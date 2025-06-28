# 服務層: 處理核心業務邏輯
import os
import json
import random
from typing import Dict, Any

from django.db import transaction
from google import genai

from .models import Player, Character, Battle
from .configs import LEVEL_CONFIGS


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
    
    def generate_character_attributes_by_rarity(self, character_name: str, prompt: str, rarity: int) -> Dict[str, Any]:
        """
        根據稀有度使用 Gemini API 生成角色屬性（技能、數值）。
        """
        # 根據稀有度設定屬性範圍
        rarity_ranges = {
            1: {'min': 30, 'max': 60, 'name': 'N'},    # Normal
            2: {'min': 50, 'max': 80, 'name': 'R'},    # Rare  
            3: {'min': 70, 'max': 100, 'name': 'SR'},  # Super Rare
            4: {'min': 90, 'max': 120, 'name': 'SSR'}, # Super Super Rare
            5: {'min': 110, 'max': 150, 'name': 'UR'}  # Ultra Rare
        }
        
        range_info = rarity_ranges.get(rarity, rarity_ranges[1])
        min_val, max_val = range_info['min'], range_info['max']
        rarity_name = range_info['name']
        
        ai_prompt = f"""
            請根據以下角色資訊，回傳一個 JSON，格式如下：
            {{
            "skill_description": "30字以內的中二技能描述（中文）",
            "strength": "{min_val}~{max_val}的整數",
            "agility": "{min_val}~{max_val}的整數", 
            "luck": "{min_val}~{max_val}的整數"
            }}
            角色名稱：「{character_name}」
            角色描述：「{prompt}」
            稀有度：{rarity_name}（{rarity}星）
            注意：這是{rarity_name}稀有度角色，屬性應該在{min_val}-{max_val}範圍內
            """
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=ai_prompt
            )
            data = self._parse_gemini_response(response)
            return {
                'skill_description': data.get('skill_description', f'{rarity_name}稀有度角色的專屬技能'),
                'strength': max(min_val, min(max_val, int(data.get('strength', min_val)))),
                'agility': max(min_val, min(max_val, int(data.get('agility', min_val)))),
                'luck': max(min_val, min(max_val, int(data.get('luck', min_val)))),
            }
        except Exception as e:
            print(f"屬性生成錯誤: {e}")
            # 備援機制：根據稀有度隨機生成屬性
            return {
                'skill_description': f'{rarity_name}稀有度角色的專屬技能',
                'strength': random.randint(min_val, max_val),
                'agility': random.randint(min_val, max_val),
                'luck': random.randint(min_val, max_val),
            }

    def generate_advanced_character_attributes(self, character_name: str, prompt: str) -> Dict[str, Any]:
        """
        使用 Gemini API 生成角色屬性（技能、數值）。
        保留舊方法以向後兼容
        """
        return self.generate_character_attributes_by_rarity(character_name, prompt, 3)
        

    def generate_character_attributes(self, character_name: str, rarity: int = 1) -> Dict[str, Any]:
        """
        使用 Gemini API 生成角色屬性（技能、數值）。
        """
        return self.generate_character_attributes_by_rarity(character_name, f"普通召喚的{character_name}", rarity)


