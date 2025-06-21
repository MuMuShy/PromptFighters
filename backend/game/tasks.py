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
            contents=f"""請畫出一個具有中二風格、動畫電影等級的{char.prompt}角色，風格偏向精緻成熟的日系動漫或遊戲角色設計，具備飽滿色彩、專業渲染、角色比例自然、眼神有戲。請避免任何可愛風、低齡化、卡通化或Q版風格。

            角色需具備立體光影效果與細膩服裝設計，整體構圖參考日系 RPG 遊戲封面或角色卡面，例如《Final Fantasy》、《Genshin Impact》風格。若有背景請柔焦處理，主體突出。

            必殺技描述：{char.skill_description}。

            絕對禁止：圖片中出現任何文字、標語、說明、標籤、中英文等，只能是純角色圖像。
            """,
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

def validate_battle_result(battle_result, player, opponent):
    """驗證戰鬥結果的一致性"""
    try:
        battle_log = battle_result.get('battle_log', [])
        winner_id = battle_result.get('winner')
        
        # 追蹤血量
        player_hp = 100
        opponent_hp = 100
        
        for i, log in enumerate(battle_log):
            attacker = log.get('attacker')
            defender = log.get('defender')
            damage = log.get('damage', 0)
            remaining_hp = log.get('remaining_hp', 0)
            
            # 更新血量
            if defender == player.name:
                player_hp = max(0, player_hp - damage)
                if remaining_hp != player_hp:
                    print(f"血量不一致：回合 {i+1}，{player.name} 血量應該是 {player_hp}，但記錄為 {remaining_hp}")
                    return False
            elif defender == opponent.name:
                opponent_hp = max(0, opponent_hp - damage)
                if remaining_hp != opponent_hp:
                    print(f"血量不一致：回合 {i+1}，{opponent.name} 血量應該是 {opponent_hp}，但記錄為 {remaining_hp}")
                    return False
            
            # 檢查是否有人血量歸零
            if player_hp <= 0 or opponent_hp <= 0:
                break
        
        # 驗證勝者
        actual_winner_id = player.id if opponent_hp <= 0 else opponent.id
        if str(winner_id) != str(actual_winner_id):
            print(f"勝者不一致：記錄的勝者是 {winner_id}，但實際勝者應該是 {actual_winner_id}")
            return False
            
        return True
        
    except Exception as e:
        print(f"驗證戰鬥結果時發生錯誤：{e}")
        return False

def fix_battle_result(battle_result, player, opponent):
    """修正戰鬥結果的不一致性"""
    try:
        battle_log = battle_result.get('battle_log', [])
        
        # 重新計算血量
        player_hp = 100
        opponent_hp = 100
        
        for log in battle_log:
            attacker = log.get('attacker')
            defender = log.get('defender')
            damage = log.get('damage', 0)
            
            if defender == player.name:
                player_hp = max(0, player_hp - damage)
                log['remaining_hp'] = player_hp
            elif defender == opponent.name:
                opponent_hp = max(0, opponent_hp - damage)
                log['remaining_hp'] = opponent_hp
        
        # 修正勝者
        actual_winner_id = player.id if opponent_hp <= 0 else opponent.id
        battle_result['winner'] = str(actual_winner_id)
        
        # 修正戰鬥描述
        winner_name = player.name if opponent_hp <= 0 else opponent.name
        battle_result['battle_description'] = f"經過激烈的戰鬥，{winner_name} 最終獲得了勝利！"
        
        return battle_result
        
    except Exception as e:
        print(f"修正戰鬥結果時發生錯誤：{e}")
        return battle_result

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

                        **重要規則：**
                        1. 3-5個回合的戰鬥。
                        2. **你想像出的戰鬥地點必須對戰局產生決定性或意想不到的影響。**
                        3. 每個回合要有具體的動作和傷害值。
                        4. 要運用到角色的特殊能力。
                        5. **血量先歸零者輸，請嚴格按照血量計算決定勝負。**
                        6. **每個回合結束後，請仔細檢查剩餘血量，確保敘述與血量一致。**

                        **血量追蹤規則：**
                        - 每個角色初始血量：100
                        - 每回合結束後，被攻擊者的剩餘血量 = 當前血量 - 受到的傷害
                        - 如果剩餘血量 <= 0，該角色立即敗北
                        - **最後一個血量 > 0 的角色獲勝**

                        **JSON格式要求：**
                        {{
                            "winner": "獲勝者ID（{player.id}或{opponent.id}）",
                            "battle_log": [
                                {{
                                    "attacker": "攻擊者名稱",
                                    "defender": "防守者名稱", 
                                    "action": "動作描述",
                                    "damage": 傷害數值（數字）,
                                    "description": "詳細描述（必須與血量變化一致）",
                                    "remaining_hp": 防守者剩餘血量（數字）
                                }}
                            ],
                            "battle_description": "整體戰鬥描述（必須與最終結果一致）"
                        }}

                        **檢查清單：**
                        1. 每個回合的 damage 和 remaining_hp 必須是數字
                        2. 血量計算必須正確：remaining_hp = 100 - 累積傷害
                        3. 最後一個血量 > 0 的角色必須是 winner
                        4. battle_description 必須與 winner 一致
                        5. 如果某角色血量歸零，戰鬥立即結束

                        請仔細檢查你的回答，確保敘述與數據完全一致！
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

        # 驗證並修正戰鬥結果
        if not validate_battle_result(battle_result, player, opponent):
            print("戰鬥結果不一致，正在修正...")
            battle_result = fix_battle_result(battle_result, player, opponent)

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