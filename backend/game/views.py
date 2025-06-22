from django.shortcuts import render
import random
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Player, Character, Battle
from .serializers import PlayerSerializer, CharacterSerializer, BattleSerializer
from django.shortcuts import get_object_or_404
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
# import openai #不再需要
from django.conf import settings
from django.db import models
from django.db.models import F, ExpressionWrapper, FloatField
import re
from django.http import JsonResponse

# 匯入新的服務
from .services import CharacterService

# Create your views here.

class CharacterDetailView(generics.RetrieveAPIView):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Character.objects.filter(player=self.request.user.player)

class PlayerProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, player_id):
        player = get_object_or_404(Player, id=player_id)
        player_data = PlayerSerializer(player).data
        characters = Character.objects.filter(player=player)
        char_data = CharacterSerializer(characters, many=True).data
        return Response({"player": player_data, "characters": char_data})

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
            User = get_user_model()
            user, created = User.objects.get_or_create(email=email, defaults={'username': email})
            # **確保有 Player**
            player, _ = Player.objects.get_or_create(user=user)
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
        # 因為 serializer 已被設定為可接收 prompt，
        # 所以我們可以從 validated_data 中安全地獲取它。
        prompt = serializer.validated_data['prompt']
        
        # 呼叫服務來處理核心邏輯
        service = CharacterService()
        character = service.create_character(
            player=self.request.user.player,
            name=prompt,  # 暫時讓 name 和 prompt 相同
            prompt=prompt
        )
        
        # 將創建好的實例回傳給序列化器，以便 DRF 能正確生成回應
        # 這一步很重要，它讓 DRF 知道該回傳哪個物件的資料
        serializer.instance = character

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

        # 3. 立即返回 battle_id，讓前端可以開始輪詢
        return Response(
            {"battle_id": battle.id, "status": battle.status},
            status=status.HTTP_202_ACCEPTED
        )

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

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    一個簡單的健康檢查端點，用於確認服務是否在線。
    """
    return JsonResponse({"status": "ok"})
