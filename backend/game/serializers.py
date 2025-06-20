from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Player, Character, Battle

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class PlayerSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    class Meta:
        model = Player
        fields = ['id', 'user', 'created_at', 'last_login']

class CharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = '__all__'
        read_only_fields = [
            'id', 'player', 'name', 'image_url', 'strength', 'agility', 'luck',
            'skill_description', 'win_count', 'loss_count', 'created_at'
        ]

class BattleSerializer(serializers.ModelSerializer):
    character1 = CharacterSerializer()
    character2 = CharacterSerializer()
    winner = CharacterSerializer()
    class Meta:
        model = Battle
        fields = ['id', 'character1', 'character2', 'winner', 'battle_log', 'created_at'] 