from celery import shared_task
from celery.schedules import crontab
from google import genai
from google.genai import types
from django.conf import settings
from .models import Character, Battle, ScheduledBattle
import os
import json
import re
import random
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from pydantic import BaseModel
from typing import List
import asyncio
from .node_service import NodeManager

# 定義戰鬥結果的Pydantic模型
class BattleLogEntry(BaseModel):
    attacker: str
    defender: str
    action: str
    damage: int
    description: str
    remaining_hp: int

class BattleResult(BaseModel):
    winner: str
    battle_log: List[BattleLogEntry]
    battle_description: str

@shared_task
def generate_character_image(character_id):
    from .storage_service import get_cloud_storage
    
    char = Character.objects.get(id=character_id)
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    try:
        # 加強 Prompt，強調禁止文字
        prompt = f"""Create a high-quality character portrait of: {char.prompt}

CRITICAL REQUIREMENTS:
- ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO SYMBOLS, NO WATERMARKS anywhere in the image
- Pure visual art only, zero text content
- Clean image without any written language

Art Style:
- AAA game character art (Final Fantasy, Genshin Impact, Fate/Grand Order quality)
- Cinematic rendering with detailed materials (metal, leather, fabric, magic effects)
- Dramatic lighting, rich saturated colors, high contrast
- Dynamic heroic pose with expressive eyes
- Complex costume design with multiple layers
- Character as main focus, blurred or magical background

Character Special Ability: {char.skill_description}

REMINDER: The image must be completely text-free. No captions, labels, titles, or any form of text."""

        print(f"🎨 為角色 '{char.name}' 生成圖片...")
        
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE', 'TEXT'],
            )
        )
        # 檢查是否有收到 response
        if not response.candidates or len(response.candidates) == 0:
            print(f"❌ Gemini 沒有返回任何候選結果 (角色 {character_id})")
            return
        
        candidate = response.candidates[0]
        if not candidate.content or not candidate.content.parts:
            print(f"❌ Gemini 候選結果中沒有內容 (角色 {character_id})")
            return
        
        print(f"📦 收到 {len(candidate.content.parts)} 個部分的內容")
        
        # 尋找圖片數據
        image_found = False
        for i, part in enumerate(candidate.content.parts):
            print(f"  部分 {i+1}: inline_data={part.inline_data is not None}, text={hasattr(part, 'text') and part.text is not None}")
            
            if part.inline_data is not None:
                filename = f"character_{character_id}.png"
                
                # 🔧 關鍵修正：Gemini 返回的 data 可能是 base64 編碼的字串或 bytes
                import base64
                raw_data = part.inline_data.data
                
                print(f"🔍 原始數據類型: {type(raw_data)}")
                
                # 嘗試 base64 解碼
                if isinstance(raw_data, str):
                    print(f"🔄 檢測到字串，嘗試 base64 解碼...")
                    try:
                        image_data = base64.b64decode(raw_data)
                        print(f"✅ Base64 解碼成功")
                    except Exception as e:
                        print(f"❌ Base64 解碼失敗: {e}")
                        continue
                elif isinstance(raw_data, bytes):
                    # bytes 可能已經解碼，或者本身就是 base64 bytes
                    # 先檢查 PNG header
                    if raw_data[:4] == b'\x89PNG':
                        image_data = raw_data
                        print(f"✅ 已是有效的 PNG 數據")
                    else:
                        # 嘗試 base64 解碼
                        try:
                            image_data = base64.b64decode(raw_data)
                            print(f"✅ Base64 (bytes) 解碼成功")
                        except:
                            # 解碼失敗，使用原始數據
                            image_data = raw_data
                            print(f"⚠️ Base64 解碼失敗，使用原始數據")
                else:
                    image_data = raw_data
                    print(f"⚠️ 未知數據類型，直接使用")
                
                image_size = len(image_data)
                print(f"✅ 圖片數據大小: {image_size:,} bytes ({image_size/1024:.2f} KB)")
                
                # 驗證圖片數據
                if image_size < 1000:
                    print(f"⚠️ 圖片太小 ({image_size} bytes)，可能不是有效圖片")
                    continue
                
                # 檢查是否為 PNG 格式 (PNG header: 89 50 4E 47)
                if len(image_data) >= 4:
                    header = image_data[:4]
                    is_png = header == b'\x89PNG'
                    print(f"🔍 PNG 格式驗證: {'✅ 是' if is_png else '❌ 否'} (header: {header.hex()})")
                    if not is_png:
                        print(f"⚠️ 警告：不是標準 PNG 格式，但仍嘗試儲存")
                
                # 嘗試上傳到雲端儲存
                cloud_storage = get_cloud_storage()
                if cloud_storage.enabled:
                    print(f"☁️ 雲端儲存已啟用，開始上傳...")
                    cloud_url = cloud_storage.upload_file(
                        file_data=image_data,
                        file_name=filename,
                        content_type='image/png'
                    )
                    if cloud_url:
                        char.image_url = cloud_url
                        char.save()
                        print(f"✅ 角色圖片已上傳到雲端: {cloud_url}")
                        image_found = True
                        break
                    else:
                        print(f"⚠️ 雲端上傳失敗，改用本地儲存")
                else:
                    print(f"💾 雲端儲存未配置，使用本地儲存")
                
                # 備援：儲存到本地（如果雲端未配置或上傳失敗）
                media_path = os.path.join(settings.MEDIA_ROOT, filename)
                print(f"💾 儲存到本地路徑: {media_path}")
                with open(media_path, "wb") as f:
                    f.write(image_data)
                
                # 驗證檔案是否成功寫入
                if os.path.exists(media_path):
                    saved_size = os.path.getsize(media_path)
                    print(f"✅ 檔案已儲存，大小: {saved_size:,} bytes")
                else:
                    print(f"❌ 檔案儲存失敗: {media_path}")
                
                char.image_url = settings.MEDIA_URL + filename
                char.save()
                print(f"💾 角色圖片 URL 已更新: {char.image_url}")
                image_found = True
                break
        
        if not image_found:
            print(f"❌ 沒有在 response 中找到圖片數據 (角色 {character_id})")
    except Exception as e:
        # 可加 log 或通知
        print(f"❌ 圖片生成失敗 (角色 {character_id}): {e}")
        pass

