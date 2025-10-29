# game/betting_views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import (
    LadderSeason, LadderRank, ScheduledBattle, 
    BattleBet, BettingStats, Player
)
from .ladder_service import LadderService
from .serializers import (
    LadderRankSerializer, ScheduledBattleSerializer, 
    BattleBetSerializer, BettingStatsSerializer
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_ladder_rankings(request):
    """獲取天梯排名"""
    try:
        season = LadderSeason.objects.filter(is_active=True).first()
        if not season:
            return Response({'error': '沒有活躍的賽季'}, status=status.HTTP_404_NOT_FOUND)
        
        # 獲取排名（前50名）
        rankings = LadderRank.objects.filter(season=season).order_by('current_rank')[:50]
        serializer = LadderRankSerializer(rankings, many=True)
        
        return Response({
            'season': {
                'id': season.id,
                'name': season.name,
                'prize_pool': season.prize_pool,
                'start_date': season.start_date,
                'end_date': season.end_date
            },
            'rankings': serializer.data
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_upcoming_battles(request):
    """獲取即將到來的戰鬥"""
    try:
        battles = LadderService.get_upcoming_battles(limit=10)
        serializer = ScheduledBattleSerializer(battles, many=True)
        
        return Response({
            'battles': serializer.data,
            'current_time': timezone.now()
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_betting_battle(request):
    """獲取當前戰鬥（可下注或即將開始的戰鬥）"""
    try:
        # 首先嘗試獲取當前可下注的戰鬥
        battle = LadderService.get_current_betting_battle()
        
        # 如果沒有可下注的戰鬥，獲取下一場即將開始的戰鬥
        if not battle:
            battle = LadderService.get_next_battle()
        
        if not battle:
            return Response({'message': '目前沒有戰鬥'}, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查用戶是否已經下注
        player = Player.objects.get(user=request.user)
        existing_bet = BattleBet.objects.filter(battle=battle, player=player).first()
        
        serializer = ScheduledBattleSerializer(battle)
        data = serializer.data
        data['user_bet'] = BattleBetSerializer(existing_bet).data if existing_bet else None
        
        # 判斷是否可以下注
        now = timezone.now()
        can_bet = (
            existing_bet is None and 
            battle.status == 'betting_open' and
            battle.betting_start_time <= now <= battle.betting_end_time
        )
        data['can_bet'] = can_bet
        
        return Response(data)
    
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def place_bet(request):
    """下注"""
    try:
        player = Player.objects.get(user=request.user)
        battle_id = request.data.get('battle_id')
        fighter_id = request.data.get('fighter_id')
        amount = int(request.data.get('amount', 0))
        
        # 驗證輸入
        if not all([battle_id, fighter_id, amount]):
            return Response({'error': '缺少必要參數'}, status=status.HTTP_400_BAD_REQUEST)
        
        if amount <= 0:
            return Response({'error': '下注金額必須大於0'}, status=status.HTTP_400_BAD_REQUEST)
        
        if amount < 10:
            return Response({'error': '最小下注金額為10金幣'}, status=status.HTTP_400_BAD_REQUEST)
        
        if amount > 10000:
            return Response({'error': '單次最大下注金額為10,000金幣'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 獲取戰鬥和選手
        battle = ScheduledBattle.objects.get(id=battle_id)
        
        if fighter_id == str(battle.fighter1.id):
            chosen_fighter = battle.fighter1
        elif fighter_id == str(battle.fighter2.id):
            chosen_fighter = battle.fighter2
        else:
            return Response({'error': '無效的選手ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 下注
        bet = LadderService.place_bet(player, battle, chosen_fighter, amount)
        serializer = BattleBetSerializer(bet)
        
        return Response({
            'message': '下注成功',
            'bet': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except ScheduledBattle.DoesNotExist:
        return Response({'error': '戰鬥不存在'}, status=status.HTTP_404_NOT_FOUND)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_bets(request):
    """獲取我的下注記錄"""
    try:
        player = Player.objects.get(user=request.user)
        
        # 獲取最近的下注記錄，包含戰鬥詳情
        bets = BattleBet.objects.filter(player=player).select_related(
            'battle', 'chosen_fighter', 'chosen_fighter__character'
        ).order_by('-created_at')[:50]
        
        bet_data = []
        for bet in bets:
            bet_info = BattleBetSerializer(bet).data
            
            # 添加戰鬥結果信息
            battle = bet.battle
            bet_info['battle_info'] = {
                'id': str(battle.id),
                'scheduled_time': battle.scheduled_time,
                'status': battle.status,
                'fighter1_name': battle.fighter1.character.name,
                'fighter2_name': battle.fighter2.character.name,
                'winner_name': battle.winner.character.name if battle.winner else None,
                'is_completed': battle.status == 'completed'
            }
            
            bet_data.append(bet_info)
        
        return Response({
            'bets': bet_data
        })
    
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_betting_stats(request):
    """獲取下注統計"""
    try:
        player = Player.objects.get(user=request.user)
        stats, created = BettingStats.objects.get_or_create(player=player)
        
        serializer = BettingStatsSerializer(stats)
        
        return Response(serializer.data)
    
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_battle_history(request):
    """獲取歷史戰鬥記錄"""
    try:
        # 獲取已完成的戰鬥
        battles = ScheduledBattle.objects.filter(
            status='completed'
        ).select_related(
            'fighter1', 'fighter1__character', 'fighter1__player__user',
            'fighter2', 'fighter2__character', 'fighter2__player__user',
            'winner', 'winner__character'
        ).order_by('-scheduled_time')[:50]
        
        battle_data = []
        for battle in battles:
            # 獲取這場戰鬥的下注統計
            total_bets = BattleBet.objects.filter(battle=battle).count()
            
            battle_info = {
                'id': str(battle.id),
                'scheduled_time': battle.scheduled_time,
                'status': battle.status,
                'fighter1': {
                    'name': battle.fighter1.character.name,
                    'image_url': battle.fighter1.character.image_url,
                    'rank': battle.fighter1.current_rank,
                    'player_name': battle.fighter1.player.user.username
                },
                'fighter2': {
                    'name': battle.fighter2.character.name,
                    'image_url': battle.fighter2.character.image_url,
                    'rank': battle.fighter2.current_rank,
                    'player_name': battle.fighter2.player.user.username
                },
                'winner': {
                    'name': battle.winner.character.name if battle.winner else None,
                    'is_fighter1': battle.winner == battle.fighter1 if battle.winner else None
                } if battle.winner else None,
                'total_bets_amount': float(battle.total_bets_amount),
                'total_bets_count': total_bets,
            }
            
            battle_data.append(battle_info)
        
        return Response({
            'battles': battle_data
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_battle_details(request, battle_id):
    """獲取戰鬥詳情"""
    try:
        battle = ScheduledBattle.objects.get(id=battle_id)
        player = Player.objects.get(user=request.user)
        
        # 獲取所有下注記錄（隱藏用戶信息）
        bets = BattleBet.objects.filter(battle=battle).select_related('player__user')
        
        # 統計信息
        fighter1_bets = bets.filter(chosen_fighter=battle.fighter1)
        fighter2_bets = bets.filter(chosen_fighter=battle.fighter2)
        
        # 用戶的下注
        user_bet = bets.filter(player=player).first()
        
        serializer = ScheduledBattleSerializer(battle)
        data = serializer.data
        
        data.update({
            'betting_stats': {
                'total_bets': bets.count(),
                'fighter1_bets_count': fighter1_bets.count(),
                'fighter2_bets_count': fighter2_bets.count(),
                'fighter1_bets_amount': float(battle.fighter1_bets_amount),
                'fighter2_bets_amount': float(battle.fighter2_bets_amount),
            },
            'user_bet': BattleBetSerializer(user_bet).data if user_bet else None,
            'recent_bets': [
                {
                    'amount': float(bet.bet_amount),
                    'chosen_fighter': bet.chosen_fighter.id,
                    'username': bet.player.user.username[:3] + '***',  # 隱藏完整用戶名
                    'created_at': bet.created_at
                }
                for bet in bets.order_by('-created_at')[:10]
            ]
        })
        
        return Response(data)
    
    except ScheduledBattle.DoesNotExist:
        return Response({'error': '戰鬥不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_ladder(request):
    """加入天梯"""
    try:
        player = Player.objects.get(user=request.user)
        character_id = request.data.get('character_id')
        
        if not character_id:
            return Response({'error': '缺少角色ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import Character
        character = Character.objects.get(id=character_id, player=player)
        
        # 移除等級限制，所有角色都能參加天梯
        
        # 獲取當前賽季
        season = LadderSeason.objects.filter(is_active=True).first()
        if not season:
            return Response({'error': '沒有活躍的賽季'}, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查是否已經加入
        existing_rank = LadderRank.objects.filter(
            season=season, 
            player=player, 
            character=character
        ).first()
        
        if existing_rank:
            return Response({'error': '此角色已經加入天梯'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 計算初始積分（移除等級限制）
        base_points = 1000
        level_bonus = character.level * 30  # 每級30分
        stat_bonus = (character.strength + character.agility + character.luck) * 2
        win_rate_bonus = 0
        
        if character.win_count + character.loss_count > 0:
            win_rate = character.win_count / (character.win_count + character.loss_count)
            win_rate_bonus = int(win_rate * 200)
        
        initial_points = base_points + level_bonus + stat_bonus + win_rate_bonus
        
        # 創建排名記錄
        rank = LadderRank.objects.create(
            season=season,
            player=player,
            character=character,
            rank_points=initial_points,
            current_rank=999999  # 臨時排名，稍後更新
        )
        
        # 更新排名
        LadderService.update_rankings(season)
        
        # 重新獲取更新後的排名
        rank.refresh_from_db()
        
        serializer = LadderRankSerializer(rank)
        
        return Response({
            'message': '成功加入天梯',
            'rank': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    except Player.DoesNotExist:
        return Response({'error': '玩家不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Character.DoesNotExist:
        return Response({'error': '角色不存在或不屬於您'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
