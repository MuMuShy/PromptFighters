# game/ladder_service.py
import random
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from .models import (
    LadderSeason, LadderRank, ScheduledBattle, 
    BattleBet, BettingStats, Character, Player
)
from django.db import models
# 避免循環導入，在需要時才導入
# from .tasks import run_battle_task


class LadderService:
    """天梯系統服務"""
    
    @staticmethod
    def create_season(name: str, start_date: datetime, end_date: datetime, prize_pool: int = 100000):
        """創建新賽季"""
        season = LadderSeason.objects.create(
            name=name,
            start_date=start_date,
            end_date=end_date,
            prize_pool=prize_pool
        )
        
        # 自動為現有角色創建天梯排名
        LadderService.initialize_season_rankings(season)
        return season
    
    @staticmethod
    def initialize_season_rankings(season: LadderSeason):
        """初始化賽季排名"""
        # 獲取所有角色（移除等級限制）
        eligible_characters = Character.objects.all().select_related('player')
        
        # 檢查是否已經有排名數據
        existing_rankings = LadderRank.objects.filter(season=season).count()
        if existing_rankings > 0:
            print(f"賽季 {season.name} 已有 {existing_rankings} 個排名記錄，跳過初始化")
            return
        
        print(f"開始初始化賽季 {season.name} 的排名，共 {eligible_characters.count()} 個角色")
        
        rankings = []
        for i, character in enumerate(eligible_characters):
            # 基於角色實力計算初始積分
            base_points = 1000
            level_bonus = character.level * 30  # 每級30分
            stat_bonus = (character.strength + character.agility + character.luck) * 2
            rarity_bonus = character.rarity * 100  # 稀有度獎勵
            win_rate_bonus = 0
            
            if character.win_count + character.loss_count > 0:
                win_rate = character.win_count / (character.win_count + character.loss_count)
                win_rate_bonus = int(win_rate * 200)
            
            initial_points = base_points + level_bonus + stat_bonus + rarity_bonus + win_rate_bonus
            
            ranking = LadderRank(
                season=season,
                player=character.player,
                character=character,
                rank_points=initial_points,
                current_rank=i + 1,
                wins=0,
                losses=0,
                is_eligible=True  # 預設所有角色都有參戰資格
            )
            rankings.append(ranking)
        
        # 批量創建排名
        if rankings:
            LadderRank.objects.bulk_create(rankings)
            print(f"成功創建 {len(rankings)} 個排名記錄")
            
            # 重新排序
            LadderService.update_rankings(season)
            print(f"賽季 {season.name} 排名初始化完成")
        else:
            print("沒有找到可用的角色")
    
    @staticmethod
    def update_rankings(season: LadderSeason):
        """更新排名"""
        rankings = LadderRank.objects.filter(season=season).order_by('-rank_points')
        
        for i, ranking in enumerate(rankings):
            ranking.current_rank = i + 1
        
        LadderRank.objects.bulk_update(rankings, ['current_rank'])
    
    @staticmethod
    def schedule_next_battle():
        """排程下一場戰鬥"""
        current_season = LadderSeason.objects.filter(is_active=True).first()
        if not current_season:
            return None
        
        # 開發模式：每5分鐘一場戰鬥
        now = timezone.now()
        next_battle_time = now + timedelta(minutes=5)
        next_battle_time = next_battle_time.replace(second=0, microsecond=0)
        
        # 檢查是否已經有排程的戰鬥
        existing_battle = ScheduledBattle.objects.filter(
            season=current_season,
            scheduled_time=next_battle_time
        ).first()
        
        if existing_battle:
            return existing_battle
        
        # 選擇戰鬥對手
        fighter1, fighter2 = LadderService.select_fighters(current_season)
        if not fighter1 or not fighter2:
            return None
        
        # 創建戰鬥（開發模式：提前2分鐘開放下注，提前30秒截止）
        battle = ScheduledBattle.objects.create(
            season=current_season,
            fighter1=fighter1,
            fighter2=fighter2,
            scheduled_time=next_battle_time,
            betting_start_time=next_battle_time - timedelta(minutes=2),  # 提前2分鐘開放下注
            betting_end_time=next_battle_time - timedelta(seconds=30),   # 戰鬥前30秒截止下注
            status='scheduled'
        )
        
        # 計算初始賠率
        battle.calculate_odds()
        
        return battle
    
    @staticmethod
    def select_fighters(season: LadderSeason):
        """選擇戰鬥對手"""
        # 獲取有資格的排名（前50名或有參戰資格的）
        eligible_rankings = LadderRank.objects.filter(
            season=season,
            is_eligible=True,
            current_rank__lte=50
        ).order_by('current_rank')[:20]  # 取前20名
        
        if len(eligible_rankings) < 2:
            return None, None
        
        # 智能匹配算法
        rankings_list = list(eligible_rankings)
        
        # 優先選擇排名接近的對手
        for i in range(len(rankings_list) - 1):
            fighter1 = rankings_list[i]
            
            # 尋找合適的對手（排名相近）
            for j in range(i + 1, min(i + 6, len(rankings_list))):  # 最多考慮後5名
                fighter2 = rankings_list[j]
                
                # 檢查最近是否已經對戰過
                recent_battles = ScheduledBattle.objects.filter(
                    season=season,
                    created_at__gte=timezone.now() - timedelta(days=7)
                ).filter(
                    Q(fighter1=fighter1, fighter2=fighter2) |
                    Q(fighter1=fighter2, fighter2=fighter1)
                )
                
                if not recent_battles.exists():
                    return fighter1, fighter2
        
        # 如果找不到合適的對手，隨機選擇
        return random.sample(rankings_list, 2)
    
    @staticmethod
    def start_battle(battle: ScheduledBattle):
        """開始戰鬥"""
        if battle.status != 'betting_closed':
            return False
        
        battle.status = 'in_progress'
        battle.save()
        
        # 創建實際的戰鬥記錄
        from .models import Battle
        actual_battle = Battle.objects.create(
            character1=battle.fighter1.character,
            character2=battle.fighter2.character,
            status='PENDING'
        )
        
        # 觸發戰鬥任務（避免循環導入）
        try:
            from .tasks import run_battle_task
            run_battle_task.delay(actual_battle.id)
        except ImportError:
            print("無法導入戰鬥任務，跳過任務觸發")
        
        return actual_battle
    
    @staticmethod
    def complete_battle(battle: ScheduledBattle, actual_battle):
        """完成戰鬥並結算"""
        with transaction.atomic():
            # 更新戰鬥狀態
            battle.status = 'completed'
            battle.battle_log = actual_battle.battle_log
            
            # 確定勝利者
            if actual_battle.winner == battle.fighter1.character:
                battle.winner = battle.fighter1
                winner_rank = battle.fighter1
                loser_rank = battle.fighter2
            else:
                battle.winner = battle.fighter2
                winner_rank = battle.fighter2
                loser_rank = battle.fighter1
            
            battle.save()
            
            # 更新排名積分
            LadderService.update_rank_points(winner_rank, loser_rank)
            
            # 結算所有下注
            LadderService.settle_all_bets(battle)
            
            # 更新排名
            LadderService.update_rankings(battle.season)
    
    @staticmethod
    def update_rank_points(winner: LadderRank, loser: LadderRank):
        """更新排名積分（ELO系統）"""
        # ELO計算
        K = 32  # K因子
        
        # 計算期望勝率
        rating_diff = loser.rank_points - winner.rank_points
        expected_winner = 1 / (1 + 10 ** (rating_diff / 400))
        expected_loser = 1 - expected_winner
        
        # 更新積分
        winner_new_points = winner.rank_points + K * (1 - expected_winner)
        loser_new_points = loser.rank_points + K * (0 - expected_loser)
        
        # 確保積分不低於0
        winner.rank_points = max(0, int(winner_new_points))
        loser.rank_points = max(0, int(loser_new_points))
        
        # 更新戰績
        winner.wins += 1
        loser.losses += 1
        
        # 更新最後參戰時間
        winner.last_battle_at = timezone.now()
        loser.last_battle_at = timezone.now()
        
        winner.save()
        loser.save()
    
    @staticmethod
    def settle_all_bets(battle: ScheduledBattle):
        """結算所有下注 - 使用正確的獎池分配邏輯"""
        from decimal import Decimal
        
        bets = BattleBet.objects.filter(battle=battle, is_settled=False)
        if not bets.exists():
            return
        
        # 先標記所有下注的勝負
        for bet in bets:
            bet.settle_bet()  # 只標記勝負，不發放獎金
        
        # 計算獎池分配
        winning_bets = bets.filter(is_winner=True)
        losing_bets = bets.filter(is_winner=False)
        
        # 獲勝者的總下注金額
        total_winning_amount = sum(bet.bet_amount for bet in winning_bets)
        # 失敗者的總下注金額（這就是要分配的獎池）
        total_losing_amount = sum(bet.bet_amount for bet in losing_bets)
        
        # 系統抽成（5%）
        house_edge = Decimal('0.05')
        system_cut = total_losing_amount * house_edge
        prize_pool = total_losing_amount - system_cut
        
        print(f"戰鬥 {battle.id} 獎池結算:")
        print(f"  獲勝者總下注: {total_winning_amount}")
        print(f"  失敗者總下注: {total_losing_amount}")
        print(f"  系統抽成 (5%): {system_cut}")
        print(f"  可分配獎池: {prize_pool}")
        
        # 分配獎池給獲勝者
        if winning_bets.exists() and total_winning_amount > 0:
            for bet in winning_bets:
                # 按比例分配獎池
                win_share = (Decimal(str(bet.bet_amount)) / Decimal(str(total_winning_amount)))
                prize_share = prize_pool * win_share
                
                # 獲勝者得到：本金 + 獎池分成
                total_payout = Decimal(str(bet.bet_amount)) + prize_share
                bet.payout_amount = total_payout
                
                # 發放獎金
                bet.player.gold += int(total_payout)
                bet.player.save()
                bet.save()
                
                print(f"  玩家 {bet.player.user.username}: 本金 {bet.bet_amount} + 獎池分成 {prize_share:.2f} = 總獎金 {total_payout:.2f}")
        else:
            # 沒有獲勝者的情況（理論上不應該發生）
            print("  沒有獲勝者，所有下注金額歸系統")
        
        # 更新玩家下注統計
        for bet in bets:
            stats, created = BettingStats.objects.get_or_create(player=bet.player)
            
            stats.total_bets += 1
            stats.total_bet_amount += bet.bet_amount
            
            if bet.is_winner:
                stats.win_count += 1
                stats.total_winnings += bet.payout_amount
                stats.current_streak += 1
                stats.best_streak = max(stats.best_streak, stats.current_streak)
            else:
                stats.current_streak = 0
            
            stats.save()
        
        print(f"戰鬥 {battle.id} 獎池結算完成")
        print("-" * 50)
    
    @staticmethod
    def get_upcoming_battles(limit=5):
        """獲取即將到來的戰鬥"""
        return ScheduledBattle.objects.filter(
            scheduled_time__gt=timezone.now(),
            status__in=['scheduled', 'betting_open', 'betting_closed']
        ).order_by('scheduled_time')[:limit]
    
    @staticmethod
    def get_current_betting_battle():
        """獲取當前可下注的戰鬥"""
        now = timezone.now()
        return ScheduledBattle.objects.filter(
            betting_start_time__lte=now,
            betting_end_time__gt=now,
            status='betting_open'
        ).first()
    
    @staticmethod
    def get_next_battle():
        """獲取下一場即將開始的戰鬥"""
        now = timezone.now()
        return ScheduledBattle.objects.filter(
            scheduled_time__gt=now,
            status__in=['scheduled', 'betting_open', 'betting_closed']
        ).order_by('scheduled_time').first()
    
    @staticmethod
    def sync_season_rankings(season: LadderSeason):
        """同步賽季排名，添加新角色並更新現有排名"""
        print(f"開始同步賽季 {season.name} 的排名")
        
        # 獲取所有角色
        all_characters = Character.objects.all().select_related('player')
        
        # 獲取現有排名
        existing_rankings = LadderRank.objects.filter(season=season)
        existing_character_ids = set(existing_rankings.values_list('character_id', flat=True))
        
        # 找出新角色
        new_characters = [char for char in all_characters if char.id not in existing_character_ids]
        
        if new_characters:
            print(f"發現 {len(new_characters)} 個新角色，正在添加到天梯系統")
            
            new_rankings = []
            for character in new_characters:
                # 計算初始積分
                base_points = 1000
                level_bonus = character.level * 30
                stat_bonus = (character.strength + character.agility + character.luck) * 2
                rarity_bonus = character.rarity * 100
                win_rate_bonus = 0
                
                if character.win_count + character.loss_count > 0:
                    win_rate = character.win_count / (character.win_count + character.loss_count)
                    win_rate_bonus = int(win_rate * 200)
                
                initial_points = base_points + level_bonus + stat_bonus + rarity_bonus + win_rate_bonus
                
                # 新角色排名設為最後
                max_rank_result = existing_rankings.aggregate(models.Max('current_rank'))
                max_rank = max_rank_result['current_rank__max'] if max_rank_result['current_rank__max'] is not None else 0
                new_rank = max_rank + 1
                
                ranking = LadderRank(
                    season=season,
                    player=character.player,
                    character=character,
                    rank_points=initial_points,
                    current_rank=new_rank,
                    wins=0,
                    losses=0,
                    is_eligible=True
                )
                new_rankings.append(ranking)
            
            # 批量創建新排名
            if new_rankings:
                LadderRank.objects.bulk_create(new_rankings)
                print(f"成功添加 {len(new_rankings)} 個新角色到天梯系統")
        
        # 更新所有排名
        LadderService.update_rankings(season)
        print(f"賽季 {season.name} 排名同步完成，總共 {LadderRank.objects.filter(season=season).count()} 個排名")
    
    @staticmethod
    def sync_all_active_seasons():
        """同步所有活躍賽季的排名"""
        active_seasons = LadderSeason.objects.filter(is_active=True)
        for season in active_seasons:
            LadderService.sync_season_rankings(season)
    
    @staticmethod
    def place_bet(player: Player, battle: ScheduledBattle, chosen_fighter: LadderRank, amount: int):
        """下注"""
        # 檢查下注是否開放
        now = timezone.now()
        if not (battle.betting_start_time <= now <= battle.betting_end_time):
            raise ValueError("下注時間已過或尚未開始")
        
        if battle.status != 'betting_open':
            raise ValueError("此戰鬥不接受下注")
        
        # 檢查玩家是否有足夠金幣
        if player.gold < amount:
            raise ValueError("金幣不足")
        
        # 檢查是否已經下注過
        existing_bet = BattleBet.objects.filter(battle=battle, player=player).first()
        if existing_bet:
            raise ValueError("您已經對此戰鬥下注")
        
        # 獲取當前賠率
        if chosen_fighter == battle.fighter1:
            current_odds = battle.fighter1_odds
        else:
            current_odds = battle.fighter2_odds
        
        # 扣除金幣
        player.gold -= amount
        player.save()
        
        # 創建下注記錄
        bet = BattleBet.objects.create(
            battle=battle,
            player=player,
            chosen_fighter=chosen_fighter,
            bet_amount=amount,
            odds_at_bet=current_odds
        )
        
        # 更新戰鬥下注統計
        if chosen_fighter == battle.fighter1:
            battle.fighter1_bets_amount += amount
        else:
            battle.fighter2_bets_amount += amount
        
        battle.total_bets_amount += amount
        battle.save()
        
        # 重新計算賠率
        battle.calculate_odds()
        
        return bet
