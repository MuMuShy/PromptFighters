import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BettingService } from '../../services/betting.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

interface BattleHistory {
  id: string;
  scheduled_time: string;
  status: string;
  fighter1: {
    name: string;
    image_url: string;
    rank: number;
    player_name: string;
  };
  fighter2: {
    name: string;
    image_url: string;
    rank: number;
    player_name: string;
  };
  winner: {
    name: string;
    is_fighter1: boolean;
  } | null;
  total_bets_amount: number;
  total_bets_count: number;
}

@Component({
  selector: 'app-battle-history',
  standalone: true,
  imports: [CommonModule, MediaUrlPipe],
  template: `
    <div class="battle-history-page">
      <!-- 簡潔背景 -->
      <div class="history-background"></div>

      <!-- 頁面標題 -->
      <div class="history-header">
        <h1 class="history-title">📚 歷史對戰</h1>
        <p class="history-subtitle">回顧精彩的天梯戰鬥記錄</p>
      </div>

      <!-- 戰鬥歷史列表 -->
      <div class="battles-list" *ngIf="battleHistory.length > 0">
        <div class="battle-history-card" 
             *ngFor="let battle of battleHistory; let i = index"
             [class.recent]="i < 3"
             (click)="viewBattleDetails(battle)">
          
          <!-- 戰鬥時間和狀態 -->
          <div class="battle-time-info">
            <div class="battle-date">{{ formatBattleDate(battle.scheduled_time) }}</div>
            <div class="battle-status completed">已完成</div>
          </div>

          <!-- 對戰雙方 -->
          <div class="fighters-matchup">
            <!-- 左側選手 -->
            <div class="fighter-section" [class.winner]="battle.winner?.is_fighter1">
              <div class="fighter-avatar">
                <img [src]="battle.fighter1.image_url | mediaUrl" 
                     [alt]="battle.fighter1.name">
                <div class="rank-badge">#{{ battle.fighter1.rank }}</div>
                <div class="winner-crown" *ngIf="battle.winner?.is_fighter1">👑</div>
              </div>
              
              <div class="fighter-info">
                <h3 class="fighter-name">{{ battle.fighter1.name }}</h3>
                <div class="fighter-owner">{{ battle.fighter1.player_name }}</div>
              </div>
            </div>

            <!-- 中央VS區域 -->
            <div class="vs-section">
              <div class="vs-icon">VS</div>
              <div class="battle-stats">
                <div class="stat-item">
                  <span class="stat-icon">💰</span>
                  <span class="stat-value">{{ bettingService.formatAmount(battle.total_bets_amount) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-icon">🎯</span>
                  <span class="stat-value">{{ battle.total_bets_count }}注</span>
                </div>
              </div>
            </div>

            <!-- 右側選手 -->
            <div class="fighter-section" [class.winner]="battle.winner && !battle.winner.is_fighter1">
              <div class="fighter-avatar">
                <img [src]="battle.fighter2.image_url | mediaUrl" 
                     [alt]="battle.fighter2.name">
                <div class="rank-badge">#{{ battle.fighter2.rank }}</div>
                <div class="winner-crown" *ngIf="battle.winner && !battle.winner.is_fighter1">👑</div>
              </div>
              
              <div class="fighter-info">
                <h3 class="fighter-name">{{ battle.fighter2.name }}</h3>
                <div class="fighter-owner">{{ battle.fighter2.player_name }}</div>
              </div>
            </div>
          </div>

          <!-- 戰鬥結果 -->
          <div class="battle-result" *ngIf="battle.winner">
            <div class="result-text">
              🏆 {{ battle.winner.name }} 獲得勝利！
            </div>
          </div>

          <!-- 查看詳情按鈕 -->
          <div class="view-details">
            <span class="details-text">點擊查看詳情 →</span>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div class="empty-history" *ngIf="battleHistory.length === 0 && !loading">
        <div class="empty-icon">📜</div>
        <h2>暫無歷史記錄</h2>
        <p>還沒有完成的戰鬥記錄</p>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入歷史記錄...</p>
      </div>

      <!-- 返回按鈕 -->
      <div class="back-nav">
        <button class="back-btn" (click)="goBack()">
          <span>← 返回競技場</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./battle-history.component.scss']
})
export class BattleHistoryComponent implements OnInit {
  battleHistory: BattleHistory[] = [];
  loading: boolean = true;
  
  scrollParticles = Array.from({ length: 15 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 3
  }));

  constructor(
    public bettingService: BettingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBattleHistory();
  }

  loadBattleHistory(): void {
    this.loading = true;
    this.bettingService.getBattleHistory().subscribe({
      next: (response) => {
        this.battleHistory = response.battles;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load battle history:', error);
        this.loading = false;
      }
    });
  }

  formatBattleDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-TW', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      });
    }
  }

  viewBattleDetails(battle: BattleHistory): void {
    // 導航到戰鬥詳情頁面
    this.router.navigate(['/battle-details', battle.id]);
  }

  goBack(): void {
    this.router.navigate(['/arena']);
  }
}
