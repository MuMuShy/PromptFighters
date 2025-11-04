"""
MNT 水龍頭服務 - 從後端錢包發送測試 MNT 給玩家
"""
import os
import logging
from web3 import Web3
from eth_account import Account
from decimal import Decimal

logger = logging.getLogger(__name__)


class MNTFaucetService:
    """MNT 水龍頭服務 - 發送測試 MNT 給玩家"""
    
    def __init__(self):
        self.private_key = os.getenv('WALLET_PRIVATE_KEY')  # 使用與 NFT 服務相同的後端錢包
        self.chain_id = int(os.getenv('CHAIN_ID', '5003'))
        self.rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
        
        # 每日簽到獎勵的 MNT 數量（單位：MNT）
        self.daily_reward_amount = Decimal(os.getenv('DAILY_MNT_REWARD', '5'))
        
        if not self.private_key:
            logger.warning("⚠️  MNT 水龍頭服務未配置 WALLET_PRIVATE_KEY")
            self.enabled = False
            return
        
        try:
            logger.info(f"🔗 正在初始化 MNT 水龍頭服務...")
            logger.info(f"   Chain ID: {self.chain_id}")
            logger.info(f"   RPC: {self.rpc_url}")
            logger.info(f"   每日獎勵: {self.daily_reward_amount} MNT")
            
            # 初始化 Web3
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            
            # 檢查連接
            if not self.w3.is_connected():
                raise Exception("無法連接到 RPC 節點")
            
            # 初始化帳戶
            self.account = Account.from_key(self.private_key)
            logger.info(f"   後端錢包地址: {self.account.address}")
            
            # 檢查餘額
            balance_wei = self.w3.eth.get_balance(self.account.address)
            balance_mnt = Web3.from_wei(balance_wei, 'ether')
            logger.info(f"   後端錢包餘額: {balance_mnt} MNT")
            
            if balance_mnt < self.daily_reward_amount:
                logger.warning(f"⚠️  後端錢包餘額不足！需要至少 {self.daily_reward_amount} MNT 來發放獎勵")
            
            self.enabled = True
            logger.info(f"✅ MNT 水龍頭服務初始化成功！")
            
        except Exception as e:
            logger.error(f"❌ MNT 水龍頭服務初始化失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.enabled = False
    
    def send_mnt(self, to_address: str, amount_mnt: Decimal = None) -> dict:
        """
        發送 MNT 到指定地址
        
        Args:
            to_address: 接收地址
            amount_mnt: 發送金額（MNT），如果為 None 則使用默認每日獎勵
            
        Returns:
            dict: {
                'success': bool,
                'tx_hash': str (if success),
                'error': str (if failed)
            }
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'MNT 水龍頭服務未啟用'
            }
        
        try:
            # 使用默認金額或指定金額
            amount = amount_mnt if amount_mnt is not None else self.daily_reward_amount
            
            # 轉換為 wei
            amount_wei = Web3.to_wei(float(amount), 'ether')
            
            # 檢查後端錢包餘額
            balance_wei = self.w3.eth.get_balance(self.account.address)
            
            # 構建初始交易（用於估算 gas）
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            gas_price = self.w3.eth.gas_price
            
            # 先構建一個基本交易來估算 gas
            transaction = {
                'to': Web3.to_checksum_address(to_address),
                'value': amount_wei,
                'gasPrice': gas_price,
                'nonce': nonce,
                'chainId': self.chain_id
            }
            
            # 動態估算 gas（Mantle L2 需要更多 gas）
            try:
                estimated_gas = self.w3.eth.estimate_gas(transaction)
                # 添加 20% 的安全邊際
                estimated_gas = int(estimated_gas * 1.2)
                logger.info(f"📊 估算 gas: {estimated_gas}")
            except Exception as e:
                logger.warning(f"⚠️ Gas 估算失敗，使用保守值: {e}")
                # 如果估算失敗，使用保守值（Mantle L2 通常需要更高的 gas）
                estimated_gas = 100000  # 保守值
            
            # 計算總成本
            total_cost = amount_wei + (estimated_gas * gas_price)
            
            if balance_wei < total_cost:
                balance_mnt = Web3.from_wei(balance_wei, 'ether')
                required_mnt = Web3.from_wei(total_cost, 'ether')
                return {
                    'success': False,
                    'error': f'後端錢包餘額不足！當前餘額: {balance_mnt} MNT，需要: {required_mnt} MNT'
                }
            
            # 更新交易，添加估算的 gas
            transaction['gas'] = estimated_gas
            
            # 簽名交易
            signed_txn = self.account.sign_transaction(transaction)
            
            # 發送交易
            logger.info(f"📤 發送 {amount} MNT 到 {to_address}...")
            # 使用 raw_transaction (新版本 eth-account 使用下劃線命名)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            # 等待交易確認（可選，可以異步處理）
            # receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            tx_hash_hex = tx_hash.hex()
            logger.info(f"✅ 交易已發送: {tx_hash_hex}")
            
            return {
                'success': True,
                'tx_hash': tx_hash_hex,
                'amount': str(amount),
                'to_address': to_address
            }
            
        except Exception as e:
            logger.error(f"❌ 發送 MNT 失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
    
    def check_balance(self) -> dict:
        """檢查後端錢包餘額"""
        if not self.enabled:
            return {
                'success': False,
                'error': 'MNT 水龍頭服務未啟用'
            }
        
        try:
            balance_wei = self.w3.eth.get_balance(self.account.address)
            balance_mnt = Web3.from_wei(balance_wei, 'ether')
            
            return {
                'success': True,
                'balance_wei': str(balance_wei),
                'balance_mnt': str(balance_mnt),
                'address': self.account.address
            }
        except Exception as e:
            logger.error(f"檢查餘額失敗: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# 單例實例
_faucet_service_instance = None


def get_faucet_service():
    """獲取 MNT 水龍頭服務實例（單例模式）"""
    global _faucet_service_instance
    if _faucet_service_instance is None:
        _faucet_service_instance = MNTFaucetService()
    return _faucet_service_instance

