"""
Marketplace API 視圖
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Avg, Max, Min, Count, Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import logging

from .models import Character, CharacterListing, MarketTransaction, CharacterPriceHistory, Player
# from .marketplace_service import get_marketplace_service  # 不再需要，用戶直接用錢包交易
from .nft_service import get_nft_service
from web3 import Web3

logger = logging.getLogger(__name__)


@api_view(['GET'])
def browse_marketplace(request):
    """
    瀏覽市場
    
    GET /api/marketplace/?page=1&limit=20&rarity=UR&min_price=0&max_price=1000&sort_by=price_asc
    """
    try:
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        # 篩選條件
        rarity = request.query_params.get('rarity')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        search = request.query_params.get('search')
        sort_by = request.query_params.get('sort_by', 'listed_at_desc')
        
        # 查詢上架中的角色
        listings = CharacterListing.objects.filter(status='active')
        
        # 應用篩選
        if rarity:
            listings = listings.filter(character__rarity=rarity)
        
        if min_price:
            listings = listings.filter(price__gte=Decimal(min_price))
        
        if max_price:
            listings = listings.filter(price__lte=Decimal(max_price))
        
        if search:
            listings = listings.filter(
                Q(character__name__icontains=search) |
                Q(character__prompt__icontains=search)
            )
        
        # 排序
        if sort_by == 'price_asc':
            listings = listings.order_by('price')
        elif sort_by == 'price_desc':
            listings = listings.order_by('-price')
        elif sort_by == 'listed_at_asc':
            listings = listings.order_by('listed_at')
        else:  # listed_at_desc (default)
            listings = listings.order_by('-listed_at')
        
        total = listings.count()
        listings = listings.select_related('character', 'seller', 'character__player')[offset:offset+limit]
        
        # 構建響應
        results = []
        for listing in listings:
            character = listing.character
            results.append({
                'listing_id': listing.id,
                'chain_listing_id': listing.listing_id,
                'character': {
                    'id': str(character.id),
                    'name': character.name,
                    'image_url': character.image_url,
                    'rarity': character.rarity,
                    'rarity_name': character.rarity_name,
                    'level': character.level,
                    'strength': character.strength,
                    'agility': character.agility,
                    'luck': character.luck,
                    'win_count': character.win_count,
                    'loss_count': character.loss_count,
                    'token_id': character.token_id,
                    'contract_address': character.contract_address,
                },
                'seller': {
                    'id': str(listing.seller.id),
                    'nickname': listing.seller.nickname,
                    'wallet_address': listing.seller.wallet_address or '',
                },
                'price': str(listing.price),
                'currency': listing.currency,
                'listed_at': listing.listed_at.isoformat(),
                'expires_at': listing.expires_at.isoformat() if listing.expires_at else None,
            })
            
            # 計算價格歷史統計
            price_history = CharacterPriceHistory.objects.filter(character=listing.character).order_by('-timestamp')
            if price_history.exists():
                prices = [float(h.price) for h in price_history]
                results[-1]['price_history'] = {
                    'lastSale': str(price_history.first().price) if price_history.first() else None,
                    'min': str(min(prices)),
                    'max': str(max(prices)),
                    'count': len(prices)
                }
            else:
                results[-1]['price_history'] = None
        
        return Response({
            'success': True,
            'data': {
                'listings': results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'total_pages': (total + limit - 1) // limit
                }
            }
        })
        
    except Exception as e:
        logger.error(f"瀏覽市場失敗: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notify_listing_created(request):
    """
    通知後端索引新上架（可選）
    
    用戶在前端完成鏈上交易後，可以選擇通知後端索引
    POST /api/marketplace/list/
    Body: {
        "tx_hash": "0x...",
        "listing_id": 123,
        "character_id": "uuid"
    }
    """
    try:
        tx_hash = request.data.get('tx_hash')
        listing_id = request.data.get('listing_id')
        character_id = request.data.get('character_id')
        
        logger.info(f"📝 收到上架索引通知: tx_hash={tx_hash}, listing_id={listing_id}, character_id={character_id}")
        
        if not all([tx_hash, listing_id, character_id]):
            logger.error(f"❌ 缺少必要參數: tx_hash={tx_hash}, listing_id={listing_id}, character_id={character_id}")
            return Response({
                'success': False,
                'error': '缺少必要參數'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 驗證角色
        try:
            character = Character.objects.get(id=character_id)
            logger.info(f"✅ 找到角色: {character.name} (id={character.id})")
        except Character.DoesNotExist:
            logger.error(f"❌ 角色不存在: {character_id}")
            return Response({
                'success': False,
                'error': '角色不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 檢查是否已索引（檢查 listing_id 或同角色的 active 上架）
        existing_listing = CharacterListing.objects.filter(listing_id=listing_id).first()
        if existing_listing:
            logger.info(f"ℹ️ 上架已存在（相同的 listing_id），返回現有記錄: listing_id={listing_id}")
            return Response({
                'success': True,
                'message': '上架已索引',
                'data': {
                    'listing_id': str(existing_listing.id),
                    'chain_listing_id': existing_listing.listing_id
                }
            })
        
        # 檢查該角色是否已有 active 上架記錄
        existing_active_listing = CharacterListing.objects.filter(
            character=character,
            status='active'
        ).first()
        
        if existing_active_listing:
            logger.warning(f"⚠️ 角色已有 active 上架記錄: existing_id={existing_active_listing.id}, listing_id={existing_active_listing.listing_id}, status={existing_active_listing.status}")
            return Response({
                'success': False,
                'error': '此角色已經上架中，請先取消現有上架再重新上架',
                'existing_listing_id': str(existing_active_listing.id),
                'chain_listing_id': existing_active_listing.listing_id
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 檢查是否有已取消或已售出的舊記錄（可以更新）
        existing_listing = CharacterListing.objects.filter(character=character).first()
        if existing_listing:
            logger.info(f"ℹ️ 角色有舊的上架記錄（status={existing_listing.status}），將更新為新上架")
        
        # 從鏈上獲取上架詳情（可選，也可以只保存基本信息）
        # 這裡簡化處理，只保存基本信息
        # 實際價格等信息可以從鏈上查詢或由前端傳遞
        
        price = request.data.get('price')  # 可選，如果前端傳遞了價格
        if not price:
            logger.warning(f"⚠️ 前端未傳遞價格，設置為 0: listing_id={listing_id}")
            price = Decimal('0')
        else:
            try:
                # 前端傳遞的價格可能是字符串形式的數字（如 "1"），需要轉換
                price = Decimal(str(price))
                logger.info(f"✅ 收到價格: {price} (原始值: {request.data.get('price')})")
            except (ValueError, TypeError) as e:
                logger.error(f"❌ 價格格式錯誤: {price}, 原始值: {request.data.get('price')}, 錯誤: {e}")
                price = Decimal('0')
        
        # EVM 鏈通用的原生代幣假地址 (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
        # 在 Mantle 上代表 MNT，在 Ethereum 上代表 ETH，以此類推
        NATIVE_CURRENCY_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        currency = request.data.get('currency', NATIVE_CURRENCY_ADDRESS)
        
        # 創建或更新索引記錄
        try:
            if existing_listing:
                # 更新舊記錄（已取消或已售出的）
                existing_listing.listing_id = listing_id
                existing_listing.price = price
                existing_listing.currency = currency
                existing_listing.status = 'active'
                existing_listing.tx_hash = tx_hash
                existing_listing.seller = request.user.player
                existing_listing.listed_at = timezone.now()
                existing_listing.cancelled_at = None  # 清除取消時間
                existing_listing.sold_at = None  # 清除售出時間
                existing_listing.buyer = None  # 清除買家
                existing_listing.buy_tx_hash = None  # 清除購買交易哈希
                existing_listing.save()
                listing = existing_listing
                logger.info(f"✅ 更新舊上架記錄為新上架: listing_id={listing.id}, chain_listing_id={listing.listing_id}, price={price}")
            else:
                # 創建新記錄
                listing = CharacterListing.objects.create(
                    character=character,
                    seller=request.user.player,
                    listing_id=listing_id,
                    price=price,
                    currency=currency,
                    status='active',
                    tx_hash=tx_hash,
                )
                logger.info(f"✅ 創建上架記錄成功: listing_id={listing.id}, chain_listing_id={listing.listing_id}, price={price}")
            
            return Response({
                'success': True,
                'message': '上架已索引',
                'data': {
                    'listing_id': str(listing.id),
                    'chain_listing_id': listing.listing_id
                }
            })
        except Exception as create_error:
            logger.error(f"❌ 創建/更新索引記錄失敗: {create_error}")
            import traceback
            logger.error(traceback.format_exc())
            raise
        
    except Exception as e:
        logger.error(f"上架角色失敗: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notify_purchase(request):
    """
    通知後端索引購買（創建交易記錄）
    
    POST /api/marketplace/buy/
    Body: {
        "tx_hash": "0x...",
        "listing_id": 123
    }
    """
    try:
        tx_hash = request.data.get('tx_hash')
        listing_id = request.data.get('listing_id')
        
        if not all([tx_hash, listing_id]):
            return Response({
                'success': False,
                'error': '缺少必要參數 (tx_hash, listing_id)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"📝 收到購買索引通知: tx_hash={tx_hash}, listing_id={listing_id}")
        
        # 查找上架記錄
        listing = CharacterListing.objects.filter(listing_id=listing_id).first()
        
        # 獲取買家（當前用戶）
        buyer = request.user.player
        
        # 如果沒有找到 listing，嘗試從鏈上獲取 token_id 並創建 Character
        if not listing:
            logger.warning(f"⚠️ 未找到上架記錄 (Listing ID: {listing_id})，嘗試從鏈上獲取 token_id 並創建 Character")
            
            # 從 marketplace 合約獲取 listing 信息以獲取 token_id
            # 注意：這裡需要 marketplace 合約地址，暫時跳過，因為需要更多信息
            # 如果前端傳遞了 token_id，可以使用它
            token_id = request.data.get('token_id')
            asset_contract = request.data.get('asset_contract')  # NFT 合約地址
            
            if token_id and asset_contract:
                # 檢查 Character 是否已存在（根據 token_id）
                character = Character.objects.filter(
                    token_id=token_id,
                    contract_address=asset_contract.lower()
                ).first()
                
                if not character:
                    # 從 tokenURI 獲取 metadata 並創建 Character
                    logger.info(f"📥 從 tokenURI 創建 Character (Token ID: {token_id})")
                    nft_service = get_nft_service()
                    
                    if nft_service.enabled:
                        try:
                            # 獲取 tokenURI
                            token_uri = nft_service.get_token_uri(token_id)
                            if token_uri:
                                # 獲取 metadata
                                metadata = nft_service.fetch_metadata_from_uri(token_uri)
                                if metadata:
                                    # 解析 metadata 並創建 Character
                                    character_data = nft_service.parse_metadata_to_character_data(
                                        metadata, token_id, asset_contract.lower(), 
                                        buyer.wallet_address if buyer.wallet_address else None
                                    )
                                    
                                    if character_data:
                                        # 創建 Character
                                        character = Character.objects.create(
                                            player=buyer,
                                            **character_data
                                        )
                                        logger.info(f"✅ 成功從 tokenURI 創建 Character: {character.name} (ID: {character.id})")
                                    else:
                                        logger.error(f"❌ 解析 metadata 失敗")
                                else:
                                    logger.error(f"❌ 獲取 metadata 失敗")
                            else:
                                logger.error(f"❌ 獲取 tokenURI 失敗")
                        except Exception as e:
                            logger.error(f"❌ 從 tokenURI 創建 Character 失敗: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                
                if character:
                    # 創建一個臨時的 listing 記錄（用於記錄交易）
                    listing = CharacterListing.objects.create(
                        character=character,
                        seller=character.player,  # 使用原持有者作為 seller
                        listing_id=listing_id,
                        price=Decimal(request.data.get('price', '0')),
                        currency=request.data.get('currency', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'),
                        status='sold',
                        sold_at=timezone.now(),
                        buy_tx_hash=tx_hash,
                        buyer=buyer,
                    )
                else:
                    return Response({
                        'success': False,
                        'error': '無法創建 Character 記錄'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                return Response({
                    'success': False,
                    'error': '上架記錄不存在，且缺少 token_id 或 asset_contract'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            # 檢查 Character 是否存在（如果 listing.character 為空）
            # 如果沒有 character，嘗試從 listing 的 token_id 獲取（如果有的話）
            # 但通常 listing 應該有 character，如果沒有，可能是數據不一致
            if not listing.character:
                logger.warning(f"⚠️ Listing {listing_id} 沒有關聯的 Character，嘗試從 token_id 創建")
                # 如果前端傳遞了 token_id，使用它
                token_id = request.data.get('token_id')
                asset_contract = request.data.get('asset_contract')
                
                if not token_id:
                    # 嘗試從 listing 的其他字段獲取（如果有的話）
                    # 注意：這裡需要根據實際的 listing 結構調整
                    logger.error(f"❌ 無法獲取 token_id，無法創建 Character")
                elif token_id and asset_contract:
                    # 檢查 Character 是否已存在
                    character = Character.objects.filter(
                        token_id=token_id,
                        contract_address=asset_contract.lower()
                    ).first()
                    
                    if not character:
                        logger.info(f"📥 從 tokenURI 創建 Character (Token ID: {token_id})")
                        nft_service = get_nft_service()
                        
                        if nft_service.enabled:
                            try:
                                token_uri = nft_service.get_token_uri(token_id)
                                if token_uri:
                                    metadata = nft_service.fetch_metadata_from_uri(token_uri)
                                    if metadata:
                                        character_data = nft_service.parse_metadata_to_character_data(
                                            metadata, token_id, asset_contract.lower(),
                                            buyer.wallet_address if buyer.wallet_address else None
                                        )
                                        
                                        if character_data:
                                            character = Character.objects.create(
                                                player=buyer,
                                                **character_data
                                            )
                                            listing.character = character
                                            listing.save()
                                            logger.info(f"✅ 成功創建並關聯 Character: {character.name}")
                            except Exception as e:
                                logger.error(f"❌ 創建 Character 失敗: {e}")
                                import traceback
                                logger.error(traceback.format_exc())
        
        # 檢查是否已經創建過交易記錄（避免重複）
        existing_transaction = MarketTransaction.objects.filter(tx_hash=tx_hash).first()
        if existing_transaction:
            logger.info(f"ℹ️ 交易記錄已存在: {tx_hash}")
            return Response({
                'success': True,
                'message': '交易記錄已存在',
                'data': {
                    'transaction_id': str(existing_transaction.id)
                }
            })
        
        # 確保 character 存在
        character = listing.character
        if not character:
            return Response({
                'success': False,
                'error': 'Character 不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 更新上架狀態
        listing.status = 'sold'
        listing.sold_at = timezone.now()
        listing.buy_tx_hash = tx_hash
        listing.buyer = buyer
        listing.save()
        
        # 創建交易記錄
        transaction = MarketTransaction.objects.create(
            listing=listing,
            character=character,
            buyer=buyer,
            seller=listing.seller,
            price=listing.price,  # 使用上架時的價格
            currency=listing.currency,
            tx_hash=tx_hash,
        )
        
        # 更新價格歷史
        CharacterPriceHistory.objects.create(
            character=character,
            transaction=transaction,
            price=listing.price,
            tx_hash=tx_hash,
        )
        
        # 更新 Character 所有權（如果還沒有更新的話）
        if buyer.wallet_address:
            character.owner_wallet = buyer.wallet_address.lower()
            character.player = buyer
            character.save()
        
        logger.info(f"✅ 創建交易記錄成功: Transaction ID {transaction.id}, Price {listing.price}")
        
        return Response({
            'success': True,
            'message': '購買已索引',
            'data': {
                'transaction_id': str(transaction.id)
            }
        })
        
    except Exception as e:
        logger.error(f"索引購買失敗: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notify_listing_cancelled(request, listing_id):
    """
    通知後端上架已取消（可選）
    
    POST /api/marketplace/listings/<uuid>/cancel/
    Body: {
        "tx_hash": "0x..."
    }
    """
    try:
        listing = CharacterListing.objects.get(id=listing_id)
        tx_hash = request.data.get('tx_hash')
        
        # 更新狀態
        listing.status = 'cancelled'
        listing.cancelled_at = timezone.now()
        if tx_hash:
            listing.cancel_tx_hash = tx_hash
        listing.save()
        
        return Response({
            'success': True,
            'message': '上架取消已索引'
        })
        
    except CharacterListing.DoesNotExist:
        return Response({
            'success': False,
            'error': '上架不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"取消上架失敗: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def marketplace_stats(request):
    """
    市場統計
    
    GET /api/marketplace/stats/
    """
    try:
        # 計算統計數據
        total_listings = CharacterListing.objects.filter(status='active').count()
        total_sold = MarketTransaction.objects.count()
        
        # 價格統計
        active_listings = CharacterListing.objects.filter(status='active')
        if active_listings.exists():
            price_stats = active_listings.aggregate(
                avg_price=Avg('price'),
                max_price=Max('price'),
                min_price=Min('price')
            )
        else:
            price_stats = {'avg_price': 0, 'max_price': 0, 'min_price': 0}
        
        # 24小時交易量
        yesterday = timezone.now() - timedelta(days=1)
        volume_24h = MarketTransaction.objects.filter(
            created_at__gte=yesterday
        ).aggregate(total=Sum('price'))['total'] or Decimal('0')
        
        # 7天交易量
        week_ago = timezone.now() - timedelta(days=7)
        volume_7d = MarketTransaction.objects.filter(
            created_at__gte=week_ago
        ).aggregate(total=Sum('price'))['total'] or Decimal('0')
        
        # 稀有度分布
        rarity_distribution = {}
        for rarity_value, rarity_name in Character.RARITY_CHOICES:
            count = active_listings.filter(character__rarity=rarity_value).count()
            rarity_distribution[rarity_name] = count
        
        return Response({
            'success': True,
            'data': {
                'total_listings': total_listings,
                'total_sold': total_sold,
                'price_stats': {
                    'average': str(price_stats['avg_price']),
                    'max': str(price_stats['max_price']),
                    'min': str(price_stats['min_price'])
                },
                'volume': {
                    '24h': str(volume_24h),
                    '7d': str(volume_7d)
                },
                'rarity_distribution': rarity_distribution
            }
        })
        
    except Exception as e:
        logger.error(f"獲取市場統計失敗: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_character_listing(request, character_id):
    """
    獲取角色的上架信息
    
    GET /api/marketplace/characters/<uuid>/listing/
    """
    try:
        character = Character.objects.get(id=character_id)
        
        # 獲取角色的上架記錄
        try:
            listing = CharacterListing.objects.get(character=character, status='active')
            return Response({
                'success': True,
                'data': {
                    'listing_id': str(listing.id),
                    'chain_listing_id': listing.listing_id,
                    'price': str(listing.price),
                    'currency': listing.currency,
                    'listed_at': listing.listed_at.isoformat(),
                    'tx_hash': listing.tx_hash,
                }
            })
        except CharacterListing.DoesNotExist:
            return Response({
                'success': False,
                'data': None,
                'message': '角色未上架'
            })
        
    except Character.DoesNotExist:
        return Response({
            'success': False,
            'error': '角色不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"獲取角色上架信息失敗: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def character_price_history(request, character_id):
    """
    角色價格歷史
    
    GET /api/marketplace/characters/<uuid>/price-history/
    """
    try:
        character = Character.objects.get(id=character_id)
        history = CharacterPriceHistory.objects.filter(character=character).order_by('-timestamp')[:50]
        
        results = [{
            'price': str(h.price),
            'timestamp': h.timestamp.isoformat(),
            'tx_hash': h.tx_hash
        } for h in history]
        
        return Response({
            'success': True,
            'data': results
        })
        
    except Character.DoesNotExist:
        return Response({
            'success': False,
            'error': '角色不存在'
        }, status=status.HTTP_404_NOT_FOUND)

