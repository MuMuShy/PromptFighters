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

            # 準備戰鬥場景描述 (使用結構化輸出，簡化prompt)
            battle_prompt = f"""
                        一場史詩般的對決即將展開！

                        **你的任務是創造一場獨一無二的戰鬥。**

                        第一步：請你自行想像一個極具創意、天馬行空的戰鬥地點。

                        第二步：基於這個你想像出來的地點，生成一場精彩的戰鬥過程。

                        **戰鬥員資料：**

                        玩家角色：
                        ID：{player.id}
                        名稱：{player.name}
                        描述：{player.prompt}
                        力量：{player.strength}
                        敏捷：{player.agility}
                        幸運：{player.luck}
                        特殊能力：{player.skill_description}

                        對手角色：
                        ID：{opponent.id}
                        名稱：{opponent.name}
                        描述：{opponent.prompt}
                        力量：{opponent.strength}
                        敏捷：{opponent.agility}
                        幸運：{opponent.luck}
                        特殊能力：{opponent.skill_description}

                        **重要規則：**
                        1. 3-5個回合的戰鬥。
                        2. 你想像出的戰鬥地點必須對戰局產生決定性或意想不到的影響。
                        3. 每個回合要有具體的動作和傷害值。
                        4. 要運用到角色的特殊能力。
                        5. 血量先歸零者輸，請嚴格按照血量計算決定勝負。
                        6. 每個回合結束後，請仔細檢查剩餘血量，確保敘述與血量一致。

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