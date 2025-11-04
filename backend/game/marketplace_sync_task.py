"""
Marketplace 同步任務

使用 totalListings() 和 getAllListings() 定期從鏈上同步所有 listing 狀態
"""
import os
import logging
from web3 import Web3
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from .models import Character, CharacterListing, Player

logger = logging.getLogger(__name__)

# MarketplaceV3 ABI (只包含需要的函數)
MARKETPLACE_ABI = [
    {
        "inputs": [],
        "name": "totalListings",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "_startId", "type": "uint256"},
            {"internalType": "uint256", "name": "_endId", "type": "uint256"}
        ],
        "name": "getAllListings",
        "outputs": [{
            "components": [
                {"internalType": "uint256", "name": "listingId", "type": "uint256"},
                {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
                {"internalType": "uint256", "name": "quantity", "type": "uint256"},
                {"internalType": "uint256", "name": "pricePerToken", "type": "uint256"},
                {"internalType": "uint128", "name": "startTimestamp", "type": "uint128"},
                {"internalType": "uint128", "name": "endTimestamp", "type": "uint128"},
                {"internalType": "address", "name": "listingCreator", "type": "address"},
                {"internalType": "address", "name": "assetContract", "type": "address"},
                {"internalType": "address", "name": "currency", "type": "address"},
                {"internalType": "uint8", "name": "tokenType", "type": "uint8"},
                {"internalType": "uint8", "name": "status", "type": "uint8"},
                {"internalType": "bool", "name": "reserved", "type": "bool"}
            ],
            "internalType": "struct IMarketplace.Listing[]",
            "name": "_allListings",
            "type": "tuple[]"
        }],
        "stateMutability": "view",
        "type": "function"
    }
]


