from celery import shared_task
from google import genai
from google.genai import types
from django.conf import settings
from .models import Character, Battle
import os
import json
import re
import random
from django.db import transaction

@shared_task
def generate_character_image(character_id):
    char = Character.objects.get(id=character_id)
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=f"請畫出一個中二風格的{char.prompt}角色，動漫風格，彩色插畫。必殺技描述：{char.skill_description}。請注意：圖片中絕對不要出現任何文字、標語、說明、標籤，只產生純角色圖像，不要有任何中文字或英文在圖片裡。",
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                filename = f"character_{character_id}.png"
                media_path = os.path.join(settings.MEDIA_ROOT, filename)
                with open(media_path, "wb") as f:
                    f.write(part.inline_data.data)
                char.image_url = settings.MEDIA_URL + filename
                char.save()
                break
    except Exception as e:
        # 可加 log 或通知
        print(f"Error generating character image for {character_id}: {e}")
        pass

@shared_task
def run_battle_task(battle_id):
    try:
        # 使用 transaction.atomic 確保資料庫操作的原子性
        with transaction.atomic():
            # 根據 battle_id 獲取戰鬥實例和參與者
            battle = Battle.objects.get(id=battle_id)
            player = battle.character1
            opponent = battle.character2

            # 準備戰鬥場景描述 (這部分邏輯與原 view 相同)
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

        # 使用 Gemini API 生成戰鬥結果
        genai_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=battle_prompt
        )
        raw_text = getattr(response, "text", "")
        
        # 提取 JSON
        json_match = re.search(r'```json\n({.*?})\n```', raw_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = raw_text
        
        battle_result = json.loads(json_str)

        # 更新 Battle 物件
        battle.winner = player if str(battle_result['winner']) == str(player.id) else opponent
        battle.battle_log = battle_result  # 將 AI 的回傳存到 battle_log
        battle.status = 'COMPLETED'
        battle.save()

        # 更新角色戰績
        if battle.winner == player:
            player.win_count += 1
            opponent.loss_count += 1
        else:
            player.loss_count += 1
            opponent.win_count += 1
        
        player.save()
        opponent.save()

    except Exception as e:
        print(f"Error in run_battle_task for battle_id {battle_id}: {e}")
        # 如果發生錯誤，更新戰鬥狀態
        try:
            battle = Battle.objects.get(id=battle_id)
            battle.status = 'ERROR'
            battle.battle_log = {'error': str(e)}
            battle.save()
        except Battle.DoesNotExist:
            print(f"Battle with id {battle_id} not found when trying to log error.") 