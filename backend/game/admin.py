from django.contrib import admin
from .models import Player, Character, Battle, DailyQuest, PlayerDailyQuest, PlayerLoginRecord


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ['user', 'wallet_address', 'login_method', 'gold', 'prompt', 'prompt_power', 'energy', 'created_at']
    list_filter = ['login_method', 'created_at']
    search_fields = ['user__username', 'user__email', 'wallet_address']
    readonly_fields = ['id', 'created_at']


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ['name', 'player', 'rarity', 'rarity_name', 'strength', 'agility', 'luck', 'win_count', 'loss_count', 'created_at']
    list_filter = ['rarity', 'created_at']
    search_fields = ['name', 'player__user__username']
    readonly_fields = ['id', 'created_at', 'rarity_name', 'star_count']


@admin.register(Battle)
class BattleAdmin(admin.ModelAdmin):
    list_display = ['character1', 'character2', 'winner', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['character1__name', 'character2__name']
    readonly_fields = ['id', 'created_at']


@admin.register(DailyQuest)
class DailyQuestAdmin(admin.ModelAdmin):
    list_display = ['name', 'quest_type', 'target_count', 'reward_summary', 'is_active', 'created_at']
    list_filter = ['quest_type', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('任務基本資訊', {
            'fields': ('name', 'description', 'quest_type', 'target_count', 'is_active')
        }),
        ('獎勵設定', {
            'fields': ('reward_gold', 'reward_prompt', 'reward_prompt_power', 'reward_exp_potion', 'reward_energy'),
            'classes': ('collapse',)
        }),
        ('系統資訊', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def reward_summary(self, obj):
        rewards = []
        if obj.reward_gold > 0:
            rewards.append(f"金幣{obj.reward_gold}")
        if obj.reward_prompt > 0:
            rewards.append(f"$PROMPT{obj.reward_prompt}")
        if obj.reward_prompt_power > 0:
            rewards.append(f"Prompt Power{obj.reward_prompt_power}")
        if obj.reward_exp_potion > 0:
            rewards.append(f"經驗藥水{obj.reward_exp_potion}")
        if obj.reward_energy > 0:
            rewards.append(f"體力{obj.reward_energy}")
        return " | ".join(rewards) if rewards else "無獎勵"
    reward_summary.short_description = '獎勵內容'


@admin.register(PlayerDailyQuest)
class PlayerDailyQuestAdmin(admin.ModelAdmin):
    list_display = ['player', 'quest_name', 'date', 'progress_display', 'is_completed', 'is_claimed', 'completed_at']
    list_filter = ['date', 'is_completed', 'is_claimed', 'quest__quest_type']
    search_fields = ['player__user__username', 'quest__name']
    readonly_fields = ['id', 'progress_percentage', 'completed_at', 'claimed_at']
    
    def quest_name(self, obj):
        return obj.quest.name
    quest_name.short_description = '任務名稱'
    
    def progress_display(self, obj):
        return f"{obj.current_count}/{obj.quest.target_count} ({obj.progress_percentage:.1f}%)"
    progress_display.short_description = '進度'


@admin.register(PlayerLoginRecord)
class PlayerLoginRecordAdmin(admin.ModelAdmin):
    list_display = ['player', 'login_date', 'created_at']
    list_filter = ['login_date', 'created_at']
    search_fields = ['player__user__username']
    readonly_fields = ['id', 'created_at']


# 自定義管理後台標題
admin.site.site_header = "AI Hero Battle 管理後台"
admin.site.site_title = "AI Hero Battle"
admin.site.index_title = "遊戲管理"
