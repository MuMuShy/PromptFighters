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
  
  // 進度系統
  currentPhase = 0;
  currentPhaseText = '';
  progressPercent = 0;
  
  // 隨機提示和階段
  phases = [
    { text: '分析英雄特質中...', percent: 20 },
    { text: '計算屬性數值...', percent: 40 },
    { text: '編織英雄故事...', percent: 60 },
    { text: '繪製英雄形象...', percent: 80 },
    { text: '注入靈魂之力...', percent: 100 }
  ];
  
  encouragingTexts = [
    '每位英雄都有獨特的命運',
    '強大的力量正在覺醒',
    '傳奇即將誕生',
    '古老魔法正在運作',
    '你的英雄將是獨一無二的',
    '稀有度由命運決定',
    '期待即將到來的驚喜'
  ];
  
  currentEncouragement = '';
  resources: PlayerResources = {
    gold: 0,
    prompt: 0,
    prompt_power: 0,
    exp_potion: 0,
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
    
    this.startGeneratingAnimation();
    const token = this.authService.getToken() || '';
    this.characterService.createCharacter(this.characterPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        // 召喚成功後重新載入資源
        this.loadPlayerResources();
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.completeGeneration();
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        const errorMsg = err.error?.error || err.error?.detail || '建立失敗';
        alert(errorMsg);
        this.resetGeneration();
      }
    });
  }

  generateAdvancedCharacter(): void {
    if (!this.advancedPrompt.trim()) return;
    
    // 檢查資源是否足夠
    if (!this.canAffordPremiumSummon()) {
      alert('資源不足！需要 5 $PROMPT 和 3 Prompt Power');
      return;
    }
    
    this.startGeneratingAnimation();
    const token = this.authService.getToken() || '';
    this.characterService.advancedSummonCharacter(this.advancedName.trim(), this.advancedPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        // 召喚成功後重新載入資源
        this.loadPlayerResources();
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.completeGeneration();
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        const errorMsg = err.error?.error || err.error?.detail || '建立失敗';
        alert(errorMsg);
        this.resetGeneration();
      }
    });
  }

  // 資源檢查方法
  canAffordBasicSummon(): boolean {
    return this.resources.gold >= 1000 && this.resources.prompt_power >= 1;
  }

  canAffordPremiumSummon(): boolean {
    return this.resources.prompt >= 5 && this.resources.prompt_power >= 3;
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

  // 進度動畫控制
  startGeneratingAnimation(): void {
    this.isGenerating = true;
    this.currentPhase = 0;
    this.progressPercent = 0;
    this.currentEncouragement = this.encouragingTexts[Math.floor(Math.random() * this.encouragingTexts.length)];
    
    this.animateProgress();
  }

  private animateProgress(): void {
    const progressPhase = () => {
      if (this.currentPhase < this.phases.length && this.isGenerating) {
        const phase = this.phases[this.currentPhase];
        this.currentPhaseText = phase.text;
        
        // 動畫進度條
        const targetPercent = phase.percent;
        const currentPercent = this.progressPercent;
        const increment = (targetPercent - currentPercent) / 20; // 20步完成
        
        const animateBar = () => {
          if (this.progressPercent < targetPercent && this.isGenerating) {
            this.progressPercent = Math.min(this.progressPercent + increment, targetPercent);
            setTimeout(animateBar, 100);
          } else {
            // 這個階段完成，準備下一階段
            setTimeout(() => {
              this.currentPhase++;
              if (this.currentPhase < this.phases.length) {
                // 隨機更換鼓勵文字
                if (Math.random() > 0.6) {
                  this.currentEncouragement = this.encouragingTexts[Math.floor(Math.random() * this.encouragingTexts.length)];
                }
                progressPhase();
              }
            }, 800 + Math.random() * 1200); // 隨機停留時間
          }
        };
        animateBar();
      }
    };
    
    progressPhase();
  }

  completeGeneration(): void {
    this.progressPercent = 100;
    this.currentPhaseText = '召喚完成！';
    
    setTimeout(() => {
      this.isGenerating = false;
      this.showSuccessModal = true;
    }, 500);
  }

  resetGeneration(): void {
    this.isGenerating = false;
    this.currentPhase = 0;
    this.progressPercent = 0;
    this.currentPhaseText = '';
    this.currentEncouragement = '';
  }
}