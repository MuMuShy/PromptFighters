import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { BattleService } from '../services/battle.service';
import { CharacterCardComponent } from '../shared/character-card.component';
import { Character } from '../interfaces/character.interface';
import { AuthService } from '../services/auth.service';
import { Battle } from '../interfaces/battle.interface';
import { PlayerService } from '../services/player.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NftService } from '../services/nft.service';
import { Web3Service } from '../services/web3.service';
import { DialogService } from '../services/dialog.service';
import { ShareDialogComponent } from '../components/share-dialog/share-dialog.component';
import { MarketplaceService } from '../services/marketplace.service';
import { DailyQuestsComponent } from '../components/daily-quests/daily-quests.component';
import { NftGalleryComponent } from '../nft-gallery/nft-gallery.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, CharacterCardComponent, FormsModule, ShareDialogComponent, DailyQuestsComponent, NftGalleryComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  isLoading = true;
  isViewMode = false;
  currentCharacter: Character | null = null;
  recentBattles: Battle[] = [];
  allCharacters: Character[] = [];
  selectedRarityFilter: number | null = null;
  walletAddress: string = '';
  nickname: string = '';
  nicknameChanged: boolean = false;
  displayName: string = '';
  editNicknameMode: boolean = false;
  loginMethod: string = ''; // 登入方式
  showWalletConnectPrompt: boolean = false; // 是否顯示錢包連接提示
  isMinting: boolean = false;
  mintingCharacterId: string | null = null;
  showShareDialog: boolean = false;
  shareCharacter: Character | null = null;
  
  // 上架相關
  showListDialog: boolean = false;
  listingCharacter: Character | null = null;
  listingPrice: string = '';
  isListing: boolean = false;
  isCheckingApproval: boolean = false;
  
  // 取消上架相關
  isCancelling: boolean = false;
  cancellingCharacterId: string | null = null;
  
  // NFT 同步相關
  isSyncingNFTs: boolean = false;
  
  // Tab 切換
  activeTab: 'fighters' | 'daily' | 'gallery' = 'fighters';
  
  // MNT 餘額
  mntBalance: string = '0.00';
  isLoadingBalance: boolean = false;
  
  rarityFilters = [
    { value: null, label: 'ALL', icon: '◉', count: 0 },
    { value: 1, label: 'N', icon: '●', count: 0 },
    { value: 2, label: 'R', icon: '✦', count: 0 },
    { value: 3, label: 'SR', icon: '✧', count: 0 },
    { value: 4, label: 'SSR', icon: '✨', count: 0 },
    { value: 5, label: 'UR', icon: '⭐', count: 0 }
  ];

  constructor(
    private characterService: CharacterService,
    private battleService: BattleService,
    private authService: AuthService,
    private playerService: PlayerService,
    private dialogService: DialogService,
    private route: ActivatedRoute,
    private router: Router,
    private nftService: NftService,
    public web3Service: Web3Service, // 改為 public，以便模板訪問
    private marketplaceService: MarketplaceService
  ) {}

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('playerId');
    this.isViewMode = !!playerId;
    this.playerService.getProfile(playerId || undefined).subscribe({
      next: async (profile: any) => {
        if (this.isViewMode) {
          this.displayName = profile.player.nickname || profile.player.display_name || '';
        } else {
          this.walletAddress = profile.player.wallet_address || '';
          this.nickname = profile.player.nickname || '';
          this.nicknameChanged = profile.player.nickname_changed || false;
          this.displayName = profile.player.nickname || profile.player.display_name || '';
        }
        this.allCharacters = profile.characters;
        
        // 如果是自己的 Profile 且有錢包連接，從鏈上同步 listing 狀態和 NFT 持有
        if (!this.isViewMode && this.web3Service.isWalletConnected()) {
          await this.syncListingsFromChain();
          // 購買後可能需要同步 NFT 持有（靜默執行，不顯示錯誤）
          try {
            await this.syncOwnedNFTsFromChainSilent();
          } catch (e) {
            // 靜默失敗，用戶可以手動點擊按鈕同步
          }
          // 加載 MNT 餘額
          this.loadMNTBalance();
        }
        
        // 監聽錢包連接狀態變化
        this.web3Service.connectionStatus$.subscribe(status => {
          if (status.connected && status.address && !this.isViewMode) {
            this.walletAddress = status.address;
            this.loadMNTBalance();
          }
        });
        
        if (profile.characters.length > 0 && !this.isViewMode) {
          const initialCharacter = profile.characters[0];
          this.currentCharacter = initialCharacter;
          this.characterService.saveCharacter(initialCharacter);
          //this.fetchBattlesForCharacter(initialCharacter.id, this.authService.getToken() || '');
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // 监听当前角色变化
    this.characterService.currentCharacter$.subscribe(character => {
      if (character && character.id !== this.currentCharacter?.id) {
        this.currentCharacter = character;
        //this.fetchBattlesForCharacter(character.id, this.authService.getToken() || ''); 目前點選角色沒有歷史戰鬥顯示需求
      }
    });
  }

  fetchBattlesForCharacter(characterId: string, token: string): void {
    this.battleService.getBattlesByCharacterId(characterId, token).subscribe(battles => {
      this.recentBattles = battles.slice(0, 10); // 只顯示最近10場
    });
  }

  selectCharacter(character: Character): void {
    if(this.isViewMode) return;
    this.currentCharacter = character;
    this.characterService.saveCharacter(character);
    const token = this.authService.getToken() || '';
    this.fetchBattlesForCharacter(character.id, token);
  }

  get totalCharacters(): number {
    return this.allCharacters.length;
  }

  get totalBattles(): number {
    return this.allCharacters.reduce((total, char) => 
      total + char.win_count + char.loss_count, 0);
  }

  get overallWinRate(): number {
    const totalWins = this.allCharacters.reduce((total, char) => total + char.win_count, 0);
    const totalBattles = this.totalBattles;
    return totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;
  }

  get winRate(): number {
    if (!this.currentCharacter) return 0;
    const total = this.currentCharacter.win_count + this.currentCharacter.loss_count;
    return total > 0 ? Math.round((this.currentCharacter.win_count / total) * 100) : 0;
  }
  
  get filteredCharacters(): Character[] {
    if (this.selectedRarityFilter === null) {
      return this.allCharacters;
    }
    return this.allCharacters.filter(char => char.rarity === this.selectedRarityFilter);
  }
  
  setRarityFilter(rarity: number | null): void {
    this.selectedRarityFilter = rarity;
  }
  
  getRarityCount(rarity: number | null): number {
    if (rarity === null) return this.allCharacters.length;
    return this.allCharacters.filter(char => char.rarity === rarity).length;
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
  
  getRarityText(rarity: number): string {
    const rarityMap: { [key: number]: string } = {
      1: '普通',
      2: '稀有', 
      3: '精英',
      4: '史詩',
      5: '傳說'
    };
    return rarityMap[rarity] || '普通';
  }

  get urCount(): number {
    return this.getRarityCount(5);
  }

  get playerStatsForShare() {
    return {
      totalFighters: this.totalCharacters,
      totalBattles: this.totalBattles,
      winRate: this.overallWinRate,
      urCount: this.urCount
    };
  }

  openShareDialog(character: Character) {
    this.shareCharacter = character;
    this.showShareDialog = true;
  }

  closeShareDialog() {
    this.showShareDialog = false;
    this.shareCharacter = null;
  }

  logout(): void {
    this.authService.logout();
  }

  copyWalletAddress(): void {
    if (!this.walletAddress) return;
    
    navigator.clipboard.writeText(this.walletAddress).then(() => {
      this.dialogService.success('已複製', '錢包地址已複製到剪貼板');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = this.walletAddress;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.dialogService.success('已複製', '錢包地址已複製到剪貼板');
      } catch (err) {
        this.dialogService.error('複製失敗', '無法複製地址，請手動複製');
      }
      document.body.removeChild(textArea);
    });
  }

  saveNickname() {
    if (this.nicknameChanged) {
      // 顯示提示：只能免費改一次
      return;
    }
    this.playerService.updateNickname(this.nickname).subscribe({
      next: (res) => {
        if (res.success) {
          this.nicknameChanged = true;
          this.editNicknameMode = false;
          this.displayName = this.nickname;
          // 顯示提示：暱稱已更新
        } else {
          // 顯示錯誤訊息
        }
      }
    });
  }

  startEditNickname() {
    if (!this.nicknameChanged) {
      this.editNicknameMode = true;
    }
  }

  goToBattle() {
    this.router.navigate(['/battle']);
  }

  // 升級功能已移除

  async mintNFT(character: Character, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    // 檢查是否已鑄造
    if (character.is_minted) {
      this.dialogService.warning('已鑄造', '此角色已經鑄造為 NFT！');
      return;
    }

    // 檢查是否有連接錢包
    if (!this.web3Service.isWalletConnected()) {
      // 如果是社交登入用戶，提示連接 thirdweb in-app wallet
      if (['google', 'facebook', 'apple', 'social'].includes(this.loginMethod)) {
        this.dialogService.warning(
          '需要連接錢包',
          '鑄造 NFT 需要連接 Web3 錢包。\n\n請前往登入頁面，使用 Google/Facebook/Apple 連接錢包。'
        );
        this.router.navigate(['/login']);
      } else {
        this.dialogService.warning('請連接錢包', '請先連接錢包才能鑄造 NFT');
      }
      return;
    }

    // 對於社交登入用戶，必須確保使用 thirdweb in-app wallet
    // 獲取當前連接的錢包地址（優先使用當前連接的錢包）
    let walletAddress = this.web3Service.getWalletAddress();
    
    // 如果沒有獲取到地址，嘗試從 currentWallet 獲取
    if (!walletAddress && this.web3Service.currentWallet) {
      try {
        const account = this.web3Service.currentWallet.getAccount();
        walletAddress = account?.address;
        console.log('從 currentWallet 獲取地址:', walletAddress);
      } catch (e) {
        console.warn('無法從 currentWallet 獲取地址:', e);
      }
    }

    // 對於社交登入用戶，如果沒有連接 thirdweb in-app wallet，需要重新連接
    if (['google', 'facebook', 'apple', 'social'].includes(this.loginMethod)) {
      if (!walletAddress) {
        // 沒有連接錢包，提示用戶連接
        this.dialogService.warning(
          '需要連接錢包',
          '鑄造 NFT 需要連接 Web3 錢包。\n\n請前往登入頁面，使用 Google/Facebook/Apple 連接 thirdweb 錢包。'
        );
        this.router.navigate(['/login']);
        return;
      }

      // 檢查是否連接了正確的錢包（對於社交登入，應該使用 thirdweb in-app wallet）
      // 如果後端有保存地址，應該使用那個地址；如果沒有，使用當前連接的地址
      const targetWalletAddress = this.walletAddress || walletAddress;
      
      // 如果當前連接的地址與目標地址不一致，提示用戶
      if (this.walletAddress && walletAddress && this.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn('⚠️ 錢包地址不一致:', {
          backend: this.walletAddress,
          connected: walletAddress,
          loginMethod: this.loginMethod
        });
        
        // 提示用戶，並建議使用後端保存的地址（即 thirdweb in-app wallet 地址）
        const confirmed = await new Promise<boolean>((resolve) => {
          this.dialogService.confirm(
            '錢包地址不一致',
            `你當前連接的錢包地址是：${walletAddress!.slice(0, 6)}...${walletAddress!.slice(-4)}\n\n` +
            `但你的帳號關聯的 thirdweb 錢包地址是：${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}\n\n` +
            `建議使用與帳號關聯的 thirdweb 錢包地址進行鑄造。\n\n` +
            `是否要繼續使用當前連接的錢包？`,
            () => resolve(true),
            () => resolve(false)
          );
        });

        if (!confirmed) {
          // 用戶選擇不使用當前錢包，提示重新連接正確的錢包
          this.dialogService.warning(
            '請連接正確的錢包',
            '請前往登入頁面，使用 Google/Facebook/Apple 連接 thirdweb 錢包。'
          );
          this.router.navigate(['/login']);
          return;
        }
      } else if (!this.walletAddress) {
        // 後端沒有保存地址，使用當前連接的地址
        // 這表示用戶第一次連接錢包，使用當前連接的地址是正確的
        console.log('✅ 使用當前連接的錢包地址（首次連接）:', walletAddress);
      } else {
        // 地址一致，使用後端保存的地址（確保使用正確的地址）
        walletAddress = this.walletAddress;
        console.log('✅ 使用後端保存的錢包地址:', walletAddress);
      }
    } else {
      // 非社交登入用戶，直接使用當前連接的地址
      if (!walletAddress) {
        this.dialogService.error('錯誤', '無法取得錢包地址，請重新連接錢包');
        return;
      }
    }

    // 確認對話框
    this.dialogService.confirm(
      '確認鑄造 NFT',
      `確定要將「${character.name}」鑄造為 NFT 嗎？\n\n` +
      `這將會：\n` +
      `• 在 Mantle 網絡上創建 NFT\n` +
      `• NFT 將發送到你的錢包：${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\n` +
      `• 可以在 OpenSea 上交易\n\n` +
      `<strong>注意：此操作不可逆！</strong>`,
      async () => {
        this.isMinting = true;
        this.mintingCharacterId = character.id;

        // 顯示載入中
        this.dialogService.loading('鑄造中', '正在鑄造 NFT，請稍候...\n這可能需要幾秒鐘');

        try {
          const result = await this.nftService.mintCharacterNFT(character.id, walletAddress).toPromise();
          
          if (result?.success && result.data) {
            // 更新本地角色數據
            character.is_minted = true;
            character.token_id = result.data.token_id;
            character.contract_address = result.data.contract_address;
            character.owner_wallet = result.data.owner_wallet;
            character.tx_hash = result.data.tx_hash;

            this.dialogService.success(
              'NFT 鑄造成功',
              `Token ID: #${result.data.token_id}\n` +
              `合約地址: ${result.data.contract_address}\n` +
              `交易哈希: ${result.data.tx_hash}\n\n` +
              `<a href="${result.data.explorer_url}" target="_blank" style="color: #6366f1;">在區塊鏈瀏覽器查看</a>`
            );
          } else {
            throw new Error(result?.error || '鑄造失敗');
          }
        } catch (error: any) {
          console.error('鑄造 NFT 失敗:', error);
          this.dialogService.error(
            '鑄造失敗',
            `錯誤: ${error.error?.error || error.message || '未知錯誤'}\n\n` +
            `請確認：\n` +
            `• 錢包已連接\n` +
            `• 網絡設定正確\n` +
            `• 角色圖片已生成完成`
          );
        } finally {
          this.isMinting = false;
          this.mintingCharacterId = null;
        }
      }
    );
  }

  // 上架角色到市場
  openListDialog(character: Character, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    // 檢查是否已鑄造
    if (!character.is_minted || !character.token_id) {
      this.dialogService.warning('尚未鑄造', '請先將角色鑄造為 NFT 才能上架');
      return;
    }

    // 檢查是否已連接錢包
    if (!this.web3Service.isWalletConnected()) {
      this.dialogService.warning('請連接錢包', '請先連接錢包才能上架角色');
      return;
    }

    this.listingCharacter = character;
    this.listingPrice = '';
    this.showListDialog = true;
  }

  closeListDialog() {
    this.showListDialog = false;
    this.listingCharacter = null;
    this.listingPrice = '';
  }

  isPriceValid(): boolean {
    if (!this.listingPrice) {
      return false;
    }
    const price = parseFloat(this.listingPrice);
    return !isNaN(price) && price > 0;
  }

  async listCharacterForSale() {
    if (!this.listingCharacter || !this.listingPrice) {
      this.dialogService.error('錯誤', '請輸入價格');
      return;
    }

    // 檢查是否已連接錢包
    if (!this.web3Service.isWalletConnected()) {
      this.dialogService.warning(
        '需要連接錢包',
        '上架 NFT 需要連接 Web3 錢包。\n\n請點擊右上角的「連接錢包」按鈕，或前往登入頁面連接錢包。'
      );
      return;
    }

    const price = parseFloat(this.listingPrice);
    if (isNaN(price) || price <= 0) {
      this.dialogService.error('錯誤', '請輸入有效的價格（大於 0）');
      return;
    }

    if (!this.listingCharacter.token_id) {
      this.dialogService.error('錯誤', '角色尚未鑄造為 NFT');
      return;
    }

    // 檢查是否已經上架（後端數據）
    if (this.listingCharacter.is_listed) {
      this.dialogService.warning(
        '已上架',
        '此角色已經上架中，請先取消現有上架再重新上架。'
      );
      return;
    }

    // 額外檢查：從鏈上驗證是否已有 active listing（防止鏈上有但後端未同步的情況）
    if (this.listingCharacter.token_id) {
      try {
        const existingListings = await this.marketplaceService.getAllListingsByTokenId(
          this.listingCharacter.token_id
        );
        
        const activeListings = existingListings.filter(l => l.status === 1); // status 1 = active
        
        if (activeListings.length > 0) {
          const listingTexts = activeListings.map(l => 
            `Listing ${l.listingId}: ${parseFloat(l.price).toFixed(4)} MNT`
          ).join('\n');
          
          const confirmed = await new Promise<boolean>((resolve) => {
            this.dialogService.confirm(
              '已上架',
              `此角色在鏈上已有 ${activeListings.length} 個 active 上架：\n\n${listingTexts}\n\n` +
              `請先取消所有現有上架再重新上架。是否要取消現有上架？`,
              () => resolve(true),
              () => resolve(false)
            );
          });

          if (confirmed) {
            // 取消所有現有上架
            for (const listing of activeListings) {
              try {
                await this.marketplaceService.cancelListing(listing.listingId);
                console.log(`✅ 已取消 Listing ${listing.listingId}`);
                // 等待一下避免 nonce 衝突
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (error: any) {
                console.error(`❌ 取消 Listing ${listing.listingId} 失敗:`, error);
                this.dialogService.error(
                  '取消失敗',
                  `無法取消 Listing ${listing.listingId}，請手動取消後再試。`
                );
                return;
              }
            }
            
            // 重新同步狀態
            await this.syncListingsFromChain();
            this.dialogService.success('已取消', '所有現有上架已取消，請重新上架。');
            return;
          } else {
            return; // 用戶取消操作
          }
        }
      } catch (error) {
        console.warn('檢查鏈上 listing 失敗:', error);
        // 繼續執行，不阻止上架流程（但會由後端 API 驗證）
      }
    }

    // 確認對話框
    const confirmed = await new Promise<boolean>((resolve) => {
      this.dialogService.confirm(
        '確認上架',
        `確定要以 ${this.listingPrice} MNT 上架「${this.listingCharacter!.name}」嗎？\n\n` +
        `此操作將：\n` +
        `• 創建鏈上上架記錄\n` +
        `• 其他玩家可以購買此角色\n` +
        `• 你可以隨時取消上架`,
        () => resolve(true),
        () => resolve(false)
      );
    });

    if (!confirmed) {
      return;
    }

    this.isListing = true;
    this.dialogService.loading('上架中', '正在處理上架交易...');

    try {
      const walletAddress = this.web3Service.getWalletAddress();
      if (!walletAddress) {
        throw new Error('無法獲取錢包地址');
      }

      // 步驟 1: 檢查 NFT 是否已批准 Marketplace
      this.isCheckingApproval = true;
      const isApproved = await this.marketplaceService.checkNFTApproval(
        this.listingCharacter.token_id!,
        walletAddress
      );

      if (!isApproved) {
        // 步驟 2: 批准 Marketplace
        this.dialogService.loading('批准中', '正在批准 Marketplace 轉移 NFT...');
        const approveTxHash = await this.marketplaceService.approveNFTForMarketplace(
          this.listingCharacter.token_id!
        );
        console.log('✅ 批准交易已發送:', approveTxHash);
        
        // 等待批准交易確認（使用 waitForReceipt 已在 approveNFTForMarketplace 中完成）
        // 但為了確保狀態已更新，再次檢查批准狀態（最多等待 10 秒）
        let approvalConfirmed = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
          const isNowApproved = await this.marketplaceService.checkNFTApproval(
            this.listingCharacter.token_id!,
            walletAddress
          );
          if (isNowApproved) {
            approvalConfirmed = true;
            console.log('✅ 批准狀態已確認');
            break;
          }
        }
        
        if (!approvalConfirmed) {
          console.warn('⚠️ 批准交易可能尚未確認，但繼續嘗試上架...');
        }
        
        this.dialogService.success('批准成功', `交易哈希: ${approveTxHash}\n\n已確認批准狀態。`);
      }

      // 步驟 3: 上架
      this.dialogService.loading('上架中', '正在創建上架記錄...');
      const result = await this.marketplaceService.listCharacter(
        this.listingCharacter.token_id!,
        this.listingPrice
      );

      // 步驟 4: 通知後端索引（可選）
      if (result.listingId !== undefined) {
        try {
          console.log('通知後端索引上架:', {
            txHash: result.txHash,
            listingId: result.listingId,
            characterId: this.listingCharacter!.id,
            price: this.listingPrice
          });
          
          await new Promise((resolve, reject) => {
            this.marketplaceService.notifyListingCreated(
              result.txHash,
              result.listingId!,
              this.listingCharacter!.id,
              this.listingPrice  // 傳遞價格
            ).subscribe({
              next: (response) => {
                console.log('後端索引成功:', response);
                resolve(undefined);
              },
              error: (error) => {
                console.error('後端索引失敗:', error);
                // 如果錯誤是因為已有 active 上架，顯示友好提示
                if (error.error && error.error.error && error.error.error.includes('已經上架中')) {
                  this.dialogService.warning(
                    '上架失敗',
                    '此角色已經上架中，請先取消現有上架再重新上架。'
                  );
                  reject(error);
                } else {
                  // 其他錯誤不阻止流程，但記錄
                  console.warn('後端索引失敗但不影響上架:', error);
                  resolve(undefined);
                }
              }
            });
          });
          
          console.log('✅ 後端索引完成');
        } catch (e: any) {
          console.error('通知後端索引失敗:', e);
          console.error('錯誤詳情:', e.message || e);
          // 不影響上架流程，但記錄錯誤
        }
      } else {
        console.warn('⚠️ 無法獲取 listingId，跳過後端索引');
      }

      this.dialogService.success(
        '上架成功',
        `交易哈希: ${result.txHash}\n\n` +
        `角色已成功上架到市場！\n` +
        `其他人現在可以購買此角色。`
      );

      // 重新從鏈上同步狀態（確保數據準確，包括 listing ID）
      await this.syncListingsFromChain();
      
      // 更新角色狀態（標記為已上架）
      // 同步後應該已經更新了 is_listed 和 chain_listing_id
      const updatedCharacter = this.allCharacters.find(c => c.id === this.listingCharacter!.id);
      if (updatedCharacter) {
        this.listingCharacter = updatedCharacter;
      }
      
      // 關閉對話框
      this.closeListDialog();

      // 可選：導航到市場頁面查看
      setTimeout(() => {
        this.router.navigate(['/marketplace']);
      }, 2000);

    } catch (error: any) {
      console.error('上架失敗:', error);
      this.dialogService.error(
        '上架失敗',
        error.message || '交易失敗，請檢查錢包餘額和網絡設置'
      );
    } finally {
      this.isListing = false;
      this.isCheckingApproval = false;
    }
  }

  /**
   * 取消上架（直接從鏈上獲取 listing ID）
   */
  async cancelListing(character: Character, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    // 檢查是否已鑄造
    if (!character.is_minted || !character.token_id) {
      this.dialogService.warning('未鑄造', '此角色尚未鑄造為 NFT');
      return;
    }

    // 檢查是否已連接錢包
    if (!this.web3Service.isWalletConnected()) {
      this.dialogService.warning('請連接錢包', '請先連接錢包才能取消上架');
      return;
    }

    // 直接從鏈上獲取所有 listing 信息（可能有多個）
    let chainListingIds: number[] = [];
    
    try {
      const allListings = await this.marketplaceService.getAllListingsByTokenId(character.token_id!);

      if (!allListings || allListings.length === 0) {
        this.dialogService.warning('未上架', '此角色在鏈上未找到上架記錄');
        return;
      }

      chainListingIds = allListings.map(l => l.listingId!);
      console.log(`從鏈上獲取的 listing 信息:`, allListings);
      
      // 如果有多個 listing，提示用戶並選擇要取消的
      if (allListings.length > 1) {
        // 格式化價格（從 wei 轉換為 ETH）
        const formatPrice = (priceInWei: string) => {
          const num = BigInt(priceInWei);
          const eth = Number(num) / 1e18;
          if (eth >= 1) {
            return eth.toFixed(2);
          } else if (eth >= 0.01) {
            return eth.toFixed(4);
          } else {
            return eth.toFixed(6);
          }
        };
        
        const listingTexts = allListings.map((l) => 
          `Listing ${l.listingId}: ${formatPrice(l.price)} ETH`
        ).join('\n');
        
        const confirmMultiple = await new Promise<boolean>((resolve) => {
          this.dialogService.confirm(
            '發現多個上架',
            `此角色有 ${allListings.length} 個上架記錄：\n\n${listingTexts}\n\n` +
            `將取消所有上架記錄。確定要繼續嗎？`,
            () => resolve(true),
            () => resolve(false)
          );
        });
        
        if (!confirmMultiple) {
          return;
        }
      }
    } catch (error: any) {
      console.error('從鏈上獲取上架信息失敗:', error);
      this.dialogService.error(
        '獲取上架信息失敗',
        error.message || '無法從鏈上獲取上架信息，請稍後再試'
      );
      return;
    }

    // 確認對話框
    const listingCount = chainListingIds.length;
    const confirmed = await new Promise<boolean>((resolve) => {
      this.dialogService.confirm(
        '確認取消上架',
        `確定要取消「${character.name}」的${listingCount > 1 ? ` ${listingCount} 個` : ''}上架嗎？\n\n` +
        `此操作將：\n` +
        `• 取消鏈上上架記錄${listingCount > 1 ? '（所有）' : ''}\n` +
        `• 其他玩家將無法購買此角色\n` +
        `• 你可以稍後重新上架`,
        () => resolve(true),
        () => resolve(false)
      );
    });

    if (!confirmed) {
      return;
    }

    this.isCancelling = true;
    this.cancellingCharacterId = character.id;
    this.dialogService.loading('取消上架中', `正在處理${listingCount > 1 ? ` ${listingCount} 個` : ''}取消上架交易...`);

    try {
      // 取消所有 listing
      const txHashes: string[] = [];
      let successCount = 0;
      let failCount = 0;
      
      for (const listingId of chainListingIds) {
        try {
          console.log(`🔄 取消 listing ID: ${listingId}`);
          const txHash = await this.marketplaceService.cancelListing(listingId);
          txHashes.push(txHash);
          successCount++;
          console.log(`✅ Listing ${listingId} 取消成功: ${txHash}`);
          
          // 如果有多個，稍等一下再取消下一個，避免 nonce 衝突
          if (chainListingIds.length > 1 && listingId !== chainListingIds[chainListingIds.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
          }
        } catch (error: any) {
          failCount++;
          console.error(`❌ 取消 listing ${listingId} 失敗:`, error);
          // 繼續取消其他的
        }
      }

      if (successCount > 0) {
        const txHashText = txHashes.map((hash, idx) => `Listing ${chainListingIds[idx]}: ${hash}`).join('\n');
        this.dialogService.success(
          '取消上架成功',
          `成功取消 ${successCount} 個上架記錄${failCount > 0 ? `，失敗 ${failCount} 個` : ''}：\n\n${txHashText}`
        );
      } else {
        throw new Error('所有取消操作都失敗了');
      }

      // 更新角色狀態（標記為未上架）
      character.is_listed = false;
      character.chain_listing_id = undefined;

      // 重新從鏈上同步狀態（確保數據準確）
      await this.syncListingsFromChain();

    } catch (error: any) {
      console.error('取消上架失敗:', error);
      this.dialogService.error(
        '取消上架失敗',
        error.message || '交易失敗，請檢查錢包餘額和網絡設置'
      );
    } finally {
      this.isCancelling = false;
      this.cancellingCharacterId = null;
    }
  }

  /**
   * 從鏈上同步所有 listing 狀態
   */
  async syncListingsFromChain() {
    try {
      // 獲取所有已鑄造的角色
      const mintedCharacters = this.allCharacters.filter(c => c.is_minted && c.token_id);
      
      if (mintedCharacters.length === 0) {
        console.log('沒有已鑄造的角色，跳過同步');
        return;
      }

      console.log(`開始同步鏈上 listing 狀態，已鑄造角色數: ${mintedCharacters.length}`);

      // 從鏈上獲取所有 listing
      const allListings = await this.marketplaceService.getAllListingsFromChain();
      
      console.log('從鏈上獲取的 listing:', allListings);
      console.log('已鑄造的角色 Token IDs:', mintedCharacters.map(c => c.token_id));
      
      // 更新角色的 listing 狀態
      let matchedCount = 0;
      for (const character of mintedCharacters) {
        if (!character.token_id) continue;
        
        // 查找對應的 listing（嚴格匹配 tokenId）
        const listing = allListings.find(
          l => l.tokenId === character.token_id && l.status === 1 // status 1 表示 active
        );
        
        if (listing) {
          // 角色已上架
          character.is_listed = true;
          character.chain_listing_id = listing.listingId;
          matchedCount++;
          console.log(`✅ 角色 ${character.name} (Token ID: ${character.token_id}) 已上架，Listing ID: ${listing.listingId}, Price: ${listing.price}`);
        } else {
          // 角色未上架
          character.is_listed = false;
          character.chain_listing_id = undefined;
          console.log(`❌ 角色 ${character.name} (Token ID: ${character.token_id}) 未上架`);
        }
      }
      
      console.log(`同步完成，匹配到 ${matchedCount} 個上架的角色`);
    } catch (error: any) {
      console.error('從鏈上同步 listing 狀態失敗:', error);
      // 失敗不影響頁面載入
    }
  }

  /**
   * 靜默同步 NFT（不顯示對話框，用於自動同步）
   */
  async syncOwnedNFTsFromChainSilent() {
    try {
      if (!this.web3Service.currentWallet) return;
      const account = this.web3Service.currentWallet.getAccount();
      if (!account || !account.address) return;

      const result = await this.marketplaceService.syncOwnedNFTsFromChain();
      if (result.success && result.syncedTokens.length > 0) {
        // 如果有新同步的 NFT，重新加載 Profile
        this.loadProfile();
      }
    } catch (error) {
      // 靜默失敗
      console.warn('靜默同步 NFT 失敗:', error);
    }
  }

  /**
   * 從鏈上掃描並同步用戶持有的所有 NFT 到後端（帶 UI 提示）
   * 這會更新 Character 的 player 和 owner_wallet，使購買的 NFT 顯示在 Profile 中
   */
  async syncOwnedNFTsFromChain() {
    try {
      // 需已連接錢包
      if (!this.web3Service.isWalletConnected()) {
        this.dialogService.warning(
          '需要連接錢包',
          '同步 NFT 需要連接 Web3 錢包。\n\n請點擊右上角的「連接錢包」按鈕，或前往登入頁面連接錢包。'
        );
        return;
      }
      const account = this.web3Service.currentWallet.getAccount();
      if (!account || !account.address) {
        this.dialogService.error('無法獲取賬戶', '無法獲取錢包地址');
        return;
      }

      this.isSyncingNFTs = true;
      this.dialogService.loading('同步中', '正在從鏈上掃描你持有的 NFT...');

      console.log('🔄 開始同步持有的 NFT 到後端...');
      
      // 使用 marketplaceService 的同步方法
      const result = await this.marketplaceService.syncOwnedNFTsFromChain();
      
      if (result.success) {
        console.log(`✅ 同步成功: ${result.message}`, result.syncedTokens);
        
        // 重新加載 Profile 以獲取更新後的 characters
        this.loadProfile();
        
        this.dialogService.success(
          '同步成功',
          result.syncedTokens.length > 0 
            ? `成功同步 ${result.syncedTokens.length} 個 NFT 到你的 Profile！`
            : '未找到新的 NFT，你的 Profile 已是最新狀態。'
        );
      } else {
        console.warn('⚠️ NFT 同步完成但可能有錯誤:', result);
        this.dialogService.error('同步失敗', result.message || '同步過程中出現錯誤');
      }
    } catch (error: any) {
      console.error('❌ 同步 NFT 失敗:', error);
      this.dialogService.error('同步失敗', error.message || '無法從鏈上同步 NFT');
    } finally {
      this.isSyncingNFTs = false;
    }
  }

  /**
   * 重新加載 Profile 數據
   */
  loadProfile() {
    this.isLoading = true;
    this.playerService.getProfile().subscribe({
      next: async (profile: any) => {
        this.walletAddress = profile.player.wallet_address || '';
        this.nickname = profile.player.nickname || '';
        this.nicknameChanged = profile.player.nickname_changed || false;
        this.displayName = profile.player.nickname || profile.player.display_name || '';
        this.loginMethod = profile.player.login_method || '';
        
        // 檢查是否為 social login 且沒有連接錢包
        const isSocialLogin = ['google', 'facebook', 'apple', 'social'].includes(this.loginMethod);
        const hasWallet = this.walletAddress && this.walletAddress.length > 0;
        const isWalletConnected = this.web3Service.isWalletConnected();
        
        // 如果是 social login 且沒有錢包地址或未連接錢包，顯示提示
        this.showWalletConnectPrompt = isSocialLogin && (!hasWallet || !isWalletConnected);
        this.allCharacters = profile.characters;
        
        // 如果是自己的 Profile 且有錢包連接，從鏈上同步 listing 狀態
        if (!this.isViewMode && this.web3Service.isWalletConnected()) {
          await this.syncListingsFromChain();
        }
        
        if (profile.characters.length > 0) {
          const initialCharacter = profile.characters[0];
          this.currentCharacter = initialCharacter;
          this.characterService.saveCharacter(initialCharacter);
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
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
  
  /**
   * 切換 Tab
   */
  setActiveTab(tab: 'fighters' | 'daily' | 'gallery'): void {
    this.activeTab = tab;
  }
  
  /**
   * 從鏈上校驗當前玩家對各 NFT 的實際持有狀態（僅校驗，不更新）
   */
  async syncOwnershipFromChain() {
    try {
      // 需已連接錢包
      if (!this.web3Service.currentWallet) {
        console.log('錢包未連接，跳過擁有權校驗');
        return;
      }
      const account = this.web3Service.currentWallet.getAccount();
      if (!account || !account.address) {
        console.log('無法獲取賬戶地址，跳過擁有權校驗');
        return;
      }
      const walletAddress = String(account.address).toLowerCase();

      // 只對已鑄造且有 tokenId 的角色進行校驗
      const mintedCharacters = this.allCharacters.filter(c => c.is_minted && c.token_id !== undefined);
      if (mintedCharacters.length === 0) {
        return;
      }

      // 逐一透過 ownerOf 校驗
      for (const character of mintedCharacters) {
        if (character.token_id === undefined) continue;
        const owner = await this.marketplaceService.ownerOf(character.token_id);
        character.is_owned = !!owner && owner === walletAddress;
      }

      // 可選：顯示不一致狀態於日誌
      const mismatches = mintedCharacters.filter(c => c.is_owned === false);
      if (mismatches.length > 0) {
        console.warn('發現鏈上不屬於當前錢包的角色（將不視為持有）:', mismatches.map(c => ({ name: c.name, tokenId: c.token_id })));
      }
    } catch (error) {
      console.error('鏈上擁有權校驗失敗:', error);
    }
  }
}