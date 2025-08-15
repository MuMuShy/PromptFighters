from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Player, Character, Battle, DailyQuest, PlayerDailyQuest, PlayerLoginRecord,
    LadderSeason, LadderRank, ScheduledBattle, BattleBet, BettingStats
)

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


# 天梯系統序列化器

class LadderSeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LadderSeason
        fields = ['id', 'name', 'start_date', 'end_date', 'is_active', 'prize_pool', 'created_at']


class LadderRankSerializer(serializers.ModelSerializer):
    player = PlayerSerializer()
    character = CharacterSerializer()
    win_rate = serializers.ReadOnlyField()
    
    class Meta:
        model = LadderRank
        fields = [
            'id', 'player', 'character', 'rank_points', 'wins', 'losses', 
            'current_rank', 'win_rate', 'is_eligible', 'last_battle_at', 
            'updated_at', 'created_at'
        ]


class ScheduledBattleSerializer(serializers.ModelSerializer):
    fighter1 = LadderRankSerializer()
    fighter2 = LadderRankSerializer()
    winner = LadderRankSerializer(allow_null=True)
    time_until_battle = serializers.ReadOnlyField()
    time_until_betting_ends = serializers.ReadOnlyField()
    
    class Meta:
        model = ScheduledBattle
        fields = [
            'id', 'fighter1', 'fighter2', 'scheduled_time', 'betting_start_time', 
            'betting_end_time', 'status', 'winner', 'total_bets_amount', 
            'fighter1_bets_amount', 'fighter2_bets_amount', 'fighter1_odds', 
            'fighter2_odds', 'battle_log', 'time_until_battle', 'time_until_betting_ends',
            'created_at', 'updated_at'
        ]


class BattleBetSerializer(serializers.ModelSerializer):
    player = PlayerSerializer()
    chosen_fighter = LadderRankSerializer()
    battle = serializers.StringRelatedField()
    potential_payout = serializers.ReadOnlyField()
    
    class Meta:
        model = BattleBet
        fields = [
            'id', 'battle', 'player', 'chosen_fighter', 'bet_amount', 
            'odds_at_bet', 'potential_payout', 'is_winner', 'payout_amount', 
            'is_settled', 'created_at', 'settled_at'
        ]


class BettingStatsSerializer(serializers.ModelSerializer):
    player = PlayerSerializer()
    win_rate = serializers.ReadOnlyField()
    net_profit = serializers.ReadOnlyField()
    
    class Meta:
        model = BettingStats
        fields = [
            'id', 'player', 'total_bets', 'total_bet_amount', 'total_winnings', 
            'win_count', 'win_rate', 'net_profit', 'current_streak', 'best_streak', 
            'updated_at'
        ] 