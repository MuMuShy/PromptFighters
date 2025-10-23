import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

class Player(models.Model):
    LOGIN_METHOD_CHOICES = [
        ('google', 'Google OAuth'),
        ('metamask', 'MetaMask'),
        ('walletconnect', 'WalletConnect'),
        ('coinbase', 'Coinbase Wallet'),
        ('email', 'Email Wallet'),
        ('phone', 'Phone Wallet'),
        ('social', 'Social Login'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    
    nickname = models.CharField(max_length=32, null=True, blank=True, unique=False, verbose_name='暱稱')
    nickname_changed = models.BooleanField(default=False, verbose_name='是否已改過暱稱')
    
    # Web3 錢包相關欄位
    wallet_address = models.CharField(max_length=42, null=True, blank=True, unique=True)
    login_method = models.CharField(max_length=20, choices=LOGIN_METHOD_CHOICES, default='google')
    chain_id = models.IntegerField(default=5000)  # Mantle 主網
    
    # thirdweb Connect 相關
    thirdweb_user_id = models.CharField(max_length=100, null=True, blank=True)
    social_provider = models.CharField(max_length=20, null=True, blank=True)  # facebook, twitter, apple 等
    
    # 遊戲資源 (根據新經濟模型調整)
    gold = models.PositiveIntegerField(default=1000, verbose_name='金幣')
    prompt = models.PositiveIntegerField(default=10, verbose_name='$PROMPT 代幣')
    prompt_power = models.PositiveIntegerField(default=5, verbose_name='Prompt Power')
    exp_potion = models.PositiveIntegerField(default=100, verbose_name='經驗藥水')
    
    energy = models.IntegerField(default=100)
    max_energy = models.IntegerField(default=100)
    last_energy_update = models.DateTimeField(default=timezone.now)
    
    def save(self, *args, **kwargs):
        if not self.nickname:
            # 取 uuid 尾 6 碼
            tail = str(self.id)[-6:]
            self.nickname = f"勇者#{tail}"
        super().save(*args, **kwargs)

    def __str__(self):
        if self.wallet_address:
            return f"{self.user.username} ({self.wallet_address[:8]}...)"
        return self.user.username
    
    def get_display_name(self):
        """取得顯示名稱"""
        if self.login_method == 'google':
            return self.user.email or self.user.username
        elif self.wallet_address:
            return f"{self.wallet_address[:6]}...{self.wallet_address[-4:]}"
        return self.user.username
    
    def update_energy(self):
        """更新體力，每10分鐘恢復1點體力"""
        if self.energy < self.max_energy:
            now = timezone.now()
            time_diff = now - self.last_energy_update
            minutes_passed = time_diff.total_seconds() / 60
            energy_to_add = int(minutes_passed / 10)
            
            if energy_to_add > 0:
                self.energy = min(self.energy + energy_to_add, self.max_energy)
                self.last_energy_update = now
                self.save()
    
    def can_afford(self, gold_cost=0, prompt_cost=0, prompt_power_cost=0, exp_potion_cost=0, energy_cost=0):
        """檢查玩家是否有足夠資源"""
        return (self.gold >= gold_cost and 
                self.prompt >= prompt_cost and 
                self.prompt_power >= prompt_power_cost and
                self.exp_potion >= exp_potion_cost and
                self.energy >= energy_cost)
    
    def spend_resources(self, gold_cost=0, prompt_cost=0, prompt_power_cost=0, exp_potion_cost=0, energy_cost=0):
        """消耗資源"""
        if self.can_afford(gold_cost, prompt_cost, prompt_power_cost, exp_potion_cost, energy_cost):
            self.gold -= gold_cost
            self.prompt -= prompt_cost
            self.prompt_power -= prompt_power_cost
            self.exp_potion -= exp_potion_cost
            self.energy -= energy_cost
            self.save()
            return True
        return False
    
class Character(models.Model):
    RARITY_CHOICES = [
        (1, 'N - Normal'),
        (2, 'R - Rare'),
        (3, 'SR - Super Rare'),
        (4, 'SSR - Super Super Rare'),
        (5, 'UR - Ultra Rare'),
    ]
    
    RARITY_NAMES = {
        1: 'N',
        2: 'R', 
        3: 'SR',
        4: 'SSR',
        5: 'UR'
    }
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='characters')
    name = models.CharField(max_length=100)
    image_url = models.URLField(blank=True, null=True)
    prompt = models.TextField()
    
    # 核心屬性
    strength = models.IntegerField()
    agility = models.IntegerField()
    luck = models.IntegerField()
    
    # 成長相關
    level = models.PositiveIntegerField(default=1, verbose_name='等級')
    experience = models.PositiveIntegerField(default=0, verbose_name='目前經驗值')
    rarity = models.IntegerField(choices=RARITY_CHOICES, default=1)

    # 統計與技能
    skill_description = models.TextField()
    win_count = models.IntegerField(default=0)
    loss_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NFT 相關欄位
    is_minted = models.BooleanField(default=False, verbose_name='是否已鑄造為 NFT')
    nft_token_id = models.PositiveIntegerField(null=True, blank=True, help_text="NFT 的 Token ID")
    nft_transaction_hash = models.CharField(max_length=255, null=True, blank=True, help_text="鑄造交易的雜湊值")

    def __str__(self):
        return f"{self.name} (Lv.{self.level})"
    
    @property
    def rarity_name(self):
        return self.RARITY_NAMES.get(self.rarity, 'N')
    
    @property
    def star_count(self):
        return self.rarity

class Battle(models.Model):
    BATTLE_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('ERROR', 'Error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    character1 = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='battles_as_char1')
    character2 = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='battles_as_char2')
    winner = models.ForeignKey(Character, on_delete=models.SET_NULL, null=True, blank=True, related_name='battles_won')
    battle_log = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=BATTLE_STATUS_CHOICES, default='PENDING')

    def __str__(self):
        return f"Battle between {self.character1.name} and {self.character2.name} at {self.created_at}"

    class Meta:
        ordering = ['-created_at']


