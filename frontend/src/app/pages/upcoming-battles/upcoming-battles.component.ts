import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { BettingService, ScheduledBattle } from '../../services/betting.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-upcoming-battles',
  standalone: true,
  imports: [CommonModule, MediaUrlPipe],
  template: `
    <div class="upcoming-battles-page">
      <!-- 背景效果 -->
      <div class="battles-background">
        <div class="sword-particles">
          <div class="sword-particle" *ngFor="let p of swordParticles" 
               [style.left.%]="p.x" 
               [style.top.%]="p.y"
               [style.animation-delay.s]="p.delay">⚔️</div>
        </div>
      </div>

      <!-- 頁面標題 -->
      <div class="battles-header">
        <h1 class="battles-title">📅 即將開戰</h1>
        <p class="battles-subtitle">預覽未來的精彩對戰</p>
      </div>

      <!-- 戰鬥時間軸 -->
      <div class="battles-timeline" *ngIf="upcomingBattles.length > 0">
        <div class="timeline-item" 
             *ngFor="let battle of upcomingBattles; let i = index"
             [class.next-battle]="i === 0"
             [class.betting-open]="battle.status === 'betting_open'"
             [class.betting-closed]="battle.status === 'betting_closed'">
          
          <!-- 時間線節點 -->
          <div class="timeline-node">
            <div class="node-icon">
              {{ getStatusIcon(battle.status) }}
            </div>
            <div class="timeline-line" *ngIf="i < upcomingBattles.length - 1"></div>
          </div>

          <!-- 戰鬥卡片 -->
          <div class="battle-card">
            <!-- 戰鬥狀態和時間 -->
            <div class="battle-header">
              <div class="battle-status" [ngClass]="battle.status">
                {{ getStatusText(battle.status) }}
              </div>
              
              <div class="battle-time">
                <div class="scheduled-time">
                  {{ formatBattleTime(battle.scheduled_time) }}
                </div>
                <div class="countdown" *ngIf="getTimeRemaining(battle.scheduled_time).total > 0">
                  {{ formatCountdown(getTimeRemaining(battle.scheduled_time)) }}
                </div>
              </div>
            </div>

            <!-- 對戰雙方 -->
            <div class="fighters-matchup">
              <!-- 左側選手 -->
              <div class="fighter-section left">
                <div class="fighter-avatar">
                  <img [src]="battle.fighter1.character.image_url | mediaUrl" 
                       [alt]="battle.fighter1.character.name">
                  <div class="rank-badge">#{{ battle.fighter1.current_rank }}</div>
                  <div class="rarity-indicator" 
                       [style.background-color]="bettingService.getRarityColor(battle.fighter1.character.rarity)">
                    {{ bettingService.getRarityLabel(battle.fighter1.character.rarity) }}
                  </div>
                </div>
                
                <div class="fighter-info">
                  <h3 class="fighter-name">{{ battle.fighter1.character.name }}</h3>
                  <div class="fighter-owner">{{ getPlayerName(battle.fighter1.player) }}</div>
                  <div class="fighter-level">Lv.{{ battle.fighter1.character.level }}</div>
                  
                  <div class="fighter-stats">
                    <div class="stat">
                      <span class="stat-icon">💪</span>
                      <span class="stat-value">{{ battle.fighter1.character.strength }}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-icon">⚡</span>
                      <span class="stat-value">{{ battle.fighter1.character.agility }}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-icon">🍀</span>
                      <span class="stat-value">{{ battle.fighter1.character.luck }}</span>
                    </div>
                  </div>
                  
                  <div class="fighter-record">
                    {{ battle.fighter1.wins }}勝 {{ battle.fighter1.losses }}敗 
                    ({{ battle.fighter1.win_rate }}%)
                  </div>
                </div>

                <!-- 下注信息 -->
                <div class="betting-info" *ngIf="battle.status === 'betting_open' || battle.total_bets_amount > 0">
                  <div class="odds">{{ battle.fighter1_odds }}x</div>
                  <div class="bet-amount">
                    {{ bettingService.formatAmount(battle.fighter1_bets_amount) }}
                  </div>
                  <div class="bet-percentage" *ngIf="battle.total_bets_amount > 0">
                    {{ getBetPercentage(battle.fighter1_bets_amount, battle.total_bets_amount) }}%
                  </div>
                </div>
              </div>

              <!-- 中央VS區域 -->
              <div class="vs-section">
                <div class="vs-icon">VS</div>
                
                <div class="battle-info">
                  <div class="total-pool" *ngIf="battle.total_bets_amount > 0">
                    <div class="pool-label">總獎池</div>
                    <div class="pool-amount">
                      {{ bettingService.formatAmount(battle.total_bets_amount) }}
                    </div>
                  </div>
                  
                  <div class="betting-countdown" *ngIf="battle.status === 'betting_open'">
                    <div class="countdown-label">下注截止</div>
                    <div class="countdown-time">
                      {{ formatCountdown(getTimeRemaining(battle.betting_end_time)) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右側選手 -->
              <div class="fighter-section right">
                <div class="fighter-avatar">
                  <img [src]="battle.fighter2.character.image_url | mediaUrl" 
                       [alt]="battle.fighter2.character.name">
                  <div class="rank-badge">#{{ battle.fighter2.current_rank }}</div>
                  <div class="rarity-indicator" 
                       [style.background-color]="bettingService.getRarityColor(battle.fighter2.character.rarity)">
                    {{ bettingService.getRarityLabel(battle.fighter2.character.rarity) }}
                  </div>
                </div>
                
                <div class="fighter-info">
                  <h3 class="fighter-name">{{ battle.fighter2.character.name }}</h3>
                  <div class="fighter-owner">{{ getPlayerName(battle.fighter2.player) }}</div>
                  <div class="fighter-level">Lv.{{ battle.fighter2.character.level }}</div>
                  
                  <div class="fighter-stats">
                    <div class="stat">
                      <span class="stat-icon">💪</span>
                      <span class="stat-value">{{ battle.fighter2.character.strength }}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-icon">⚡</span>
                      <span class="stat-value">{{ battle.fighter2.character.agility }}</span>
                    </div>
                    <div class="stat">
                      <span class="stat-icon">🍀</span>
                      <span class="stat-value">{{ battle.fighter2.character.luck }}</span>
                    </div>
                  </div>
                  
                  <div class="fighter-record">
                    {{ battle.fighter2.wins }}勝 {{ battle.fighter2.losses }}敗 
                    ({{ battle.fighter2.win_rate }}%)
                  </div>
                </div>

                <!-- 下注信息 -->
                <div class="betting-info" *ngIf="battle.status === 'betting_open' || battle.total_bets_amount > 0">
                  <div class="odds">{{ battle.fighter2_odds }}x</div>
                  <div class="bet-amount">
                    {{ bettingService.formatAmount(battle.fighter2_bets_amount) }}
                  </div>
                  <div class="bet-percentage" *ngIf="battle.total_bets_amount > 0">
                    {{ getBetPercentage(battle.fighter2_bets_amount, battle.total_bets_amount) }}%
                  </div>
                </div>
              </div>
            </div>

            <!-- 戰鬥操作 -->
            <div class="battle-actions">
              <button class="action-btn watch" 
                      *ngIf="battle.status === 'betting_open'"
                      (click)="goToBetting(battle)">
                <span class="btn-icon">🎯</span>
                <span class="btn-text">立即下注</span>
              </button>
              
              <button class="action-btn details" 
                      (click)="viewBattleDetails(battle)">
                <span class="btn-icon">📊</span>
                <span class="btn-text">詳細資訊</span>
              </button>
              
              <button class="action-btn notify" 
                      (click)="toggleNotification(battle)"
                      [class.active]="isNotificationEnabled(battle.id)">
                <span class="btn-icon">{{ isNotificationEnabled(battle.id) ? '🔔' : '🔕' }}</span>
                <span class="btn-text">{{ isNotificationEnabled(battle.id) ? '已提醒' : '提醒我' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div class="empty-battles" *ngIf="upcomingBattles.length === 0 && !loading">
        <div class="empty-icon">⚔️</div>
        <h2>暫無即將開始的戰鬥</h2>
        <p>系統將在每小時55分自動排程下一場戰鬥</p>
        <button class="refresh-btn" (click)="refreshData()">刷新</button>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入戰鬥時間表...</p>
      </div>

      <!-- 返回按鈕 -->
      <div class="back-nav">
        <button class="back-btn" (click)="goBack()">
          <span>← 返回競技場</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./upcoming-battles.component.scss']
})
export class UpcomingBattlesComponent implements OnInit, OnDestroy {
  upcomingBattles: ScheduledBattle[] = [];
  loading: boolean = true;
  notificationBattles = new Set<string>();
  
  swordParticles = Array.from({ length: 10 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 3
  }));
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    public bettingService: BettingService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadUpcomingBattles();
    this.startAutoRefresh();
    this.loadNotificationSettings();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private loadUpcomingBattles(): void {
    this.loading = true;
    this.bettingService.getUpcomingBattles().subscribe({
      next: (response) => {
        this.upcomingBattles = response.battles;
        this.loading = false;
      },
      error: (error) => {
        console.error('載入即將開始的戰鬥失敗:', error);
        this.loading = false;
      }
    });
  }
  
  private startAutoRefresh(): void {
    // 每30秒自動刷新
    const refreshSub = interval(30000).subscribe(() => {
      this.loadUpcomingBattles();
    });
    this.subscriptions.push(refreshSub);
  }
  
  private loadNotificationSettings(): void {
    const saved = localStorage.getItem('battle-notifications');
    if (saved) {
      this.notificationBattles = new Set(JSON.parse(saved));
    }
  }
  
  private saveNotificationSettings(): void {
    localStorage.setItem('battle-notifications', JSON.stringify([...this.notificationBattles]));
  }
  
  getStatusText(status: string): string {
    const statusMap = {
      'scheduled': '已排程',
      'betting_open': '下注進行中',
      'betting_closed': '下注已截止',
      'in_progress': '戰鬥中',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  }
  
  getStatusIcon(status: string): string {
    const iconMap = {
      'scheduled': '📅',
      'betting_open': '🎯',
      'betting_closed': '⏰',
      'in_progress': '⚔️',
      'completed': '🏆',
      'cancelled': '❌'
    };
    return iconMap[status as keyof typeof iconMap] || '📅';
  }
  
  getPlayerName(player: any): string {
    return player.nickname || player.user.username;
  }
  
  getTimeRemaining(targetTime: string): { 
    hours: number; 
    minutes: number; 
    seconds: number; 
    total: number;
  } {
    return this.bettingService.getTimeRemaining(targetTime);
  }
  
  formatBattleTime(timeString: string): string {
    const date = new Date(timeString);
    return date.toLocaleString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  formatCountdown(timeRemaining: any): string {
    if (timeRemaining.total <= 0) {
      return '已開始';
    }
    
    if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}小時${timeRemaining.minutes}分`;
    } else if (timeRemaining.minutes > 0) {
      return `${timeRemaining.minutes}分${timeRemaining.seconds}秒`;
    } else {
      return `${timeRemaining.seconds}秒`;
    }
  }
  
  getBetPercentage(amount: number, total: number): number {
    return total > 0 ? Math.round((amount / total) * 100) : 0;
  }
  
  isNotificationEnabled(battleId: string): boolean {
    return this.notificationBattles.has(battleId);
  }
  
  toggleNotification(battle: ScheduledBattle): void {
    if (this.notificationBattles.has(battle.id)) {
      this.notificationBattles.delete(battle.id);
    } else {
      this.notificationBattles.add(battle.id);
      
      // 設置瀏覽器通知（如果支持）
      if ('Notification' in window && Notification.permission === 'granted') {
        const timeUntilBattle = new Date(battle.scheduled_time).getTime() - new Date().getTime();
        if (timeUntilBattle > 0) {
          setTimeout(() => {
            new Notification('戰鬥即將開始！', {
              body: `${battle.fighter1.character.name} vs ${battle.fighter2.character.name}`,
              icon: '/assets/icon.png'
            });
          }, Math.max(0, timeUntilBattle - 60000)); // 提前1分鐘通知
        }
      }
    }
    
    this.saveNotificationSettings();
  }
  
  viewBattleDetails(battle: ScheduledBattle): void {
    // 導航到戰鬥詳情頁面
    this.router.navigate(['/battle-details', battle.id]);
  }
  
  goToBetting(battle: ScheduledBattle): void {
    // 導航到 Arena 頁面並傳遞戰鬥ID作為查詢參數
    this.router.navigate(['/arena'], { 
      queryParams: { battleId: battle.id }
    });
  }
  
  refreshData(): void {
    this.loadUpcomingBattles();
  }
  
  goBack(): void {
    this.router.navigate(['/arena']);
  }
}
