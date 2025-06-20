import uuid
from django.db import models
from django.contrib.auth.models import User

class Player(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.user.username

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

    def __str__(self):
        return self.name

class Battle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    character1 = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='battles_as_char1')
    character2 = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='battles_as_char2')
    winner = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='battles_won')
    battle_log = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.character1} vs {self.character2}"

    class Meta:
        ordering = ['-created_at']
