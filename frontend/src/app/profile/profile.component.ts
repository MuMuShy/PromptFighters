import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { BattleService } from '../services/battle.service';
import { CharacterCardComponent } from '../shared/character-card.component';
import { Character } from '../interfaces/character.interface';
import { AuthService } from '../services/auth.service';
import { Battle } from '../interfaces/battle.interface';
import { PlayerService } from '../services/player.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, CharacterCardComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  isLoading = true;
  currentCharacter: Character | null = null;
  recentBattles: Battle[] = [];
  allCharacters: Character[] = [];
  selectedRarityFilter: number | null = null;
  walletAddress: string = '';
  
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
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    const token = this.authService.getToken() || '';
    
    // 取得玩家錢包地址
    this.playerService.getProfile().subscribe({
      next: (profile: any) => {
        this.walletAddress = profile.player.wallet_address || '';
      },
      error: () => {
        this.walletAddress = '';
      }
    });

    // 获取所有角色
    this.characterService.getAllCharacters(token).subscribe({
      next: characters => {
        this.allCharacters = characters;
        if (characters.length > 0) {
          // 如果有角色，设置第一个为当前角色
          const initialCharacter = characters[0];
          this.currentCharacter = initialCharacter;
          this.characterService.saveCharacter(initialCharacter);
          this.fetchBattlesForCharacter(initialCharacter.id, token);
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
        this.fetchBattlesForCharacter(character.id, token);
      }
    });
  }

  fetchBattlesForCharacter(characterId: string, token: string): void {
    this.battleService.getBattlesByCharacterId(characterId, token).subscribe(battles => {
      this.recentBattles = battles.slice(0, 10); // 只顯示最近10場
    });
  }

  selectCharacter(character: Character): void {
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
}