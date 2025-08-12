import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Character } from '../interfaces/character.interface';
import { CharacterService } from '../services/character.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-upgrade',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './upgrade.component.html',
  styleUrls: ['./upgrade.component.scss']
})
export class UpgradeComponent implements OnInit, OnDestroy {
  character: Character | null = null;
  upgradeInfo: any = null;
  playerResources: any = null;
  isLoading = true;
  isProcessing = false;
  characterId: string = '';
  expAmount = 1;
  message = '';
  messageType: 'success' | 'error' | 'info' = 'info';
  private subscription = new Subscription();
  
  // 讓模板可以使用 Math
  Math = Math;

  // 計算相關屬性
  get maxExpAmount(): number {
    if (!this.playerResources) return 0;
    return this.playerResources.exp_potion;
  }

  get finalExperience(): number {
    return this.upgradeInfo ? this.upgradeInfo.current_experience + this.expAmount : 0;
  }

  get levelUpResults(): any {
    if (!this.upgradeInfo || !this.character) return { finalLevel: this.character?.level || 1, totalGoldCost: 0 };
    
    let currentExp = this.finalExperience;
    let currentLevel = this.character.level;
    let totalGoldCost = 0;
    
    // 模擬升級過程，直到經驗不足或達到滿級
    while (currentLevel < 50) {
      const levelConfig = this.getLevelConfig(currentLevel);
      if (!levelConfig) break;
      
      const requiredExp = levelConfig.experience_needed;
      const goldCost = levelConfig.gold_cost;
      
      if (currentExp >= requiredExp) {
        currentExp -= requiredExp;
        totalGoldCost += goldCost;
        currentLevel++;
      } else {
        break;
      }
    }
    
    return {
      finalLevel: currentLevel,
      finalExperience: currentExp,
      totalGoldCost: totalGoldCost,
      canAfford: this.playerResources?.gold >= totalGoldCost
    };
  }

  private getLevelConfig(level: number): any {
    // 這裡應該使用與後端相同的等級配置
    const levelConfigs: any = {
      1: { experience_needed: 100, gold_cost: 100 },
      2: { experience_needed: 120, gold_cost: 150 },
      3: { experience_needed: 150, gold_cost: 200 },
      4: { experience_needed: 200, gold_cost: 250 },
      5: { experience_needed: 270, gold_cost: 300 },
      6: { experience_needed: 350, gold_cost: 350 },
      7: { experience_needed: 450, gold_cost: 400 },
      8: { experience_needed: 600, gold_cost: 450 },
      9: { experience_needed: 800, gold_cost: 500 },
      10: { experience_needed: 1000, gold_cost: 600 },
      11: { experience_needed: 1200, gold_cost: 700 },
      12: { experience_needed: 1440, gold_cost: 800 },
      13: { experience_needed: 1720, gold_cost: 900 },
      14: { experience_needed: 2060, gold_cost: 1000 },
      15: { experience_needed: 2470, gold_cost: 1200 },
      16: { experience_needed: 2960, gold_cost: 1400 },
      17: { experience_needed: 3550, gold_cost: 1600 },
      18: { experience_needed: 4260, gold_cost: 1800 },
      19: { experience_needed: 5110, gold_cost: 2000 },
      20: { experience_needed: 6130, gold_cost: 2500 },
      21: { experience_needed: 7350, gold_cost: 3000 },
      22: { experience_needed: 8820, gold_cost: 3500 },
      23: { experience_needed: 10580, gold_cost: 4000 },
      24: { experience_needed: 12700, gold_cost: 4500 },
      25: { experience_needed: 15240, gold_cost: 5000 },
      26: { experience_needed: 18290, gold_cost: 6000 },
      27: { experience_needed: 21950, gold_cost: 7000 },
      28: { experience_needed: 26340, gold_cost: 8000 },
      29: { experience_needed: 31610, gold_cost: 9000 },
      30: { experience_needed: 37930, gold_cost: 10000 },
      31: { experience_needed: 45520, gold_cost: 12000 },
      32: { experience_needed: 54620, gold_cost: 14000 },
      33: { experience_needed: 65540, gold_cost: 16000 },
      34: { experience_needed: 78650, gold_cost: 18000 },
      35: { experience_needed: 94380, gold_cost: 20000 },
      36: { experience_needed: 113260, gold_cost: 25000 },
      37: { experience_needed: 135910, gold_cost: 30000 },
      38: { experience_needed: 163090, gold_cost: 35000 },
      39: { experience_needed: 195710, gold_cost: 40000 },
      40: { experience_needed: 234850, gold_cost: 45000 },
      41: { experience_needed: 281820, gold_cost: 50000 },
      42: { experience_needed: 338180, gold_cost: 55000 },
      43: { experience_needed: 405820, gold_cost: 60000 },
      44: { experience_needed: 486980, gold_cost: 65000 },
      45: { experience_needed: 584380, gold_cost: 70000 },
      46: { experience_needed: 701260, gold_cost: 75000 },
      47: { experience_needed: 841510, gold_cost: 80000 },
      48: { experience_needed: 1009810, gold_cost: 90000 },
      49: { experience_needed: 1211770, gold_cost: 100000 }
    };
    
    return levelConfigs[level];
  }

