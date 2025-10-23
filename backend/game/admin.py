from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from django.contrib import messages
from django.db import transaction
from django.http import HttpResponseRedirect
from .models import (
    Player, Character, Battle, DailyQuest, PlayerDailyQuest, PlayerLoginRecord,
    LadderSeason, LadderRank, ScheduledBattle, BattleBet, BettingStats,
    AINode, BattleVotingRecord
)
from .ladder_service import LadderService
from django.shortcuts import redirect
from .node_service import NodeHealthChecker
import asyncio


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


# ==================== 天梯系統管理 ====================

@admin.register(LadderSeason)
class LadderSeasonAdmin(admin.ModelAdmin):
    """天梯赛季节管理"""
    list_display = [
        'name', 'start_date', 'end_date', 'is_active', 'prize_pool', 
        'player_count', 'battle_count', 'status_display', 'actions_display'
    ]
    list_filter = ['is_active', 'start_date', 'end_date']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'player_count', 'battle_count']
    actions = ['activate_season', 'deactivate_season', 'initialize_rankings', 'sync_rankings', 'duplicate_season']
    
    fieldsets = (
        ('赛季节基本信息', {
            'fields': ('name', 'start_date', 'end_date', 'is_active', 'prize_pool')
        }),
        ('统计信息', {
            'fields': ('player_count', 'battle_count'),
            'classes': ('collapse',)
        }),
        ('系统信息', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def player_count(self, obj):
        return obj.rankings.count()
    player_count.short_description = '参与玩家数'
    
    def battle_count(self, obj):
        return obj.battles.count()
    battle_count.short_description = '战斗场数'
    
    def status_display(self, obj):
        if obj.is_active:
            if timezone.now() < obj.start_date:
                return format_html('<span style="color: orange;">即将开始</span>')
            elif obj.start_date <= timezone.now() <= obj.end_date:
                return format_html('<span style="color: green;">进行中</span>')
            else:
                return format_html('<span style="color: red;">已结束</span>')
        else:
            return format_html('<span style="color: gray;">未激活</span>')
    status_display.short_description = '状态'
    
    def actions_display(self, obj):
        """显示操作按钮"""
        buttons = []
        
        if obj.is_active:
            buttons.append(f'<a href="{reverse("admin:game_ladderseason_change", args=[obj.id])}" class="button">编辑</a>')
            if obj.rankings.count() == 0:
                buttons.append(f'<a href="#" onclick="initializeRankings({obj.id})" class="button">初始化排名</a>')
        else:
            buttons.append(f'<a href="#" onclick="activateSeason({obj.id})" class="button">激活</a>')
        
        return format_html(' '.join(buttons))
    actions_display.short_description = '操作'
    
    def activate_season(self, request, queryset):
        """激活选中的赛季节"""
        for season in queryset:
            # 停用其他赛季节
            LadderSeason.objects.exclude(id=season.id).update(is_active=False)
            # 激活当前赛季节
            season.is_active = True
            season.save()
            messages.success(request, f'赛季节 "{season.name}" 已激活')
    activate_season.short_description = '激活选中的赛季节'
    
    def deactivate_season(self, request, queryset):
        """停用选中的赛季节"""
        queryset.update(is_active=False)
        messages.success(request, f'已停用 {queryset.count()} 个赛季节')
    deactivate_season.short_description = '停用选中的赛季节'
    
    def initialize_rankings(self, request, queryset):
        """初始化賽季節排名"""
        for season in queryset:
            try:
                LadderService.initialize_season_rankings(season)
                messages.success(request, f'賽季節 "{season.name}" 排名已初始化')
            except Exception as e:
                messages.error(request, f'初始化賽季節 "{season.name}" 排名失敗: {str(e)}')
    initialize_rankings.short_description = '初始化賽季節排名'
    
    def sync_rankings(self, request, queryset):
        """同步賽季節排名，添加新角色"""
        for season in queryset:
            try:
                LadderService.sync_season_rankings(season)
                messages.success(request, f'賽季節 "{season.name}" 排名已同步')
            except Exception as e:
                messages.error(request, f'同步賽季節 "{season.name}" 排名失敗: {str(e)}')
    sync_rankings.short_description = '同步排名（添加新角色）'
    
    def duplicate_season(self, request, queryset):
        """複製賽季節"""
        for season in queryset:
            new_season = LadderSeason.objects.create(
                name=f"{season.name} (副本)",
                start_date=season.start_date + timezone.timedelta(days=30),
                end_date=season.end_date + timezone.timedelta(days=30),
                prize_pool=season.prize_pool,
                is_active=False
            )
            messages.success(request, f'已複製賽季節 "{season.name}" 為 "{new_season.name}"')
    duplicate_season.short_description = '複製賽季節'


@admin.register(LadderRank)
class LadderRankAdmin(admin.ModelAdmin):
    """天梯排名管理"""
    list_display = [
        'character_name', 'player_username', 'season_name', 'current_rank', 
        'rank_points', 'wins', 'losses', 'win_rate', 'is_eligible', 'last_battle'
    ]
    list_filter = ['season__is_active', 'is_eligible', 'current_rank', 'created_at']
    search_fields = ['character__name', 'player__user__username', 'season__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'win_rate']
    actions = ['toggle_eligibility', 'reset_rank_points', 'adjust_points']
    
    fieldsets = (
        ('排名信息', {
            'fields': ('season', 'player', 'character', 'current_rank', 'rank_points')
        }),
        ('战绩统计', {
            'fields': ('wins', 'losses', 'win_rate', 'last_battle_at')
        }),
        ('参战设置', {
            'fields': ('is_eligible',)
        }),
        ('系统信息', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def character_name(self, obj):
        return obj.character.name
    character_name.short_description = '角色名称'
    
    def player_username(self, obj):
        return obj.player.user.username
    player_username.short_description = '玩家'
    
    def season_name(self, obj):
        return obj.season.name
    season_name.short_description = '赛季节'
    
    def win_rate(self, obj):
        return f"{obj.win_rate}%"
    win_rate.short_description = '胜率'
    
    def last_battle(self, obj):
        if obj.last_battle_at:
            return obj.last_battle_at.strftime('%m-%d %H:%M')
        return '无'
    last_battle.short_description = '最后参战'
    
    def toggle_eligibility(self, request, queryset):
        """切换参战资格"""
        for rank in queryset:
            rank.is_eligible = not rank.is_eligible
            rank.save()
        messages.success(request, f'已更新 {queryset.count()} 个排名的参战资格')
    toggle_eligibility.short_description = '切换参战资格'
    
    def reset_rank_points(self, request, queryset):
        """重置排名积分"""
        for rank in queryset:
            rank.rank_points = 1000
            rank.current_rank = 999999
            rank.wins = 0
            rank.losses = 0
            rank.save()
        messages.success(request, f'已重置 {queryset.count()} 个排名的积分')
    reset_rank_points.short_description = '重置积分'
    
    def adjust_points(self, request, queryset):
        """调整积分"""
        # 这里可以实现积分调整的逻辑
        messages.info(request, '积分调整功能需要额外实现')
    adjust_points.short_description = '调整积分'


@admin.register(ScheduledBattle)
class ScheduledBattleAdmin(admin.ModelAdmin):
    """定时天梯战斗管理"""
    list_display = [
        'battle_info', 'season_name', 'scheduled_time', 'status', 
        'total_bets', 'odds_display', 'winner_info', 'actions_display'
    ]
    list_filter = ['status', 'season__is_active', 'scheduled_time', 'created_at']
    search_fields = ['fighter1__character__name', 'fighter2__character__name', 'season__name']
    readonly_fields = ['id', 'created_at', 'updated_at', 'total_bets', 'odds_display']
    actions = ['start_battle', 'complete_battle', 'cancel_battle', 'recalculate_odds', 'manual_settle']
    
    fieldsets = (
        ('战斗信息', {
            'fields': ('season', 'fighter1', 'fighter2', 'status', 'winner')
        }),
        ('时间安排', {
            'fields': ('scheduled_time', 'betting_start_time', 'betting_end_time')
        }),
        ('下注统计', {
            'fields': ('total_bets_amount', 'fighter1_bets_amount', 'fighter2_bets_amount'),
            'classes': ('collapse',)
        }),
        ('赔率设置', {
            'fields': ('fighter1_odds', 'fighter2_odds'),
            'classes': ('collapse',)
        }),
        ('战斗结果', {
            'fields': ('battle_log',),
            'classes': ('collapse',)
        }),
        ('系统信息', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def battle_info(self, obj):
        return f"{obj.fighter1.character.name} vs {obj.fighter2.character.name}"
    battle_info.short_description = '战斗'
    
    def season_name(self, obj):
        return obj.season.name
    season_name.short_description = '赛季节'
    
    def total_bets(self, obj):
        return f"{obj.total_bets_amount} ({obj.bets.count()}笔)"
    total_bets.short_description = '下注总额'
    
    def odds_display(self, obj):
        return f"{obj.fighter1_odds} / {obj.fighter2_odds}"
    odds_display.short_description = '赔率'
    
    def winner_info(self, obj):
        if obj.winner:
            return format_html('<span style="color: green;">{}</span>', obj.winner.character.name)
        return '未决出'
    winner_info.short_description = '胜利者'
    
    def actions_display(self, obj):
        """显示操作按钮"""
        buttons = []
        
        if obj.status == 'betting_closed':
            buttons.append(f'<a href="#" onclick="startBattle({obj.id})" class="button">开始战斗</a>')
        elif obj.status == 'in_progress':
            buttons.append(f'<a href="#" onclick="completeBattle({obj.id})" class="button">完成战斗</a>')
        
        if obj.status in ['scheduled', 'betting_open']:
            buttons.append(f'<a href="#" onclick="cancelBattle({obj.id})" class="button">取消战斗</a>')
        
        return format_html(' '.join(buttons))
    actions_display.short_description = '操作'
    
    def start_battle(self, request, queryset):
        """开始战斗"""
        success_count = 0
        for battle in queryset:
            if battle.status == 'betting_closed':
                try:
                    actual_battle = LadderService.start_battle(battle)
                    if actual_battle:
                        success_count += 1
                        messages.success(request, f'战斗 {battle.id} 已开始')
                    else:
                        messages.error(request, f'战斗 {battle.id} 开始失败')
                except Exception as e:
                    messages.error(request, f'战斗 {battle.id} 开始失败: {str(e)}')
            else:
                messages.warning(request, f'战斗 {battle.id} 状态不正确，无法开始')
        
        if success_count > 0:
            messages.success(request, f'成功开始 {success_count} 场战斗')
    start_battle.short_description = '开始选中的战斗'
    
    def complete_battle(self, request, queryset):
        """完成战斗"""
        if queryset.count() == 1:
            battle = queryset.first()
            if battle.status == 'in_progress':
                # 重定向到战斗结果输入页面
                return redirect(f'/admin/game/scheduledbattle/{battle.id}/complete/')
            else:
                messages.warning(request, f'战斗 {battle.id} 状态不正确，无法完成')
        else:
            messages.warning(request, '请选择一个战斗进行完成操作')
    complete_battle.short_description = '完成选中的战斗'
    
    def cancel_battle(self, request, queryset):
        """取消战斗"""
        queryset.update(status='cancelled')
        messages.success(request, f'已取消 {queryset.count()} 场战斗')
    cancel_battle.short_description = '取消选中的战斗'
    
    def recalculate_odds(self, request, queryset):
        """重新计算赔率"""
        for battle in queryset:
            battle.calculate_odds()
        messages.success(request, f'已重新计算 {queryset.count()} 场战斗的赔率')
    recalculate_odds.short_description = '重新计算赔率'
    
    def manual_settle(self, request, queryset):
        """手动结算战斗"""
        for battle in queryset:
            if battle.status == 'in_progress' and battle.winner:
                try:
                    # 这里需要实现手动结算逻辑
                    messages.info(request, f'战斗 {battle.id} 需要手动结算')
                except Exception as e:
                    messages.error(request, f'结算战斗 {battle.id} 失败: {str(e)}')
            else:
                messages.warning(request, f'战斗 {battle.id} 无法结算')
    manual_settle.short_description = '手动结算战斗'


@admin.register(BattleBet)
class BattleBetAdmin(admin.ModelAdmin):
    """下注记录管理"""
    list_display = [
        'player_username', 'battle_info', 'chosen_fighter', 'bet_amount', 
        'odds_at_bet', 'status', 'payout_amount', 'created_at'
    ]
    list_filter = ['is_settled', 'is_winner', 'created_at']
    search_fields = ['player__user__username', 'battle__fighter1__character__name', 'battle__fighter2__character__name']
    readonly_fields = ['id', 'created_at', 'settled_at', 'potential_payout', 'estimated_pool_payout']
    actions = ['settle_bets', 'void_bets', 'export_bets']
    
    fieldsets = (
        ('下注信息', {
            'fields': ('battle', 'player', 'chosen_fighter', 'bet_amount', 'odds_at_bet')
        }),
        ('结算信息', {
            'fields': ('is_winner', 'payout_amount', 'is_settled', 'settled_at')
        }),
        ('预估获利', {
            'fields': ('potential_payout', 'estimated_pool_payout'),
            'classes': ('collapse',)
        }),
        ('系统信息', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def player_username(self, obj):
        return obj.player.user.username
    player_username.short_description = '玩家'
    
    def battle_info(self, obj):
        return f"{obj.battle.fighter1.character.name} vs {obj.battle.fighter2.character.name}"
    battle_info.short_description = '战斗'
    
    def status(self, obj):
        if obj.is_settled:
            if obj.is_winner:
                return format_html('<span style="color: green;">获胜</span>')
            else:
                return format_html('<span style="color: red;">失败</span>')
        else:
            return format_html('<span style="color: orange;">未结算</span>')
    status.short_description = '状态'
    
    def settle_bets(self, request, queryset):
        """结算下注"""
        unsettled_bets = queryset.filter(is_settled=False)
        if unsettled_bets.exists():
            messages.warning(request, '请先完成战斗，系统会自动结算下注')
        else:
            messages.info(request, '所有选中的下注都已结算')
    settle_bets.short_description = '结算选中的下注'
    
    def void_bets(self, request, queryset):
        """作废下注"""
        # 这里可以实现作废下注的逻辑
        messages.info(request, '作废下注功能需要额外实现')
    void_bets.short_description = '作废选中的下注'
    
    def export_bets(self, request, queryset):
        """导出下注记录"""
        # 这里可以实现导出功能
        messages.info(request, '导出功能需要额外实现')
    export_bets.short_description = '导出下注记录'


@admin.register(BettingStats)
class BettingStatsAdmin(admin.ModelAdmin):
    """下注统计管理"""
    list_display = [
        'player_username', 'total_bets', 'total_bet_amount', 'total_winnings', 
        'win_count', 'win_rate', 'net_profit', 'best_streak'
    ]
    list_filter = ['updated_at']
    search_fields = ['player__user__username']
    readonly_fields = ['id', 'updated_at', 'win_rate', 'net_profit']
    actions = ['reset_stats', 'export_stats']
    
    fieldsets = (
        ('玩家信息', {
            'fields': ('player',)
        }),
        ('下注统计', {
            'fields': ('total_bets', 'total_bet_amount', 'total_winnings', 'win_count', 'win_rate')
        }),
        ('连胜记录', {
            'fields': ('current_streak', 'best_streak')
        }),
        ('盈亏分析', {
            'fields': ('net_profit',),
            'classes': ('collapse',)
        }),
        ('系统信息', {
            'fields': ('id', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def player_username(self, obj):
        return obj.player.user.username
    player_username.short_description = '玩家'
    
    def win_rate(self, obj):
        return f"{obj.win_rate}%"
    win_rate.short_description = '胜率'
    
    def net_profit(self, obj):
        if obj.net_profit > 0:
            return format_html('<span style="color: green;">+{}</span>', obj.net_profit)
        elif obj.net_profit < 0:
            return format_html('<span style="color: red;">{}</span>', obj.net_profit)
        else:
            return format_html('<span style="color: gray;">0</span>')
    net_profit.short_description = '净利润'
    
    def reset_stats(self, request, queryset):
        """重置统计"""
        for stats in queryset:
            stats.total_bets = 0
            stats.total_bet_amount = 0
            stats.total_winnings = 0
            stats.win_count = 0
            stats.current_streak = 0
            stats.best_streak = 0
            stats.save()
        messages.success(request, f'已重置 {queryset.count()} 个玩家的下注统计')
    reset_stats.short_description = '重置统计'
    
    def export_stats(self, request, queryset):
        """导出统计"""
        # 这里可以实现导出功能
        messages.info(request, '导出功能需要额外实现')
    export_stats.short_description = '导出统计'


# 自定义管理后台标题
admin.site.site_header = "AI Hero Battle 管理后台"
admin.site.site_title = "AI Hero Battle"
admin.site.index_title = "游戏管理"

# 添加天梯系統快速連結
admin.site.index_template = 'admin/index.html'


@admin.register(AINode)
class AINodeAdmin(admin.ModelAdmin):
    """AI節點管理"""
    list_display = [
        'name', 'url', 'status', 'is_online_display', 'is_available_display',
        'success_rate_display', 'avg_response_time', 'current_load',
        'last_heartbeat', 'actions_display'
    ]
    list_filter = ['status', 'last_heartbeat', 'weight']
    search_fields = ['name', 'url']
    readonly_fields = [
        'id', 'created_at', 'updated_at', 'last_heartbeat', 
        'total_requests', 'successful_requests', 'avg_response_time',
        'is_online_display', 'success_rate_display'
    ]
    actions = ['health_check_nodes', 'reset_stats', 'set_maintenance', 'set_online']
    
    fieldsets = (
        ('節點基本信息', {
            'fields': ('name', 'url', 'api_key', 'status')
        }),
        ('負載均衡設定', {
            'fields': ('weight', 'max_concurrent_requests', 'current_requests')
        }),
        ('性能統計', {
            'fields': ('total_requests', 'successful_requests', 'avg_response_time', 'success_rate_display'),
            'classes': ('collapse',)
        }),
        ('狀態監控', {
            'fields': ('last_heartbeat', 'is_online_display'),
            'classes': ('collapse',)
        }),
        ('系統信息', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_online_display(self, obj):
        # 檢查數據庫狀態和實際心跳狀態
        db_status = obj.status
        heartbeat_online = obj.is_online
        
        if db_status == 'online' and heartbeat_online:
            return format_html('<span style="color: green;">●</span> 在線')
        elif db_status == 'online' and not heartbeat_online:
            return format_html('<span style="color: orange;">●</span> 心跳超時')
        elif db_status == 'offline':
            return format_html('<span style="color: red;">●</span> 離線')
        elif db_status == 'maintenance':
            return format_html('<span style="color: gray;">●</span> 維護中')
        elif db_status == 'error':
            return format_html('<span style="color: purple;">●</span> 錯誤')
        else:
            return format_html('<span style="color: black;">●</span> 未知')
    is_online_display.short_description = '實時狀態'
    
    def is_available_display(self, obj):
        if obj.is_available:
            return format_html('<span style="color: green;">可用</span>')
        else:
            return format_html('<span style="color: orange;">不可用</span>')
    is_available_display.short_description = '可用狀態'
    
    def success_rate_display(self, obj):
        rate = obj.success_rate
        if rate >= 95:
            color = 'green'
        elif rate >= 80:
            color = 'orange'
        else:
            color = 'red'
        return format_html('<span style="color: {};">{}</span>', color, f"{rate:.1f}%")
    success_rate_display.short_description = '成功率'
    
    def current_load(self, obj):
        percentage = (obj.current_requests / obj.max_concurrent_requests) * 100 if obj.max_concurrent_requests > 0 else 0
        return f"{obj.current_requests}/{obj.max_concurrent_requests} ({percentage:.0f}%)"
    current_load.short_description = '當前負載'
    
    def actions_display(self, obj):
        """顯示操作按鈕"""
        buttons = []
        
        if obj.status == 'online':
            buttons.append(f'<a href="#" class="button" onclick="setMaintenance({obj.id})" title="設為維護">維護</a>')
        elif obj.status == 'maintenance':
            buttons.append(f'<a href="#" class="button" onclick="setOnline({obj.id})" title="設為在線">上線</a>')
        
        buttons.append(f'<a href="#" class="button" onclick="healthCheck({obj.id})" title="健康檢查">檢查</a>')
        
        from django.utils.safestring import mark_safe
        return mark_safe(' '.join(buttons))
    actions_display.short_description = '操作'
    
    def health_check_nodes(self, request, queryset):
        """健康檢查選中的節點"""
        try:
            # 使用asyncio運行異步健康檢查
            total_checked = 0
            online_count = 0
            
            for node in queryset:
                total_checked += 1
                # 這裡應該調用實際的健康檢查邏輯
                try:
                    is_healthy = asyncio.run(NodeHealthChecker.check_node_health(node))
                    if is_healthy:
                        online_count += 1
                except Exception as e:
                    messages.warning(request, f'節點 {node.name} 健康檢查失敗: {str(e)}')
            
            messages.success(request, f'健康檢查完成: {online_count}/{total_checked} 節點在線')
            
        except Exception as e:
            messages.error(request, f'健康檢查失敗: {str(e)}')
    health_check_nodes.short_description = '健康檢查選中節點'
    
    def reset_stats(self, request, queryset):
        """重置統計數據"""
        for node in queryset:
            node.total_requests = 0
            node.successful_requests = 0
            node.avg_response_time = 0.0
            node.save()
        
        messages.success(request, f'已重置 {queryset.count()} 個節點的統計數據')
    reset_stats.short_description = '重置統計數據'
    
    def set_maintenance(self, request, queryset):
        """設為維護狀態"""
        queryset.update(status='maintenance')
        messages.success(request, f'已將 {queryset.count()} 個節點設為維護狀態')
    set_maintenance.short_description = '設為維護狀態'
    
    def set_online(self, request, queryset):
        """設為在線狀態"""
        queryset.update(status='online')
        messages.success(request, f'已將 {queryset.count()} 個節點設為在線狀態')
    set_online.short_description = '設為在線狀態'


@admin.register(BattleVotingRecord)
class BattleVotingRecordAdmin(admin.ModelAdmin):
    """戰鬥投票記錄管理"""
    list_display = [
        'battle_info', 'node_name', 'voted_winner_id', 
        'is_valid', 'response_time', 'created_at'
    ]
    list_filter = ['is_valid', 'node__status', 'created_at']
    search_fields = ['battle__id', 'node__name', 'voted_winner_id']
    readonly_fields = [
        'id', 'battle', 'node', 'voted_winner_id', 'battle_result',
        'response_time', 'is_valid', 'error_message', 'created_at'
    ]
    
    fieldsets = (
        ('投票信息', {
            'fields': ('battle', 'node', 'voted_winner_id', 'is_valid')
        }),
        ('結果數據', {
            'fields': ('battle_result',),
            'classes': ('collapse',)
        }),
        ('性能數據', {
            'fields': ('response_time', 'error_message'),
            'classes': ('collapse',)
        }),
        ('系統信息', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def battle_info(self, obj):
        return f"戰鬥 {obj.battle.id}"
    battle_info.short_description = '戰鬥'
    
    def node_name(self, obj):
        status_color = {
            'online': 'green',
            'offline': 'red',
            'error': 'orange',
            'maintenance': 'gray'
        }.get(obj.node.status, 'black')
        
        return format_html(
            '<span style="color: {};">{}</span>', 
            status_color, 
            obj.node.name
        )
    node_name.short_description = '節點'
