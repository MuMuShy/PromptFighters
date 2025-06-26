import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { PlayerService, PlayerResources } from '../services/player.service';
import { CharacterCardComponent } from '../shared/character-card.component';
import { AuthService } from '../services/auth.service';
import { Character } from '../interfaces/character.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterCardComponent],
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.scss']
})
export class CreateComponent implements OnInit, OnDestroy {
  mode: 'normal' | 'advanced' = 'normal';
  characterPrompt = '';
  advancedName = '';
  advancedPrompt = '';
  generatedCharacter: Character | null = null;
  isGenerating = false;
  showSuccessModal = false;
  resources: PlayerResources = {
    gold: 0,
    diamond: 0,
    prompt_power: 0,
    energy: 0,
    max_energy: 100
  };
  private subscriptions: Subscription[] = [];

  examplePrompts = [
    '炒麵戰士',
    'Pizza Knight',
    'Sushi Ninja',
    'Bubble Tea Mage',
    'Ramen Master',
    'Taco Berserker',
    'Ice Cream Paladin',
    'Coffee Wizard'
  ];

  constructor(
    private characterService: CharacterService,
    private playerService: PlayerService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPlayerResources();
    // 訂閱資源變化
    const resourcesSub = this.playerService.resources$.subscribe(resources => {
      this.resources = resources;
    });
    this.subscriptions.push(resourcesSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadPlayerResources() {
    this.playerService.getResources().subscribe({
      next: (resources) => {
        this.resources = resources;
      },
      error: (error) => {
        console.error('載入資源失敗:', error);
      }
    });
  }

  generateCharacter(): void {
    if (!this.characterPrompt.trim()) return;
    
    // 檢查資源是否足夠
    if (!this.canAffordBasicSummon()) {
      alert('資源不足！需要 1000 金幣和 1 Prompt Power');
      return;
    }
    
    this.isGenerating = true;
    const token = this.authService.getToken() || '';
    this.characterService.createCharacter(this.characterPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        // 召喚成功後重新載入資源
        this.loadPlayerResources();
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.isGenerating = false;
            this.showSuccessModal = true;
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        const errorMsg = err.error?.error || err.error?.detail || '建立失敗';
        alert(errorMsg);
        this.isGenerating = false;
      }
    });
  }

  generateAdvancedCharacter(): void {
    if (!this.advancedPrompt.trim()) return;
    
    // 檢查資源是否足夠
    if (!this.canAffordPremiumSummon()) {
      alert('資源不足！需要 5 鑽石和 3 Prompt Power');
      return;
    }
    
    this.isGenerating = true;
    const token = this.authService.getToken() || '';
    this.characterService.advancedSummonCharacter(this.advancedName.trim(), this.advancedPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        // 召喚成功後重新載入資源
        this.loadPlayerResources();
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.isGenerating = false;
            this.showSuccessModal = true;
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        const errorMsg = err.error?.error || err.error?.detail || '建立失敗';
        alert(errorMsg);
        this.isGenerating = false;
      }
    });
  }

  // 資源檢查方法
  canAffordBasicSummon(): boolean {
    return this.resources.gold >= 1000 && this.resources.prompt_power >= 1;
  }

  canAffordPremiumSummon(): boolean {
    return this.resources.diamond >= 5 && this.resources.prompt_power >= 3;
  }

  // 檢查是否可以召喚
  canSummon(): boolean {
    if (this.mode === 'normal') {
      return this.canAffordBasicSummon() && this.characterPrompt.trim().length > 0;
    } else {
      return this.canAffordPremiumSummon() && 
             this.advancedName.trim().length > 0 && 
             this.advancedPrompt.trim().length > 0;
    }
  }

  // 獲取稀有度顯示資訊 (使用與 character-card 相同的顏色)
  getRarityInfo(rarity: number) {
    const rarityMap: { [key: number]: { name: string, color: string, stars: string } } = {
      1: { name: 'N', color: '#888888', stars: '★' },
      2: { name: 'R', color: '#4fd2ff', stars: '★★' },
      3: { name: 'SR', color: '#a259ff', stars: '★★★' },
      4: { name: 'SSR', color: '#ffb300', stars: '★★★★' },
      5: { name: 'UR', color: '#ff3c6e', stars: '★★★★★' }
    };
    return rarityMap[rarity] || rarityMap[1];
  }

  saveCharacter(): void {
    if (this.generatedCharacter) {
      this.characterService.saveCharacter(this.generatedCharacter);
      this.router.navigate(['/battle']);
    }
  }

  getExampleEmoji(prompt: string): string {
    const emojiMap: { [key: string]: string } = {
      '炒麵戰士': '🍜',
      'Pizza Knight': '🍕',
      'Sushi Ninja': '🍣',
      'Bubble Tea Mage': '🧋',
      'Ramen Master': '🍜',
      'Taco Berserker': '🌮',
      'Ice Cream Paladin': '🍦',
      'Coffee Wizard': '☕'
    };
    return emojiMap[prompt] || '⚔️';
  }

  closeModal(): void {
    this.showSuccessModal = false;
  }
}