class DailyQuest(models.Model):
    QUEST_TYPE_CHOICES = [
        ('daily_checkin', '每日簽到'),
        ('battle_count', '對戰次數'),
        ('battle_win', '對戰勝利'),
        ('character_summon', '召喚角色'),
        ('login_streak', '連續登入'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='任務名稱')
    description = models.TextField(verbose_name='任務描述')
    quest_type = models.CharField(max_length=20, choices=QUEST_TYPE_CHOICES, verbose_name='任務類型')
    target_count = models.IntegerField(default=1, verbose_name='目標數量')
    
    # 獎勵內容 (根據新經濟模型調整)
    reward_gold = models.IntegerField(default=0, verbose_name='金幣獎勵')
    reward_prompt = models.IntegerField(default=0, verbose_name='$PROMPT 代幣獎勵') 
    reward_prompt_power = models.IntegerField(default=0, verbose_name='Prompt Power獎勵')
    reward_exp_potion = models.IntegerField(default=0, verbose_name='經驗藥水獎勵')
    reward_energy = models.IntegerField(default=0, verbose_name='體力獎勵')
    
    is_active = models.BooleanField(default=True, verbose_name='是否啟用')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.get_quest_type_display()})"
    
    class Meta:
        verbose_name = '每日任務'
        verbose_name_plural = '每日任務'


class PlayerDailyQuest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='daily_quests')
    quest = models.ForeignKey(DailyQuest, on_delete=models.CASCADE)
    current_count = models.IntegerField(default=0, verbose_name='當前進度')
    is_completed = models.BooleanField(default=False, verbose_name='是否完成')
    is_claimed = models.BooleanField(default=False, verbose_name='是否領取獎勵')
    date = models.DateField(default=timezone.now, verbose_name='任務日期')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成時間')
    claimed_at = models.DateTimeField(null=True, blank=True, verbose_name='領取時間')
    
    def __str__(self):
        return f"{self.player.user.username} - {self.quest.name} ({self.date})"
    
    @property
    def progress_percentage(self):
        if self.quest.target_count == 0:
            return 100
        return min(100, (self.current_count / self.quest.target_count) * 100)
    
    def update_progress(self, increment=1):
        """更新任務進度"""
        if not self.is_completed:
            self.current_count = min(self.current_count + increment, self.quest.target_count)
            if self.current_count >= self.quest.target_count:
                self.is_completed = True
                self.completed_at = timezone.now()
            self.save()
            return True
        return False
    
    def claim_reward(self):
        """領取獎勵"""
        if self.is_completed and not self.is_claimed:
            player = self.player
            player.gold += self.quest.reward_gold
            player.prompt += self.quest.reward_prompt
            player.prompt_power += self.quest.reward_prompt_power
            player.exp_potion += self.quest.reward_exp_potion
            player.energy = min(player.max_energy, player.energy + self.quest.reward_energy)
            player.save()
            
            self.is_claimed = True
            self.claimed_at = timezone.now()
            self.save()
            return True
        return False
    
    class Meta:
        verbose_name = '玩家每日任務'
        verbose_name_plural = '玩家每日任務'
        unique_together = ['player', 'quest', 'date']


