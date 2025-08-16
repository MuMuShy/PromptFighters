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

@shared_task
def generate_character_image(character_id):
    char = Character.objects.get(id=character_id)
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-preview-image-generation",
            contents=f"""
            請以3A級遊戲CG、電影級渲染的風格，繪製{char.prompt}這個角色。風格需極度精緻成熟，參考《Final Fantasy》、《Genshin Impact》、《Fate/Grand Order》、《Arknights》、《暴雪爐石傳說》角色卡面。  
            重點要求：  
            - 飽和且高對比的色彩，光影立體，材質細膩（如金屬、皮革、布料、魔法特效等）  
            - 線條乾淨俐落，無任何草圖感或插畫感  
            - 角色比例自然，姿勢帥氣，眼神有戲  
            - 服裝設計複雜且有層次，細節豐富  
            - 構圖以角色為主體，背景可柔焦或帶魔法特效  
            - 禁止Q版、卡通、低齡、簡筆畫、模糊、低解析、插畫風、草圖風  
            - 圖片中禁止出現任何文字、標語、說明、標籤、中英文等

            角色描述：{char.prompt}
            必殺技描述：{char.skill_description}
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