def validate_battle_result(battle_result, player, opponent):
    """驗證戰鬥結果的一致性（優先使用ID，比對不過時回退比對名稱）"""
    try:
        battle_log = battle_result.get('battle_log', [])
        winner_id = str(battle_result.get('winner'))
        
        # 追蹤血量
        player_hp = 100
        opponent_hp = 100
        
        player_id_str = str(player.id)
        opponent_id_str = str(opponent.id)
        
        for i, log in enumerate(battle_log):
            attacker = str(log.get('attacker'))
            defender = str(log.get('defender'))
            damage = int(log.get('damage', 0))
            remaining_hp = int(log.get('remaining_hp', 0))
            
            matched = False
            # 先用ID比對
            if defender == player_id_str:
                player_hp = max(0, player_hp - damage)
                matched = True
                if remaining_hp != player_hp:
                    print(f"血量不一致(ID)：回合 {i+1}，{player.name} 血量應為 {player_hp}，記錄 {remaining_hp}")
                    return False
            elif defender == opponent_id_str:
                opponent_hp = max(0, opponent_hp - damage)
                matched = True
                if remaining_hp != opponent_hp:
                    print(f"血量不一致(ID)：回合 {i+1}，{opponent.name} 血量應為 {opponent_hp}，記錄 {remaining_hp}")
                    return False
            
            # 若ID未匹配，回退用名稱比對（兼容舊資料或模型輸出）
            if not matched:
                if defender == player.name:
                    player_hp = max(0, player_hp - damage)
                    if remaining_hp != player_hp:
                        print(f"血量不一致(名稱)：回合 {i+1}，{player.name} 血量應為 {player_hp}，記錄 {remaining_hp}")
                        return False
                elif defender == opponent.name:
                    opponent_hp = max(0, opponent_hp - damage)
                    if remaining_hp != opponent_hp:
                        print(f"血量不一致(名稱)：回合 {i+1}，{opponent.name} 血量應為 {opponent_hp}，記錄 {remaining_hp}")
                        return False
            
            if player_hp <= 0 or opponent_hp <= 0:
                break
        
        # 以血量推算勝者
        actual_winner_id = str(player.id) if opponent_hp <= 0 else str(opponent.id)
        if winner_id != actual_winner_id:
            print(f"勝者不一致：記錄 {winner_id}，實際應為 {actual_winner_id}")
            return False
        
        return True
    except Exception as e:
        print(f"驗證戰鬥結果時發生錯誤：{e}")
        return False