  constructor(
    private characterService: CharacterService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.characterId = this.route.snapshot.paramMap.get('characterId') || '';
    if (!this.characterId) {
      this.router.navigate(['/profile']);
      return;
    }
    this.loadUpgradeInfo();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadUpgradeInfo(): void {
    this.isLoading = true;
    const token = this.authService.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const sub = this.characterService.getUpgradeInfo(this.characterId, token).subscribe({
      next: (data) => {
        this.character = data.character;
        this.upgradeInfo = data.upgrade_info;
        this.playerResources = data.player_resources;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load upgrade info:', err);
        this.showMessage('載入角色資訊失敗', 'error');
        this.isLoading = false;
      }
    });
    this.subscription.add(sub);
  }

  addExperience(): void {
    if (this.expAmount <= 0 || this.expAmount > this.playerResources.exp_potion) {
      this.showMessage('經驗藥水數量無效', 'error');
      return;
    }

    this.isProcessing = true;
    const token = this.authService.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const sub = this.characterService.addExperience(this.characterId, this.expAmount, token).subscribe({
      next: (data) => {
        if (data.success) {
          this.character = data.character;
          this.upgradeInfo = data.upgrade_info;
          this.playerResources = data.player_resources;
          this.showMessage(data.message, 'success');
          this.expAmount = 1;
        } else {
          this.showMessage(data.error || '增加經驗失敗', 'error');
        }
        this.isProcessing = false;
      },
      error: (err) => {
        console.error('Failed to add experience:', err);
        this.showMessage(err.error?.error || '增加經驗失敗', 'error');
        this.isProcessing = false;
      }
    });
    this.subscription.add(sub);
  }

  levelUp(): void {
    if (!this.upgradeInfo.can_level_up) {
      this.showMessage('無法升級：經驗值或金幣不足', 'error');
      return;
    }

    this.isProcessing = true;
    const token = this.authService.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const sub = this.characterService.levelUpCharacter(this.characterId, token).subscribe({
      next: (data) => {
        if (data.success) {
          this.character = data.character;
          this.upgradeInfo = data.upgrade_info;
          this.playerResources = data.player_resources;
          this.showMessage(data.message, 'success');
          // 更新本地角色數據
          if (this.character) {
            this.characterService.saveCharacter(this.character);
          }
        } else {
          this.showMessage(data.error || '升級失敗', 'error');
        }
        this.isProcessing = false;
      },
      error: (err) => {
        console.error('Failed to level up:', err);
        this.showMessage(err.error?.error || '升級失敗', 'error');
        this.isProcessing = false;
      }
    });
    this.subscription.add(sub);
  }

  showMessage(text: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.message = text;
    this.messageType = type;
    setTimeout(() => {
      this.message = '';
    }, 5000);
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

  getFullImageUrl(url: string): string {
    if (!url || url.includes('placeholder')) {
      return url;
    }
    return url.startsWith('http') ? url : `http://localhost:8000${url}`;
  }

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  setMaxExpAmount(): void {
    this.expAmount = this.maxExpAmount;
  }

  increaseExpAmount(): void {
    if (this.expAmount < this.maxExpAmount) {
      this.expAmount++;
    }
  }

  decreaseExpAmount(): void {
    if (this.expAmount > 0) {
      this.expAmount--;
    }
  }

  setExpAmount(amount: number): void {
    this.expAmount = Math.max(0, Math.min(amount, this.maxExpAmount));
  }

  upgradeCharacter(): void {
    if (this.expAmount <= 0 || this.expAmount > this.playerResources.exp_potion) {
      this.showMessage('經驗藥水數量無效', 'error');
      return;
    }

    const results = this.levelUpResults;
    if (!results.canAfford) {
      this.showMessage(`金幣不足：需要 ${results.totalGoldCost} 金幣`, 'error');
      return;
    }

    this.isProcessing = true;
    const token = this.authService.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    // 先添加經驗值
    const addExpSub = this.characterService.addExperience(this.characterId, this.expAmount, token).subscribe({
      next: (data) => {
        if (data.success) {
          // 更新角色和資源數據
          this.character = data.character;
          this.upgradeInfo = data.upgrade_info;
          this.playerResources = data.player_resources;
          
          // 開始連續升級
          this.performLevelUps(token);
        } else {
          this.showMessage(data.error || '增加經驗失敗', 'error');
          this.isProcessing = false;
        }
      },
      error: (err) => {
        console.error('Failed to add experience:', err);
        this.showMessage(err.error?.error || '增加經驗失敗', 'error');
        this.isProcessing = false;
      }
    });
    this.subscription.add(addExpSub);
  }

  private performLevelUps(token: string): void {
    // 檢查是否可以升級
    if (!this.upgradeInfo.can_level_up) {
      // 升級完成
      this.showMessage(`升級完成！最終等級：Lv.${this.character?.level}`, 'success');
      this.expAmount = 0;
      this.isProcessing = false;
      
      // 更新本地角色數據
      if (this.character) {
        this.characterService.saveCharacter(this.character);
      }
      return;
    }

    // 執行升級
    const levelUpSub = this.characterService.levelUpCharacter(this.characterId, token).subscribe({
      next: (data) => {
        if (data.success) {
          this.character = data.character;
          this.upgradeInfo = data.upgrade_info;
          this.playerResources = data.player_resources;
          
          // 繼續嘗試升級
          this.performLevelUps(token);
        } else {
          this.showMessage(data.error || '升級失敗', 'error');
          this.isProcessing = false;
        }
      },
      error: (err) => {
        console.error('Failed to level up:', err);
        this.showMessage(err.error?.error || '升級失敗', 'error');
        this.isProcessing = false;
      }
    });
    this.subscription.add(levelUpSub);
  }
}