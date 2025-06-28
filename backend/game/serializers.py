from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Player, Character, Battle, DailyQuest, PlayerDailyQuest, PlayerLoginRecord

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class PlayerSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    
    class Meta:
        model = Player
        fields = ['id', 'user', 'created_at', 'last_login', 'gold', 'prompt', 'prompt_power', 'exp_potion', 'energy', 'max_energy', 'wallet_address','nickname','nickname_changed']

class CharacterSerializer(serializers.ModelSerializer):
    win_rate = serializers.SerializerMethodField()
    player_display_name = serializers.SerializerMethodField()
    player_name = serializers.CharField(source='player.user.username', read_only=True)
    prompt = serializers.CharField(write_only=True, required=True, max_length=100)
    rarity_name = serializers.CharField(read_only=True)
    star_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Character
        fields = '__all__'
        read_only_fields = [
            'id', 'player', 'name', 'image_url', 'strength', 'agility', 'luck',
            'skill_description', 'win_count', 'loss_count', 'created_at', 'rarity'
        ]
    
    def get_win_rate(self, obj):
        total_battles = obj.win_count + obj.loss_count
        if total_battles == 0:
            return 0
        return round((obj.win_count / total_battles) * 100)

    def get_player_display_name(self, obj):
        tail = str(obj.player.id)[-4:]
        if obj.player.nickname:
            return f"{obj.player.nickname}#{tail}"
        else:
            return f"player#{tail}"

class BattleSerializer(serializers.ModelSerializer):
    character1 = CharacterSerializer(read_only=True)
    character2 = CharacterSerializer(read_only=True)
    winner = CharacterSerializer(read_only=True)
    
    class Meta:
        model = Battle
        fields = '__all__'


class DailyQuestSerializer(serializers.ModelSerializer):
    quest_type_display = serializers.CharField(source='get_quest_type_display', read_only=True)
    
    class Meta:
        model = DailyQuest
        fields = [
            'id', 'name', 'description', 'quest_type', 'quest_type_display',
            'target_count', 'reward_gold', 'reward_prompt', 'reward_prompt_power', 
            'reward_exp_potion', 'reward_energy', 'is_active'
        ]


class PlayerDailyQuestSerializer(serializers.ModelSerializer):
    quest = DailyQuestSerializer(read_only=True)
    progress_percentage = serializers.ReadOnlyField()
    
    class Meta:
        model = PlayerDailyQuest
        fields = [
            'id', 'quest', 'current_count', 'is_completed', 'is_claimed',
            'date', 'completed_at', 'claimed_at', 'progress_percentage'
        ]


class DailyStatsSerializer(serializers.Serializer):
    total_quests = serializers.IntegerField()
    completed_quests = serializers.IntegerField()
    claimed_rewards = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    login_streak = serializers.IntegerField()
    quests = PlayerDailyQuestSerializer(many=True)


class ClaimRewardSerializer(serializers.Serializer):
    quest_id = serializers.UUIDField() 