class PlayerLoginRecord(models.Model):
    """玩家登入記錄，用於追蹤連續登入"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='login_records')
    login_date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.player.user.username} - {self.login_date}"
    
    class Meta:
        verbose_name = '玩家登入記錄'
        verbose_name_plural = '玩家登入記錄'
        unique_together = ['player', 'login_date']


class LadderSeason(models.Model):
    """天梯賽季"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='賽季名稱')
    start_date = models.DateTimeField(verbose_name='開始時間')
    end_date = models.DateTimeField(verbose_name='結束時間')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    prize_pool = models.PositiveIntegerField(default=0, verbose_name='獎金池')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} ({self.start_date.strftime('%Y-%m-%d')})"
    
    class Meta:
        verbose_name = '天梯賽季'
        verbose_name_plural = '天梯賽季'


class LadderRank(models.Model):
    """天梯排名"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season = models.ForeignKey(LadderSeason, on_delete=models.CASCADE, related_name='rankings')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='ladder_ranks')
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='ladder_ranks')
    
    # 排名數據
    rank_points = models.IntegerField(default=1000, verbose_name='排名積分')
    wins = models.PositiveIntegerField(default=0, verbose_name='勝場')
    losses = models.PositiveIntegerField(default=0, verbose_name='敗場')
    current_rank = models.PositiveIntegerField(default=999999, verbose_name='當前排名')
    
    # 參戰資格
    is_eligible = models.BooleanField(default=True, verbose_name='是否有參戰資格')
    last_battle_at = models.DateTimeField(null=True, blank=True, verbose_name='最後參戰時間')
    
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    @property
    def win_rate(self):
        total = self.wins + self.losses
        return round((self.wins / total) * 100, 1) if total > 0 else 0
    
    def __str__(self):
        return f"{self.character.name} - Rank #{self.current_rank} ({self.rank_points}pts)"
    
    class Meta:
        verbose_name = '天梯排名'
        verbose_name_plural = '天梯排名'
        unique_together = ['season', 'player', 'character']
        ordering = ['current_rank']


class ScheduledBattle(models.Model):
    """定時天梯戰鬥"""
    STATUS_CHOICES = [
        ('scheduled', '已排程'),
        ('betting_open', '開放下注'),
        ('betting_closed', '下注截止'),
        ('in_progress', '戰鬥中'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    season = models.ForeignKey(LadderSeason, on_delete=models.CASCADE, related_name='battles')
    
    # 戰鬥對手
    fighter1 = models.ForeignKey(LadderRank, on_delete=models.CASCADE, related_name='battles_as_fighter1')
    fighter2 = models.ForeignKey(LadderRank, on_delete=models.CASCADE, related_name='battles_as_fighter2')
    
    # 時間安排
    scheduled_time = models.DateTimeField(verbose_name='預定戰鬥時間')
    betting_start_time = models.DateTimeField(verbose_name='下注開始時間')
    betting_end_time = models.DateTimeField(verbose_name='下注截止時間')
    
    # 戰鬥狀態
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    winner = models.ForeignKey(LadderRank, on_delete=models.SET_NULL, null=True, blank=True, 
                              related_name='won_battles', verbose_name='勝利者')
    
    # 下注統計
    total_bets_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='總下注金額')
    fighter1_bets_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='選手1下注金額')
    fighter2_bets_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='選手2下注金額')
    
    # 賠率
    fighter1_odds = models.DecimalField(max_digits=5, decimal_places=2, default=2.0, verbose_name='選手1賠率')
    fighter2_odds = models.DecimalField(max_digits=5, decimal_places=2, default=2.0, verbose_name='選手2賠率')
    
    # 戰鬥結果
    battle_log = models.JSONField(null=True, blank=True, verbose_name='戰鬥記錄')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def calculate_odds(self):
        """動態計算賠率"""
        if self.fighter1_bets_amount == 0 and self.fighter2_bets_amount == 0:
            # 沒有下注時，根據排名計算基礎賠率
            rank_diff = abs(self.fighter1.current_rank - self.fighter2.current_rank)
            if self.fighter1.current_rank < self.fighter2.current_rank:
                # fighter1排名更高（數字更小）
                self.fighter1_odds = max(1.2, 2.0 - (rank_diff * 0.1))
                self.fighter2_odds = min(5.0, 2.0 + (rank_diff * 0.1))
            else:
                self.fighter1_odds = min(5.0, 2.0 + (rank_diff * 0.1))
                self.fighter2_odds = max(1.2, 2.0 - (rank_diff * 0.1))
        else:
            # 根據下注金額動態調整賠率
            from decimal import Decimal
            total = self.fighter1_bets_amount + self.fighter2_bets_amount
            if total > 0:
                fighter1_percentage = self.fighter1_bets_amount / total
                fighter2_percentage = self.fighter2_bets_amount / total
                
                # 賠率與下注比例成反比
                self.fighter1_odds = max(Decimal('1.1'), min(Decimal('10.0'), Decimal('1.0') / max(Decimal('0.1'), fighter1_percentage)))
                self.fighter2_odds = max(Decimal('1.1'), min(Decimal('10.0'), Decimal('1.0') / max(Decimal('0.1'), fighter2_percentage)))
        
        self.save(update_fields=['fighter1_odds', 'fighter2_odds'])
    
    @property
    def time_until_battle(self):
        """距離戰鬥開始的時間"""
        return self.scheduled_time - timezone.now()
    
    @property
    def time_until_betting_ends(self):
        """距離下注截止的時間"""
        return self.betting_end_time - timezone.now()
    
    def __str__(self):
        return f"{self.fighter1.character.name} vs {self.fighter2.character.name} - {self.scheduled_time.strftime('%Y-%m-%d %H:%M')}"
    
    class Meta:
        verbose_name = '定時戰鬥'
        verbose_name_plural = '定時戰鬥'
        ordering = ['-scheduled_time']


class BattleBet(models.Model):
    """下注記錄"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    battle = models.ForeignKey(ScheduledBattle, on_delete=models.CASCADE, related_name='bets')
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='battle_bets')
    
    # 下注詳情
    chosen_fighter = models.ForeignKey(LadderRank, on_delete=models.CASCADE, verbose_name='選擇的選手')
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='下注金額')
    odds_at_bet = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='下注時賠率')
    
    # 結算
    is_winner = models.BooleanField(null=True, blank=True, verbose_name='是否獲勝')
    payout_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='獲利金額')
    is_settled = models.BooleanField(default=False, verbose_name='是否已結算')
    
    created_at = models.DateTimeField(auto_now_add=True)
    settled_at = models.DateTimeField(null=True, blank=True, verbose_name='結算時間')
    
    @property
    def potential_payout(self):
        """潛在獲利 - 基於當前賠率的估算（實際獲利將根據獎池分配）"""
        return self.bet_amount * self.odds_at_bet
    
    @property
    def estimated_pool_payout(self):
        """基於獎池機制的預估獲利"""
        if not self.battle or self.battle.total_bets_amount == 0:
            return self.bet_amount
        
        # 簡單估算：假設獲勝方和失敗方下注相等
        total_pool = float(self.battle.total_bets_amount)
        house_edge = 0.05
        estimated_prize_pool = total_pool * 0.5 * (1 - house_edge)  # 假設失敗方佔50%
        estimated_winner_pool = total_pool * 0.5  # 假設獲勝方佔50%
        
        if estimated_winner_pool > 0:
            win_share = float(self.bet_amount) / estimated_winner_pool
            prize_share = estimated_prize_pool * win_share
            return self.bet_amount + prize_share
        
        return self.bet_amount
    
    def settle_bet(self):
        """結算下注 - 注意：這個方法現在只標記結果，實際獎金分配由 settle_all_bets_with_pool 處理"""
        if self.is_settled:
            return
        
        if self.battle.winner == self.chosen_fighter:
            self.is_winner = True
            # 獎金金額將由獎池分配邏輯計算
            self.payout_amount = 0  # 暫時設為0，稍後計算
        else:
            self.is_winner = False
            self.payout_amount = 0
        
        self.is_settled = True
        self.settled_at = timezone.now()
        self.save()
    
    def __str__(self):
        return f"{self.player.user.username} bets {self.bet_amount} on {self.chosen_fighter.character.name}"
    
    class Meta:
        verbose_name = '下注記錄'
        verbose_name_plural = '下注記錄'
        unique_together = ['battle', 'player']  # 每場戰鬥每個玩家只能下注一次


