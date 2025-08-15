import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BettingService, BattleBet, BettingStats } from '../../services/betting.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-my-bets',
  standalone: true,
  imports: [CommonModule, MediaUrlPipe],
  template: `
    <div class="my-bets-page">
      <!-- 背景效果 -->
      <div class="bets-background">
        <div class="coin-particles">
          <div class="coin-particle" *ngFor="let p of coinParticles" 
               [style.left.%]="p.x" 
               [style.top.%]="p.y"
               [style.animation-delay.s]="p.delay">💰</div>
        </div>
      </div>

      <!-- 頁面標題 -->
      <div class="bets-header">
        <h1 class="bets-title">下注記錄</h1>
        <p class="bets-subtitle">追蹤您的投注歷史與收益</p>
      </div>

      <!-- 統計卡片 -->
      <div class="stats-section" *ngIf="stats">
        <div class="stats-grid">
          <div class="stat-card total-bets">
            <div class="stat-icon">🎯</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total_bets }}</div>
              <div class="stat-label">總下注次數</div>
            </div>
          </div>

          <div class="stat-card win-rate">
            <div class="stat-icon">🏆</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.win_rate }}%</div>
              <div class="stat-label">勝率</div>
            </div>
          </div>

          <div class="stat-card total-amount">
            <div class="stat-icon">💎</div>
            <div class="stat-info">
              <div class="stat-value">{{ bettingService.formatAmount(stats.total_bet_amount) }}</div>
              <div class="stat-label">總下注金額</div>
            </div>
          </div>

          <div class="stat-card net-profit" [class.profit]="stats.net_profit > 0" [class.loss]="stats.net_profit < 0">
            <div class="stat-icon">{{ stats.net_profit > 0 ? '📈' : '📉' }}</div>
            <div class="stat-info">
              <div class="stat-value">
                {{ stats.net_profit > 0 ? '+' : '' }}{{ bettingService.formatAmount(stats.net_profit) }}
              </div>
              <div class="stat-label">淨收益</div>
            </div>
          </div>

          <div class="stat-card current-streak">
            <div class="stat-icon">🔥</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.current_streak }}</div>
              <div class="stat-label">當前{{ stats.current_streak >= 0 ? '連勝' : '連敗' }}</div>
            </div>
          </div>

          <div class="stat-card best-streak">
            <div class="stat-icon">⭐</div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.best_streak }}</div>
              <div class="stat-label">最佳連勝</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下注記錄列表 -->
      <div class="bets-section">
        <div class="section-header">
          <h2>下注歷史</h2>
          <div class="filter-tabs">
            <button class="filter-tab" 
                    [class.active]="currentFilter === 'all'"
                    (click)="setFilter('all')">
              全部
            </button>
            <button class="filter-tab" 
                    [class.active]="currentFilter === 'pending'"
                    (click)="setFilter('pending')">
              進行中
            </button>
            <button class="filter-tab" 
                    [class.active]="currentFilter === 'won'"
                    (click)="setFilter('won')">
              已獲勝
            </button>
            <button class="filter-tab" 
                    [class.active]="currentFilter === 'lost'"
                    (click)="setFilter('lost')">
              已失敗
            </button>
          </div>
        </div>

        <div class="bets-list" *ngIf="filteredBets.length > 0">
          <div class="bet-item" 
               *ngFor="let bet of filteredBets"
               [class.won]="bet.is_winner === true"
               [class.lost]="bet.is_winner === false"
               [class.pending]="bet.is_winner === null">
            
            <!-- 戰鬥信息 -->
            <div class="bet-battle-info">
              <div class="battle-fighters">
                <div class="fighter">
                  <img [src]="bet.chosen_fighter.character.image_url | mediaUrl" 
                       [alt]="bet.chosen_fighter.character.name">
                  <div class="fighter-details">
                    <div class="fighter-name">{{ bet.chosen_fighter.character.name }}</div>
                    <div class="fighter-rank">#{{ bet.chosen_fighter.current_rank }}</div>
                  </div>
                  <div class="chosen-badge">已選擇</div>
                </div>
              </div>
              
              <div class="battle-meta">
                <div class="battle-date">{{ formatDate(bet.created_at) }}</div>
                <div class="battle-vs" *ngIf="bet.battle_info">
                  {{ bet.battle_info.fighter1_name }} vs {{ bet.battle_info.fighter2_name }}
                </div>
              </div>
            </div>

            <!-- 下注詳情 -->
            <div class="bet-details">
              <div class="bet-amount">
                <div class="amount-label">下注金額</div>
                <div class="amount-value">{{ bet.bet_amount }} 金幣</div>
              </div>
              
              <div class="bet-odds">
                <div class="odds-label">賠率</div>
                <div class="odds-value">{{ bet.odds_at_bet }}x</div>
              </div>
              
              <div class="potential-payout">
                <div class="payout-label">潛在獲利</div>
                <div class="payout-value">{{ bet.potential_payout }} 金幣</div>
              </div>
            </div>

            <!-- 結果狀態 -->
            <div class="bet-result">
              <div class="result-status" *ngIf="bet.is_settled">
                <div class="status-icon">
                  {{ bet.is_winner ? '🎉' : '😞' }}
                </div>
                <div class="status-text">
                  {{ bet.is_winner ? '獲勝' : '失敗' }}
                </div>
                <div class="payout-amount" *ngIf="bet.is_winner">
                  +{{ bet.payout_amount }} 金幣
                </div>
              </div>
              
              <div class="result-status pending" *ngIf="!bet.is_settled">
                <div class="status-icon">⏳</div>
                <div class="status-text">等待結果</div>
              </div>
            </div>

            <!-- 展開詳情按鈕 -->
            <div class="bet-actions">
              <button class="details-btn" (click)="toggleDetails(bet)">
                {{ expandedBets.has(bet.id) ? '收起' : '詳情' }}
                <span class="arrow" [class.expanded]="expandedBets.has(bet.id)">▼</span>
              </button>
            </div>

            <!-- 展開的詳細信息 -->
            <div class="bet-expanded-details" *ngIf="expandedBets.has(bet.id)">
              <div class="expanded-content">
                <div class="detail-row" *ngIf="bet.battle_info">
                  <span class="detail-label">戰鬥狀態:</span>
                  <span class="detail-value">
                    {{ bet.battle_info.is_completed ? '已完成' : '進行中' }}
                  </span>
                </div>
                
                <div class="detail-row" *ngIf="bet.battle_info?.winner_name">
                  <span class="detail-label">戰鬥勝者:</span>
                  <span class="detail-value">{{ bet.battle_info?.winner_name }}</span>
                </div>
                
                <div class="detail-row" *ngIf="bet.battle_info">
                  <span class="detail-label">戰鬥時間:</span>
                  <span class="detail-value">{{ formatDate(bet.battle_info.scheduled_time) }}</span>
                </div>
                
                <div class="detail-row" *ngIf="bet.settled_at">
                  <span class="detail-label">結算時間:</span>
                  <span class="detail-value">{{ formatDate(bet.settled_at) }}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">角色屬性:</span>
                  <span class="detail-value">
                    💪{{ bet.chosen_fighter.character.strength }} 
                    ⚡{{ bet.chosen_fighter.character.agility }} 
                    🍀{{ bet.chosen_fighter.character.luck }}
                  </span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">戰績:</span>
                  <span class="detail-value">
                    {{ bet.chosen_fighter.wins }}勝 {{ bet.chosen_fighter.losses }}敗 
                    ({{ bet.chosen_fighter.win_rate }}%)
                  </span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">戰鬥ID:</span>
                  <span class="detail-value">{{ bet.battle }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 空狀態 -->
        <div class="empty-bets" *ngIf="filteredBets.length === 0 && !loading">
          <div class="empty-icon">🎲</div>
          <h3>{{ getEmptyMessage() }}</h3>
          <p>{{ getEmptySubMessage() }}</p>
          <button class="go-arena-btn" (click)="goToArena()">前往競技場</button>
        </div>
      </div>

      <!-- 載入更多 -->
      <div class="load-more-section" *ngIf="bets.length >= 20">
        <button class="load-more-btn" (click)="loadMore()" [disabled]="loading">
          {{ loading ? '載入中...' : '載入更多' }}
        </button>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入下注記錄中...</p>
      </div>

      <!-- 返回按鈕 -->
      <div class="back-nav">
        <button class="back-btn" (click)="goBack()">
          <span>← 返回競技場</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./my-bets.component.scss']
})
export class MyBetsComponent implements OnInit, OnDestroy {
  bets: BattleBet[] = [];
  stats: BettingStats | null = null;
  currentFilter: 'all' | 'pending' | 'won' | 'lost' = 'all';
  expandedBets = new Set<string>();
  loading: boolean = true;
  
  coinParticles = Array.from({ length: 12 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2
  }));
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    public bettingService: BettingService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadData();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private loadData(): void {
    this.loading = true;
    
    // 載入下注記錄
    this.bettingService.getMyBets().subscribe({
      next: (response) => {
        this.bets = response.bets;
        this.loading = false;
      },
      error: (error) => {
        console.error('載入下注記錄失敗:', error);
        this.loading = false;
      }
    });
    
    // 載入統計數據
    this.bettingService.getBettingStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('載入統計數據失敗:', error);
      }
    });
  }
  
  get filteredBets(): BattleBet[] {
    switch (this.currentFilter) {
      case 'pending':
        return this.bets.filter(bet => bet.is_winner === null);
      case 'won':
        return this.bets.filter(bet => bet.is_winner === true);
      case 'lost':
        return this.bets.filter(bet => bet.is_winner === false);
      default:
        return this.bets;
    }
  }
  
  setFilter(filter: 'all' | 'pending' | 'won' | 'lost'): void {
    this.currentFilter = filter;
  }
  
  toggleDetails(bet: BattleBet): void {
    if (this.expandedBets.has(bet.id)) {
      this.expandedBets.delete(bet.id);
    } else {
      this.expandedBets.add(bet.id);
    }
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) {
      return '剛剛';
    } else if (minutes < 60) {
      return `${minutes}分鐘前`;
    } else if (hours < 24) {
      return `${hours}小時前`;
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
  
  getEmptyMessage(): string {
    switch (this.currentFilter) {
      case 'pending':
        return '沒有進行中的下注';
      case 'won':
        return '還沒有獲勝記錄';
      case 'lost':
        return '沒有失敗記錄';
      default:
        return '還沒有下注記錄';
    }
  }
  
  getEmptySubMessage(): string {
    switch (this.currentFilter) {
      case 'pending':
        return '所有下注都已結算完成';
      case 'won':
        return '快去競技場下注，爭取第一次勝利！';
      case 'lost':
        return '恭喜！您還沒有失敗的下注';
      default:
        return '前往競技場開始您的第一次下注吧！';
    }
  }
  
  loadMore(): void {
    this.loading = true;
    // 實現載入更多功能
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  }
  
  goToArena(): void {
    this.router.navigate(['/arena']);
  }
  
  goBack(): void {
    this.router.navigate(['/arena']);
  }
}
