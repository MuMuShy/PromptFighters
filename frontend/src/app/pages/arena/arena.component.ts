import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { BettingService, ScheduledBattle, LadderRank } from '../../services/betting.service';
import { PlayerService } from '../../services/player.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-arena',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUrlPipe],
  template: `
    <div class="arena-page">
      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="overlayActive">
        <div class="loading-spinner"></div>
        <p class="loading-text">更新戰鬥狀態...</p>
      </div>

      <!-- 主標題 -->
      <div class="arena-header">
        <h1 class="arena-title">ARENA</h1>
        <p class="arena-subtitle">Battle Prediction System</p>
      </div>

      <!-- 當前戰鬥區域 -->
      <div class="current-battle-section" *ngIf="currentBattle">
        <div class="battle-card">
          <!-- 戰鬥標題 -->
          <div class="battle-header">
            <div class="battle-info">
              <h2 class="battle-title">RANKED MATCH</h2>
              <div class="battle-id">#{{ currentBattle.id.substring(0, 8) }}</div>
            </div>
            <div class="battle-status" [ngClass]="currentBattle.status">
              <div class="status-dot"></div>
              {{ getStatusText(currentBattle.status) }}
            </div>
          </div>

          <!-- 狀態說明和倒數計時 -->
          <div class="battle-progress-section">
            <div class="progress-info">
              <div class="current-phase">
                <h3 class="phase-title">{{ getCurrentPhaseTitle() }}</h3>
                <p class="phase-description">{{ getCurrentPhaseDescription() }}</p>
              </div>
              
              <div class="countdown-timer" *ngIf="!timeRemaining.isExpired">
                <div class="timer-display">
                  <div class="time-unit" *ngIf="timeRemaining.hours > 0">
                    <span class="time-number">{{ timeRemaining.hours.toString().padStart(2, '0') }}</span>
                    <span class="time-label">時</span>
                  </div>
                  <div class="time-unit">
                    <span class="time-number">{{ timeRemaining.minutes.toString().padStart(2, '0') }}</span>
                    <span class="time-label">分</span>
                  </div>
                  <div class="time-unit">
                    <span class="time-number">{{ timeRemaining.seconds.toString().padStart(2, '0') }}</span>
                    <span class="time-label">秒</span>
                  </div>
                </div>
                <div class="timer-action">{{ getTimerAction() }}</div>
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
                  <div class="stat-item">
                    <div class="stat-icon str"></div>
                    <span class="stat-value">{{ currentBattle.fighter1.character.strength }}</span>
                  </div>
                  <div class="stat-item">
                    <div class="stat-icon agi"></div>
                    <span class="stat-value">{{ currentBattle.fighter1.character.agility }}</span>
                  </div>
                  <div class="stat-item">
                    <div class="stat-icon luk"></div>
                    <span class="stat-value">{{ currentBattle.fighter1.character.luck }}</span>
                  </div>
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
                  <div class="stat-item">
                    <div class="stat-icon str"></div>
                    <span class="stat-value">{{ currentBattle.fighter2.character.strength }}</span>
                  </div>
                  <div class="stat-item">
                    <div class="stat-icon agi"></div>
                    <span class="stat-value">{{ currentBattle.fighter2.character.agility }}</span>
                  </div>
                  <div class="stat-item">
                    <div class="stat-icon luk"></div>
                    <span class="stat-value">{{ currentBattle.fighter2.character.luck }}</span>
                  </div>
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
                    <button class="info-btn" (click)="showPoolInfo = !showPoolInfo">?</button>
                    </div>
                    
                    <!-- 獎池機制說明 -->
                    <div class="pool-info-modal" *ngIf="showPoolInfo" (click)="showPoolInfo = false">
                      <div class="pool-info-content" (click)="$event.stopPropagation()">
                      <h4>PRIZE POOL MECHANISM</h4>
                        <div class="info-sections">
                          <div class="info-section">
                          <h5>How It Works</h5>
                          <p>• All losing bets go into the prize pool</p>
                          <p>• 5% platform fee is deducted</p>
                          <p>• Remaining 95% is distributed proportionally to winners</p>
                          </div>
                          <div class="info-section">
                          <h5>Profit Calculation</h5>
                          <p>Winner Receives = Principal + Pool Share</p>
                          <p>Share Ratio = Your Bet ÷ Total Winning Side Bets</p>
                          </div>
                          <div class="info-section">
                          <h5>Fair System</h5>
                          <p>• No house edge (除hand續費外)</p>
                          <p>• Profits come from losing bets, not system printing</p>
                          <p>• Bigger bets = Bigger share</p>
                        </div>
                      </div>
                      <button class="close-btn" (click)="showPoolInfo = false">Got It</button>
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
          <div class="user-bet-display" *ngIf="currentBattle.user_bet && currentBattle.status !== 'completed'">
            <div class="bet-info">
              <h3 class="bet-title">YOUR BET</h3>
              <div class="bet-details">
                <div class="bet-fighter">{{ currentBattle.user_bet.chosen_fighter.character.name }}</div>
                <div class="bet-amount-display">{{ currentBattle.user_bet.bet_amount }} GOLD</div>
                <div class="bet-odds">{{ currentBattle.user_bet.odds_at_bet }}x ODDS</div>
                <div class="potential-win">Est. Profit: {{ currentBattle.user_bet.potential_payout }} GOLD</div>
              </div>
            </div>
          </div>

          <!-- 戰鬥進行中顯示 -->
          <div class="battle-in-progress" *ngIf="currentBattle.status === 'in_progress'">
            <div class="progress-container">
              <div class="battle-animation">
                <div class="animation-ring"></div>
                <div class="animation-ring"></div>
                <div class="animation-ring"></div>
                <div class="battle-icon">⚔️</div>
              </div>
              <h3 class="progress-title">BATTLE IN PROGRESS</h3>
              <p class="progress-description">兩位戰士正在激烈交鋒中...</p>
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
            </div>
          </div>

          <!-- 戰鬥結果顯示 -->
          <div class="battle-result" *ngIf="currentBattle.status === 'completed'">
            <div class="result-container">
              <div class="result-header">
                <h3 class="result-title">BATTLE COMPLETED</h3>
                <div class="winner-announcement">
                  <div class="winner-label">WINNER</div>
                  <div class="winner-name">{{ currentBattle.winner?.character?.name || 'Unknown' }}</div>
                </div>
              </div>

              <div class="result-fighters">
                <div class="result-fighter" [class.winner]="currentBattle.winner?.id === currentBattle.fighter1.id">
                  <div class="fighter-portrait">
                    <img [src]="currentBattle.fighter1.character.image_url | mediaUrl" 
                         [alt]="currentBattle.fighter1.character.name">
                    <div class="winner-badge" *ngIf="currentBattle.winner?.id === currentBattle.fighter1.id">
                      <span>VICTORY</span>
                    </div>
                  </div>
                  <div class="fighter-name">{{ currentBattle.fighter1.character.name }}</div>
                  <div class="fighter-rank">Rank #{{ currentBattle.fighter1.current_rank }}</div>
                </div>

                <div class="vs-divider">VS</div>

                <div class="result-fighter" [class.winner]="currentBattle.winner?.id === currentBattle.fighter2.id">
                  <div class="fighter-portrait">
                    <img [src]="currentBattle.fighter2.character.image_url | mediaUrl" 
                         [alt]="currentBattle.fighter2.character.name">
                    <div class="winner-badge" *ngIf="currentBattle.winner?.id === currentBattle.fighter2.id">
                      <span>VICTORY</span>
                    </div>
                  </div>
                  <div class="fighter-name">{{ currentBattle.fighter2.character.name }}</div>
                  <div class="fighter-rank">Rank #{{ currentBattle.fighter2.current_rank }}</div>
                </div>
              </div>

              <!-- 用戶下注結果 -->
              <div class="user-bet-result" *ngIf="currentBattle.user_bet">
                <div class="bet-result-card" [class.won]="getBetResult() === 'won'" [class.lost]="getBetResult() === 'lost'">
                  <div class="result-icon">{{ getBetResult() === 'won' ? '🎉' : '😢' }}</div>
                  <div class="result-status">{{ getBetResult() === 'won' ? 'YOU WON!' : 'YOU LOST' }}</div>
                  <div class="result-details">
                    <div class="detail-row">
                      <span class="detail-label">Your Bet:</span>
                      <span class="detail-value">{{ currentBattle.user_bet.bet_amount }} GOLD</span>
                    </div>
                    <div class="detail-row" *ngIf="getBetResult() === 'won'">
                      <span class="detail-label">Payout:</span>
                      <span class="detail-value winning">+{{ currentBattle.user_bet.actual_payout || currentBattle.user_bet.potential_payout }} GOLD</span>
                    </div>
                    <div class="detail-row" *ngIf="getBetResult() === 'lost'">
                      <span class="detail-label">Lost:</span>
                      <span class="detail-value losing">-{{ currentBattle.user_bet.bet_amount }} GOLD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="result-actions">
                <button class="action-btn primary" (click)="goToBattleHistory()">
                  VIEW HISTORY
                </button>
                <button class="action-btn secondary" (click)="goToUpcoming()">
                  NEXT BATTLE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 無戰鬥時的顯示 -->
      <div class="no-battle-section" *ngIf="!currentBattle && !loading">
        <div class="no-battle-card">
          <div class="no-battle-icon"></div>
          <h2>NO ACTIVE BATTLES</h2>
          <p>Next battle is being scheduled</p>
          <div class="action-buttons">
            <button class="refresh-btn" (click)="refreshData()">
              <span>REFRESH</span>
            </button>
            <button class="create-battle-btn" (click)="createTestBattle()">
              <span>CREATE TEST BATTLE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 快速導航 -->
      <div class="quick-nav">
        <button class="nav-btn" (click)="goToLadder()">
          <span class="nav-text">LADDER</span>
        </button>
        <button class="nav-btn" (click)="goToMyBets()">
          <span class="nav-text">MY BETS</span>
        </button>
        <button class="nav-btn" (click)="goToUpcoming()">
          <span class="nav-text">UPCOMING</span>
        </button>
        <button class="nav-btn" (click)="goToBattleHistory()">
          <span class="nav-text">HISTORY</span>
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
  private hasHandledExpiry = false; // 防止重複處理倒數完成
  private lastApiCallTime = 0; // 最後一次 API 調用時間
  private nextScheduledCallTime = 0; // 下次預定調用時間
  // Overlay 僅在階段切換時顯示
  overlayActive: boolean = false;
  private overlayUntilStatus: string | null = null;
  private overlayDeadline: number = 0;
  private lastKnownStatus: string | null = null;
  
  constructor(
    public bettingService: BettingService,
    private playerService: PlayerService,
    private router: Router,
    private route: ActivatedRoute,
    private dialogService: DialogService
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
      // 同時檢查 overlay 是否應該關閉（超時保護）
      if (this.overlayActive && this.currentBattle) {
        this.maybeDismissOverlay(this.currentBattle.status);
      }
    });
    this.subscriptions.push(timerSub);
    
    // 訂閱當前戰鬥
    const battleSub = this.bettingService.currentBattle$.subscribe(battle => {
      if (!battleId) { // 只有在沒有指定戰鬥ID時才更新
        this.currentBattle = battle;
        this.loading = false;
        if (battle) {
          this.onBattleUpdated(battle);
        }
        this.selectedFighter = null; // 重置選擇
      }
    });
    this.subscriptions.push(battleSub);
    
    // 智能輪詢：根據戰鬥狀態和時間戳調度 API 調用
    const pollSub = interval(1000).subscribe(() => {
      this.smartPoll(battleId);
    });
    this.subscriptions.push(pollSub);
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
    // 載入當前戰鬥（僅用於 betting_open 和 betting_closed 狀態）
    console.log('🔄 [Arena] 開始載入當前戰鬥');
    this.bettingService.getCurrentBettingBattle().subscribe({
      next: (battle) => {
        console.log('✅ [Arena] 當前戰鬥載入成功:', battle);
        if (battle) {
          this.currentBattle = battle;
          // 僅在初次載入時影響 loading，避免閃爍
          if (!this.lastKnownStatus) {
            this.loading = false;
          }
          this.hasHandledExpiry = false; // 重置倒數處理標記
          console.log('📸 Arena Fighter1 圖片:', battle.fighter1?.character?.image_url);
          console.log('📸 Arena Fighter2 圖片:', battle.fighter2?.character?.image_url);
          this.onBattleUpdated(battle);
        } else {
          // 沒有當前戰鬥
          this.currentBattle = null;
          this.loading = false;
        }
      },
      error: (error) => {
        // 404 錯誤表示沒有當前戰鬥（正常情況）
        if (error.status === 404) {
          console.log('ℹ️ [Arena] 目前沒有可下注的戰鬥');
          this.currentBattle = null;
          this.loading = false;
        } else {
          console.error('❌ [Arena] 載入當前戰鬥失敗:', error);
          this.loading = false;
        }
      }
    });
  }
  
  private loadSpecificBattle(battleId: string): void {
    console.log('🔄 [Arena] 載入特定戰鬥:', battleId);
    this.bettingService.getBattleDetails(battleId).subscribe({
      next: (battle) => {
        console.log('✅ [Arena] 特定戰鬥載入成功:', battle.status);
        this.currentBattle = battle;
        // 避免在輪詢期間切換 loading 造成閃爍
        if (!this.lastKnownStatus) {
        this.loading = false;
        }
        this.hasHandledExpiry = false; // 重置倒數處理標記
        this.onBattleUpdated(battle);
      },
      error: (error) => {
        console.error('❌ [Arena] 載入特定戰鬥失敗:', error);
        if (!this.lastKnownStatus) {
        this.loading = false;
        }
        // 如果載入失敗，嘗試載入當前戰鬥
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
      // 重置標記，允許下次倒數完成時處理
      this.hasHandledExpiry = false;
    } else {
      this.timeRemaining = { hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
      
      // 倒數完成，立即預測並更新本地狀態（只處理一次）
      if (!this.hasHandledExpiry) {
        this.hasHandledExpiry = true;
        this.handleCountdownExpired();
      }
    }
  }
  
  private smartPoll(battleId?: string): void {
    const now = Date.now();
    
    // 如果還沒到預定調用時間，跳過
    if (now < this.nextScheduledCallTime) {
      return;
    }
    
    if (battleId) {
      // 有指定戰鬥ID，使用較短的輪詢間隔（5秒）
      if (now - this.lastApiCallTime >= 5000) {
        this.loadSpecificBattle(battleId);
        this.lastApiCallTime = now;
        this.nextScheduledCallTime = now + 5000;
      }
      return;
    }
    
    if (!this.currentBattle) {
      // 沒有當前戰鬥，每 10 秒檢查一次
      if (now - this.lastApiCallTime >= 10000) {
        this.loadCurrentBattle();
        this.lastApiCallTime = now;
        this.nextScheduledCallTime = now + 10000;
      }
      return;
    }
    
    const status = this.currentBattle.status;
    let pollInterval = 5000; // 預設 5 秒
    
    // 根據狀態決定輪詢間隔
    if (status === 'betting_open') {
      // 下注進行中：計算距離結束還有多久
      const endTime = new Date(this.currentBattle.betting_end_time).getTime();
      const timeUntilEnd = endTime - now;
      
      if (timeUntilEnd < 30000) {
        // 最後 30 秒，每 2 秒輪詢一次
        pollInterval = 2000;
      } else if (timeUntilEnd < 60000) {
        // 最後 1 分鐘，每 5 秒輪詢一次
        pollInterval = 5000;
      } else {
        // 其他時間，每 15 秒輪詢一次
        pollInterval = 15000;
      }
    } else if (status === 'betting_closed') {
      // 等待戰鬥開始：計算距離開始還有多久
      const startTime = new Date(this.currentBattle.scheduled_time).getTime();
      const timeUntilStart = startTime - now;
      
      if (timeUntilStart < 10000) {
        // 最後 10 秒，每 1 秒輪詢一次
        pollInterval = 1000;
      } else if (timeUntilStart < 30000) {
        // 最後 30 秒，每 3 秒輪詢一次
        pollInterval = 3000;
      } else {
        // 其他時間，每 10 秒輪詢一次
        pollInterval = 10000;
      }
    } else if (status === 'in_progress') {
      // 戰鬥進行中，每 3 秒輪詢一次
      pollInterval = 3000;
    } else if (status === 'completed') {
      // 戰鬥已完成，停止輪詢
      console.log('🏁 [Arena] 戰鬥已完成，停止輪詢');
      return;
    } else if (status === 'scheduled') {
      // 準備階段，每 10 秒輪詢一次
      pollInterval = 10000;
    }
    
    // 檢查是否該調用 API
    if (now - this.lastApiCallTime >= pollInterval) {
      console.log(`📡 [Arena] 智能輪詢 - 狀態: ${status}, 間隔: ${pollInterval}ms`);
      
      if (status === 'scheduled') {
        this.loadCurrentBattle();
      } else {
        this.loadSpecificBattle(this.currentBattle.id);
      }
      
      this.lastApiCallTime = now;
      this.nextScheduledCallTime = now + pollInterval;
    }
  }
  
  private handleCountdownExpired(): void {
    if (!this.currentBattle) return;
    
    const currentStatus = this.currentBattle.status;
    
    console.log('⏰ [Arena] 倒數完成，當前狀態:', currentStatus);
    
    // 設定目標階段（只有在下注或切換到下注時才使用 overlay）
    const now = Date.now();
    this.overlayDeadline = now + 20000;
    if (currentStatus === 'scheduled') {
      this.overlayUntilStatus = 'betting_open';
    } else if (currentStatus === 'betting_open') {
      this.overlayUntilStatus = 'betting_closed';
    } else if (currentStatus === 'betting_closed') {
      this.overlayUntilStatus = 'in_progress';
    } else {
      this.overlayUntilStatus = null;
    }
    
    // 只有需要等待下注階段切換時才顯示 overlay；
    // 進入 in_progress 或之後不顯示 overlay
    this.overlayActive = !!this.overlayUntilStatus;
    
    console.log(`🔄 [Arena] Overlay 啟動 - 等待狀態: ${this.overlayUntilStatus}, 超時時間: ${new Date(this.overlayDeadline).toLocaleTimeString()}`);
    
    // 立即刷新數據以獲取最新狀態，繞過輪詢間隔
    this.lastApiCallTime = 0; // 重置，允許立即調用
    this.nextScheduledCallTime = 0;
    
    if (currentStatus === 'scheduled') {
      this.loadCurrentBattle();
    } else {
      this.loadSpecificBattle(this.currentBattle.id);
    }
  }

  private onBattleUpdated(battle: ScheduledBattle): void {
    const newStatus = battle.status;
    
    if (this.lastKnownStatus !== newStatus) {
      console.log(`📊 [Arena] 戰鬥狀態更新: ${this.lastKnownStatus} → ${newStatus}`);
    }
    
    // 一旦進入戰鬥或已完成，強制關閉 overlay
    if (newStatus === 'in_progress' || newStatus === 'completed') {
      this.overlayActive = false;
      this.overlayUntilStatus = null;
    } else {
      this.maybeDismissOverlay(newStatus);
    }
    this.lastKnownStatus = newStatus;
  }

  private maybeDismissOverlay(newStatus: string): void {
    if (!this.overlayActive) return;
    
    const now = Date.now();
    
    // 定義狀態順序（後面的狀態表示更進一步）
    const statusOrder: { [key: string]: number } = {
      'scheduled': 1,
      'betting_open': 2,
      'betting_closed': 3,
      'in_progress': 4,
      'completed': 5
    };
    
    // 如果狀態已達到或超過期望的狀態，關閉 overlay
    if (this.overlayUntilStatus) {
      const expectedOrder = statusOrder[this.overlayUntilStatus] || 0;
      const currentOrder = statusOrder[newStatus] || 0;
      
      if (currentOrder >= expectedOrder) {
        console.log(`✅ [Arena] Overlay 關閉 - 狀態已達到: ${newStatus} (期望: ${this.overlayUntilStatus})`);
        this.overlayActive = false;
        this.overlayUntilStatus = null;
        return;
      }
    }
    
    // 如果超過期限，強制關閉（避免永遠卡住）
    if (now >= this.overlayDeadline) {
      console.log(`⏰ [Arena] Overlay 超時關閉 - 當前狀態: ${newStatus}`);
      this.overlayActive = false;
      this.overlayUntilStatus = null;
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
  
  getCurrentPhaseTitle(): string {
    if (!this.currentBattle) return '';
    
    switch (this.currentBattle.status) {
      case 'scheduled':
        return '準備階段';
      case 'betting_open':
        return '下注進行中';
      case 'betting_closed':
        return '下注已截止';
      case 'in_progress':
        return '戰鬥進行中';
      case 'completed':
        return '戰鬥已結束';
      default:
        return '等待中';
    }
  }
  
  getCurrentPhaseDescription(): string {
    if (!this.currentBattle) return '';
    
    switch (this.currentBattle.status) {
      case 'scheduled':
        return '戰鬥即將開始，下注將於指定時間開放';
      case 'betting_open':
        return '現在可以選擇支持的角色並進行下注';
      case 'betting_closed':
        return '下注時間已結束，戰鬥即將開始';
      case 'in_progress':
        return '角色正在激烈戰鬥中，請耐心等待結果';
      case 'completed':
        return '戰鬥已結束，可查看結果和獎金分配';
      default:
        return '系統正在處理中';
    }
  }
  
  getTimerAction(): string {
    if (!this.currentBattle) return '';
    
    switch (this.currentBattle.status) {
      case 'scheduled':
        return '後開放下注';
      case 'betting_open':
        return '後截止下注';
      case 'betting_closed':
        return '後開始戰鬥';
      default:
        return '後更新狀態';
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
        this.dialogService.success('Bet Placed', 'Your bet has been placed successfully!');
        this.selectedFighter = null;
        this.betAmount = 100;
        // 重新載入戰鬥資料
        this.loadCurrentBattle();
        // 更新玩家金幣
        this.loadInitialData();
        this.loading = false;
      },
      error: (error) => {
        this.dialogService.error('Bet Failed', error.error?.error || 'Please try again later');
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
        this.dialogService.success('Battle Created', 'Test battle has been created successfully!');
        this.refreshData();
      },
      error: (error) => {
        this.dialogService.error('Creation Failed', error.error?.error || 'Please try again later');
        this.loading = false;
      }
    });
  }
  
  // 判斷下注結果
  getBetResult(): 'won' | 'lost' | null {
    if (!this.currentBattle?.user_bet || !this.currentBattle.winner) {
      return null;
    }
    return this.currentBattle.user_bet.chosen_fighter.id === this.currentBattle.winner.id 
      ? 'won' 
      : 'lost';
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