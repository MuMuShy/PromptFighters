"""
NFT 服務 - 處理角色 NFT 的鑄造和管理（使用 Web3.py + Thirdweb ERC721Drop + Pinata IPFS）
"""
import os
import json
import base64
import requests
from web3 import Web3
from eth_account import Account
from django.db import models
import logging

logger = logging.getLogger(__name__)


class NFTService:
    """NFT 管理服務 - 使用 Web3.py 與 Thirdweb NFTCollection 合約"""
    
    # Thirdweb NFTCollection ABI（只包含需要的函數）
    CONTRACT_ABI = json.loads('''[
        {
            "inputs": [
                {"internalType": "address", "name": "_to", "type": "address"},
                {"internalType": "string", "name": "_uri", "type": "string"}
            ],
            "name": "mintTo",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
            "name": "ownerOf",
            "outputs": [{"internalType": "address", "name": "", "type": "address"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "nextTokenIdToMint",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]''')
    
    def __init__(self):
        self.private_key = os.getenv('WALLET_PRIVATE_KEY')
        self.contract_address = os.getenv('NFT_CONTRACT_ADDRESS')
        self.chain_id = int(os.getenv('CHAIN_ID', '5003'))
        self.rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
        
        # Pinata IPFS 配置
        self.pinata_api_key = os.getenv('PINATA_API_KEY')
        self.pinata_secret_key = os.getenv('PINATA_SECRET_KEY')
        
        if not all([self.private_key, self.contract_address]):
            logger.warning("⚠️  NFT 服務未完整配置")
            logger.warning(f"   WALLET_PRIVATE_KEY: {'✅' if self.private_key else '❌'}")
            logger.warning(f"   NFT_CONTRACT_ADDRESS: {'✅' if self.contract_address else '❌'}")
            logger.warning(f"   PINATA_API_KEY: {'✅' if self.pinata_api_key else '❌'}")
            self.enabled = False
            return
        
        try:
            logger.info(f"🔗 正在初始化 NFT 服務...")
            logger.info(f"   Chain ID: {self.chain_id}")
            logger.info(f"   Contract: {self.contract_address}")
            logger.info(f"   RPC: {self.rpc_url}")
            
            # 初始化 Web3
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            
            # 檢查連接
            if not self.w3.is_connected():
                raise Exception("無法連接到 RPC 節點")
            
            # 初始化帳戶
            self.account = Account.from_key(self.private_key)
            logger.info(f"   錢包地址: {self.account.address}")
            
            # 初始化合約
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.contract_address),
                abi=self.CONTRACT_ABI
            )
            
            self.enabled = True
            logger.info(f"✅ NFT 服務初始化成功！")
            
        except Exception as e:
            logger.error(f"❌ NFT 服務初始化失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.enabled = False
    
    def mint_character_nft(self, character, owner_wallet_address: str):
        """
        鑄造角色 NFT（使用 mintTo + IPFS）
        
        流程:
        1. 上傳 metadata 到 IPFS (Pinata)
        2. 呼叫 mintTo(address, uri) 直接鑄造
        
        Args:
            character: Character 模型實例
            owner_wallet_address: 接收 NFT 的錢包地址
            
        Returns:
            dict: {
                'success': bool,
                'token_id': int,
                'tx_hash': str,
                'contract_address': str,
                'ipfs_url': str,
                'error': str (if failed)
            }
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'NFT 服務未啟用或配置不完整'
            }
        
        try:
            logger.info(f"=" * 60)
            logger.info(f"🎨 開始鑄造角色 NFT: {character.name} (ID: {character.id})")
            logger.info(f"   接收錢包: {owner_wallet_address}")
            logger.info(f"   合約地址: {self.contract_address}")
            logger.info(f"   Backend 錢包: {self.account.address}")
            logger.info(f"=" * 60)
            
            # 步驟 1: 準備並上傳 Metadata 到 IPFS
            logger.info(f"📦 步驟 1: 上傳 Metadata 到 IPFS...")
            metadata = self._prepare_metadata(character)
            ipfs_result = self._upload_to_ipfs(metadata, character.name)
            
            if not ipfs_result['success']:
                return ipfs_result
            
            ipfs_url = ipfs_result['ipfs_url']
            logger.info(f"✅ IPFS 上傳成功: {ipfs_url}")
            
            # 步驟 2: MintTo 鑄造 NFT
            logger.info(f"🎫 步驟 2: MintTo 鑄造 NFT...")
            
            # 獲取下一個 Token ID
            next_token_id = self.contract.functions.nextTokenIdToMint().call()
            logger.info(f"🔢 下一個 Token ID: {next_token_id}")
            
            # 構建交易
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            
            logger.info(f"📋 交易參數:")
            logger.info(f"   From: {self.account.address}")
            logger.info(f"   To (Receiver): {owner_wallet_address}")
            logger.info(f"   Token URI: {ipfs_url}")
            logger.info(f"   Nonce: {nonce}")
            
            receiver = Web3.to_checksum_address(owner_wallet_address)
            
            # 估算 Gas
            try:
                gas_estimate = self.contract.functions.mintTo(
                    receiver, ipfs_url
                ).estimate_gas({'from': self.account.address})
                logger.info(f"   Gas Estimate: {gas_estimate}")
            except Exception as e:
                logger.error('使用的錢包地址: ' + self.account.address)
                logger.error(f"❌ Gas 估算失敗: {e}")
                return {
                    'success': False,
                    'error': f'MintTo 失敗，請確認 backend 錢包有 MINTER_ROLE 或 admin 權限'
                }
            
            # 構建並發送交易
            transaction = self.contract.functions.mintTo(
                receiver, ipfs_url
            ).build_transaction({
                'chainId': self.chain_id,
                'from': self.account.address,
                'gas': int(gas_estimate * 1.2),
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            logger.info(f"📤 交易已發送: {tx_hash.hex()}")
            logger.info(f"⏳ 等待交易確認...")
            
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt['status'] != 1:
                raise Exception("交易失敗")
            
            logger.info(f"✅ NFT 鑄造成功!")
            logger.info(f"   Token ID: {next_token_id}")
            logger.info(f"   TX Hash: {tx_hash.hex()}")
            logger.info(f"   IPFS: {ipfs_url}")
            
            return {
                'success': True,
                'token_id': int(next_token_id),
                'tx_hash': tx_hash.hex(),
                'contract_address': self.contract_address,
                'ipfs_url': ipfs_url
            }
            
        except Exception as e:
            logger.error(f"❌ NFT 鑄造失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
    
    def _upload_to_ipfs(self, metadata: dict, name: str):
        """上傳 metadata 到 Pinata IPFS"""
        if not self.pinata_api_key:
            logger.warning("⚠️  Pinata 未配置，使用臨時 JSON")
            # 回退方案：使用 base64 encoded JSON (不推薦，但可測試)
            metadata_json = json.dumps(metadata)
            metadata_base64 = base64.b64encode(metadata_json.encode()).decode()
            return {
                'success': True,
                'ipfs_url': f"data:application/json;base64,{metadata_base64}"
            }
        
        try:
            # Pinata API
            url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
            headers = {
                "pinata_api_key": self.pinata_api_key,
                "pinata_secret_api_key": self.pinata_secret_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "pinataContent": metadata,
                "pinataMetadata": {
                    "name": f"{name}_metadata.json"
                }
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"❌ Pinata 上傳失敗: {response.text}")
                return {
                    'success': False,
                    'error': f'IPFS 上傳失敗: {response.text}'
                }
            
            result = response.json()
            ipfs_hash = result['IpfsHash']
            ipfs_url = f"ipfs://{ipfs_hash}"
            
            logger.info(f"✅ IPFS 上傳成功: {ipfs_url}")
            logger.info(f"   Gateway URL: https://gateway.pinata.cloud/ipfs/{ipfs_hash}")
            
            return {
                'success': True,
                'ipfs_url': ipfs_url,
                'ipfs_hash': ipfs_hash
            }
            
        except Exception as e:
            logger.error(f"❌ IPFS 上傳失敗: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    def _prepare_metadata(self, character):
        """準備 NFT Metadata"""
        from .models import Battle
        
        # 計算戰績
        total_battles = Battle.objects.filter(
            models.Q(character1=character) | models.Q(character2=character),
            status='COMPLETED'
        ).count()
        
        wins = character.win_count
        losses = character.loss_count
        win_rate = (wins / total_battles * 100) if total_battles > 0 else 0
        
        # 構建 Metadata
        metadata = {
            "name": character.name,
            "description": f"{character.prompt}\n\n✨ 特殊能力: {character.skill_description}",
            "image": character.image_url or "https://via.placeholder.com/512",
            "attributes": [
                {"trait_type": "Rarity", "value": character.rarity_name},
                {"trait_type": "Level", "value": character.level},
                {"trait_type": "Strength", "value": character.strength},
                {"trait_type": "Agility", "value": character.agility},
                {"trait_type": "Luck", "value": character.luck},
                {"trait_type": "Total Battles", "value": total_battles},
                {"trait_type": "Wins", "value": wins},
                {"trait_type": "Losses", "value": losses},
                {"trait_type": "Win Rate", "value": f"{win_rate:.1f}%"},
                {"trait_type": "Created At", "value": character.created_at.strftime("%Y-%m-%d")},
            ]
        }
        
        return metadata
    
    def get_nft_owner(self, token_id: int) -> str:
        """
        查詢 NFT 持有者
        
        Returns:
            str: 錢包地址（小寫）
        """
        if not self.enabled:
            return None
        
        try:
            owner = self.contract.functions.ownerOf(token_id).call()
            owner = owner.lower()
            logger.info(f"🔍 Token ID {token_id} 的持有者: {owner}")
            return owner
        except Exception as e:
            logger.error(f"❌ 查詢 NFT 持有者失敗 (Token ID: {token_id}): {e}")
            return None
    
    def verify_ownership(self, token_id: int, wallet_address: str) -> bool:
        """
        驗證 NFT 所有權
        
        Returns:
            bool: True 如果 wallet_address 擁有該 NFT
        """
        owner = self.get_nft_owner(token_id)
        if not owner:
            return False
        
        is_owner = owner == wallet_address.lower()
        logger.info(f"🔐 所有權驗證: Token ID {token_id} - {wallet_address} = {'✅' if is_owner else '❌'}")
        return is_owner


# 單例模式
_nft_service_instance = None

def get_nft_service() -> NFTService:
    """獲取 NFT 服務實例（單例）"""
    global _nft_service_instance
    if _nft_service_instance is None:
        _nft_service_instance = NFTService()
    return _nft_service_instance
