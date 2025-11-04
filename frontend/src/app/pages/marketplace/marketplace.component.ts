import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MarketplaceService, MarketplaceListing, MarketplaceStats } from '../../services/marketplace.service';
import { Web3Service } from '../../services/web3.service';
import { DialogService } from '../../services/dialog.service';
import { Character } from '../../interfaces/character.interface';
import { CharacterService } from '../../services/character.service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  cancellingListingId: string | null = null;
  
  // 錢包連接狀態
  walletAddress: string | null = null;
  isWalletConnected = false;
  
  // MNT 餘額
  mntBalance: string = '0.00';
  isLoadingBalance = false;
  
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
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    // 檢查是否有 queryParams 指定要跳轉到特定 listing
    this.route.queryParams.subscribe(params => {
      const listingId = params['listingId'];
      if (listingId) {
        // 載入完 listing 後，滾動到指定 listing
        this.scrollToListing(listingId);
      }
    });
    
    this.loadMarketplace();
      this.loadStats();
      this.checkWalletConnection();
      
      // 調試：檢查錢包物件結構
      const wallet = this.web3Service.currentWallet;
      if (wallet) {
        console.log('🔍 Marketplace: currentWallet 類型:', wallet.constructor.name);
        console.log('🔍 Marketplace: currentWallet 物件:', wallet);
        console.log('🔍 Marketplace: currentWallet 方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(wallet)));
        try {
          const account = wallet.getAccount();
          console.log('🔍 Marketplace: getAccount() 結果:', account);
          if (account) {
            console.log('🔍 Marketplace: account.address:', account.address);
          }
        } catch (e) {
          console.error('🔍 Marketplace: getAccount() 錯誤:', e);
        }
      } else {
        console.log('🔍 Marketplace: currentWallet 為 null');
      }
    
    // 監聽錢包連接狀態
    this.web3Service.connectionStatus$.subscribe(status => {
      this.isWalletConnected = status.connected;
      this.walletAddress = status.address || null;
      
      // 如果錢包已連接，加載 MNT 餘額
      if (status.connected && status.address) {
        this.loadMNTBalance();
      } else {
        this.mntBalance = '0.00';
      }
    });
  }
  
  ngOnDestroy(): void {
    // 清理
  }
  
  checkWalletConnection(): void {
    // 先檢查當前連接狀態
    const currentStatus = this.web3Service.getCurrentConnection();
    this.isWalletConnected = currentStatus.connected;
    this.walletAddress = currentStatus.address || null;
    
    // 如果狀態顯示未連接，但用戶是 social login，嘗試主動檢查 thirdweb in-app wallet
    if (!this.isWalletConnected) {
      const loginMethod = localStorage.getItem('login_method') || '';
      const isSocialLogin = ['google', 'facebook', 'apple', 'social'].includes(loginMethod);
      
      if (isSocialLogin) {
        // 先嘗試靜默恢復
        this.web3Service.trySilentRestoreSocialWallet().then((address: string | null) => {
          if (address) {
            console.log('🔍 Marketplace: 靜默恢復成功:', address);
            this.isWalletConnected = true;
            this.walletAddress = address;
            this.loadMNTBalance();
          } else {
            // 如果靜默恢復失敗，嘗試從 currentWallet 獲取地址
            const currentWallet = this.web3Service.currentWallet;
            if (currentWallet) {
              try {
                const account = currentWallet.getAccount();
                if (account && account.address) {
                  console.log('🔍 Marketplace: 檢測到 social login 的 thirdweb in-app wallet:', account.address);
                  this.isWalletConnected = true;
                  this.walletAddress = account.address;
                  
                  // 更新 web3Service 的連接狀態
                  this.web3Service.updateConnectionStatus(
                    true,
                    account.address,
                    'social'
                  );
                  this.loadMNTBalance();
                }
              } catch (e) {
                console.warn('Marketplace: 無法從 currentWallet 獲取帳戶:', e);
                // 如果都失敗，使用後端保存的 wallet_address
                const savedAddress = localStorage.getItem('wallet_address');
                if (savedAddress) {
                  console.log('🔍 Marketplace: 使用後端保存的 wallet_address:', savedAddress);
                  this.walletAddress = savedAddress;
                  // 不設置 connected，因為 thirdweb 會話未激活
                }
              }
            } else {
              // 如果沒有 currentWallet，使用後端保存的 wallet_address
              const savedAddress = localStorage.getItem('wallet_address');
              if (savedAddress) {
                console.log('🔍 Marketplace: 使用後端保存的 wallet_address:', savedAddress);
                this.walletAddress = savedAddress;
              }
            }
          }
        });
      }
    }
    
    // 訂閱連接狀態變化
    this.web3Service.connectionStatus$.subscribe({
      next: status => {
        this.isWalletConnected = status.connected;
        this.walletAddress = status.address || null;
        
        // 如果錢包已連接，加載 MNT 餘額
        if (status.connected && status.address) {
          this.loadMNTBalance();
        } else {
          // 如果狀態顯示未連接，但用戶是 social login，再次嘗試檢查
          const loginMethod = localStorage.getItem('login_method') || '';
          const isSocialLogin = ['google', 'facebook', 'apple', 'social'].includes(loginMethod);
          
          if (isSocialLogin && !this.isWalletConnected) {
            const currentWallet = this.web3Service.currentWallet;
            if (currentWallet) {
              try {
                const account = currentWallet.getAccount();
                if (account && account.address) {
                  console.log('🔍 Marketplace: 訂閱中檢測到 social login 錢包:', account.address);
                  this.isWalletConnected = true;
                  this.walletAddress = account.address;
                  this.loadMNTBalance();
                }
              } catch (e) {
                // 忽略錯誤
              }
            }
          }
        }
      }
    });
  }

  /**
   * 加載 MNT 餘額
   */
  async loadMNTBalance(): Promise<void> {
    let address = this.walletAddress;
    
    // 如果沒有地址，嘗試從 currentWallet 獲取
    if (!address) {
      const currentWallet = this.web3Service.currentWallet;
      if (currentWallet) {
        try {
          const account = currentWallet.getAccount();
          address = account?.address;
        } catch (e) {
          console.warn('無法從 currentWallet 獲取地址:', e);
        }
      }
    }
    
    if (!address) {
      this.mntBalance = '0.00';
      return;
    }

    this.isLoadingBalance = true;
    try {
      const balance = await this.marketplaceService.checkNativeBalance(address);
      const balanceMNT = Number(balance) / 1e18;
      this.mntBalance = balanceMNT >= 0.0001 ? balanceMNT.toFixed(4) : balanceMNT.toFixed(6);
    } catch (error) {
      console.error('加載 MNT 餘額失敗:', error);
      this.mntBalance = '0.00';
    } finally {
      this.isLoadingBalance = false;
    }
  }
  
  loadMarketplace(): void {
    this.isLoading = true;
    // 從後端 API 獲取已索引的 listing（更快）
    const queryParams: any = {
      page: this.currentPage,
      limit: this.limit,
      sort_by: this.sortBy,
    };
    
    if (this.selectedRarity) {
      queryParams.rarity = this.selectedRarity;
    }
    if (this.minPrice) {
      queryParams.min_price = this.minPrice;
    }
    if (this.maxPrice) {
      queryParams.max_price = this.maxPrice;
    }
    if (this.searchQuery) {
      queryParams.search = this.searchQuery;
    }
    
    // 使用後端 API 獲取 listings（更快）
    this.marketplaceService.browseMarketplace(queryParams).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          console.warn('後端 API 返回空數據，回退到鏈上獲取');
          this.loadMarketplaceFromChain();
          return;
        }

        // 轉換後端格式為 MarketplaceListing
        const adapted: MarketplaceListing[] = response.data.listings.map((listing: any) => ({
          listing_id: listing.listing_id,
          chain_listing_id: listing.chain_listing_id,
          character: listing.character,
          seller: listing.seller,
          price: listing.price,
          currency: listing.currency,
          listed_at: listing.listed_at,
          expires_at: listing.expires_at,
          priceHistory: listing.price_history || undefined,
        }));

        // 使用後端返回的分頁信息
        this.totalItems = response.data.pagination.total;
        this.totalPages = response.data.pagination.total_pages;
        this.listings = adapted;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('從後端獲取 listings 失敗，回退到鏈上獲取:', err);
        // 如果後端失敗，回退到鏈上獲取
        this.loadMarketplaceFromChain();
      }
    });
  }

  /**
   * 從鏈上獲取 listings（備用方案）
   */
  loadMarketplaceFromChain(): void {
    this.marketplaceService.getAllListingsFromChain()
      .then(async rawListings => {
        // 根據 tokenId 從後端獲取完整的角色資料
        const adaptedPromises = rawListings.map(async (l: any) => {
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
          if (l.listingId === undefined || l.listingId === null) {
            console.warn(`⚠️ Listing 缺少 listingId，原始數據:`, l);
            return null;
          }

          return {
            listing_id: String(l.listingId),
            chain_listing_id: l.listingId,
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
            price: l.price,
            priceWei: l.priceWei,
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
      .catch((err: any) => {
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
    // 檢查是否已連接錢包（包括 social login 的 thirdweb in-app wallet）
    if (!this.isWalletConnected) {
      // 嘗試檢查是否有 thirdweb in-app wallet（social login）
        const loginMethod = localStorage.getItem('login_method') || '';
        const isSocialLogin = ['google', 'facebook', 'apple', 'social'].includes(loginMethod);
        const walletAddress = localStorage.getItem('wallet_address');
        
        // 調試：檢查錢包物件
        const wallet = this.web3Service.currentWallet;
        console.log('🔍 buyCharacter: currentWallet 存在?', !!wallet);
        if (wallet) {
          console.log('🔍 buyCharacter: currentWallet 類型:', wallet.constructor.name);
          console.log('🔍 buyCharacter: currentWallet 方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(wallet)));
          try {
            const account = wallet.getAccount();
            console.log('🔍 buyCharacter: getAccount() 結果:', account);
            if (account) {
              console.log('🔍 buyCharacter: account.address:', account.address);
            }
          } catch (e: any) {
            console.error('🔍 buyCharacter: getAccount() 錯誤:', e);
            console.error('🔍 buyCharacter: 錯誤詳情:', e?.message, e?.stack);
          }
        }
      
      if (isSocialLogin && walletAddress) {
        // 對於社交登入用戶，嘗試恢復錢包
        console.log('🔍 社交登入用戶，嘗試恢復錢包...');
        try {
          const restoredAddress = await this.web3Service.trySilentRestoreSocialWallet();
          if (restoredAddress) {
            console.log('✅ 成功恢復錢包:', restoredAddress);
            this.isWalletConnected = true;
            this.walletAddress = restoredAddress;
            await this.loadMNTBalance();
          } else {
            // 如果恢復失敗，但用戶已登入，提示重新連接
            this.dialogService.warning(
              '需要重新連接錢包',
              '您的錢包會話已過期。\n\n請點擊「重新連接」按鈕來恢復錢包連接。'
            );
            // 不導航到登入頁面，讓用戶在當前頁面重新連接
            return;
          }
        } catch (e) {
          console.warn('恢復錢包失敗:', e);
          this.dialogService.warning(
            '需要重新連接錢包',
            '無法恢復錢包連接。\n\n請嘗試刷新頁面或重新登入。'
          );
          return;
        }
      } else {
        // 非社交登入或沒有 wallet_address
        const currentWallet = this.web3Service.currentWallet;
        if (currentWallet) {
          try {
            const account = currentWallet.getAccount();
            if (account && account.address) {
              this.isWalletConnected = true;
              this.walletAddress = account.address;
              await this.loadMNTBalance();
            } else {
              this.dialogService.warning(
                '需要連接錢包',
                '請先連接錢包才能購買角色。'
              );
              this.router.navigate(['/login']);
              return;
            }
          } catch (e) {
            console.warn('檢查 wallet 失敗:', e);
            this.dialogService.warning(
              '需要連接錢包',
              '請先連接錢包才能購買角色。'
            );
            this.router.navigate(['/login']);
            return;
          }
        } else {
          this.dialogService.warning(
            '需要連接錢包',
            '請先連接錢包才能購買角色。\n\n請前往登入頁面連接錢包。'
          );
          this.router.navigate(['/login']);
          return;
        }
      }
    }
    
    // 再次確認錢包已連接（在購買前）
    if (!this.isWalletConnected || !this.walletAddress) {
      this.dialogService.error('錯誤', '無法確認錢包連接狀態，請刷新頁面後重試。');
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
            // 傳遞 token_id 和 asset_contract 以便後端創建 Character（如果不存在）
            this.marketplaceService.notifyPurchase(
              txHash, 
              listing.chain_listing_id!,
              listing.character?.token_id,
              listing.character?.contract_address,
              listing.price,
              listing.currency
            ).subscribe({
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
      this.dialogService.hide();
    }
  }
  
  /**
   * 檢查 listing 是否屬於當前用戶
   */
  isMyListing(listing: MarketplaceListing): boolean {
    if (!this.walletAddress) {
      return false;
    }
    
    const myWallet = this.walletAddress.toLowerCase();
    const sellerWallet = (listing.seller as any).wallet_address || listing.seller.id;
    
    if (!sellerWallet) {
      return false;
    }
    
    return sellerWallet.toLowerCase() === myWallet;
  }
  
  /**
   * 取消上架
   */
  async cancelListing(listing: MarketplaceListing): Promise<void> {
    if (listing.chain_listing_id === undefined && listing.chain_listing_id !== 0) {
      this.dialogService.error('錯誤', '無法獲取上架 ID');
      return;
    }
    
    // 確認對話框
    const confirmed = await new Promise<boolean>((resolve) => {
      this.dialogService.confirm(
        '確認取消上架',
        `確定要取消「${listing.character.name}」的上架嗎？\n\n此操作無法撤銷。`,
        () => resolve(true),
        () => resolve(false)
      );
    });
    
    if (!confirmed) {
      return;
    }
    
    this.cancellingListingId = listing.listing_id;
    this.dialogService.loading('取消中', '正在處理取消上架交易...');
    
    try {
      // 取消上架
      const txHash = await this.marketplaceService.cancelListing(listing.chain_listing_id!);
      
      // 通知後端索引
      try {
        await new Promise((resolve, reject) => {
          this.marketplaceService.notifyListingCancelled(listing.listing_id, txHash).subscribe({
            next: () => resolve(undefined),
            error: reject
          });
        });
      } catch (e) {
        console.warn('通知後端索引失敗:', e);
        // 不影響取消流程
      }
      
      this.dialogService.success(
        '取消成功',
        `交易哈希: ${txHash}\n\n上架已取消。`
      );
      
      // 重新加載市場
      this.loadMarketplace();
      this.loadStats();
      await this.loadMNTBalance();
    } catch (error: any) {
      this.dialogService.error('取消失敗', error.message || '取消上架過程中發生錯誤');
      console.error('取消上架失敗:', error);
    } finally {
      this.cancellingListingId = null;
      this.dialogService.hide();
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

  getCharacterImage(listing: MarketplaceListing): string {
    const character = listing.character;
    if (character.image_url && !character.image_url.includes('placeholder')) {
      // 如果是完整 URL，直接返回；否則拼接後端 URL
      if (character.image_url.startsWith('http://') || character.image_url.startsWith('https://')) {
        return character.image_url;
      }
      // 使用後端基礎 URL
      return `${environment.backendBaseUrl}${character.image_url.startsWith('/') ? '' : '/'}${character.image_url}`;
    }
    return 'assets/placeholder-character.png';
  }

  onImageError(event: any): void {
    event.target.src = 'assets/placeholder-character.png';
  }

  getRarityLabel(rarity: number): string {
    const rarityMap: { [key: number]: string } = {
      1: 'N',
      2: 'R',
      3: 'SR',
      4: 'SSR',
      5: 'UR'
    };
    return rarityMap[rarity] || 'N';
  }

  getWinRate(character: any): number {
    const total = character.win_count + character.loss_count;
    if (total === 0) return 0;
    return Math.round((character.win_count / total) * 100);
  }

  /**
   * 滾動到指定的 listing
   */
  scrollToListing(listingId: string | number): void {
    // 等待 listing 加載完成
    setTimeout(() => {
      const listingElement = document.querySelector(`[data-listing-id="${listingId}"]`);
      if (listingElement) {
        listingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 添加高亮效果
        listingElement.classList.add('highlighted-listing');
        setTimeout(() => {
          listingElement.classList.remove('highlighted-listing');
        }, 2000);
      }
    }, 500);
  }
}

