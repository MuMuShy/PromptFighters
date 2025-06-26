from django.shortcuts import render
import random
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Player, Character, Battle, DailyQuest, PlayerDailyQuest
from .serializers import PlayerSerializer, CharacterSerializer, BattleSerializer, DailyStatsSerializer, ClaimRewardSerializer
from .daily_quest_service import DailyQuestService
from django.shortcuts import get_object_or_404
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.decorators import throttle_classes
# from google import genai #不再需要
import os
import json
from .tasks import generate_character_image, run_battle_task
from rest_framework.permissions import AllowAny
# from rest_framework import status # status 已被 import
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
# import openai #不再需要
from django.conf import settings
from django.db import models
from django.db.models import F, ExpressionWrapper, FloatField
import re
from django.http import JsonResponse

# 匯入新的服務
from .services import CharacterService

# --- Web3 錢包登入驗證 ---
from django.core.cache import cache
from django.utils import timezone
from eth_account.messages import encode_defunct
from eth_account import Account
import secrets

# Create your views here.

class CharacterDetailView(generics.RetrieveAPIView):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Character.objects.filter(player=self.request.user.player)

class PlayerProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        player_id = request.GET.get('player_id')
        if player_id:
            # 僅允許查詢公開資訊
            player = get_object_or_404(Player, id=player_id)
            player_data = {
                "nickname": player.nickname,
                "display_name": player.get_display_name(),
            }
            characters = Character.objects.filter(player=player)
            char_data = CharacterSerializer(characters, many=True).data
            return Response({"player": player_data, "characters": char_data, "is_view_mode": True})
        else:
            # 自己看自己，回傳完整資訊
            player = request.user.player
            player.update_energy()
            player_data = PlayerSerializer(player).data
            characters = Character.objects.filter(player=player)
            char_data = CharacterSerializer(characters, many=True).data
            return Response({"player": player_data, "characters": char_data, "is_view_mode": False})

    def patch(self, request):
        player = request.user.player
        nickname = request.data.get('nickname')
        if nickname is not None:
            if not player.nickname_changed:
                player.nickname = nickname
                player.nickname_changed = True
                player.save()
                return Response({'success': True, 'nickname': player.nickname, 'free_change': False})
            else:
                return Response({'success': False, 'error': '只能免費修改一次暱稱'}, status=400)
        return Response({'success': False, 'error': 'No nickname provided'}, status=400)

class BattleCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        char1_id = request.data.get('character1')
        char2_id = request.data.get('character2')
        char1 = get_object_or_404(Character, id=char1_id)
        char2 = get_object_or_404(Character, id=char2_id)
        # 簡單對戰邏輯
        score1 = char1.strength + char1.agility + char1.luck + random.randint(0, 20)
        score2 = char2.strength + char2.agility + char2.luck + random.randint(0, 20)
        if score1 >= score2:
            winner = char1
            char1.win_count += 1
            char2.loss_count += 1
        else:
            winner = char2
            char2.win_count += 1
            char1.loss_count += 1
        char1.save()
        char2.save()
        battle_log = {
            "char1": char1.name,
            "char2": char2.name,
            "score1": score1,
            "score2": score2,
            "winner": winner.name
        }
        battle = Battle.objects.create(character1=char1, character2=char2, winner=winner, battle_log=battle_log)
        return Response(BattleSerializer(battle).data, status=status.HTTP_201_CREATED)

class BattleHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, player_id):
        player = get_object_or_404(Player, id=player_id)
        characters = Character.objects.filter(player=player)
        battles = Battle.objects.filter(
            models.Q(character1__in=characters) | 
            models.Q(character2__in=characters)
        ).distinct().order_by('-created_at')
        
        # 序列化戰鬥記錄，直接返回 battle_log
        battle_logs = [battle.battle_log for battle in battles]
        return Response(battle_logs)