class CharacterService:
    """
    處理與角色（Character）相關的業務邏輯。
    """
    def __init__(self):
        self.gemini_service = GeminiService()

    def _generate_rarity_by_probability(self, summon_type: str) -> int:
        """
        根據召喚類型和機率產生稀有度
        """
        rand = random.random() * 100  # 0-100
        
        if summon_type == 'basic':
            # 一般召喚: N=70%, R=25%, SR=5%
            if rand < 70:
                return 1  # N
            elif rand < 95:
                return 2  # R
            else:
                return 3  # SR
        elif summon_type == 'premium':
            # 高階召喚: SR=90%, SSR=8%, UR=2%
            if rand < 90:
                return 3  # SR
            elif rand < 98:
                return 4  # SSR
            else:
                return 5  # UR
        else:
            return 1  # 預設 N

    def create_character(self, player: Player, name: str, prompt: str) -> Character:
        """
        創建一個新角色（一般召喚），先隨機稀有度再用AI生成屬性。
        """
        # 檢查資源
        if not player.can_afford(gold_cost=1000, prompt_power_cost=1):
            raise ValueError("資源不足：需要1000金幣和1 Prompt Power")
        
        # 消耗資源
        player.spend_resources(gold_cost=1000, prompt_power_cost=1)
        
        # 根據一般召喚機率決定稀有度
        rarity = self._generate_rarity_by_probability('basic')
        
        # 使用AI根據稀有度生成屬性
        attributes = self.gemini_service.generate_character_attributes_by_rarity(name, prompt, rarity)
        image_url = f"https://via.placeholder.com/256?text={name.replace(' ', '+')}"

        character = Character.objects.create(
            player=player,
            name=name,
            prompt=prompt,
            image_url=image_url,
            rarity=rarity,
            **attributes
        )
        
        # 使用延遲匯入來避免循環依賴問題，並觸發異步任務
        from .tasks import generate_character_image
        from .daily_quest_service import DailyQuestService
        generate_character_image.delay(character.id)
        
        # 更新召喚任務進度
        DailyQuestService.update_quest_progress(player, 'character_summon', 1)
        
        return character 

    def create_advanced_character(self, player: Player, name: str, prompt: str) -> Character:
        """
        高階召喚：檢查資源，根據機率決定稀有度，用AI生成屬性。
        """
        # 檢查資源
        if not player.can_afford(prompt_cost=5, prompt_power_cost=3):
            raise ValueError("資源不足：需要5 $PROMPT和3 Prompt Power")
        
        # 消耗資源
        player.spend_resources(prompt_cost=5, prompt_power_cost=3)
        
        # 根據高階召喚機率決定稀有度
        rarity = self._generate_rarity_by_probability('premium')
        
        # 使用AI根據稀有度生成屬性
        attributes = self.gemini_service.generate_character_attributes_by_rarity(name, prompt, rarity)
        image_url = f"https://via.placeholder.com/256?text={name.replace(' ', '+')}"
        
        character = Character.objects.create(
            player=player,
            name=name,
            prompt=prompt,
            image_url=image_url,
            rarity=rarity,
            **attributes
        )
        from .tasks import generate_character_image
        from .daily_quest_service import DailyQuestService
        generate_character_image.delay(character.id)
        
        # 更新召喚任務進度
        DailyQuestService.update_quest_progress(player, 'character_summon', 1)
        
        return character 

class CharacterGrowthService:
    """
    處理與角色成長（等級、經驗值）相關的業務邏輯。
    """
    @staticmethod
    def add_experience(character: Character, amount: int):
        """
        為角色增加經驗值。
        在我們的模型中，經驗值是透過消耗「經驗藥水」道具獲得的。
        這個方法應該在玩家使用經驗藥水時被呼叫。
        """
        if character.level >= 50:
            return # 滿級後不再增加經驗

        character.experience += amount
        character.save(update_fields=['experience'])
        # 注意：這裡只增加經驗值，升級檢查和操作在 level_up 中進行。

    @staticmethod
    def get_required_exp_for_level_up(character: Character) -> int:
        """
        獲取角色升到下一級所需的經驗值。
        """
        if character.level >= 50:
            return 0
        
        level_info = LEVEL_CONFIGS.get(character.level)
        return level_info.get("experience_needed", 0) if level_info else 0

    @staticmethod
    def can_level_up(character: Character) -> bool:
        """
        檢查角色當前的經驗值是否滿足升級條件。
        """
        if character.level >= 50:
            return False
        
        required_exp = CharacterGrowthService.get_required_exp_for_level_up(character)
        return character.experience >= required_exp

    @staticmethod
    @transaction.atomic
    def level_up(character: Character):
        """
        執行升級操作。
        這是一個原子操作，會同時檢查經驗值、金幣，並更新角色和玩家的狀態。
        """
        if not CharacterGrowthService.can_level_up(character):
            raise ValueError("經驗值不足，無法升級。")

        player = character.player
        level_info = LEVEL_CONFIGS.get(character.level)
        
        if not level_info:
            raise ValueError(f"找不到等級 {character.level} 的設定。")

        gold_cost = level_info.get("gold_cost", 0)
        required_exp = level_info.get("experience_needed", 0)

        # 檢查玩家是否有足夠的金幣
        if not player.can_afford(gold_cost=gold_cost):
            raise ValueError(f"資源不足：升級需要 {gold_cost} 金幣。")

        # 消耗資源和經驗值
        player.spend_resources(gold_cost=gold_cost)
        character.experience -= required_exp
        character.level += 1
        
        # 保存變更
        player.save()
        character.save(update_fields=['level', 'experience'])

        return character 