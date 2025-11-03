"""
Marketplace 服務 - 處理 NFT 市場交易（使用 Web3.py + Thirdweb MarketplaceV3）
"""
import os
import json
from decimal import Decimal
from web3 import Web3
from eth_account import Account
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class MarketplaceService:
    """市場服務 - 使用 Web3.py 與 Thirdweb MarketplaceV3 合約交互"""
    
    # MarketplaceV3 核心 ABI（只包含需要的函數）
    # 完整 ABI 請參考: https://thirdweb.com/thirdweb.eth/MarketplaceV3
    CONTRACT_ABI = json.loads('''[
        {
            "inputs": [
                {"internalType": "address", "name": "_assetContract", "type": "address"},
                {"internalType": "uint256", "name": "_tokenId", "type": "uint256"},
                {"internalType": "address", "name": "_currency", "type": "address"},
                {"internalType": "uint256", "name": "_pricePerToken", "type": "uint256"},
                {"internalType": "uint256", "name": "_quantity", "type": "uint256"},
                {"internalType": "uint256", "name": "_startTime", "type": "uint256"},
                {"internalType": "uint256", "name": "_endTime", "type": "uint256"},
                {"internalType": "bool", "name": "_isReservedListing", "type": "bool"}
            ],
            "name": "createListing",
            "outputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "uint256", "name": "_listingId", "type": "uint256"},
                {"internalType": "address", "name": "_buyFor", "type": "address"},
                {"internalType": "uint256", "name": "_quantity", "type": "uint256"},
                {"internalType": "address", "name": "_currency", "type": "address"},
                {"internalType": "uint256", "name": "_pricePerToken", "type": "uint256"}
            ],
            "name": "buy",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "_listingId", "type": "uint256"}],
            "name": "cancelDirectListing",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
            "name": "getListing",
            "outputs": [{
                "components": [
                    {"internalType": "uint256", "name": "listingId", "type": "uint256"},
                    {"internalType": "address", "name": "tokenOwner", "type": "address"},
                    {"internalType": "address", "name": "assetContract", "type": "address"},
                    {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
                    {"internalType": "uint256", "name": "startTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "endTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "quantity", "type": "uint256"},
                    {"internalType": "address", "name": "currency", "type": "address"},
                    {"internalType": "uint256", "name": "reservePricePerToken", "type": "uint256"},
                    {"internalType": "uint256", "name": "buyoutPricePerToken", "type": "uint256"},
                    {"internalType": "uint8", "name": "tokenType", "type": "uint8"},
                    {"internalType": "uint8", "name": "listingType", "type": "uint8"}
                ],
                "internalType": "struct IMarketplace.Listing",
                "name": "listing",
                "type": "tuple"
            }],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "uint256", "name": "listingId", "type": "uint256"}],
            "name": "isBuyerApprovedForListing",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "totalListings",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "uint256", "name": "startId", "type": "uint256"},
                {"internalType": "uint256", "name": "endId", "type": "uint256"}
            ],
            "name": "getAllListings",
            "outputs": [{
                "components": [
                    {"internalType": "uint256", "name": "listingId", "type": "uint256"},
                    {"internalType": "address", "name": "tokenOwner", "type": "address"},
                    {"internalType": "address", "name": "assetContract", "type": "address"},
                    {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
                    {"internalType": "uint256", "name": "startTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "endTime", "type": "uint256"},
                    {"internalType": "uint256", "name": "quantity", "type": "uint256"},
                    {"internalType": "address", "name": "currency", "type": "address"},
                    {"internalType": "uint256", "name": "reservePricePerToken", "type": "uint256"},
                    {"internalType": "uint256", "name": "buyoutPricePerToken", "type": "uint256"},
                    {"internalType": "uint8", "name": "tokenType", "type": "uint8"},
                    {"internalType": "uint8", "name": "listingType", "type": "uint8"}
                ],
                "internalType": "struct IMarketplace.Listing[]",
                "name": "_listings",
                "type": "tuple[]"
            }],
            "stateMutability": "view",
            "type": "function"
        }
    ]''')
    
    # ERC721 批准 ABI
    ERC721_ABI = json.loads('''[
        {
            "inputs": [
                {"internalType": "address", "name": "operator", "type": "address"},
                {"internalType": "bool", "name": "approved", "type": "bool"}
            ],
            "name": "setApprovalForAll",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "address", "name": "owner", "type": "address"},
                {"internalType": "address", "name": "operator", "type": "address"}
            ],
            "name": "isApprovedForAll",
            "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        }
    ]''')
    
    def __init__(self):
        self.private_key = os.getenv('WALLET_PRIVATE_KEY')
        self.marketplace_address = os.getenv('MARKETPLACE_CONTRACT_ADDRESS')
        self.nft_contract_address = os.getenv('NFT_CONTRACT_ADDRESS')
        self.chain_id = int(os.getenv('CHAIN_ID', '5003'))
        self.rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
        
        if not all([self.private_key, self.marketplace_address, self.nft_contract_address]):
            logger.warning("⚠️  Marketplace 服務未完整配置")
            logger.warning(f"   WALLET_PRIVATE_KEY: {'✅' if self.private_key else '❌'}")
            logger.warning(f"   MARKETPLACE_CONTRACT_ADDRESS: {'✅' if self.marketplace_address else '❌'}")
            logger.warning(f"   NFT_CONTRACT_ADDRESS: {'✅' if self.nft_contract_address else '❌'}")
            self.enabled = False
            return
        
        try:
            logger.info(f"🔗 正在初始化 Marketplace 服務...")
            logger.info(f"   Chain ID: {self.chain_id}")
            logger.info(f"   Marketplace: {self.marketplace_address}")
            logger.info(f"   NFT Contract: {self.nft_contract_address}")
            logger.info(f"   RPC: {self.rpc_url}")
            
            # 初始化 Web3
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            
            if not self.w3.is_connected():
                raise Exception("無法連接到 RPC 節點")
            
            # 初始化帳戶
            self.account = Account.from_key(self.private_key)
            logger.info(f"   錢包地址: {self.account.address}")
            
            # 初始化合約
            self.marketplace = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.marketplace_address),
                abi=self.CONTRACT_ABI
            )
            
            self.nft_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.nft_contract_address),
                abi=self.ERC721_ABI
            )
            
            self.enabled = True
            logger.info(f"✅ Marketplace 服務初始化成功！")
            
        except Exception as e:
            logger.error(f"❌ Marketplace 服務初始化失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.enabled = False
    
    def ensure_nft_approval(self, owner_address: str) -> bool:
        """
        確保 NFT 合約已批准 Marketplace 合約轉移 NFT
        
        Args:
            owner_address: NFT 持有者地址
            
        Returns:
            bool: True 如果已批准或批准成功
        """
        if not self.enabled:
            return False
        
        try:
            # 檢查是否已批准
            is_approved = self.nft_contract.functions.isApprovedForAll(
                Web3.to_checksum_address(owner_address),
                Web3.to_checksum_address(self.marketplace_address)
            ).call()
            
            if is_approved:
                logger.info(f"✅ NFT 已批准 Marketplace 轉移")
                return True
            
            # 需要批准，但這應該由用戶在前端完成
            # 這裡只返回 False，提示用戶需要批准
            logger.warning(f"⚠️  NFT 尚未批准 Marketplace，需要用戶在前端調用 setApprovalForAll")
            return False
            
        except Exception as e:
            logger.error(f"❌ 檢查 NFT 批准失敗: {e}")
            return False
    
    def create_listing(
        self,
        token_id: int,
        price_per_token: Decimal,
        seller_address: str,
        currency_address: str = None,  # None = native token (ETH)
        quantity: int = 1,
        start_time: int = None,
        end_time: int = None
    ):
        """
        創建上架列表
        
        Args:
            token_id: NFT Token ID
            price_per_token: 每個代幣的價格（以 wei 為單位）
            seller_address: 賣家地址
            currency_address: 支付代幣地址（None = native）
            quantity: 數量（通常為 1）
            start_time: 開始時間（Unix timestamp，None = now）
            end_time: 結束時間（Unix timestamp，None = 無限期）
            
        Returns:
            dict: {
                'success': bool,
                'listing_id': int,
                'tx_hash': str,
                'error': str
            }
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'Marketplace 服務未啟用'
            }
        
        try:
            # 確保已批准
            if not self.ensure_nft_approval(seller_address):
                return {
                    'success': False,
                    'error': 'NFT 尚未批准 Marketplace，請先批准'
                }
            
            # 設置時間
            if start_time is None:
                start_time = int(timezone.now().timestamp())
            if end_time is None:
                end_time = 2**256 - 1  # 無限期
            
            # 設置支付代幣（None = native）
            if currency_address is None:
                currency_address = "0x0000000000000000000000000000000000000000"
            else:
                currency_address = Web3.to_checksum_address(currency_address)
            
            # 轉換價格為 wei
            price_wei = int(price_per_token * Decimal('1e18'))  # 假設 18 位小數
            
            logger.info(f"=" * 60)
            logger.info(f"📝 創建上架列表...")
            logger.info(f"   Token ID: {token_id}")
            logger.info(f"   價格: {price_per_token} (wei: {price_wei})")
            logger.info(f"   賣家: {seller_address}")
            logger.info(f"   開始時間: {start_time}")
            logger.info(f"   結束時間: {end_time}")
            logger.info(f"=" * 60)
            
            # 構建交易
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            
            # 估算 Gas
            try:
                gas_estimate = self.marketplace.functions.createListing(
                    Web3.to_checksum_address(self.nft_contract_address),  # assetContract
                    token_id,  # tokenId
                    currency_address,  # currency (native = 0x0)
                    price_wei,  # pricePerToken
                    quantity,  # quantity
                    start_time,  # startTime
                    end_time,  # endTime
                    False  # isReservedListing
                ).estimate_gas({'from': self.account.address})
                logger.info(f"   Gas Estimate: {gas_estimate}")
            except Exception as e:
                logger.error(f"❌ Gas 估算失敗: {e}")
                return {
                    'success': False,
                    'error': f'Gas 估算失敗: {str(e)}'
                }
            
            # 構建並發送交易
            transaction = self.marketplace.functions.createListing(
                Web3.to_checksum_address(self.nft_contract_address),
                token_id,
                currency_address,
                price_wei,
                quantity,
                start_time,
                end_time,
                False
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
            
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt['status'] != 1:
                raise Exception("交易失敗")
            
            # 從事件中獲取 listing_id
            # 注意：實際應該解析 NewListing 事件來獲取 listing_id
            # 這裡簡化處理，需要從事件日誌中提取
            listing_id = self.marketplace.functions.totalListings().call() - 1
            
            logger.info(f"✅ 上架成功! Listing ID: {listing_id}")
            
            return {
                'success': True,
                'listing_id': listing_id,
                'tx_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"❌ 創建上架失敗: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_listing(self, listing_id: int):
        """
        獲取上架信息
        
        Returns:
            dict: 上架信息
        """
        if not self.enabled:
            return None
        
        try:
            listing = self.marketplace.functions.getListing(listing_id).call()
            # listing 是一個 tuple，需要解析
            return {
                'listing_id': listing[0],
                'token_owner': listing[1],
                'asset_contract': listing[2],
                'token_id': listing[3],
                'start_time': listing[4],
                'end_time': listing[5],
                'quantity': listing[6],
                'currency': listing[7],
                'reserve_price': listing[8],
                'buyout_price': listing[9],
                'token_type': listing[10],
                'listing_type': listing[11]
            }
        except Exception as e:
            logger.error(f"❌ 獲取上架信息失敗: {e}")
            return None
    
    def cancel_listing(self, listing_id: int):
        """
        取消上架
        
        Returns:
            dict: {
                'success': bool,
                'tx_hash': str,
                'error': str
            }
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'Marketplace 服務未啟用'
            }
        
        try:
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            
            gas_estimate = self.marketplace.functions.cancelDirectListing(listing_id).estimate_gas({
                'from': self.account.address
            })
            
            transaction = self.marketplace.functions.cancelDirectListing(listing_id).build_transaction({
                'chainId': self.chain_id,
                'from': self.account.address,
                'gas': int(gas_estimate * 1.2),
                'gasPrice': self.w3.eth.gas_price,
                'nonce': nonce,
            })
            
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            tx_receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt['status'] != 1:
                raise Exception("交易失敗")
            
            return {
                'success': True,
                'tx_hash': tx_hash.hex()
            }
            
        except Exception as e:
            logger.error(f"❌ 取消上架失敗: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# 單例模式
_marketplace_service_instance = None

def get_marketplace_service() -> MarketplaceService:
    """獲取 Marketplace 服務實例（單例）"""
    global _marketplace_service_instance
    if _marketplace_service_instance is None:
        _marketplace_service_instance = MarketplaceService()
    return _marketplace_service_instance

