import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { BettingService, ScheduledBattle, LadderRank } from '../../services/betting.service';
import { PlayerService } from '../../services/player.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-arena',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUrlPipe],
  template: `
    <div class="arena-page">
      <!-- 主標題 -->
      <div class="arena-header">
        <h1 class="arena-title">競技場</h1>
        <p class="arena-subtitle">每小時自動對戰 • 實時下注 • 豐厚獎勵</p>
      </div>

      <!-- 當前戰鬥區域 -->
      <div class="current-battle-section" *ngIf="currentBattle">
        <div class="battle-card">
          <!-- 戰鬥標題 -->
          <div class="battle-header">
            <h2 class="battle-title">⚔️ 即將開戰</h2>
            <div class="battle-status" [ngClass]="currentBattle.status">
              {{ getStatusText(currentBattle.status) }}
            </div>
          </div>

          <!-- 倒數計時器 -->
          <div class="countdown-section">
            <div class="countdown-timer" *ngIf="!timeRemaining.isExpired">
              <div class="timer-label">{{ getTimerLabel() }}</div>
              <div class="timer-display">
                <div class="time-unit">
                  <span class="time-number">{{ timeRemaining.hours.toString().padStart(2, '0') }}</span>
                  <span class="time-label">時</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <span class="time-number">{{ timeRemaining.minutes.toString().padStart(2, '0') }}</span>
                  <span class="time-label">分</span>
                </div>
                <span class="time-separator">:</span>
                <div class="time-unit">
                  <span class="time-number">{{ timeRemaining.seconds.toString().padStart(2, '0') }}</span>
                  <span class="time-label">秒</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 戰鬥對手 -->
          <div class="fighters-section">
            <div class="fighter-card left">
              <div class="fighter-image">
                <img [src]="currentBattle.fighter1.character.image_url | mediaUrl" 
                     [alt]="currentBattle.fighter1.character.name">
                <div class="fighter-rank">#{{ currentBattle.fighter1.current_rank }}</div>
              </div>
              <div class="fighter-info">
                <h3 class="fighter-name">{{ currentBattle.fighter1.character.name }}</h3>
                <div class="fighter-stats">
                  <span class="stat">💪 {{ currentBattle.fighter1.character.strength }}</span>
                  <span class="stat">⚡ {{ currentBattle.fighter1.character.agility }}</span>
                  <span class="stat">🍀 {{ currentBattle.fighter1.character.luck }}</span>
                </div>
                <div class="fighter-record">
                  {{ currentBattle.fighter1.wins }}勝 {{ currentBattle.fighter1.losses }}敗
                  ({{ currentBattle.fighter1.win_rate }}%)
                </div>
              </div>
              <div class="betting-section">
                <div class="odds">賠率 {{ currentBattle.fighter1_odds }}x</div>
                <div class="bet-amount">{{ bettingService.formatAmount(currentBattle.fighter1_bets_amount) }} 金幣</div>
                <button class="bet-button" 
                        [disabled]="!canBet()" 
                        (click)="selectFighter(currentBattle.fighter1)"
                        [class.selected]="selectedFighter?.id === currentBattle.fighter1.id">
                  選擇
                </button>
              </div>
            </div>

            <div class="vs-section">
              <div class="vs-icon">VS</div>
              <div class="total-pool">
                <div class="pool-label">總獎池</div>
                <div class="pool-amount">{{ bettingService.formatAmount(currentBattle.total_bets_amount) }} 金幣</div>
              </div>
            </div>

            <div class="fighter-card right">
              <div class="fighter-image">
                <img [src]="currentBattle.fighter2.character.image_url | mediaUrl" 
                     [alt]="currentBattle.fighter2.character.name">
                <div class="fighter-rank">#{{ currentBattle.fighter2.current_rank }}</div>
              </div>
              <div class="fighter-info">
                <h3 class="fighter-name">{{ currentBattle.fighter2.character.name }}</h3>
                <div class="fighter-stats">
                  <span class="stat">💪 {{ currentBattle.fighter2.character.strength }}</span>
                  <span class="stat">⚡ {{ currentBattle.fighter2.character.agility }}</span>
                  <span class="stat">🍀 {{ currentBattle.fighter2.character.luck }}</span>
                </div>
                <div class="fighter-record">
                  {{ currentBattle.fighter2.wins }}勝 {{ currentBattle.fighter2.losses }}敗
                  ({{ currentBattle.fighter2.win_rate }}%)
                </div>
              </div>
              <div class="betting-section">
                <div class="odds">賠率 {{ currentBattle.fighter2_odds }}x</div>
                <div class="bet-amount">{{ bettingService.formatAmount(currentBattle.fighter2_bets_amount) }} 金幣</div>
                <button class="bet-button" 
                        [disabled]="!canBet()" 
                        (click)="selectFighter(currentBattle.fighter2)"
                        [class.selected]="selectedFighter?.id === currentBattle.fighter2.id">
                  選擇
                </button>
              </div>
            </div>
          </div>

          <!-- 下注表單 -->
          <div class="betting-form" *ngIf="selectedFighter && canBet()">
            <div class="form-header">
              <h3>下注 {{ selectedFighter.character.name }}</h3>
              <div class="current-odds">當前賠率: {{ getCurrentOdds() }}x</div>
            </div>
            
            <div class="bet-input-section">
              <div class="amount-input">
                <label>下注金額</label>
                <input type="number" 
                       [(ngModel)]="betAmount" 
                       min="10" 
                       max="10000" 
                       placeholder="最少 10 金幣">
                <div class="input-info">
                  <span>可用: {{ playerGold }} 金幣</span>
                  <div class="payout-info">
                    <div class="payout-item">
                      <span class="payout-label">預估獲利:</span>
                      <span class="payout-value">{{ getEstimatedPoolPayout() }} 金幣</span>
                    </div>
                    <div class="payout-note">
                      *實際獲利基於獎池分配機制
                      <button class="info-btn" (click)="showPoolInfo = !showPoolInfo">ℹ️</button>
                    </div>
                    
                    <!-- 獎池機制說明 -->
                    <div class="pool-info-modal" *ngIf="showPoolInfo" (click)="showPoolInfo = false">
                      <div class="pool-info-content" (click)="$event.stopPropagation()">
                        <h4>💰 獎池分配機制</h4>
                        <div class="info-sections">
                          <div class="info-section">
                            <h5>🎯 如何運作</h5>
                            <p>• 所有失敗者的下注金額進入獎池</p>
                            <p>• 系統收取 5% 手續費</p>
                            <p>• 剩餘 95% 按比例分配給獲勝者</p>
                          </div>
                          <div class="info-section">
                            <h5>💎 獲利計算</h5>
                            <p>獲勝者獲得 = 本金 + 獎池分成</p>
                            <p>分成比例 = 你的下注 ÷ 獲勝方總下注</p>
                          </div>
                          <div class="info-section">
                            <h5>⚖️ 公平機制</h5>
                            <p>• 沒有莊家優勢（除手續費外）</p>
                            <p>• 獲利來自失敗者，不是系統印鈔</p>
                            <p>• 下注越多，分成越多</p>
                          </div>
                        </div>
                        <button class="close-btn" (click)="showPoolInfo = false">知道了</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="quick-amounts">
                <button *ngFor="let amount of quickAmounts" 
                        (click)="setBetAmount(amount)"
                        [disabled]="amount > playerGold"
                        class="quick-amount-btn">
                  {{ amount }}
                </button>
              </div>
            </div>
            
            <div class="form-actions">
              <button class="cancel-btn" (click)="cancelBet()">取消</button>
              <button class="confirm-btn" 
                      (click)="confirmBet()" 
                      [disabled]="!isValidBet()">
                確認下注
              </button>
            </div>
          </div>

          <!-- 已下注顯示 -->
          <div class="user-bet-display" *ngIf="currentBattle.user_bet">
            <div class="bet-info">
              <h3>🎯 您的下注</h3>
              <div class="bet-details">
                <div class="bet-fighter">{{ currentBattle.user_bet.chosen_fighter.character.name }}</div>
                <div class="bet-amount-display">{{ currentBattle.user_bet.bet_amount }} 金幣</div>
                <div class="bet-odds">賠率 {{ currentBattle.user_bet.odds_at_bet }}x</div>
                <div class="potential-win">預估獲利: {{ currentBattle.user_bet.potential_payout }} 金幣</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 無戰鬥時的顯示 -->
      <div class="no-battle-section" *ngIf="!currentBattle && !loading">
        <div class="no-battle-card">
          <div class="no-battle-icon">⏰</div>
          <h2>暫無進行中的戰鬥</h2>
          <p>下一場戰鬥將在整點開始，敬請期待！</p>
          <div class="action-buttons">
            <button class="refresh-btn" (click)="refreshData()">刷新</button>
            <button class="create-battle-btn" (click)="createTestBattle()">創建測試戰鬥</button>
          </div>
        </div>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入中...</p>
      </div>

      <!-- 快速導航 -->
      <div class="quick-nav">
        <button class="nav-btn" (click)="goToLadder()">
          <span class="nav-icon">🏆</span>
          <span class="nav-text">天梯排名</span>
        </button>
        <button class="nav-btn" (click)="goToMyBets()">
          <span class="nav-icon">📊</span>
          <span class="nav-text">我的下注</span>
        </button>
        <button class="nav-btn" (click)="goToUpcoming()">
          <span class="nav-icon">📅</span>
          <span class="nav-text">即將開戰</span>
        </button>
        <button class="nav-btn" (click)="goToBattleHistory()">
          <span class="nav-icon">📚</span>
          <span class="nav-text">歷史對戰</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./arena.component.scss']
})
export class ArenaComponent implements OnInit, OnDestroy {
  currentBattle: ScheduledBattle | null = null;
  selectedFighter: LadderRank | null = null;
  betAmount: number = 100;
  playerGold: number = 0;
  loading: boolean = true;
  showPoolInfo: boolean = false;
  
  timeRemaining = { hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: false };
  quickAmounts = [50, 100, 500, 1000, 5000];
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    public bettingService: BettingService,
    private playerService: PlayerService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  
  ngOnInit(): void {
    this.loadInitialData();
    
    // 檢查是否有指定的戰鬥ID
    const battleId = this.route.snapshot.queryParams['battleId'];
    if (battleId) {
      this.loadSpecificBattle(battleId);
    } else {
      this.loadCurrentBattle();
    }
    
    // 設置定時器更新倒數計時
    const timerSub = interval(1000).subscribe(() => {
      this.updateTimeRemaining();
    });
    this.subscriptions.push(timerSub);
    
    // 訂閱當前戰鬥
    const battleSub = this.bettingService.currentBattle$.subscribe(battle => {
      if (!battleId) { // 只有在沒有指定戰鬥ID時才更新
        this.currentBattle = battle;
        this.loading = false;
        this.selectedFighter = null; // 重置選擇
      }
    });
    this.subscriptions.push(battleSub);
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private loadInitialData(): void {
    // 載入玩家數據
    this.playerService.getResources().subscribe((data: any) => {
      this.playerGold = data.gold || 0;
    });
  }
  
  private loadCurrentBattle(): void {
    // 載入當前戰鬥
    this.bettingService.getCurrentBettingBattle().subscribe();
  }
  
  private loadSpecificBattle(battleId: string): void {
    this.loading = true;
    this.bettingService.getBattleDetails(battleId).subscribe({
      next: (battle) => {
        this.currentBattle = battle;
        this.loading = false;
      },
      error: (error) => {
        console.error('載入戰鬥失敗:', error);
        this.loading = false;
        // 如果載入失敗，回到當前戰鬥
        this.loadCurrentBattle();
      }
    });
  }
  
  private updateTimeRemaining(): void {
    if (!this.currentBattle) return;
    
    const now = new Date().getTime();
    let targetTime: number;
    
    if (this.currentBattle.status === 'betting_open') {
      targetTime = new Date(this.currentBattle.betting_end_time).getTime();
    } else if (this.currentBattle.status === 'scheduled') {
      targetTime = new Date(this.currentBattle.betting_start_time).getTime();
    } else {
      targetTime = new Date(this.currentBattle.scheduled_time).getTime();
    }
    
    const distance = targetTime - now;
    
    if (distance > 0) {
      this.timeRemaining = {
        total: distance,
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        isExpired: false
      };
    } else {
      this.timeRemaining = { hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
    }
  }
  
  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'scheduled': '準備中',
      'betting_open': '下注開放',
      'betting_closed': '下注結束',
      'in_progress': '戰鬥中',
      'completed': '已結束'
    };
    return statusMap[status] || status;
  }
  
  getTimerLabel(): string {
    if (!this.currentBattle) return '';
    
    if (this.currentBattle.status === 'betting_open') {
      return '下注截止';
    } else if (this.currentBattle.status === 'scheduled') {
      return '下注開始';
    } else {
      return '戰鬥開始';
    }
  }
  
  canBet(): boolean {
    return this.currentBattle?.status === 'betting_open' && 
           !this.currentBattle.user_bet &&
           this.playerGold >= 10;
  }
  
  selectFighter(fighter: LadderRank): void {
    if (!this.canBet()) return;
    this.selectedFighter = fighter;
  }
  
  getCurrentOdds(): number {
    if (!this.selectedFighter || !this.currentBattle) return 0;
    
    return this.selectedFighter.id === this.currentBattle.fighter1.id 
      ? this.currentBattle.fighter1_odds 
      : this.currentBattle.fighter2_odds;
  }
  
  getPotentialPayout(): number {
    // 傳統賠率計算（僅供參考）
    return Math.floor(this.betAmount * this.getCurrentOdds());
  }
  
  getEstimatedPoolPayout(): number {
    // 基於獎池機制的預估獲利
    if (!this.currentBattle || this.currentBattle.total_bets_amount === 0) {
      return this.betAmount;
    }
    
    const totalPool = this.currentBattle.total_bets_amount;
    const houseEdge = 0.05;
    
    // 簡單估算：假設獲勝方和失敗方下注相等
    const estimatedPrizePool = totalPool * 0.5 * (1 - houseEdge);
    const estimatedWinnerPool = totalPool * 0.5;
    
    if (estimatedWinnerPool > 0) {
      const winShare = this.betAmount / estimatedWinnerPool;
      const prizeShare = estimatedPrizePool * winShare;
      return Math.floor(this.betAmount + prizeShare);
    }
    
    return this.betAmount;
  }
  
  setBetAmount(amount: number): void {
    this.betAmount = Math.min(amount, this.playerGold);
  }
  
  isValidBet(): boolean {
    return this.betAmount >= 10 && 
           this.betAmount <= 10000 && 
           this.betAmount <= this.playerGold;
  }
  
  confirmBet(): void {
    if (!this.currentBattle || !this.selectedFighter || !this.isValidBet()) return;
    
    this.loading = true;
    this.bettingService.placeBet(
      this.currentBattle.id,
      this.selectedFighter.id,
      this.betAmount
    ).subscribe({
      next: (response) => {
        alert('下注成功！');
        this.selectedFighter = null;
        this.betAmount = 100;
        // 重新載入戰鬥資料
        this.loadCurrentBattle();
        // 更新玩家金幣
        this.loadInitialData();
        this.loading = false;
      },
      error: (error) => {
        alert('下注失敗：' + (error.error?.error || '請稍後再試'));
        this.loading = false;
      }
    });
  }
  
  cancelBet(): void {
    this.selectedFighter = null;
    this.betAmount = 100;
  }
  
  refreshData(): void {
    this.loading = true;
    this.loadCurrentBattle();
    this.loadInitialData();
  }
  
  createTestBattle(): void {
    this.loading = true;
    this.bettingService.createTestBattle().subscribe({
      next: (response) => {
        alert('測試戰鬥創建成功！');
        this.refreshData();
      },
      error: (error) => {
        alert('創建失敗：' + (error.error?.error || '請稍後再試'));
        this.loading = false;
      }
    });
  }
  
  // 導航方法
  goToLadder(): void {
    this.router.navigate(['/ladder']);
  }
  
  goToMyBets(): void {
    this.router.navigate(['/my-bets']);
  }
  
  goToUpcoming(): void {
    this.router.navigate(['/upcoming-battles']);
  }
  
  goToBattleHistory(): void {
    this.router.navigate(['/battle-history']);
  }
}