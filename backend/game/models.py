import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    
    # 遊戲資源
    gold = models.IntegerField(default=1000)
    diamond = models.IntegerField(default=10)
    prompt_power = models.IntegerField(default=5)
    energy = models.IntegerField(default=100)
    max_energy = models.IntegerField(default=100)
    last_energy_update = models.DateTimeField(default=timezone.now)

    def __str__(self):
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
    
    def can_afford(self, gold_cost=0, diamond_cost=0, prompt_power_cost=0, energy_cost=0):
        """檢查玩家是否有足夠資源"""
        return (self.gold >= gold_cost and 
                self.diamond >= diamond_cost and 
                self.prompt_power >= prompt_power_cost and 
                self.energy >= energy_cost)
    
    def spend_resources(self, gold_cost=0, diamond_cost=0, prompt_power_cost=0, energy_cost=0):
        """消耗資源"""
        if self.can_afford(gold_cost, diamond_cost, prompt_power_cost, energy_cost):
            self.gold -= gold_cost
            self.diamond -= diamond_cost
            self.prompt_power -= prompt_power_cost
            self.energy -= energy_cost
            self.save()
            return True
        return False

class Character(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='characters')
    name = models.CharField(max_length=100)
    image_url = models.URLField(blank=True, null=True)
    prompt = models.TextField()
    strength = models.IntegerField()
    agility = models.IntegerField()
    luck = models.IntegerField()
    skill_description = models.TextField()
    win_count = models.IntegerField(default=0)
    loss_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    rarity = models.IntegerField(default=1)

    def __str__(self):
        return self.name

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
