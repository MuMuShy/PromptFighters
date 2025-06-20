from django.shortcuts import render
import random
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Player, Character, Battle
from .serializers import PlayerSerializer, CharacterSerializer, BattleSerializer
from django.shortcuts import get_object_or_404
from google import genai
import os
import json
from .tasks import generate_character_image
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from rest_framework import viewsets
from rest_framework.decorators import action
import openai
from django.conf import settings
from django.db import models
import re

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

class CharacterViewSet(viewsets.ModelViewSet):
    serializer_class = CharacterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Character.objects.filter(player=self.request.user.player)

    def perform_create(self, serializer):
        prompt = self.request.data.get('prompt')
        # Gemini 產生技能描述與屬性
        genai_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
        ai_prompt = f"""
請根據以下角色名稱，回傳一個 JSON，格式如下：
{{
  \"skill_description\": \"30字以內的中二技能描述（中文）\",
  \"strength\": 30~100的整數,
  \"agility\": 30~100的整數,
  \"luck\": 30~100的整數
}}
角色名稱：「{prompt}」
"""
        try:
            response = genai_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=ai_prompt
            )
            # 印出 Gemini 回傳內容方便 debug
            print("Gemini 回傳內容：", getattr(response, "text", None), response)
            # 處理 markdown 標記，確保能正確解析 JSON
            raw_text = getattr(response, "text", "")
            if raw_text.startswith("```json"):
                raw_text = raw_text[len("```json"):].strip()
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()
            data = json.loads(raw_text)
            skill_description = data.get('skill_description', '技能描述生成失敗')
            strength = int(data.get('strength', random.randint(30, 100)))
            agility = int(data.get('agility', random.randint(30, 100)))
            luck = int(data.get('luck', random.randint(30, 100)))
        except Exception as e:
            print(f"Error generating skill description for {prompt}: {e}")
            skill_description = "技能描述生成失敗"
            strength = random.randint(30, 100)
            agility = random.randint(30, 100)
            luck = random.randint(30, 100)

        # 產生圖片（如無法串接則用 placeholder）
        image_url = f"https://via.placeholder.com/256?text={prompt}"
        
        # 使用 serializer.save() 創建角色
        character = serializer.save(
            player=self.request.user.player,
            name=prompt,
            prompt=prompt,
            image_url=image_url,
            strength=strength,
            agility=agility,
            luck=luck,
            skill_description=skill_description,
            win_count=0,
            loss_count=0
        )
        
        # 非同步生成角色圖片
        generate_character_image.delay(character.id)

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
        """進行戰鬥"""
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

        # 準備戰鬥場景描述
        battle_prompt = f"""
                    一場史詩般的對決即將展開！

                    **你的任務是創造一場獨一無二的戰鬥。**

                    第一步：請你自行想像一個極具創意、天馬行空的戰鬥地點。

                    第二步：基於這個你想像出來的地點，生成一場精彩的戰鬥過程，並以JSON格式回傳。

                    **戰鬥員資料：**

                    玩家角色：
                    名稱：{player.name}
                    描述：{player.prompt}
                    力量：{player.strength}
                    敏捷：{player.agility}
                    幸運：{player.luck}
                    特殊能力：{player.skill_description}

                    對手角色：
                    名稱：{opponent.name}
                    描述：{opponent.prompt}
                    力量：{opponent.strength}
                    敏捷：{opponent.agility}
                    幸運：{opponent.luck}
                    特殊能力：{opponent.skill_description}

                    **生成規則：**
                    1. 3-5個回合的戰鬥。
                    2. **你想像出的戰鬥地點必須對戰局產生決定性或意想不到的影響。** 這個地點可能會給其中一方帶來優勢或劣勢，甚至導致看似弱小的一方反敗為勝。
                    3. 每個回合要有具體的動作和傷害值。
                    4. 要運用到角色的特殊能力。
                    5. **不要單純根據角色的名字或描述來決定勝負（例如，不要讓「關羽」因為他是關羽就一定贏）。勝負應該是基於你所創造的、受場地影響的戰鬥過程的創意結果。**
                    6. 血量先歸零者輸。

                    回傳格式一定要是以下JSON格式：
                    {{
                        "winner": "{player.id}或{opponent.id}",
                        "battle_log": [
                            {{
                                "attacker": "攻擊者名稱",
                                "defender": "防守者名稱",
                                "action": "動作描述",
                                "damage": 50,
                                "description": "詳細描述",
                                "remaining_hp": 100
                            }}
                        ],
                        "battle_description": "整體戰鬥描述"
                    }}

                    注意：
                    1. damage 和 remaining_hp 必須是數字
                    2. winner 必須是兩個角色 ID 其中之一 血量先歸零者輸
                    3. battle_log 至少要有 3 個回合
                    """

        try:
            # 使用 Gemini API 生成戰鬥結果
            genai_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
            response = genai_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=battle_prompt
            )

            # 處理 markdown 標記，確保能正確解析 JSON
            raw_text = getattr(response, "text", "")
            print(raw_text)

            # 使用正規表達式提取 JSON 區塊
            json_match = re.search(r'```json\n({.*?})\n```', raw_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # 如果沒有找到符合的格式，嘗試直接解析
                json_str = raw_text

            # 解析 AI 返回的戰鬥結果
            battle_result = json.loads(json_str)

            # 創建戰鬥記錄
            battle = Battle.objects.create(
                character1=player,
                character2=opponent,
                winner=player if str(battle_result['winner']) == str(player.id) else opponent,
                battle_log=battle_result  # 直接存儲完整的戰鬥結果
            )

            # 更新角色戰績
            winner_id = battle_result['winner']
            if str(winner_id) == str(player.id):
                player.win_count += 1
                opponent.loss_count += 1
            else:
                player.loss_count += 1
                opponent.win_count += 1

            player.save()
            opponent.save()

            return Response(battle_result)

        except Exception as e:
            print(f"Battle error: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