def fix_battle_result(battle_result, player, opponent):
    """修正戰鬥結果的不一致性"""
    try:
        battle_log = battle_result.get('battle_log', [])
        
        # 重新計算血量 - 使用ID而不是name
        player_hp = 100
        opponent_hp = 100
        
        player_id_str = str(player.id)
        opponent_id_str = str(opponent.id)
        
        print(f"修正戰鬥結果: 玩家ID={player_id_str}, 對手ID={opponent_id_str}")
        
        for i, log in enumerate(battle_log):
            attacker = str(log.get('attacker'))
            defender = str(log.get('defender'))
            damage = log.get('damage', 0)
            
            # 使用ID匹配，不是name
            if defender == player_id_str:
                player_hp = max(0, player_hp - damage)
                log['remaining_hp'] = player_hp
                print(f"回合{i+1}: {player.name}被攻擊，受到{damage}傷害，剩餘HP={player_hp}")
            elif defender == opponent_id_str:
                opponent_hp = max(0, opponent_hp - damage)
                log['remaining_hp'] = opponent_hp
                print(f"回合{i+1}: {opponent.name}被攻擊，受到{damage}傷害，剩餘HP={opponent_hp}")
        
        # 修正勝者：血量高的那個獲勝
        if player_hp > opponent_hp:
            actual_winner_id = player.id
            winner_name = player.name
        elif opponent_hp > player_hp:
            actual_winner_id = opponent.id
            winner_name = opponent.name
        else:
            # 平局，隨機決定
            import random
            if random.random() > 0.5:
                actual_winner_id = player.id
                winner_name = player.name
            else:
                actual_winner_id = opponent.id
                winner_name = opponent.name
        
        battle_result['winner'] = str(actual_winner_id)
        
        # 修正戰鬥描述
        battle_result['battle_description'] = f"經過激烈的戰鬥，{winner_name} 最終獲得了勝利！"
        
        print(f"修正結果: 玩家HP={player_hp}, 對手HP={opponent_hp}, 勝者={winner_name}")
        
        return battle_result
        
    except Exception as e:
        print(f"修正戰鬥結果時發生錯誤：{e}")
        import traceback
        traceback.print_exc()
        return battle_result


@shared_task
def sync_ladder_rankings_task():
    """定時同步天梯排名的任務"""
    print(f"[{timezone.now()}] 開始執行定時同步天梯排名任務")
    
    try:
        # 同步所有活躍賽季的排名（避免循環導入）
        from .ladder_service import LadderService
        LadderService.sync_all_active_seasons()
        print(f"[{timezone.now()}] 定時同步天梯排名任務完成")
        return True
    except Exception as e:
        print(f"[{timezone.now()}] 定時同步天梯排名任務失敗: {e}")
        return False