class BettingStats(models.Model):
    """下注統計"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.OneToOneField(Player, on_delete=models.CASCADE, related_name='betting_stats')
    
    # 統計數據
    total_bets = models.PositiveIntegerField(default=0, verbose_name='總下注次數')
    total_bet_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='總下注金額')
    total_winnings = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='總獲利')
    win_count = models.PositiveIntegerField(default=0, verbose_name='獲勝次數')
    
    # 連勝記錄
    current_streak = models.IntegerField(default=0, verbose_name='當前連勝')
    best_streak = models.PositiveIntegerField(default=0, verbose_name='最佳連勝')
    
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def win_rate(self):
        return round((self.win_count / self.total_bets) * 100, 1) if self.total_bets > 0 else 0
    
    @property
    def net_profit(self):
        return self.total_winnings - self.total_bet_amount
    
    def __str__(self):
        return f"{self.player.user.username} - {self.win_count}/{self.total_bets} ({self.win_rate}%)"
    
    class Meta:
        verbose_name = '下注統計'
        verbose_name_plural = '下注統計'


# AI節點管理模型
class AINode(models.Model):
    """AI節點註冊與管理"""
    STATUS_CHOICES = [
        ('online', '在線'),
        ('offline', '離線'),
        ('error', '錯誤'),
        ('maintenance', '維護中'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='節點名稱')
    url = models.URLField(verbose_name='節點API地址')
    api_key = models.CharField(max_length=255, null=True, blank=True, verbose_name='API密鑰')
    
    # 節點狀態
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')
    last_heartbeat = models.DateTimeField(null=True, blank=True, verbose_name='最後心跳時間')
    
    # 效能統計
    total_requests = models.PositiveIntegerField(default=0, verbose_name='總請求數')
    successful_requests = models.PositiveIntegerField(default=0, verbose_name='成功請求數')
    avg_response_time = models.FloatField(default=0.0, verbose_name='平均響應時間(秒)')
    
    # 負載均衡權重
    weight = models.PositiveIntegerField(default=1, verbose_name='權重')
    max_concurrent_requests = models.PositiveIntegerField(default=5, verbose_name='最大並發請求數')
    current_requests = models.PositiveIntegerField(default=0, verbose_name='當前請求數')
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def is_online(self):
        """判斷節點是否在線（5分鐘內有心跳）"""
        if not self.last_heartbeat:
            return False
        return timezone.now() - self.last_heartbeat < timedelta(minutes=5)
    
    @property
    def success_rate(self):
        """成功率"""
        if self.total_requests == 0:
            return 0
        return (self.successful_requests / self.total_requests) * 100
    
    @property
    def is_available(self):
        """節點是否可用於新請求"""
        return (self.status == 'online' and 
                self.is_online and 
                self.current_requests < self.max_concurrent_requests)
    
    def update_heartbeat(self):
        """更新心跳時間"""
        self.last_heartbeat = timezone.now()
        if self.status == 'offline':
            self.status = 'online'
        self.save(update_fields=['last_heartbeat', 'status'])
    
    def record_request(self, success=True, response_time=0.0):
        """記錄請求統計"""
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        
        # 更新平均響應時間
        if self.total_requests == 1:
            self.avg_response_time = response_time
        else:
            self.avg_response_time = ((self.avg_response_time * (self.total_requests - 1)) + response_time) / self.total_requests
        
        self.save(update_fields=['total_requests', 'successful_requests', 'avg_response_time'])
    
    def __str__(self):
        return f"{self.name} ({self.status})"
    
    class Meta:
        verbose_name = 'AI節點'
        verbose_name_plural = 'AI節點'
        ordering = ['-created_at']


class BattleVotingRecord(models.Model):
    """戰鬥結果投票記錄"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    battle = models.ForeignKey(Battle, on_delete=models.CASCADE, related_name='voting_records')
    node = models.ForeignKey(AINode, on_delete=models.CASCADE, related_name='votes')
    
    # 投票結果
    voted_winner_id = models.CharField(max_length=100, verbose_name='投票的獲勝者ID')
    battle_result = models.JSONField(verbose_name='節點返回的戰鬥結果')
    response_time = models.FloatField(verbose_name='響應時間(秒)')
    
    # 狀態
    is_valid = models.BooleanField(default=True, verbose_name='投票是否有效')
    error_message = models.TextField(null=True, blank=True, verbose_name='錯誤信息')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.node.name} votes for {self.voted_winner_id} in battle {self.battle.id}"
    
    class Meta:
        verbose_name = '戰鬥投票記錄'
        verbose_name_plural = '戰鬥投票記錄'
        unique_together = ['battle', 'node']  # 每個節點每場戰鬥只能投票一次
