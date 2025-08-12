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
  
  rarityFilters = [
    { value: null, label: '全部', icon: '◉', count: 0 },
    { value: 1, label: '普通', icon: '●', count: 0 },
    { value: 2, label: '稀有', icon: '✦', count: 0 },
    { value: 3, label: '精英', icon: '✧', count: 0 },
    { value: 4, label: '史詩', icon: '✨', count: 0 },
    { value: 5, label: '傳說', icon: '⭐', count: 0 }
  ];

  constructor(
    private characterService: CharacterService,
    private battleService: BattleService,
    private authService: AuthService,
    private playerService: PlayerService,
    private route: ActivatedRoute,
    private router: Router
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

  goToUpgrade(character: Character, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.router.navigate(['/upgrade', character.id]);
  }
}