class SocialLoginView(APIView):
    authentication_classes = []  # 不需要任何認證
    permission_classes = [permissions.AllowAny]  # 允許所有請求

    def post(self, request):
        provider = request.data.get('provider')
        id_token = request.data.get('id_token')
        if provider == 'google':
            # 驗證 Google id_token
            google_resp = requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}'
            )
            if google_resp.status_code != 200:
                return Response({'error': 'Invalid Google token'}, status=400)
            info = google_resp.json()
            email = info['email']
            name = info.get('name', email)
            
            User = get_user_model()
            # 首先嘗試用 email 查找現有用戶
            user = User.objects.filter(email=email).first()
            if not user:
                # 創建新用戶
                user = User.objects.create(
                    username=email,
                    email=email,
                    first_name=name.split(' ')[0] if ' ' in name else name
                )
            
            # 確保有 Player 並填入正確資料
            player, player_created = Player.objects.get_or_create(
                user=user,
                defaults={
                    'login_method': 'google',
                    'social_provider': 'google'
                }
            )
            
            # 如果 Player 已存在但登入方式不是 google，更新為 google
            if not player_created and player.login_method != 'google':
                player.login_method = 'google'
                player.social_provider = 'google'
                player.save()
            
            # 更新最後登入時間
            player.last_login = timezone.now()
            player.save()
            
            # 產生 JWT
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'player_id': player.id,
                'username': user.username,
                'email': user.email
            })
        return Response({'error': 'Unsupported provider'}, status=400)

class BattleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    提供戰鬥結果的查詢功能。
    只讀，不允許創建、修改、刪除。
    """
    queryset = Battle.objects.all()
    serializer_class = BattleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        確保使用者只能查詢與自己角色相關的戰鬥。
        """
        user_characters = Character.objects.filter(player=self.request.user.player)
        return Battle.objects.filter(
            models.Q(character1__in=user_characters) | models.Q(character2__in=user_characters)
        ).distinct()