@shared_task
def sync_specific_season_rankings_task(season_id):
    """同步指定賽季排名的任務"""
    print(f"[{timezone.now()}] 開始執行同步賽季 {season_id} 排名任務")
    
    try:
        # 避免循環導入
        from .models import LadderSeason
        from .ladder_service import LadderService
        
        season = LadderSeason.objects.get(id=season_id)
        LadderService.sync_season_rankings(season)
        print(f"[{timezone.now()}] 同步賽季 {season.name} 排名任務完成")
        return True
    except LadderSeason.DoesNotExist:
        print(f"[{timezone.now()}] 賽季 {season_id} 不存在")
        return False
    except Exception as e:
        print(f"[{timezone.now()}] 同步賽季 {season_id} 排名任務失敗: {e}")
        return False


@shared_task
def run_battle_task(battle_id):
    try:
        # 使用 transaction.atomic 確保資料庫操作的原子性
        with transaction.atomic():
            # 根據 battle_id 獲取戰鬥實例和參與者
            battle = Battle.objects.get(id=battle_id)
            player = battle.character1
            opponent = battle.character2

            # 準備戰鬥場景描述 (使用結構化輸出，加入屬性權重與微量幸運)
            # 推導屬性引導參數（作為 LLM 參考，不是硬規則）
            p_STR, p_AGI, p_LUK = player.strength, player.agility, player.luck
            o_STR, o_AGI, o_LUK = opponent.strength, opponent.agility, opponent.luck

            def dmg_params(STR, AGI):
                base = 0.6*STR + 0.3*AGI
                low = max(5, int(base*0.9))
                high = int(base*1.1 + 5)
                return low, high
            p_low, p_high = dmg_params(p_STR, p_AGI)
            o_low, o_high = dmg_params(o_STR, o_AGI)

            def crit_rate(LUK):
                return min(0.15, 0.005*LUK)  # 上限 15%
            p_crit = crit_rate(p_LUK)
            o_crit = crit_rate(o_LUK)

            def dodge_suggestion(a_agi, d_agi):
                diff = max(0, a_agi - d_agi)
                return min(0.10, diff/200.0)  # 0%~10%
            # 我方攻擊對手 → 對手的建議閃避率
            o_vs_p_dodge = dodge_suggestion(p_AGI, o_AGI)
            # 對手攻擊我方 → 我方的建議閃避率
            p_vs_o_dodge = dodge_suggestion(o_AGI, p_AGI)

            luck_one_off_p = min(0.10, 0.002*p_LUK)
            luck_one_off_o = min(0.10, 0.002*o_LUK)

            battle_prompt = f"""
                        一場史詩般的對決即將展開！

                        **你的任務是創造一場獨一無二的戰鬥。**

                        第一步：請你自行想像一個極具創意、天馬行空的戰鬥地點。

                        第二步：基於這個你想像出來的地點，生成一場精彩的戰鬥過程。

                        **戰鬥員資料：**

                        角色1：
                        ID：{player.id}
                        名稱：{player.name}
                        描述：{player.prompt}
                        力量：{player.strength}
                        敏捷：{player.agility}
                        幸運：{player.luck}
                        特殊能力：{player.skill_description}

                        角色2：
                        ID：{opponent.id}
                        名稱：{opponent.name}
                        描述：{opponent.prompt}
                        力量：{opponent.strength}
                        敏捷：{opponent.agility}
                        幸運：{opponent.luck}
                        特殊能力：{opponent.skill_description}

                        **屬性權重與隨機機制（請遵循，允許 ±10% 的自然波動）：**
                        - 傷害建議（角色1→角色2）：每回合在 [{p_low}, {p_high}] 間，並有 0~5 的微隨機。
                        - 傷害建議（角色2→角色1）：每回合在 [{o_low}, {o_high}] 間，並有 0~5 的微隨機。
                        - 暴擊率建議：角色1 {p_crit:.0%}、角色2 {o_crit:.0%}，暴擊約 1.5x。
                        - 閃避率建議：角色1被攻時 ~{p_vs_o_dodge:.0%}，角色2被攻時 ~{o_vs_p_dodge:.0%}。
                        - 幸運一次性意外：全場最多一次，角色1機率 {luck_one_off_p:.0%}、角色2機率 {luck_one_off_o:.0%}，可造成當次結果最高約 1.2x 偏移（可能有利或不利）。

                        **先後手建議（每回合判定一次）：**
                        - 基於敏捷，較高者約 60% 機率先手；剩餘 40% 視敘事交替。

                        **重要規則：**
                        1. 5-10個回合的戰鬥。
                        2. 你想像出的戰鬥地點必須對戰局產生決定性或意想不到的影響。
                        3. 每個回合要有具體的動作和傷害值。
                        4. 要運用到角色的特殊能力。
                        5. 血量先歸零者輸，請嚴格按照血量計算決定勝負。
                        6. 每個回合結束後，請仔細檢查剩餘血量，確保敘述與數據一致。
                        7. 若有角色血量歸零，立即結束戰鬥，不要補多餘回合。

                        **血量追蹤規則：**
                        - 每個角色初始血量：100
                        - 每回合結束後，被攻擊者的剩餘血量 = 當前血量 - 受到的傷害
                        - 如果剩餘血量 <= 0，該角色立即敗北
                        - 最後一個血量 > 0 的角色獲勝

                        **重要：ID格式要求（必須嚴格遵守）：**
                        - winner字段必須填入獲勝者的ID：{player.id} 或 {opponent.id}
                        - 每個回合的attacker字段必須填入攻擊者的ID：{player.id} 或 {opponent.id}
                        - 每個回合的defender字段必須填入防守者的ID：{player.id} 或 {opponent.id}
                        - description字段中可以使用角色名稱（{player.name}、{opponent.name}）來描述戰鬥
                        - 每個回合的damage和remaining_hp必須是數字
                        - 血量計算必須正確
                        - 最後一個血量 > 0 的角色必須是winner
                        - 如果某角色血量歸零，戰鬥立即結束

                        **範例格式（請務必使用ID而不是名稱）：**
                        {{
                            "winner": "{player.id}",
                            "battle_log": [
                                {{
                                    "attacker": "{player.id}",
                                    "defender": "{opponent.id}",
                                    "action": "火球術",
                                    "damage": 15,
                                    "remaining_hp": 85,
                                    "description": "{player.name}施放火球術攻擊{opponent.name}"
                                }}
                            ]
                        }}

                        請仔細檢查你的回答，確保：
                        1. 所有ID字段都使用角色ID，不是名稱
                        2. 敘述與數據完全一致
                        3. 血量計算準確無誤
                        """

        # 嘗試使用分散式節點生成戰鬥結果
        node_manager = NodeManager()
        battle_result = None
        
        try:
            # 檢查是否有可用節點
            available_nodes = node_manager.get_available_nodes()
            if available_nodes:
                print(f"找到 {len(available_nodes)} 個可用節點，嘗試分散式生成")
                
                # 使用同步版本的分散式共識
                battle_result = node_manager.generate_battle_with_consensus_sync(battle, battle_prompt)
                
                if battle_result:
                    print("成功從分散式節點獲得戰鬥結果")
                else:
                    print("分散式節點未能產生共識，使用本地生成")
                
            else:
                print("沒有可用的AI節點，使用本地生成")
                battle_result = None
                
        except Exception as e:
            print(f"分散式節點調用失敗，使用本地生成: {e}")
            battle_result = None
        
        # 如果分散式節點無法產生共識結果，回退到本地Gemini API
        if battle_result is None:
            print("回退到本地Gemini API生成戰鬥結果")
            genai_client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
            response = genai_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=battle_prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": BattleResult,
                }
            )
            
            # 直接使用解析後的結果，轉換為dict格式以兼容現有邏輯
            if response.parsed:
                battle_result = response.parsed.model_dump()
            else:
                # 如果解析失敗，拋出錯誤
                raise ValueError("Failed to parse battle result from Gemini API")

        # 驗證並修正戰鬥結果
        if not validate_battle_result(battle_result, player, opponent):
            print("戰鬥結果不一致，正在修正...")
            battle_result = fix_battle_result(battle_result, player, opponent)

        # 更新 Battle 物件
        battle.winner = player if str(battle_result['winner']) == str(player.id) else opponent
        battle.battle_log = battle_result  # 將 AI 的回傳存到 battle_log
        battle.status = 'COMPLETED'
        battle.save()

        # 更新角色戰績和任務進度
        from .daily_quest_service import DailyQuestService
        
        if battle.winner == player:
            player.win_count += 1
            player_user = player.player
            
            # 戰鬥勝利獎勵
            base_gold_reward = 500
            base_exp_reward = 5
            
            # 根據對手稀有度調整獎勵
            rarity_multiplier = {1: 1.0, 2: 1.2, 3: 1.5, 4: 2.0, 5: 3.0}
            multiplier = rarity_multiplier.get(opponent.rarity, 1.0)
            
            gold_reward = int(base_gold_reward * multiplier)
            exp_reward = int(base_exp_reward * multiplier)
            
            # 發放獎勵
            player_user.gold += gold_reward
            player_user.exp_potion += exp_reward
            player_user.save()
            
            # 將獎勵信息加入戰鬥日誌
            battle_result['battle_rewards'] = {
                'gold': gold_reward,
                'exp_potion': exp_reward,
                'rarity_bonus': multiplier,
                'victory': True
            }
            
            # 更新玩家勝利任務進度
            DailyQuestService.update_quest_progress(
                player.player, 'battle_win', 1
            )
        else:
            player.loss_count += 1
            # 失敗也給少量安慰獎勵
            player_user = player.player
            consolation_gold = 100
            player_user.gold += consolation_gold
            player_user.save()
            
            # 將獎勵信息加入戰鬥日誌
            battle_result['battle_rewards'] = {
                'gold': consolation_gold,
                'exp_potion': 0,
                'rarity_bonus': 1.0,
                'victory': False
            }
        
        # 更新戰鬥日誌包含獎勵信息
        battle.battle_log = battle_result
        battle.save()
        
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



