from django.shortcuts import render
import random
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Player, Character, Battle, DailyQuest, PlayerDailyQuest, MarketTransaction
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
from django.http import JsonResponse, HttpResponse
import base64
import logging

# 匯入新的服務
from .services import CharacterService, CharacterGrowthService

logger = logging.getLogger(__name__)

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
        異步啟動一場戰鬥，包含體力消耗機制。
        """
        player_id = request.data.get('player_character')
        opponent_id = request.data.get('opponent_character')
        
        # 獲取玩家並更新體力
        player_user = request.user.player
        player_user.update_energy()

        # 檢查體力是否足夠（戰鬥消耗10體力）
        BATTLE_ENERGY_COST = 10
        if player_user.energy < BATTLE_ENERGY_COST:
            return Response(
                {
                    "error": "Energy insufficient", 
                    "message": "體力不足，無法進行戰鬥",
                    "current_energy": player_user.energy,
                    "required_energy": BATTLE_ENERGY_COST,
                    "next_recovery_minutes": 10 - ((timezone.now() - player_user.last_energy_update).total_seconds() // 60) % 10
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            player_character = Character.objects.get(id=player_id, player=player_user)
            opponent = Character.objects.get(id=opponent_id)
        except Character.DoesNotExist:
            return Response(
                {"error": "Character not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 消耗體力
        player_user.energy -= BATTLE_ENERGY_COST
        player_user.save()

        # 1. 立即創建一個 PENDING 狀態的 Battle 實例
        battle = Battle.objects.create(
            character1=player_character,
            character2=opponent,
            status='PENDING'
        )

        # 2. 觸發背景任務
        run_battle_task.delay(battle.id)
        
        # 3. 更新對戰任務進度
        DailyQuestService.update_quest_progress(
            player_user, 'battle_count', 1
        )

        # 4. 立即返回 battle_id，讓前端可以開始輪詢
        return Response(
            {
                "battle_id": battle.id, 
                "status": battle.status,
                "energy_consumed": BATTLE_ENERGY_COST,
                "remaining_energy": player_user.energy
            },
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
            'prompt': player.prompt,
            'prompt_power': player.prompt_power,
            'exp_potion': player.exp_potion,
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
        prompt_cost = request.data.get('prompt_cost', 0)
        prompt_power_cost = request.data.get('prompt_power_cost', 0)
        energy_cost = request.data.get('energy_cost', 0)
        
        if player.spend_resources(gold_cost, prompt_cost, prompt_power_cost, energy_cost):
            return Response({
                'success': True,
                'gold': player.gold,
                'prompt': player.prompt,
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
    authentication_classes = []  # 不需要任何認證
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
    authentication_classes = []  # 不需要任何認證
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

class CharacterGrowthAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, character_id, action):
        character = get_object_or_404(Character, id=character_id, player=request.user.player)
        
        if action == 'info':
            # 獲取角色升級信息
            upgrade_info = CharacterGrowthService.get_upgrade_info(character)
            
            # 獲取玩家資源
            player = request.user.player
            player.update_energy()
            
            return Response({
                'character': CharacterSerializer(character).data,
                'upgrade_info': upgrade_info,
                'player_resources': {
                    'gold': player.gold,
                    'prompt': player.prompt,
                    'prompt_power': player.prompt_power,
                    'exp_potion': player.exp_potion,
                    'energy': player.energy,
                    'max_energy': player.max_energy
                }
            })
        
        return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, character_id, action):
        character = get_object_or_404(Character, id=character_id, player=request.user.player)
        
        if action == 'add-exp':
            amount = request.data.get('amount', 0)
            if not isinstance(amount, int) or amount <= 0:
                return Response({'error': 'Amount must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

            player = request.user.player
            if not player.can_afford(exp_potion_cost=amount):
                return Response({'error': '經驗藥水不足。'}, status=status.HTTP_400_BAD_REQUEST)

            player.spend_resources(exp_potion_cost=amount)
            CharacterGrowthService.add_experience(character, amount)
            
            # 更新資源數據
            player.refresh_from_db()
            upgrade_info = CharacterGrowthService.get_upgrade_info(character)
            
            return Response({
                'success': True, 
                'message': f'成功為 {character.name} 增加了 {amount} 點經驗值。',
                'character': CharacterSerializer(character).data,
                'upgrade_info': upgrade_info,
                'player_resources': {
                    'gold': player.gold,
                    'prompt': player.prompt,
                    'prompt_power': player.prompt_power,
                    'exp_potion': player.exp_potion,
                    'energy': player.energy,
                    'max_energy': player.max_energy
                }
            })

        elif action == 'level-up':
            try:
                CharacterGrowthService.level_up(character)
                
                # 更新資源數據
                player = request.user.player
                player.refresh_from_db()
                upgrade_info = CharacterGrowthService.get_upgrade_info(character)
                
                return Response({
                    'success': True, 
                    'message': f'{character.name} 成功升級至 Lv.{character.level}！',
                    'character': CharacterSerializer(character).data,
                    'upgrade_info': upgrade_info,
                    'player_resources': {
                        'gold': player.gold,
                        'prompt': player.prompt,
                        'prompt_power': player.prompt_power,
                        'exp_potion': player.exp_potion,
                        'energy': player.energy,
                        'max_energy': player.max_energy
                    }
                })
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

# ============== NFT 相關 API ==============

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mint_character_nft(request, character_id):
    """
    鑄造角色 NFT
    
    POST /api/characters/<uuid>/mint/
    Body: {
        "wallet_address": "0x..."
    }
    """
    from .nft_service import get_nft_service
    from django.utils import timezone
    
    try:
        character = Character.objects.get(id=character_id, player=request.user.player)
    except Character.DoesNotExist:
        return Response({'error': '角色不存在或無權限'}, status=status.HTTP_404_NOT_FOUND)
    
    # 檢查是否已鑄造
    if character.is_minted:
        return Response({
            'error': '該角色已鑄造為 NFT',
            'token_id': character.token_id,
            'contract_address': character.contract_address
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 獲取錢包地址
    wallet_address = request.data.get('wallet_address')
    if not wallet_address:
        return Response({'error': '缺少 wallet_address'}, status=status.HTTP_400_BAD_REQUEST)
    
    # 驗證錢包地址格式
    if not wallet_address.startswith('0x') or len(wallet_address) != 42:
        return Response({'error': '錢包地址格式錯誤'}, status=status.HTTP_400_BAD_REQUEST)
    
    # 檢查角色是否有圖片
    if not character.image_url or 'placeholder' in character.image_url:
        return Response({
            'error': '角色圖片尚未生成完成，請稍後再試'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 呼叫 NFT 服務鑄造
    nft_service = get_nft_service()
    
    if not nft_service.enabled:
        return Response({
            'error': 'NFT 服務暫時不可用，請稍後再試'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    result = nft_service.mint_character_nft(character, wallet_address)
    
    if not result['success']:
        return Response({
            'error': f"鑄造失敗: {result.get('error', '未知錯誤')}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # 檢查是否已有其他角色使用相同 token_id（處理重複鑄造的情況）
    existing_char = Character.objects.filter(
        token_id=result['token_id'],
        contract_address=result['contract_address']
    ).exclude(id=character.id).first()
    
    if existing_char:
        # 如果已存在，說明這是重複鑄造，需要清除舊記錄的 token_id
        existing_char.token_id = None
        existing_char.is_minted = False
        existing_char.save()
    
    # 更新角色資料
    character.is_minted = True
    character.token_id = result['token_id']
    character.contract_address = result['contract_address']
    character.owner_wallet = wallet_address.lower()
    character.minted_at = timezone.now()
    character.tx_hash = result['tx_hash']
    character.save()
    
    # 返回成功資訊
    chain_id = os.getenv('CHAIN_ID', '5001')
    chain_name = 'mantle' if chain_id == '5000' else 'mantle-testnet'
    
    return Response({
        'success': True,
        'message': f'🎉 {character.name} 已成功鑄造為 NFT！',
        'data': {
            'token_id': result['token_id'],
            'tx_hash': result['tx_hash'],
            'contract_address': result['contract_address'],
            'owner_wallet': wallet_address,
            'opensea_url': f"https://opensea.io/assets/{chain_name}/{result['contract_address']}/{result['token_id']}",
            'explorer_url': f"https://explorer.mantle.xyz/tx/{result['tx_hash']}" if chain_id == '5000' else f"https://explorer.testnet.mantle.xyz/tx/{result['tx_hash']}"
        }
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def verify_character_ownership(request, character_id):
    """
    驗證角色 NFT 所有權
    
    GET /api/characters/<uuid>/verify-ownership/?wallet_address=0x...
    """
    from .nft_service import get_nft_service
    
    try:
        character = Character.objects.get(id=character_id)
    except Character.DoesNotExist:
        return Response({'error': '角色不存在'}, status=status.HTTP_404_NOT_FOUND)
    
    if not character.is_minted:
        return Response({
            'is_owner': True,
            'message': '該角色尚未鑄造為 NFT'
        })
    
    wallet_address = request.query_params.get('wallet_address')
    if not wallet_address:
        return Response({'error': '缺少 wallet_address'}, status=status.HTTP_400_BAD_REQUEST)
    
    nft_service = get_nft_service()
    
    if not nft_service.enabled:
        return Response({
            'error': 'NFT 服務暫時不可用'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    is_owner = nft_service.verify_ownership(character.token_id, wallet_address)
    
    return Response({
        'is_owner': is_owner,
        'token_id': character.token_id,
        'contract_address': character.contract_address,
        'current_owner': character.owner_wallet
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_character_by_token_id(request, token_id):
    """
    根據 token_id 獲取角色信息（允許任何人訪問，用於市場展示）
    
    GET /api/characters/token/<token_id>/
    """
    try:
        character = Character.objects.get(token_id=token_id)
        serializer = CharacterSerializer(character)
        return Response({
            'success': True,
            'data': serializer.data
        })
    except Character.DoesNotExist:
        return Response({
            'success': False,
            'error': '角色不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"根據 token_id 獲取角色失敗: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_owned_nfts(request):
    """
    同步用戶錢包持有的 NFT 到後端數據庫
    
    POST /api/characters/sync-owned-nfts/
    Body: {
        "wallet_address": "0x...",
        "token_ids": [21, 22, 23]
    }
    
    此 API 會：
    1. 驗證 token_ids 中每個 token 的實際持有者（鏈上查詢）
    2. 將屬於該錢包的 Character 記錄更新 owner_wallet 和 player
    3. 返回同步結果
    """
    from .nft_service import get_nft_service
    from .models import Player
    
    try:
        wallet_address = request.data.get('wallet_address', '').lower()
        token_ids = request.data.get('token_ids', [])
        
        if not wallet_address:
            return Response({
                'success': False,
                'error': '缺少 wallet_address'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 獲取當前用戶的 Player
        player = request.user.player
        
        # 驗證錢包地址是否匹配（可選，如果要嚴格驗證）
        if player.wallet_address and player.wallet_address.lower() != wallet_address:
            return Response({
                'success': False,
                'error': '錢包地址不匹配'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # 更新玩家錢包地址（如果尚未設置）
        if not player.wallet_address:
            player.wallet_address = wallet_address
            player.save()
        
        nft_service = get_nft_service()
        if not nft_service.enabled:
            return Response({
                'success': False,
                'error': 'NFT 服務暫時不可用'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        synced_tokens = []
        errors = []
        
        # 如果提供了 token_ids，只同步這些 token
        # 否則需要從合約查詢所有持有的 token（這需要合約支持 Enumerable）
        tokens_to_check = token_ids if token_ids else []
        
        if not tokens_to_check:
            # 優化：如果沒有提供 token_ids，智能過濾只檢查可能有變化的 token
            # 1. 優先檢查該錢包可能擁有的 token（根據 owner_wallet）
            wallet_owned_chars = Character.objects.filter(
                owner_wallet__iexact=wallet_address,
                is_minted=True,
                token_id__isnull=False
            ).values_list('token_id', flat=True)
            
            # 2. 檢查最近交易的 token（通過 MarketTransaction）
            from django.utils import timezone
            from datetime import timedelta
            recent_transactions = MarketTransaction.objects.filter(
                created_at__gte=timezone.now() - timedelta(days=7)  # 最近 7 天
            ).values_list('character__token_id', flat=True).distinct()
            
            # 3. 如果還是沒有，才檢查所有已鑄造的 token（但要限制數量）
            if wallet_owned_chars.exists() or recent_transactions.exists():
                tokens_to_check = list(set(list(wallet_owned_chars) + list(recent_transactions)))
                logger.info(f"智能過濾：檢查錢包相關和最近交易的 token: {len(tokens_to_check)} 個")
            else:
                # 限制最多檢查 1000 個，避免過慢
                all_minted_chars = Character.objects.filter(
                    is_minted=True,
                    token_id__isnull=False
                ).values_list('token_id', flat=True)[:1000]
                tokens_to_check = list(all_minted_chars)
                logger.info(f"未提供 token_ids，檢查最多 1000 個已鑄造的 token: {len(tokens_to_check)} 個")
        
        # 使用並發查詢加速（並發數限制避免過載）
        import concurrent.futures
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def check_token_ownership(token_id):
            """檢查單個 token 的所有權並更新"""
            try:
                # 從鏈上查詢實際持有者
                current_owner = nft_service.get_nft_owner(token_id)
                
                if not current_owner:
                    logger.warning(f"無法獲取 Token ID {token_id} 的持有者")
                    return None
                
                current_owner = current_owner.lower()
                
                # 檢查是否屬於該錢包
                if current_owner == wallet_address:
                    # 查找對應的 Character
                    character = Character.objects.filter(token_id=token_id).first()
                    
                    if character:
                        # 更新 owner_wallet 和 player
                        old_owner = character.owner_wallet
                        character.owner_wallet = wallet_address
                        character.player = player
                        character.save()
                        
                        if old_owner and old_owner.lower() != wallet_address:
                            logger.info(f"📝 Token ID {token_id} 從 {old_owner} 轉移到 {wallet_address}")
                        
                        return token_id
                    else:
                        logger.warning(f"⚠️ Token ID {token_id} 在鏈上存在，但後端數據庫中沒有對應的 Character 記錄")
                        return f"ERROR:Token {token_id} 不存在於數據庫"
                else:
                    logger.debug(f"Token ID {token_id} 不屬於錢包 {wallet_address} (屬於 {current_owner})")
                    return None
            except Exception as e:
                logger.error(f"處理 Token ID {token_id} 時出錯: {e}")
                return f"ERROR:Token {token_id}: {str(e)}"
        
        # 使用線程池並發查詢（限制並發數為 10，避免過載 RPC）
        max_workers = min(10, len(tokens_to_check)) if tokens_to_check else 1
        logger.info(f"🚀 使用 {max_workers} 個並發線程查詢 {len(tokens_to_check)} 個 token 的所有權")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任務
            future_to_token = {
                executor.submit(check_token_ownership, token_id): token_id 
                for token_id in tokens_to_check
            }
            
            # 收集結果
            for future in as_completed(future_to_token):
                token_id = future_to_token[future]
                try:
                    result = future.result()
                    if result:
                        if isinstance(result, int):
                            synced_tokens.append(result)
                            logger.debug(f"✅ Token ID {result} 已同步")
                        elif isinstance(result, str) and result.startswith("ERROR:"):
                            errors.append(result.replace("ERROR:", ""))
                except Exception as e:
                    logger.error(f"Token ID {token_id} 查詢異常: {e}")
                    errors.append(f"Token {token_id}: {str(e)}")
        
        return Response({
            'success': True,
            'synced_tokens': synced_tokens,
            'synced_count': len(synced_tokens),
            'message': f'成功同步 {len(synced_tokens)} 個 NFT' + (f'，{len(errors)} 個錯誤' if errors else ''),
            'errors': errors if errors else None
        })
        
    except Exception as e:
        logger.error(f"同步 NFT 失敗: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # 允許任何人訪問（用於分享功能）
def proxy_image(request):
    """
    代理圖片請求，解決 CORS 問題
    用於分享功能中的 Canvas 繪製
    """
    image_url = request.query_params.get('url')
    if not image_url:
        return Response({'error': '缺少 url 參數'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .storage_service import CloudStorageService
        
        # 獲取配置的存儲服務信息
        storage_service = CloudStorageService()
        allowed_domains = []
        
        # 添加後端域名
        allowed_domains.append('localhost')
        allowed_domains.append('127.0.0.1')
        if hasattr(settings, 'ALLOWED_HOSTS') and settings.ALLOWED_HOSTS:
            allowed_domains.extend([h for h in settings.ALLOWED_HOSTS if h != '*'])
        
        # 添加 MEDIA_URL 域名
        if settings.MEDIA_URL.startswith('http'):
            try:
                from urllib.parse import urlparse
                media_domain = urlparse(settings.MEDIA_URL).netloc
                allowed_domains.append(media_domain)
            except:
                pass
        
        # 添加存儲服務的 CDN URL（如果配置）
        if storage_service.cdn_url:
            try:
                from urllib.parse import urlparse
                cdn_domain = urlparse(storage_service.cdn_url).netloc
                allowed_domains.append(cdn_domain)
            except:
                pass
        
        # 驗證 URL 是否合法（只允許來自我們自己的存儲或同源）
        from urllib.parse import urlparse
        parsed_url = urlparse(image_url)
        
        # 允許的域名列表
        is_allowed = (
            parsed_url.netloc in allowed_domains or
            'r2.dev' in parsed_url.netloc or  # Cloudflare R2
            image_url.startswith(settings.MEDIA_URL) or  # 相對路徑
            parsed_url.netloc == ''  # 相對路徑
        )
        
        if not is_allowed:
            logger.warning(f'拒絕代理請求：無效的圖片 URL: {image_url}')
            return Response({'error': '無效的圖片 URL'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 使用 requests 下載圖片
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; PromptFighters/1.0)'
        }
        response = requests.get(image_url, timeout=10, headers=headers)
        response.raise_for_status()
        
        # 檢查響應類型是否是圖片
        content_type = response.headers.get('Content-Type', '').lower()
        if not content_type.startswith('image/'):
            logger.warning(f'響應不是圖片類型: {content_type}')
            return Response({'error': '響應不是圖片'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 返回圖片數據
        image_response = HttpResponse(response.content, content_type=content_type)
        
        # 設置 CORS 標頭
        image_response['Access-Control-Allow-Origin'] = '*'
        image_response['Access-Control-Allow-Methods'] = 'GET'
        image_response['Access-Control-Allow-Headers'] = 'Content-Type'
        image_response['Cache-Control'] = 'public, max-age=31536000'  # 緩存 1 年
        
        return image_response
    except requests.RequestException as e:
        logger.error(f'代理圖片請求失敗: {e}')
        return Response({'error': '無法加載圖片'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f'代理圖片請求出錯: {e}')
        return Response({'error': '服務器錯誤'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
