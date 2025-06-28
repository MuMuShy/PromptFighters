import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

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
