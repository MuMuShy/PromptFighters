# 服務層: 處理核心業務邏輯
import os
import json
import random
from typing import Dict, Any

from django.db import transaction
from google import genai

from .models import Player, Character, Battle


class GeminiService:
    """
    負責與 Google Gemini API 進行通訊的服務。
    """
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY 環境變數未設定。")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def _parse_gemini_response(self, response) -> Dict[str, Any]:
        """
        清理並解析 Gemini 回傳的文字為字典。
        """
        raw_text = getattr(response, "text", "")
        # 移除 markdown 區塊標記
        if raw_text.startswith("```json"):
            raw_text = raw_text[len("```json"):].strip()
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3].strip()
        return json.loads(raw_text)

    def generate_character_attributes(self, character_name: str) -> Dict[str, Any]:
        """
        使用 Gemini API 生成角色屬性（技能、數值）。
        """
        prompt = f"""
請根據以下角色名稱，回傳一個 JSON，格式如下：
{{
  "skill_description": "30字以內的中二技能描述（中文）",
  "strength": "30~100的整數",
  "agility": "30~100的整數",
  "luck": "30~100的整數"
}}
角色名稱：「{character_name}」
"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            data = self._parse_gemini_response(response)
            return {
                'skill_description': data.get('skill_description', '技能描述生成失敗'),
                'strength': int(data.get('strength', 50)),
                'agility': int(data.get('agility', 50)),
                'luck': int(data.get('luck', 50)),
            }
        except Exception as e:
            print(f"屬性生成錯誤: {e}")
            # 備援機制：隨機生成屬性
            return {
                'skill_description': '技能描述生成失敗',
                'strength': random.randint(30, 100),
                'agility': random.randint(30, 100),
                'luck': random.randint(30, 100),
            }


class CharacterService:
    """
    處理與角色（Character）相關的業務邏輯。
    """
    def __init__(self):
        self.gemini_service = GeminiService()

    def create_character(self, player: Player, name: str, prompt: str) -> Character:
        """
        創建一個新角色，並從 AI 服務獲取屬性。
        """
        attributes = self.gemini_service.generate_character_attributes(name)
        image_url = f"https://via.placeholder.com/256?text={name.replace(' ', '+')}"

        character = Character.objects.create(
            player=player,
            name=name,
            prompt=prompt,
            image_url=image_url,
            **attributes
        )
        
        # 使用延遲匯入來避免循環依賴問題，並觸發異步任務
        from .tasks import generate_character_image
        generate_character_image.delay(character.id)
        
        return character 