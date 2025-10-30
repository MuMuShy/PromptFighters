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
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, CharacterCardComponent, FormsModule],
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
  isMinting: boolean = false;
  mintingCharacterId: string | null = null;
  
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
    private web3Service: Web3Service
  ) {}

  ngOnInit(): void {
    const playerId = this.route.snapshot.paramMap.get('playerId');
    this.isViewMode = !!playerId;
    this.playerService.getProfile(playerId || undefined).subscribe({
      next: (profile: any) => {
        if (this.isViewMode) {
          this.displayName = profile.player.nickname || profile.player.display_name || '';
        } else {
          this.walletAddress = profile.player.wallet_address || '';
          this.nickname = profile.player.nickname || '';
          this.nicknameChanged = profile.player.nickname_changed || false;
          this.displayName = profile.player.nickname || profile.player.display_name || '';
        }
        this.allCharacters = profile.characters;
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

  logout(): void {
    this.authService.logout();
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
      this.dialogService.warning('請連接錢包', '請先連接 MetaMask 錢包才能鑄造 NFT');
      return;
    }

    const walletAddress = this.web3Service.getWalletAddress();
    if (!walletAddress) {
      this.dialogService.error('錯誤', '無法取得錢包地址，請重新連接錢包');
      return;
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
}