# 天梯系統定時任務

@shared_task
def schedule_hourly_battles():
    """每小時排程戰鬥"""
    from .ladder_service import LadderService
    
    try:
        battle = LadderService.schedule_next_battle()
        if battle:
            print(f"Scheduled battle: {battle}")
            return f"Battle scheduled: {battle.id}"
        else:
            print("No battle could be scheduled")
            return "No battle scheduled"
    except Exception as e:
        print(f"Error scheduling battle: {e}")
        return f"Error: {e}"


@shared_task
def open_betting():
    """開放下注（戰鬥前30分鐘）"""
    from .ladder_service import LadderService
    
    now = timezone.now()
    battles_to_open = ScheduledBattle.objects.filter(
        betting_start_time__lte=now,
        status='scheduled'
    )
    
    opened_count = 0
    for battle in battles_to_open:
        battle.status = 'betting_open'
        battle.save()
        opened_count += 1
        print(f"Opened betting for battle: {battle}")
    
    return f"Opened betting for {opened_count} battles"


@shared_task
def close_betting():
    """關閉下注（戰鬥前5分鐘）"""
    now = timezone.now()
    battles_to_close = ScheduledBattle.objects.filter(
        betting_end_time__lte=now,
        status='betting_open'
    )
    
    closed_count = 0
    for battle in battles_to_close:
        battle.status = 'betting_closed'
        battle.save()
        closed_count += 1
        print(f"Closed betting for battle: {battle}")
    
    return f"Closed betting for {closed_count} battles"