def sync_marketplace_listings():
    """
    同步所有 marketplace listing 到數據庫
    
    使用 totalListings() 獲取總數，然後使用 getAllListings() 批量獲取所有 listing
    根據 listingCreator 和 status 來索引和更新數據庫
    """
    try:
        rpc_url = os.getenv('RPC_URL', 'https://rpc.sepolia.mantle.xyz')
        marketplace_address = os.getenv('MARKETPLACE_CONTRACT_ADDRESS')
        nft_contract_address = os.getenv('NFT_CONTRACT_ADDRESS')
        
        if not all([marketplace_address, nft_contract_address]):
            logger.warning("⚠️ Marketplace 合約地址未配置，跳過同步")
            return
        
        # 連接 Web3
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.error("❌ 無法連接到 RPC 節點")
            return
        
        marketplace_contract = w3.eth.contract(
            address=Web3.to_checksum_address(marketplace_address),
            abi=MARKETPLACE_ABI
        )
        
        # 1. 獲取總 listing 數量
        total_listings = marketplace_contract.functions.totalListings().call()
        logger.info(f"📊 鏈上總 listing 數量: {total_listings}")
        
        if total_listings == 0:
            logger.info("ℹ️ 沒有 listing，跳過同步")
            return
        
        # 2. 批量獲取所有 listing (每次最多 1000 個)
        batch_size = 1000
        all_listings_data = []
        
        for start_id in range(0, total_listings, batch_size):
            end_id = min(start_id + batch_size - 1, total_listings - 1)
            logger.info(f"📥 獲取 listing {start_id} 到 {end_id}...")
            
            try:
                listings_batch = marketplace_contract.functions.getAllListings(
                    start_id, end_id
                ).call()
                all_listings_data.extend(listings_batch)
            except Exception as e:
                logger.error(f"❌ 獲取 listing {start_id}-{end_id} 失敗: {e}")
                continue
        
        logger.info(f"✅ 成功獲取 {len(all_listings_data)} 個 listing")
        
        # 3. 處理每個 listing
        updated_count = 0
        created_count = 0
        skipped_count = 0
        
        with transaction.atomic():
            for listing_data in all_listings_data:
                try:
                    # 解析 listing 數據
                    listing_id = listing_data[0]  # listingId
                    token_id = listing_data[1]    # tokenId
                    price_per_token = listing_data[3]  # pricePerToken (wei)
                    listing_creator = listing_data[6]  # listingCreator
                    asset_contract = listing_data[7]   # assetContract
                    currency = listing_data[8]         # currency
                    listing_status = listing_data[10]  # status
                    
                    # 只處理我們的 NFT 合約
                    if asset_contract.lower() != nft_contract_address.lower():
                        skipped_count += 1
                        continue
                    
                    # status: 1=active, 2=sold, 3=cancelled
                    status_map = {
                        1: 'active',
                        2: 'sold',
                        3: 'cancelled'
                    }
                    db_status = status_map.get(listing_status, 'active')
                    
                    # 轉換價格 (wei to MNT/ETH)
                    price_mnt = Decimal(price_per_token) / Decimal(10**18)
                    
                    # 查找或創建 Character
                    character = Character.objects.filter(
                        token_id=token_id,
                        contract_address__iexact=asset_contract
                    ).first()
                    
                    if not character:
                        logger.warning(f"⚠️ 未找到 Token ID {token_id} 的角色，跳過")
                        skipped_count += 1
                        continue
                    
                    # 查找或創建 Player (根據 listingCreator)
                    # 優先根據 wallet_address 查找
                    player = Player.objects.filter(
                        wallet_address__iexact=listing_creator
                    ).first()
                    
                    # 如果找不到，使用角色的持有者
                    if not player:
                        logger.warning(f"⚠️ 未找到錢包地址 {listing_creator} 的玩家，使用角色持有者")
                        player = character.player
                        
                        # 如果角色持有者也沒有 wallet_address，更新它
                        if player and not player.wallet_address:
                            player.wallet_address = listing_creator
                            player.save()
                            logger.info(f"✅ 更新角色持有者的 wallet_address: {listing_creator}")
                    
                    # 查找或更新 CharacterListing
                    # 注意：CharacterListing 的 character 是 OneToOneField，所以一個角色只能有一個 listing
                    # 但鏈上可能有多個 listing_id 對應同一個 token_id
                    # 我們使用 listing_id 作為唯一鍵來區分不同的 listing
                    
                    # 先檢查是否已存在相同的 listing_id
                    existing_listing = CharacterListing.objects.filter(
                        listing_id=listing_id
                    ).first()
                    
                    if existing_listing:
                        # 更新現有 listing
                        existing_listing.character = character
                        existing_listing.seller = player
                        existing_listing.price = price_mnt
                        existing_listing.currency = currency
                        old_status = existing_listing.status
                        existing_listing.status = db_status
                        
                        # 根據狀態更新時間戳
                        if db_status == 'sold' and not existing_listing.sold_at:
                            existing_listing.sold_at = timezone.now()
                        elif db_status == 'cancelled' and not existing_listing.cancelled_at:
                            existing_listing.cancelled_at = timezone.now()
                        
                        existing_listing.save()
                        
                        if old_status != db_status:
                            logger.info(f"🔄 更新 listing 狀態: ID={listing_id}, {old_status} -> {db_status}")
                        
                        updated_count += 1
                    else:
                        # 檢查該角色是否已有其他 listing（由於 OneToOneField 限制）
                        existing_character_listing = CharacterListing.objects.filter(
                            character=character
                        ).first()
                        
                        if existing_character_listing:
                            # 如果該角色已有 listing，檢查是否應該替換
                            # 優先保留 active 的 listing，如果都是 active，保留 listing_id 更大的（更新的）
                            if db_status == 'active' and existing_character_listing.status != 'active':
                                # 新的是 active，舊的不是，替換
                                logger.info(f"🔄 替換 listing: 角色 {character.name} 已有 {existing_character_listing.listing_id}，新 listing {listing_id} 是 active")
                                existing_character_listing.delete()
                                
                                # 創建新的 listing
                                listing = CharacterListing.objects.create(
                                    listing_id=listing_id,
                                    character=character,
                                    seller=player,
                                    price=price_mnt,
                                    currency=currency,
                                    status=db_status,
                                    listed_at=timezone.now()
                                )
                                created_count += 1
                                logger.info(f"✅ 創建新 listing: ID={listing_id}, Token={token_id}, Price={price_mnt} MNT")
                            elif db_status == 'active' and existing_character_listing.status == 'active':
                                # 兩個都是 active，保留 listing_id 更大的（假設是更新的）
                                if listing_id > (existing_character_listing.listing_id or 0):
                                    logger.info(f"🔄 替換 active listing: 角色 {character.name} 已有 {existing_character_listing.listing_id}，新 listing {listing_id} 更更新")
                                    existing_character_listing.delete()
                                    
                                    listing = CharacterListing.objects.create(
                                        listing_id=listing_id,
                                        character=character,
                                        seller=player,
                                        price=price_mnt,
                                        currency=currency,
                                        status=db_status,
                                        listed_at=timezone.now()
                                    )
                                    created_count += 1
                                    logger.info(f"✅ 創建新 listing: ID={listing_id}, Token={token_id}, Price={price_mnt} MNT")
                                else:
                                    # 舊的 listing_id 更大，保留舊的，跳過新的
                                    logger.warning(f"⚠️ 跳過 listing {listing_id}: 角色 {character.name} 已有更新的 active listing {existing_character_listing.listing_id}")
                                    skipped_count += 1
                            else:
                                # 新的是非 active 狀態，保留舊的，跳過新的
                                logger.warning(f"⚠️ 跳過 listing {listing_id}: 角色 {character.name} 已有 listing {existing_character_listing.listing_id}")
                                skipped_count += 1
                        else:
                            # 該角色沒有現有 listing，直接創建
                            listing = CharacterListing.objects.create(
                                listing_id=listing_id,
                                character=character,
                                seller=player,
                                price=price_mnt,
                                currency=currency,
                                status=db_status,
                                listed_at=timezone.now()
                            )
                            created_count += 1
                            logger.info(f"✅ 創建新 listing: ID={listing_id}, Token={token_id}, Price={price_mnt} MNT")
                
                except Exception as e:
                    logger.error(f"❌ 處理 listing 失敗 (ID: {listing_data[0] if listing_data else 'unknown'}): {e}")
                    continue
        
        logger.info(f"✅ 同步完成: 創建 {created_count} 個，更新 {updated_count} 個，跳過 {skipped_count} 個")
        
    except Exception as e:
        logger.error(f"❌ 同步 marketplace listings 失敗: {e}", exc_info=True)
        raise

