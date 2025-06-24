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
        fields = ['id', 'user', 'created_at', 'last_login', 'gold', 'diamond', 'prompt_power', 'energy', 'max_energy']

class CharacterSerializer(serializers.ModelSerializer):
    win_rate = serializers.SerializerMethodField()
    player_name = serializers.CharField(source='player.user.username', read_only=True)
    prompt = serializers.CharField(write_only=True, required=True, max_length=100)

    class Meta:
        model = Character
        fields = '__all__'
        read_only_fields = [
            'id', 'player', 'name', 'image_url', 'strength', 'agility', 'luck',
            'skill_description', 'win_count', 'loss_count', 'created_at'
        ]
    
    def get_win_rate(self, obj):
        total_battles = obj.win_count + obj.loss_count
        if total_battles == 0:
            return 0
        return round((obj.win_count / total_battles) * 100)

class BattleSerializer(serializers.ModelSerializer):
    character1 = CharacterSerializer(read_only=True)
    character2 = CharacterSerializer(read_only=True)
    winner = CharacterSerializer(read_only=True)
    
    class Meta:
        model = Battle
        fields = '__all__' 