@shared_task
def start_scheduled_battles():
    """開始已排程的戰鬥"""
    from .ladder_service import LadderService
    
    now = timezone.now()
    battles_to_start = ScheduledBattle.objects.filter(
        scheduled_time__lte=now,
        status='betting_closed'
    )
    
    started_count = 0
    for battle in battles_to_start:
        actual_battle = LadderService.start_battle(battle)
        if actual_battle:
            started_count += 1
            print(f"Started battle: {battle}")
    
    return f"Started {started_count} battles"


@shared_task
def check_completed_battles():
    """檢查並結算已完成的戰鬥"""
    from .ladder_service import LadderService
    
    # 查找進行中但實際戰鬥已完成的戰鬥
    in_progress_battles = ScheduledBattle.objects.filter(status='in_progress')
    
    completed_count = 0
    for battle in in_progress_battles:
        # 查找對應的實際戰鬥記錄
        actual_battle = Battle.objects.filter(
            character1=battle.fighter1.character,
            character2=battle.fighter2.character,
            created_at__gte=battle.scheduled_time - timedelta(minutes=10),
            status='COMPLETED'
        ).first()
        
        if actual_battle:
            LadderService.complete_battle(battle, actual_battle)
            completed_count += 1
            print(f"Completed and settled battle: {battle}")
    
    return f"Completed {completed_count} battles"


