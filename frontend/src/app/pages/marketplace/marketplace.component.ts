import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketplaceService, MarketplaceListing, MarketplaceStats } from '../../services/marketplace.service';
import { Web3Service } from '../../services/web3.service';
import { DialogService } from '../../services/dialog.service';
import { CharacterCardComponent } from '../../shared/character-card.component';
import { Character } from '../../interfaces/character.interface';
import { CharacterService } from '../../services/character.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CharacterCardComponent],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.scss']
})
export class MarketplaceComponent implements OnInit, OnDestroy {
  isLoading = true;
  listings: MarketplaceListing[] = [];
  stats: MarketplaceStats | null = null;
  
  // 分頁
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  limit = 20;
  
  // 篩選和排序
  selectedRarity: string | null = null;
  minPrice: string = '';
  maxPrice: string = '';
  searchQuery: string = '';
  sortBy: string = 'listed_at_desc';
  
  // 購買狀態
  purchasingListingId: string | null = null;
  
  // 錢包連接狀態
  walletAddress: string | null = null;
  isWalletConnected = false;
  
  rarityFilters = [
    { value: null, label: 'ALL' },
    { value: '1', label: 'N' },
    { value: '2', label: 'R' },
    { value: '3', label: 'SR' },
    { value: '4', label: 'SSR' },
    { value: '5', label: 'UR' },
  ];
  
  sortOptions = [
    { value: 'listed_at_desc', label: '最新上架' },
    { value: 'listed_at_asc', label: '最早上架' },
    { value: 'price_asc', label: '價格：低到高' },
    { value: 'price_desc', label: '價格：高到低' },
  ];
  
  constructor(
    private marketplaceService: MarketplaceService,
    private web3Service: Web3Service,
    private dialogService: DialogService,
    private characterService: CharacterService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadMarketplace();
    this.loadStats();
    this.checkWalletConnection();
    
    // 監聽錢包連接狀態
    this.web3Service.connectionStatus$.subscribe(status => {
      this.isWalletConnected = status.connected;
      this.walletAddress = status.address || null;
    });
  }
  
  ngOnDestroy(): void {
    // 清理
  }
  
  checkWalletConnection(): void {
    this.web3Service.connectionStatus$.subscribe(status => {
      this.isWalletConnected = status.connected;
      this.walletAddress = status.address || null;
    }).unsubscribe();
    
    // 立即檢查一次
    this.web3Service.connectionStatus$.subscribe({
      next: status => {
        this.isWalletConnected = status.connected;
        this.walletAddress = status.address || null;
      }
    });
  }
  
