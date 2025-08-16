# game/admin_urls.py
# 天梯系统管理URL配置

from django.urls import path
from django.contrib import admin
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from .models import LadderSeason, ScheduledBattle
# 避免循環導入，在需要時才導入
# from .ladder_service import LadderService


@method_decorator(csrf_exempt, name='dispatch')
class LadderAdminView(View):
    """天梯系统管理视图"""
    
    def get(self, request):
        """显示天梯管理仪表板"""
        context = {
            'current_season': LadderSeason.objects.filter(is_active=True).first(),
            'recent_battles': ScheduledBattle.objects.all().order_by('-created_at')[:10],
            'total_seasons': LadderSeason.objects.count(),
            'total_battles': ScheduledBattle.objects.count(),
        }
        return render(request, 'admin/ladder_dashboard.html', context)
    
    def post(self, request):
        """处理管理操作"""
        action = request.POST.get('action')
        
        if action == 'schedule_battle':
            return self.schedule_battle(request)
        elif action == 'initialize_rankings':
            return self.initialize_rankings(request)
        elif action == 'complete_battle':
            return self.complete_battle(request)
        else:
            return JsonResponse({'error': '未知操作'}, status=400)
    
    def schedule_battle(self, request):
        """排程下一场战斗"""
        try:
            # 避免循環導入
            from .ladder_service import LadderService
            battle = LadderService.schedule_next_battle()
            if battle:
                return JsonResponse({
                    'success': True,
                    'message': f'已排程战斗: {battle.fighter1.character.name} vs {battle.fighter2.character.name}',
                    'battle_id': str(battle.id)
                })
            else:
                return JsonResponse({
                    'success': False,
                    'message': '无法排程战斗，请检查赛季节状态'
                })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'排程战斗失败: {str(e)}'
            }, status=500)
    
    def initialize_rankings(self, request):
        """初始化赛季节排名"""
        try:
            season = LadderSeason.objects.filter(is_active=True).first()
            if not season:
                return JsonResponse({
                    'success': False,
                    'message': '没有活跃的赛季节'
                })
            
            # 避免循環導入
            from .ladder_service import LadderService
            LadderService.initialize_season_rankings(season)
            return JsonResponse({
                'success': True,
                'message': f'赛季节 "{season.name}" 排名已初始化'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'初始化排名失败: {str(e)}'
            }, status=500)
    
    def complete_battle(self, request):
        """完成战斗"""
        battle_id = request.POST.get('battle_id')
        winner_id = request.POST.get('winner_id')
        
        try:
            battle = ScheduledBattle.objects.get(id=battle_id)
            if battle.status != 'in_progress':
                return JsonResponse({
                    'success': False,
                    'message': '战斗状态不正确'
                })
            
            # 设置胜利者
            if winner_id == str(battle.fighter1.id):
                battle.winner = battle.fighter1
            elif winner_id == str(battle.fighter2.id):
                battle.winner = battle.fighter2
            else:
                return JsonResponse({
                    'success': False,
                    'message': '无效的胜利者ID'
                })
            
            # 完成战斗
            battle.status = 'completed'
            battle.save()
            
            # 结算战斗
            LadderService.complete_battle(battle, None)  # 这里需要传入实际的战斗记录
            
            return JsonResponse({
                'success': True,
                'message': f'战斗已完成，胜利者: {battle.winner.character.name}'
            })
        except ScheduledBattle.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': '战斗不存在'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'完成战斗失败: {str(e)}'
            }, status=500)


def battle_complete_view(request, battle_id):
    """战斗完成页面"""
    try:
        battle = ScheduledBattle.objects.get(id=battle_id)
        if battle.status != 'in_progress':
            messages.error(request, '战斗状态不正确，无法完成')
            return redirect('admin:game_scheduledbattle_changelist')
        
        if request.method == 'POST':
            winner_id = request.POST.get('winner')
            if winner_id == str(battle.fighter1.id):
                battle.winner = battle.fighter1
            elif winner_id == str(battle.fighter2.id):
                battle.winner = battle.fighter2
            
            battle.status = 'completed'
            battle.save()
            
            # 这里需要实现完整的战斗结算逻辑
            messages.success(request, f'战斗已完成，胜利者: {battle.winner.character.name}')
            return redirect('admin:game_scheduledbattle_changelist')
        
        context = {
            'battle': battle,
            'title': '完成战斗',
            'opts': ScheduledBattle._meta,
        }
        return render(request, 'admin/battle_complete.html', context)
        
    except ScheduledBattle.DoesNotExist:
        messages.error(request, '战斗不存在')
        return redirect('admin:game_scheduledbattle_changelist')


def ladder_stats_view(request):
    """天梯统计页面"""
    current_season = LadderSeason.objects.filter(is_active=True).first()
    
    if current_season:
        # 获取排名统计
        rankings = current_season.rankings.all().order_by('current_rank')
        total_players = rankings.count()
        
        # 获取战斗统计
        battles = current_season.battles.all()
        total_battles = battles.count()
        completed_battles = battles.filter(status='completed').count()
        
        # 获取下注统计
        total_bets = sum(battle.total_bets_amount for battle in battles)
        
        # 获取积分分布
        point_ranges = {
            '0-500': rankings.filter(rank_points__lte=500).count(),
            '501-1000': rankings.filter(rank_points__gt=500, rank_points__lte=1000).count(),
            '1001-1500': rankings.filter(rank_points__gt=1000, rank_points__lte=1500).count(),
            '1501-2000': rankings.filter(rank_points__gt=1500, rank_points__lte=2000).count(),
            '2000+': rankings.filter(rank_points__gt=2000).count(),
        }
        
        context = {
            'current_season': current_season,
            'total_players': total_players,
            'total_battles': total_battles,
            'completed_battles': completed_battles,
            'total_bets': total_bets,
            'point_ranges': point_ranges,
            'top_rankings': rankings[:20],
            'recent_battles': battles.order_by('-created_at')[:10],
        }
    else:
        context = {'current_season': None}
    
    return render(request, 'admin/ladder_stats.html', context)


# URL配置
urlpatterns = [
    path('ladder/', LadderAdminView.as_view(), name='ladder_dashboard'),
    path('ladder/stats/', ladder_stats_view, name='ladder_stats'),
    path('battle/<uuid:battle_id>/complete/', battle_complete_view, name='battle_complete'),
]
