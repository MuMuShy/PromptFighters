import logging
from datetime import date, timedelta
from django.utils import timezone
from django.db import transaction
from .models import Player, DailyQuest, PlayerDailyQuest, PlayerLoginRecord

logger = logging.getLogger(__name__)


class DailyQuestService:
    """每日任務管理服務"""
    
    @staticmethod
    def create_default_quests():
        """創建預設的每日任務"""
        default_quests = [
            {
                'name': '每日簽到',
                'description': '完成每日簽到，獲得豐厚獎勵！',
                'quest_type': 'daily_checkin',
                'target_count': 1,
                'reward_gold': 0,
                'reward_diamond': 10,
                'reward_prompt_power': 10,
                'reward_energy': 0,
            },
            {
                'name': '參與對戰',
                'description': '參與 3 場對戰，鍛鍊你的英雄！',
                'quest_type': 'battle_count',
                'target_count': 3,
                'reward_gold': 500,
                'reward_diamond': 0,
                'reward_prompt_power': 2,
                'reward_energy': 10,
            },
            {
                'name': '獲得勝利',
                'description': '在對戰中獲得 1 次勝利！',
                'quest_type': 'battle_win',
                'target_count': 1,
                'reward_gold': 1000,
                'reward_diamond': 2,
                'reward_prompt_power': 3,
                'reward_energy': 0,
            },
            {
                'name': '召喚英雄',
                'description': '召喚 2 個新英雄加入你的隊伍！',
                'quest_type': 'character_summon',
                'target_count': 2,
                'reward_gold': 0,
                'reward_diamond': 5,
                'reward_prompt_power': 5,
                'reward_energy': 20,
            },
        ]
        
        for quest_data in default_quests:
            quest, created = DailyQuest.objects.get_or_create(
                quest_type=quest_data['quest_type'],
                defaults=quest_data
            )
            if created:
                logger.info(f"Created default quest: {quest.name}")
    
    @staticmethod
    def reset_daily_quests_for_player(player: Player, target_date: date = None):
        """為玩家重置每日任務"""
        if target_date is None:
            target_date = timezone.now().date()
        
        active_quests = DailyQuest.objects.filter(is_active=True)
        
        for quest in active_quests:
            player_quest, created = PlayerDailyQuest.objects.get_or_create(
                player=player,
                quest=quest,
                date=target_date,
                defaults={
                    'current_count': 0,
                    'is_completed': False,
                    'is_claimed': False,
                }
            )
            
            if created:
                logger.info(f"Created daily quest for {player.user.username}: {quest.name}")
    
    @staticmethod
    def reset_all_daily_quests():
        """重置所有玩家的每日任務（可用於定時任務）"""
        today = timezone.now().date()
        players = Player.objects.all()
        
        for player in players:
            DailyQuestService.reset_daily_quests_for_player(player, today)
    
    @staticmethod
    def get_player_daily_quests(player: Player, target_date: date = None):
        """獲取玩家當日的任務列表"""
        if target_date is None:
            target_date = timezone.now().date()
        
        # 確保玩家有當日的任務
        DailyQuestService.reset_daily_quests_for_player(player, target_date)
        
        return PlayerDailyQuest.objects.filter(
            player=player,
            date=target_date
        ).select_related('quest').order_by('quest__quest_type')
    
    @staticmethod
    def record_player_login(player: Player):
        """記錄玩家登入"""
        today = timezone.now().date()
        login_record, created = PlayerLoginRecord.objects.get_or_create(
            player=player,
            login_date=today
        )
        
        if created:
            logger.info(f"Recorded login for {player.user.username} on {today}")
            
            # 更新每日簽到任務
            DailyQuestService.update_quest_progress(
                player, 'daily_checkin', 1
            )
        
        return login_record
    
    @staticmethod
    def update_quest_progress(player: Player, quest_type: str, increment: int = 1):
        """更新玩家任務進度"""
        today = timezone.now().date()
        
        try:
            player_quest = PlayerDailyQuest.objects.get(
                player=player,
                quest__quest_type=quest_type,
                date=today
            )
            
            if player_quest.update_progress(increment):
                logger.info(f"Updated {quest_type} progress for {player.user.username}: {player_quest.current_count}/{player_quest.quest.target_count}")
                return player_quest
        except PlayerDailyQuest.DoesNotExist:
            logger.warning(f"No {quest_type} quest found for {player.user.username} on {today}")
        
        return None
    
    @staticmethod
    def claim_quest_reward(player: Player, quest_id: str):
        """領取任務獎勵"""
        today = timezone.now().date()
        
        try:
            player_quest = PlayerDailyQuest.objects.get(
                id=quest_id,
                player=player,
                date=today
            )
            
            if player_quest.claim_reward():
                logger.info(f"Player {player.user.username} claimed reward for quest: {player_quest.quest.name}")
                return {
                    'success': True,
                    'quest': player_quest,
                    'rewards': {
                        'gold': player_quest.quest.reward_gold,
                        'diamond': player_quest.quest.reward_diamond,
                        'prompt_power': player_quest.quest.reward_prompt_power,
                        'energy': player_quest.quest.reward_energy,
                    }
                }
            else:
                return {'success': False, 'error': 'Quest not completed or reward already claimed'}
                
        except PlayerDailyQuest.DoesNotExist:
            return {'success': False, 'error': 'Quest not found'}
    
    @staticmethod
    def get_login_streak(player: Player):
        """獲取玩家連續登入天數"""
        today = timezone.now().date()
        streak = 0
        current_date = today
        
        while True:
            if PlayerLoginRecord.objects.filter(player=player, login_date=current_date).exists():
                streak += 1
                current_date -= timedelta(days=1)
            else:
                break
        
        return streak
    
    @staticmethod
    def get_daily_stats(player: Player):
        """獲取玩家每日統計"""
        today = timezone.now().date()
        quests = DailyQuestService.get_player_daily_quests(player, today)
        
        total_quests = quests.count()
        completed_quests = quests.filter(is_completed=True).count()
        claimed_rewards = quests.filter(is_claimed=True).count()
        
        return {
            'total_quests': total_quests,
            'completed_quests': completed_quests,
            'claimed_rewards': claimed_rewards,
            'completion_rate': (completed_quests / total_quests * 100) if total_quests > 0 else 0,
            'login_streak': DailyQuestService.get_login_streak(player),
            'quests': quests
        }