class CharacterViewSet(viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Character.objects.filter(player=self.request.user.player)

    def perform_create(self, serializer):
        """
        將角色創建邏輯委託給 CharacterService。
        視圖層只負責傳遞參數和處理 HTTP 回應。
        """
        prompt = serializer.validated_data['prompt']
        service = CharacterService()
        try:
            character = service.create_character(
                player=self.request.user.player,
                name=prompt,
                prompt=prompt
            )
            serializer.instance = character
        except ValueError as e:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(str(e))

    @action(detail=True, methods=['get'])
    def battles(self, request, pk=None):
        """獲取指定角色的戰鬥歷史"""
        character = self.get_object()
        battles = Battle.objects.filter(
            models.Q(character1=character) | models.Q(character2=character)
        ).distinct().order_by('-created_at')
        serializer = BattleSerializer(battles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def random(self, request):
        """獲取隨機對手"""
        # 排除當前用戶的角色
        opponents = Character.objects.exclude(player=request.user.player)
        if not opponents.exists():
            return Response(
                {"error": "No opponents available"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        opponent = random.choice(opponents)
        serializer = self.get_serializer(opponent)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def battle(self, request):
        """
        異步啟動一場戰鬥。
        """
        player_id = request.data.get('player_character')
        opponent_id = request.data.get('opponent_character')

        try:
            player = Character.objects.get(id=player_id, player=request.user.player)
            opponent = Character.objects.get(id=opponent_id)
        except Character.DoesNotExist:
            return Response(
                {"error": "Character not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 1. 立即創建一個 PENDING 狀態的 Battle 實例
        battle = Battle.objects.create(
            character1=player,
            character2=opponent,
            status='PENDING'
        )

        # 2. 觸發背景任務
        run_battle_task.delay(battle.id)
        
        # 3. 更新對戰任務進度
        DailyQuestService.update_quest_progress(
            request.user.player, 'battle_count', 1
        )

        # 4. 立即返回 battle_id，讓前端可以開始輪詢
        return Response(
            {"battle_id": battle.id, "status": battle.status},
            status=status.HTTP_202_ACCEPTED
        )

    @action(detail=False, methods=['post'])
    def advanced_summon(self, request):
        """
        高級召喚：消耗5鑽石+3 Prompt Power，根據機率獲得SR/SSR/UR角色。
        """
        prompt = request.data.get('prompt')
        name = request.data.get('name')
        if not prompt:
            return Response({'error': 'Prompt is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({'error': 'Name is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        service = CharacterService()
        try:
            character = service.create_advanced_character(
                player=request.user.player,
                name=name,
                prompt=prompt
            )
            return Response(CharacterSerializer(character).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class LeaderboardView(generics.ListAPIView):
    """
    提供基於勝率的角色排行榜。
    - 只包含至少戰鬥過一次的角色。
    - 按勝率降序排序，勝率相同則按勝場數降序。
    - 最多返回前 100 名。
    """
    serializer_class = CharacterSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Annotate the queryset with the total number of battles first
        queryset = Character.objects.annotate(
            total_battles=F('win_count') + F('loss_count')
        )

        # Now filter based on the annotated field
        queryset = queryset.filter(total_battles__gt=0)

        # Annotate with the win rate
        queryset = queryset.annotate(
            win_rate_calculated=ExpressionWrapper(
                (F('win_count') * 100.0) / F('total_battles'),
                output_field=FloatField()
            )
        )

        # Order by the calculated win rate and win count
        return queryset.order_by('-win_rate_calculated', '-win_count')[:100]

class PlayerResourceView(APIView):
    """獲取當前玩家的資源狀態"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        player = request.user.player
        # 更新體力
        player.update_energy()
        return Response({
            'gold': player.gold,
            'diamond': player.diamond,
            'prompt_power': player.prompt_power,
            'energy': player.energy,
            'max_energy': player.max_energy
        })

class SpendResourceView(APIView):
    """消耗玩家資源"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        player = request.user.player
        # 更新體力
        player.update_energy()
        
        gold_cost = request.data.get('gold_cost', 0)
        diamond_cost = request.data.get('diamond_cost', 0)
        prompt_power_cost = request.data.get('prompt_power_cost', 0)
        energy_cost = request.data.get('energy_cost', 0)
        
        if player.spend_resources(gold_cost, diamond_cost, prompt_power_cost, energy_cost):
            return Response({
                'success': True,
                'gold': player.gold,
                'diamond': player.diamond,
                'prompt_power': player.prompt_power,
                'energy': player.energy,
                'max_energy': player.max_energy
            })
        else:
            return Response({
                'success': False,
                'error': 'Insufficient resources'
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([])
def health_check(request):
    """
    一個簡單的健康檢查端點，用於確認服務是否在線。
    """
    return JsonResponse({"status": "ok"})

# --- Web3 錢包登入驗證 ---
class Web3NonceView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        address = request.GET.get('address')
        if not address:
            return Response({'error': 'No address'}, status=400)
        nonce = secrets.token_hex(16)
        # 包裝成明文訊息
        message = f"Sign in to Prompt Fighters to verify your wallet address."
        cache.set(f'web3_nonce_{address.lower()}', nonce, timeout=300)
        return Response({'nonce': nonce, 'message': message})

class Web3LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        address = request.data.get('address')
        signature = request.data.get('signature')
        nonce = request.data.get('nonce')
        if not address or not signature or not nonce:
            return Response({'error': '缺少參數'}, status=400)
        # 取出 cache 中的 nonce
        cached_nonce = cache.get(f'web3_nonce_{address.lower()}')
        if not cached_nonce or cached_nonce != nonce:
            return Response({'error': '無效或過期的 nonce'}, status=400)
        # 驗證簽名
        try:
            message = f"Sign in to Prompt Fighters to verify your wallet address."
            print('Backend verify message:', message)
            message_obj = encode_defunct(text=message)
            recovered = Account.recover_message(message_obj, signature=signature)
        except Exception as e:
            return Response({'error': '簽名驗證失敗'}, status=400)
        if recovered.lower() != address.lower():
            return Response({'error': '地址與簽名不符'}, status=400)
        # 取得或創建 User/Player
        User = get_user_model()
        login_method = request.data.get('login_method', 'metamask')  # 預設 MetaMask
        
        # 首先檢查是否已有相同地址的 Player
        existing_player = Player.objects.filter(wallet_address__iexact=address).first()
        
        if existing_player:
            # 如果已有相同地址的 Player，更新登入方式
            user = existing_player.user
            existing_player.login_method = login_method
            existing_player.last_login = timezone.now()
            existing_player.save()
            player = existing_player
        else:
            # 檢查是否有相同 email 的用戶（用於社交錢包整合）
            social_email = request.data.get('social_email')  # 社交登入的 email
            user = None
            
            if social_email:
                # 嘗試找到相同 email 的用戶
                user = User.objects.filter(email=social_email).first()
                if user:
                    # 找到相同 email 的用戶，更新其 Player 資料
                    player, _ = Player.objects.get_or_create(user=user)
                    player.wallet_address = address
                    player.login_method = login_method
                    player.chain_id = 5000  # Mantle
                    player.last_login = timezone.now()
                    if login_method in ['google', 'facebook', 'apple']:
                        player.social_provider = login_method
                    player.save()
                else:
                    # 沒有找到相同 email，創建新用戶
                    user = User.objects.create(
                        username=social_email,
                        email=social_email
                    )
                    player = Player.objects.create(
                        user=user,
                        wallet_address=address,
                        login_method=login_method,
                        chain_id=5000,
                        social_provider=login_method if login_method in ['google', 'facebook', 'apple'] else None,
                        last_login=timezone.now()
                    )
            else:
                # 一般 Web3 登入，使用地址作為 username
                user, _ = User.objects.get_or_create(
                    username=address.lower(),
                    defaults={'email': f'{address.lower()}@web3.local'}
                )
                player, _ = Player.objects.get_or_create(
                    user=user,
                    defaults={
                        'wallet_address': address,
                        'login_method': login_method,
                        'chain_id': 5000,
                        'last_login': timezone.now()
                    }
                )
                # 如果 Player 已存在但沒有地址，填入地址
                if not player.wallet_address:
                    player.wallet_address = address
                    player.chain_id = 5000
                    player.save()
        
        # 簽發 JWT
        refresh = RefreshToken.for_user(user)
        # 清除 nonce
        cache.delete(f'web3_nonce_{address.lower()}')
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'player_id': player.id,
            'username': user.username,
            'email': user.email,
            'wallet_address': player.wallet_address,
            'login_method': player.login_method
        })


class DailyQuestView(APIView):
    """每日任務相關API"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """獲取玩家當日任務統計"""
        player = request.user.player
        
        # 記錄登入
        #DailyQuestService.record_player_login(player)
        
        # 獲取統計資料
        stats = DailyQuestService.get_daily_stats(player)
        serializer = DailyStatsSerializer(stats)
        
        return Response(serializer.data)
    
    def post(self, request):
        """領取任務獎勵"""
        player = request.user.player
        serializer = ClaimRewardSerializer(data=request.data)
        
        if serializer.is_valid():
            quest_id = serializer.validated_data['quest_id']
            result = DailyQuestService.claim_quest_reward(player, quest_id)
            
            if result['success']:
                return Response({
                    'success': True,
                    'message': '獎勵領取成功！',
                    'rewards': result['rewards']
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error']
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheckInView(APIView):
    """每日簽到API"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """執行每日簽到"""
        player = request.user.player
        
        # 記錄登入（這會自動觸發簽到任務）
        login_record = DailyQuestService.record_player_login(player)
        
        if login_record:
            return Response({
                'success': True,
                'message': '簽到成功！',
                'login_streak': DailyQuestService.get_login_streak(player)
            })
        else:
            return Response({
                'success': False,
                'message': '今日已簽到'
            })


class QuestProgressView(APIView):
    """任務進度更新API（供內部使用）"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """手動更新任務進度（測試用）"""
        player = request.user.player
        quest_type = request.data.get('quest_type')
        increment = request.data.get('increment', 1)
        
        if not quest_type:
            return Response({
                'error': 'quest_type is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        player_quest = DailyQuestService.update_quest_progress(player, quest_type, increment)
        
        if player_quest:
            return Response({
                'success': True,
                'quest_type': quest_type,
                'current_count': player_quest.current_count,
                'target_count': player_quest.quest.target_count,
                'is_completed': player_quest.is_completed
            })
        else:
            return Response({
                'error': 'Quest not found'
            }, status=status.HTTP_404_NOT_FOUND)