"""
Marketplace 索引服務（可選）

用於掃描鏈上事件並更新數據庫，提供快速查詢
如果不需要快速查詢，可以完全不用後端，前端直接查詢鏈上數據
"""
import os
import json
from web3 import Web3
from django.utils import timezone
from django.db import transaction
import logging

from .models import Character, CharacterListing, MarketTransaction, CharacterPriceHistory

logger = logging.getLogger(__name__)


class MarketplaceIndexer:
    """掃描鏈上事件並索引到數據庫"""
    
    # MarketplaceV3 事件 ABI
    NEW_LISTING_EVENT_ABI = json.loads('''[{
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256"},
            {"indexed": true, "internalType": "address", "name": "assetContract", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "lister", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256"},
            {"indexed": false, "internalType": "address", "name": "currency", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "pricePerToken", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"}
        ],
        "name": "NewListing",
        "type": "event"
    }]''')
    
    NEW_SALE_EVENT_ABI = json.loads('''[{
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256"},
            {"indexed": true, "internalType": "address", "name": "assetContract", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "lister", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "buyer", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "quantity", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "totalPricePaid", "type": "uint256"}
        ],
        "name": "NewSale",
        "type": "event"
    }]''')
    
    def __init__(self):
        self.rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
        self.marketplace_address = os.getenv('MARKETPLACE_CONTRACT_ADDRESS')
        self.nft_contract_address = os.getenv('NFT_CONTRACT_ADDRESS')
        
        if not all([self.marketplace_address, self.nft_contract_address]):
            logger.warning("⚠️  Marketplace 索引服務未配置")
            self.enabled = False
            return
        
        try:
            self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if not self.w3.is_connected():
                raise Exception("無法連接到 RPC 節點")
            
            self.marketplace_contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(self.marketplace_address),
                abi=self.NEW_LISTING_EVENT_ABI + self.NEW_SALE_EVENT_ABI
            )
            
            self.enabled = True
            logger.info("✅ Marketplace 索引服務初始化成功")
        except Exception as e:
            logger.error(f"❌ Marketplace 索引服務初始化失敗: {e}")
            self.enabled = False
    
    def scan_new_listings(self, from_block: int = None, to_block: int = 'latest'):
        """
        掃描新的上架事件
        
        可以通過 Celery 定時任務定期調用
        """
        if not self.enabled:
            return
        
        try:
            if from_block is None:
                # 從最後掃描的區塊開始，或從合約部署區塊開始
                from_block = self._get_last_scanned_block() or 0
            
            # 獲取事件
            event_filter = self.marketplace_contract.events.NewListing.create_filter(
                fromBlock=from_block,
                toBlock=to_block,
                argument_filters={
                    'assetContract': Web3.to_checksum_address(self.nft_contract_address)
                }
            )
            
            events = event_filter.get_all_entries()
            
            for event in events:
                self._process_new_listing_event(event)
            
            # 更新最後掃描的區塊
            if events:
                latest_block = max(e.blockNumber for e in events)
                self._update_last_scanned_block(latest_block)
            
            logger.info(f"✅ 掃描到 {len(events)} 個新上架")
            
        except Exception as e:
            logger.error(f"❌ 掃描新上架失敗: {e}")
    
    def scan_new_sales(self, from_block: int = None, to_block: int = 'latest'):
        """
        掃描新的銷售事件
        """
        if not self.enabled:
            return
        
        try:
            if from_block is None:
                from_block = self._get_last_scanned_block('sales') or 0
            
            event_filter = self.marketplace_contract.events.NewSale.create_filter(
                fromBlock=from_block,
                toBlock=to_block,
                argument_filters={
                    'assetContract': Web3.to_checksum_address(self.nft_contract_address)
                }
            )
            
            events = event_filter.get_all_entries()
            
            for event in events:
                self._process_new_sale_event(event)
            
            if events:
                latest_block = max(e.blockNumber for e in events)
                self._update_last_scanned_block(latest_block, 'sales')
            
            logger.info(f"✅ 掃描到 {len(events)} 個新銷售")
            
        except Exception as e:
            logger.error(f"❌ 掃描新銷售失敗: {e}")
    
    def _process_new_listing_event(self, event):
        """處理新上架事件"""
        try:
            args = event.args
            listing_id = args.listingId
            token_id = args.tokenId
            lister = args.lister
            
            # 查找角色
            character = Character.objects.filter(
                token_id=token_id,
                contract_address__iexact=self.nft_contract_address
            ).first()
            
            if not character:
                logger.warning(f"未找到對應的角色 (Token ID: {token_id})")
                return
            
            # 檢查是否已存在
            if CharacterListing.objects.filter(listing_id=listing_id).exists():
                logger.info(f"上架 {listing_id} 已存在，跳過")
                return
            
            # 創建上架記錄
            price_per_token = args.pricePerToken / 1e18  # 轉換為 ETH
            
            CharacterListing.objects.create(
                character=character,
                seller=character.player,  # 假設角色持有者就是賣家
                listing_id=listing_id,
                price=price_per_token,
                currency=args.currency,
                status='active',
                tx_hash=event.transactionHash.hex(),
                expires_at=None  # 可以從 endTime 計算
            )
            
            logger.info(f"✅ 索引新上架: Listing ID {listing_id}, Character {character.name}")
            
        except Exception as e:
            logger.error(f"❌ 處理新上架事件失敗: {e}")
    
    def _process_new_sale_event(self, event):
        """處理新銷售事件"""
        try:
            args = event.args
            listing_id = args.listingId
            buyer = args.buyer
            total_price = args.totalPricePaid / 1e18
            
            # 查找上架記錄
            listing = CharacterListing.objects.filter(listing_id=listing_id).first()
            
            if not listing:
                logger.warning(f"未找到上架記錄 (Listing ID: {listing_id})")
                return
            
            # 更新上架狀態
            listing.status = 'sold'
            listing.sold_at = timezone.now()
            listing.buy_tx_hash = event.transactionHash.hex()
            
            # 查找買家（通過錢包地址）
            from .models import Player
            buyer = buyer.lower()
            buyer_player = Player.objects.filter(wallet_address__iexact=buyer).first()
            
            # 如果找不到買家 Player 記錄，嘗試創建或使用現有用戶
            if not buyer_player:
                # 嘗試通過用戶名查找（如果用戶使用該錢包登錄過）
                from django.contrib.auth.models import User
                # 這裡可以添加邏輯創建新 Player，但通常需要用戶先登錄
                logger.warning(f"⚠️ 未找到買家 Player 記錄 (wallet: {buyer})，Character 所有權將通過 sync API 更新")
            else:
                # 更新買家的錢包地址（如果尚未設置）
                if not buyer_player.wallet_address:
                    buyer_player.wallet_address = buyer
                    buyer_player.save()
            
            if buyer_player:
                listing.buyer = buyer_player
            
            listing.save()
            
            # 重要：更新 Character 的所有權
            character = listing.character
            old_owner = character.owner_wallet
            character.owner_wallet = buyer
            if buyer_player:
                character.player = buyer_player
            character.save()
            
            if old_owner and old_owner.lower() != buyer:
                logger.info(f"📝 更新 Character {character.id} ({character.name}) 所有權: {old_owner} → {buyer}")
            
            # 創建交易記錄
            MarketTransaction.objects.create(
                listing=listing,
                character=character,
                buyer=buyer_player or listing.character.player,  # 如果找不到買家，暫時用角色原持有者
                seller=listing.seller,
                price=total_price,
                currency=listing.currency,
                tx_hash=event.transactionHash.hex(),
                block_number=event.blockNumber
            )
            
            # 更新價格歷史
            CharacterPriceHistory.objects.create(
                character=character,
                transaction=MarketTransaction.objects.filter(tx_hash=event.transactionHash.hex()).first(),
                price=total_price,
                tx_hash=event.transactionHash.hex(),
                block_number=event.blockNumber
            )
            
            logger.info(f"✅ 索引新銷售: Listing ID {listing_id}, Price {total_price}, Buyer {buyer}")
            
        except Exception as e:
            logger.error(f"❌ 處理新銷售事件失敗: {e}")
    
    def _get_last_scanned_block(self, event_type: str = 'listings') -> int:
        """獲取最後掃描的區塊（可以存儲在數據庫或 Redis）"""
        # 簡化實現：從數據庫查詢
        if event_type == 'listings':
            last_listing = CharacterListing.objects.order_by('-listed_at').first()
            if last_listing and last_listing.tx_hash:
                try:
                    tx = self.w3.eth.get_transaction_receipt(last_listing.tx_hash)
                    return tx.blockNumber
                except:
                    pass
        elif event_type == 'sales':
            last_sale = MarketTransaction.objects.order_by('-created_at').first()
            if last_sale and last_sale.tx_hash:
                try:
                    tx = self.w3.eth.get_transaction_receipt(last_sale.tx_hash)
                    return tx.blockNumber
                except:
                    pass
        
        return None
    
    def _update_last_scanned_block(self, block_number: int, event_type: str = 'listings'):
        """更新最後掃描的區塊（可以存儲在數據庫或 Redis）"""
        # 簡化實現：不存儲，每次都查詢
        pass


# 單例模式
_indexer_instance = None

def get_marketplace_indexer() -> MarketplaceIndexer:
    """獲取索引服務實例"""
    global _indexer_instance
    if _indexer_instance is None:
        _indexer_instance = MarketplaceIndexer()
    return _indexer_instance