@shared_task
def update_ladder_rankings():
    """更新天梯排名（每小時）"""
    from .ladder_service import LadderService
    from .models import LadderSeason
    
    active_seasons = LadderSeason.objects.filter(is_active=True)
    
    updated_count = 0
    for season in active_seasons:
        LadderService.update_rankings(season)
        updated_count += 1
        print(f"Updated rankings for season: {season}")
    
    return f"Updated rankings for {updated_count} seasons"


@shared_task
def cleanup_old_battles():
    """清理舊的戰鬥記錄（保留最近7天）"""
    cutoff_date = timezone.now() - timedelta(days=7)
    
    old_battles = ScheduledBattle.objects.filter(
        created_at__lt=cutoff_date,
        status='completed'
    )
    
    count = old_battles.count()
    old_battles.delete()
    
    return f"Cleaned up {count} old battles"


@shared_task 
def check_node_health():
    """定期檢查節點健康狀態，標記離線節點"""
    from .models import AINode
    
    print(f"[{timezone.now()}] 開始節點健康檢查...")
    
    # 找出超過5分鐘沒有心跳的節點
    offline_threshold = timezone.now() - timedelta(minutes=5)
    
    # 獲取所有在線節點進行檢查
    online_nodes = AINode.objects.filter(status='online')
    total_online = online_nodes.count()
    
    print(f"[{timezone.now()}] 檢查 {total_online} 個在線節點...")
    
    # 更新狀態為offline的節點（原本是online但心跳超時的）
    offline_nodes = online_nodes.filter(last_heartbeat__lt=offline_threshold)
    
    offline_count = 0
    for node in offline_nodes:
        print(f"[{timezone.now()}] 節點 {node.name} 心跳超時 (最後心跳: {node.last_heartbeat})")
        node.status = 'offline'
        node.save()
        offline_count += 1
    
    # 找出沒有心跳記錄的節點也標記為離線
    no_heartbeat_nodes = online_nodes.filter(last_heartbeat__isnull=True)
    
    no_heartbeat_count = 0
    for node in no_heartbeat_nodes:
        print(f"[{timezone.now()}] 節點 {node.name} 無心跳記錄")
        node.status = 'offline'
        node.save()
        no_heartbeat_count += 1
    
    # 顯示當前所有節點狀態
    all_nodes = AINode.objects.all()
    for node in all_nodes:
        status_info = f"節點 {node.name}: {node.status}"
        if node.last_heartbeat:
            time_diff = timezone.now() - node.last_heartbeat
            status_info += f" (最後心跳: {time_diff.total_seconds():.0f}秒前)"
        else:
            status_info += " (無心跳記錄)"
        print(f"[{timezone.now()}] {status_info}")
    
    total_marked_offline = offline_count + no_heartbeat_count
    print(f"[{timezone.now()}] 健康檢查完成: 標記 {total_marked_offline} 個節點為離線")
    
    return f"Health check completed: {total_marked_offline} nodes marked offline" 