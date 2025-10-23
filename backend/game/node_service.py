# 節點管理服務
import asyncio
import aiohttp
import time
import random
import hashlib
import requests
from typing import List, Dict, Optional, Tuple
from django.conf import settings
from django.utils import timezone
from .models import AINode, Battle, BattleVotingRecord
from collections import Counter
import logging

logger = logging.getLogger(__name__)


class NodeManager:
    """AI節點管理器 - 負載均衡、健康檢查、投票管理"""
    
    def __init__(self):
        self.timeout = getattr(settings, 'AI_NODE_TIMEOUT', 30)
        self.max_retries = getattr(settings, 'AI_NODE_MAX_RETRIES', 3)
        self.min_consensus_nodes = getattr(settings, 'MIN_CONSENSUS_NODES', 3)
    
    def get_available_nodes(self) -> List[AINode]:
        """獲取所有可用的節點"""
        return list(AINode.objects.filter(
            status='online'
        ).exclude(
            last_heartbeat__isnull=True
        ).filter(
            last_heartbeat__gte=timezone.now() - timezone.timedelta(minutes=5)
        ).order_by('-weight', 'avg_response_time'))
    
    def select_nodes_for_battle(self, battle_id: str, num_nodes: Optional[int] = None) -> List[AINode]:
        """為戰鬥選擇節點 - 使用確定性選擇確保一致性"""
        available_nodes = self.get_available_nodes()
        
        if not available_nodes:
            return []
        
        # 確定性選擇：基於battle_id的hash確保相同戰鬥總是選到相同節點
        random.seed(int(hashlib.md5(str(battle_id).encode()).hexdigest(), 16))
        
        # 選擇節點數量：預設為可用節點數的一半（最少3個，最多所有可用節點）
        if num_nodes is None:
            num_nodes = max(self.min_consensus_nodes, min(len(available_nodes), len(available_nodes) // 2 + 1))
        
        # 加權隨機選擇
        selected = []
        candidates = available_nodes.copy()
        
        for _ in range(min(num_nodes, len(candidates))):
            weights = [node.weight for node in candidates]
            node = random.choices(candidates, weights=weights)[0]
            selected.append(node)
            candidates.remove(node)
        
        logger.info(f"Selected {len(selected)} nodes for battle {battle_id}: {[n.name for n in selected]}")
        return selected
    
    async def call_node_generate_battle(self, node: AINode, battle_prompt: str, 
                                      battle_id: str, seed: Optional[int] = None) -> Tuple[bool, Dict, float]:
        """呼叫節點生成戰鬥結果"""
        start_time = time.time()
        
        try:
            payload = {
                "battle_id": battle_id,
                "prompt": battle_prompt,
                "seed": seed or random.randint(1, 1000000)
            }
            
            headers = {}
            if node.api_key:
                headers['Authorization'] = f'Bearer {node.api_key}'
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.post(
                    f"{node.url}/generate_battle",
                    json=payload,
                    headers=headers
                ) as response:
                    response_time = time.time() - start_time
                    
                    if response.status == 200:
                        result = await response.json()
                        # 使用 sync_to_async 來處理數據庫操作
                        from asgiref.sync import sync_to_async
                        await sync_to_async(node.record_request)(success=True, response_time=response_time)
                        return True, result, response_time
                    else:
                        error_text = await response.text()
                        logger.error(f"Node {node.name} returned {response.status}: {error_text}")
                        from asgiref.sync import sync_to_async
                        await sync_to_async(node.record_request)(success=False, response_time=response_time)
                        return False, {"error": f"HTTP {response.status}: {error_text}"}, response_time
                        
        except asyncio.TimeoutError:
            response_time = time.time() - start_time
            logger.error(f"Node {node.name} timeout after {response_time}s")
            from asgiref.sync import sync_to_async
            await sync_to_async(node.record_request)(success=False, response_time=response_time)
            return False, {"error": "Timeout"}, response_time
            
        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"Error calling node {node.name}: {str(e)}")
            from asgiref.sync import sync_to_async
            await sync_to_async(node.record_request)(success=False, response_time=response_time)
            return False, {"error": str(e)}, response_time
    
    async def collect_battle_votes(self, battle: Battle, battle_prompt: str, 
                                 selected_nodes: List[AINode]) -> List[BattleVotingRecord]:
        """收集所有節點的戰鬥結果投票"""
        battle_id = str(battle.id)
        seed = random.randint(1, 1000000)  # 所有節點使用相同seed以獲得一致性
        
        # 並行呼叫所有節點
        tasks = []
        for node in selected_nodes:
            task = self.call_node_generate_battle(node, battle_prompt, battle_id, seed)
            tasks.append((node, task))
        
        # 等待所有結果
        voting_records = []
        results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
        
        # 使用 sync_to_async 來處理數據庫操作
        from asgiref.sync import sync_to_async
        
        @sync_to_async
        def create_voting_record(battle, node, voted_winner_id, battle_result, response_time, is_valid, error_message=None):
            return BattleVotingRecord.objects.create(
                battle=battle,
                node=node,
                voted_winner_id=voted_winner_id,
                battle_result=battle_result,
                response_time=response_time,
                is_valid=is_valid,
                error_message=error_message
            )
        
        for (node, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                logger.error(f"Exception from node {node.name}: {result}")
                voting_record = await create_voting_record(
                    battle=battle,
                    node=node,
                    voted_winner_id="",
                    battle_result={"error": str(result)},
                    response_time=self.timeout,
                    is_valid=False,
                    error_message=str(result)
                )
            else:
                success, battle_result, response_time = result
                
                if success and 'winner' in battle_result:
                    voting_record = await create_voting_record(
                        battle=battle,
                        node=node,
                        voted_winner_id=str(battle_result['winner']),
                        battle_result=battle_result,
                        response_time=response_time,
                        is_valid=True
                    )
                else:
                    voting_record = await create_voting_record(
                        battle=battle,
                        node=node,
                        voted_winner_id="",
                        battle_result=battle_result,
                        response_time=response_time,
                        is_valid=False,
                        error_message=battle_result.get('error', 'Unknown error')
                    )
                
            voting_records.append(voting_record)
        
        logger.info(f"Collected {len(voting_records)} votes for battle {battle_id}")
        return voting_records
    
    def determine_consensus_result(self, voting_records: List[BattleVotingRecord], 
                                 player_id: str, opponent_id: str) -> Optional[Dict]:
        """多數決投票確定最終戰鬥結果"""
        valid_votes = [record for record in voting_records if record.is_valid]
        
        if len(valid_votes) < self.min_consensus_nodes:
            logger.warning(f"Not enough valid votes: {len(valid_votes)} < {self.min_consensus_nodes}")
            return None
        
        # 統計投票結果
        winner_votes = Counter()
        battle_results = {}
        
        for record in valid_votes:
            winner_id = record.voted_winner_id
            winner_votes[winner_id] += 1
            battle_results[winner_id] = record.battle_result
        
        # 確保只有有效的獲勝者ID被考慮
        valid_winner_ids = {str(player_id), str(opponent_id)}
        filtered_votes = {k: v for k, v in winner_votes.items() if k in valid_winner_ids}
        
        if not filtered_votes:
            logger.error("No votes for valid winner IDs")
            return None
        
        # 找出獲得最多票數的獲勝者
        consensus_winner = max(filtered_votes, key=filtered_votes.get)
        max_votes = filtered_votes[consensus_winner]
        
        # 檢查是否達到共識（超過半數）
        if max_votes <= len(valid_votes) // 2:
            logger.warning(f"No consensus reached. Winner {consensus_winner} got {max_votes}/{len(valid_votes)} votes")
            # 如果沒有明確共識，回退到本地生成
            return None
        
        # 選擇獲勝者對應的戰鬥結果
        consensus_result = battle_results[consensus_winner]
        
        logger.info(f"Consensus reached: {consensus_winner} with {max_votes}/{len(valid_votes)} votes")
        return consensus_result
    
    def generate_battle_with_consensus_sync(self, battle: Battle, battle_prompt: str) -> Optional[Dict]:
        """同步版本的分散式共識生成戰鬥結果 - 用於 Celery 任務"""
        import requests
        import json
        
        selected_nodes = self.select_nodes_for_battle(str(battle.id))
        
        if not selected_nodes:
            logger.info("No available nodes, falling back to local generation")
            return None
        
        print(f"選擇了 {len(selected_nodes)} 個節點進行投票")
        
        # 收集投票 - 使用並行請求
        import concurrent.futures
        import threading
        import time
        
        voting_records = []
        battle_id = str(battle.id)
        seed = random.randint(1, 1000000)
        
        def call_single_node(node):
            """調用單個節點的函數"""
            try:
                payload = {
                    "prompt": battle_prompt,
                    "battle_id": battle_id,
                    "seed": seed
                }
                
                headers = {'Content-Type': 'application/json'}
                if node.api_key:
                    headers['Authorization'] = f'Bearer {node.api_key}'
                
                start_time = time.time()
                response = requests.post(
                    f"{node.url}/generate_battle",
                    json=payload,
                    headers=headers,
                    timeout=30
                )
                response_time = time.time() - start_time
                
                print(f"節點 {node.name} 響應狀態: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    if 'winner' in result:
                        # 創建投票記錄
                        voting_record = BattleVotingRecord.objects.create(
                            battle=battle,
                            node=node,
                            voted_winner_id=str(result['winner']),
                            battle_result=result,
                            response_time=response_time,
                            is_valid=True
                        )
                        node.record_request(success=True, response_time=response_time)
                        print(f"✅ 節點 {node.name} 投票成功，選擇勝者: {result['winner']} ({response_time:.2f}秒)")
                        return voting_record
                    else:
                        print(f"❌ 節點 {node.name} 返回無效結果")
                        node.record_request(success=False, response_time=response_time)
                        return None
                else:
                    print(f"❌ 節點 {node.name} 返回錯誤: {response.status_code}")
                    print(response.text)
                    node.record_request(success=False, response_time=response_time)
                    return None
                    
            except Exception as e:
                print(f"❌ 調用節點 {node.name} 失敗: {e}")
                node.record_request(success=False, response_time=30.0)
                return None
        
        # 並行調用所有節點
        print(f"🚀 並行調用 {len(selected_nodes)} 個節點...")
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(selected_nodes)) as executor:
            # 提交所有任務
            future_to_node = {executor.submit(call_single_node, node): node for node in selected_nodes}
            
            # 收集結果
            for future in concurrent.futures.as_completed(future_to_node, timeout=35):
                node = future_to_node[future]
                try:
                    result = future.result()
                    if result:
                        voting_records.append(result)
                except Exception as e:
                    print(f"❌ 節點 {node.name} 執行異常: {e}")
        
        total_time = time.time() - start_time
        print(f"⏱️  並行調用完成，總耗時: {total_time:.2f}秒，收到 {len(voting_records)} 個有效投票")
        
        # 確定共識結果
        if voting_records:
            consensus_result = self.determine_consensus_result(
                voting_records, 
                str(battle.character1.id), 
                str(battle.character2.id)
            )
            print(f"共識投票完成，共 {len(voting_records)} 票")
            return consensus_result
        else:
            print("沒有收到有效投票，使用本地生成")
            return None
    
    async def generate_battle_with_consensus(self, battle: Battle, battle_prompt: str) -> Optional[Dict]:
        """使用分散式共識生成戰鬥結果"""
        selected_nodes = self.select_nodes_for_battle(str(battle.id))
        
        if not selected_nodes:
            logger.info("No available nodes, falling back to local generation")
            return None
        
        # 收集投票
        voting_records = await self.collect_battle_votes(battle, battle_prompt, selected_nodes)
        
        # 確定共識結果
        consensus_result = self.determine_consensus_result(
            voting_records, 
            str(battle.character1.id), 
            str(battle.character2.id)
        )
        
        return consensus_result


class NodeHealthChecker:
    """節點健康檢查服務"""
    
    @staticmethod
    async def check_node_health(node: AINode) -> bool:
        """檢查單個節點健康狀態"""
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                headers = {}
                if node.api_key:
                    headers['Authorization'] = f'Bearer {node.api_key}'
                
                async with session.get(f"{node.url}/health", headers=headers) as response:
                    if response.status == 200:
                        from asgiref.sync import sync_to_async
                        await sync_to_async(node.update_heartbeat)()
                        return True
                    else:
                        logger.warning(f"Node {node.name} health check failed: {response.status}")
                        from asgiref.sync import sync_to_async
                        node.status = 'error'
                        await sync_to_async(node.save)()
                        return False
                        
        except Exception as e:
            logger.error(f"Health check failed for node {node.name}: {str(e)}")
            from asgiref.sync import sync_to_async
            node.status = 'offline'
            await sync_to_async(node.save)()
            return False
    
    @staticmethod
    async def check_all_nodes():
        """檢查所有節點的健康狀態"""
        from asgiref.sync import sync_to_async
        
        # 使用 sync_to_async 來獲取節點列表
        nodes = await sync_to_async(list)(AINode.objects.all())
        tasks = [NodeHealthChecker.check_node_health(node) for node in nodes]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        online_count = sum(1 for result in results if result is True)
        logger.info(f"Health check completed: {online_count}/{len(nodes)} nodes online")
        
        return online_count