  loadMarketplace(): void {
    this.isLoading = true;
    // 直接從鏈上抓取 listing
    this.marketplaceService.getAllListingsFromChain()
      .then(async rawListings => {
        // 根據 tokenId 從後端獲取完整的角色資料
        const adaptedPromises = rawListings.map(async (l) => {
          let characterData = null;
          try {
            // 根據 tokenId 查詢角色
            characterData = await new Promise<Character | null>((resolve) => {
              this.characterService.getCharacterByTokenId(l.tokenId).subscribe({
                next: (response) => {
                  if (response.success && response.data) {
                    resolve(response.data);
                  } else {
                    resolve(null);
                  }
                },
                error: (err) => {
                  console.warn(`無法獲取 Token ID ${l.tokenId} 的角色資料:`, err);
                  resolve(null);
                }
              });
            });
          } catch (err) {
            console.warn(`獲取 Token ID ${l.tokenId} 的角色資料失敗:`, err);
          }

          // 如果有角色資料，使用真實資料；否則使用佔位符
          const character = characterData || {
            id: `onchain-${l.assetContract}-${l.tokenId}`,
            name: `Fighter #${l.tokenId}`,
            image_url: '',
            rarity: 1,
            rarity_name: 'N',
            level: 1,
            strength: 0,
            agility: 0,
            luck: 0,
            win_count: 0,
            loss_count: 0,
            token_id: l.tokenId,
            contract_address: l.assetContract
          };

          // 確保 chain_listing_id 存在
          // 注意：listingId 可以是 0（有效的 listing ID），所以只檢查 undefined 和 null
          if (l.listingId === undefined || l.listingId === null) {
            console.warn(`⚠️ Listing 缺少 listingId，原始數據:`, l);
            console.warn(`⚠️ 將跳過這個 listing`);
            // 返回 null，稍後過濾掉
            return null;
          }

          return {
            listing_id: String(l.listingId),
            chain_listing_id: l.listingId, // listingId 已經確認不是 undefined/null
            character: {
              id: character.id,
              name: character.name,
              image_url: character.image_url || '',
              rarity: character.rarity || 1,
              rarity_name: character.rarity_name || 'N',
              level: character.level || 1,
              strength: character.strength || 0,
              agility: character.agility || 0,
              luck: character.luck || 0,
              win_count: character.win_count || 0,
              loss_count: character.loss_count || 0,
              token_id: l.tokenId,
              contract_address: l.assetContract
            },
            seller: {
              id: l.seller,
              nickname: l.seller.substring(0, 6) + '...' + l.seller.substring(l.seller.length - 4)
            },
            price: l.price, // 現在是 MNT 格式（已轉換）
            priceWei: l.priceWei, // 保留 wei 格式用於鏈上交易
            currency: l.currency,
            listed_at: new Date().toISOString(),
            expires_at: undefined,
          } as MarketplaceListing;
        });

        const adapted = (await Promise.all(adaptedPromises)).filter((item): item is MarketplaceListing => item !== null);

        // 根據排序選項排序
        adapted.sort((a, b) => {
          const priceA = parseFloat(a.price || '0');
          const priceB = parseFloat(b.price || '0');
          
          if (this.sortBy === 'price_asc') {
            return priceA - priceB;
          } else if (this.sortBy === 'price_desc') {
            return priceB - priceA;
          } else if (this.sortBy === 'listed_at_desc') {
            return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
          } else if (this.sortBy === 'listed_at_asc') {
            return new Date(a.listed_at).getTime() - new Date(b.listed_at).getTime();
          }
          return 0;
        });

        // 簡單分頁（前端）
        this.totalItems = adapted.length;
        this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.limit));
        const start = (this.currentPage - 1) * this.limit;
        const end = start + this.limit;
        this.listings = adapted.slice(start, end);
      })
      .catch(err => {
        console.error('加載市場失敗(鏈上):', err);
        this.dialogService.error('加載失敗', '無法從鏈上加載市場數據');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
  
  loadStats(): void {
    this.marketplaceService.getMarketplaceStats().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.stats = response.data;
        }
      },
      error: (error) => {
        console.error('加載統計失敗:', error);
      }
    });
  }
  
  applyFilters(): void {
    this.currentPage = 1;
    this.loadMarketplace();
  }
  
  resetFilters(): void {
    this.selectedRarity = null;
    this.minPrice = '';
    this.maxPrice = '';
    this.searchQuery = '';
    this.sortBy = 'listed_at_desc';
    this.applyFilters();
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMarketplace();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  async buyCharacter(listing: MarketplaceListing): Promise<void> {
    if (!this.isWalletConnected) {
      this.dialogService.error('未連接錢包', '請先連接錢包才能購買');
      return;
    }
    
    if (listing.chain_listing_id === undefined || listing.chain_listing_id === null) {
      console.error('❌ 無法獲取 chain_listing_id，listing 數據:', listing);
      this.dialogService.error('錯誤', `無法獲取上架 ID。Listing ID: ${listing.listing_id}`);
      return;
    }
    
    // 使用 Promise 包裝確認對話框
    const confirmed = await new Promise<boolean>((resolve) => {
      this.dialogService.confirm(
        '確認購買',
        `確定要以 ${this.formatPrice(listing.price)} MNT 購買 ${listing.character.name} 嗎？\n\n此操作無法撤銷。`,
        () => resolve(true),
        () => resolve(false)
      );
    });
    
    if (!confirmed) {
      return;
    }
    
    this.purchasingListingId = listing.listing_id;
    this.dialogService.loading('購買中', '正在處理購買交易...');
    
    try {
      // 購買時需要使用 wei 格式的價格（原始價格）
      // 如果 listing 有 priceWei，使用它；否則將 MNT 轉換回 wei
      const priceWei = (listing as any).priceWei || (BigInt(Math.floor(parseFloat(listing.price) * 1e18))).toString();
      
      // 使用原生代幣地址（EVM 通用地址）
      // buyCharacter 方法會自動處理各種原生代幣地址的轉換
      const currencyForPurchase = listing.currency || '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
      
      console.log('🛒 購買參數:', {
        listingId: listing.chain_listing_id,
        priceWei,
        originalCurrency: listing.currency,
        currencyForPurchase,
        note: 'buyCharacter 方法會將 MNT 地址轉換為零地址以符合 MarketplaceV3 合約要求'
      });
      
      const txHash = await this.marketplaceService.buyCharacter(
        listing.chain_listing_id,
        priceWei, // 傳遞 wei 格式的價格
        currencyForPurchase // 使用原生代幣地址（合約會使用 msg.value 處理支付）
      );
      
      // 等待交易確認後，通知後端索引
      try {
        if (listing.chain_listing_id !== undefined) {
          await new Promise((resolve, reject) => {
            this.marketplaceService.notifyPurchase(txHash, listing.chain_listing_id!).subscribe({
              next: () => resolve(undefined),
              error: reject
            });
          });
        }
      } catch (e) {
        console.warn('通知後端索引失敗:', e);
        // 不影響購買流程
      }
      
      this.dialogService.success(
        '購買成功',
        `交易哈希: ${txHash}\n\nNFT 已轉移到你的錢包。`
      );
      
      // 重新加載市場
      this.loadMarketplace();
      this.loadStats();
      
      // 提示用戶前往 Profile 查看（可能需要同步）
      this.dialogService.info(
        '同步 NFT',
        '購買的 NFT 已轉移到你的錢包。\n\n請前往 Profile 頁面查看，如有需要可以點擊「同步 NFT」按鈕更新。'
      );
      
    } catch (error: any) {
      console.error('購買失敗:', error);
      this.dialogService.error(
        '購買失敗',
        error.message || '交易失敗，請檢查錢包餘額和網絡設置'
      );
    } finally {
      this.purchasingListingId = null;
    }
  }
  
  // 將 MarketplaceListing 轉換為 Character 格式（供 CharacterCard 使用）
  listingToCharacter(listing: MarketplaceListing): Character {
    return {
      id: listing.character.id,
      name: listing.character.name,
      image_url: listing.character.image_url,
      rarity: listing.character.rarity,
      rarity_name: listing.character.rarity_name,
      level: listing.character.level,
      strength: listing.character.strength,
      agility: listing.character.agility,
      luck: listing.character.luck,
      win_count: listing.character.win_count,
      loss_count: listing.character.loss_count,
      skill_description: '', // MarketplaceListing 中可能沒有這個字段
      prompt: '', // MarketplaceListing 中可能沒有這個字段
      is_minted: listing.character.token_id !== null && listing.character.token_id !== undefined,
      token_id: listing.character.token_id,
      contract_address: listing.character.contract_address || '',
      owner_wallet: listing.seller.id, // 簡化處理
      created_at: new Date().toISOString(), // 默認值
      player: listing.seller.id // 簡化處理
    } as Character;
  }
  
  formatPrice(price: string): string {
    const num = parseFloat(price);
    if (num >= 1) {
      return num.toFixed(2);
    } else if (num >= 0.01) {
      return num.toFixed(4);
    } else {
      return num.toFixed(6);
    }
  }
}

