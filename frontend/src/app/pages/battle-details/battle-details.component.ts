import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BettingService } from '../../services/betting.service';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

interface BattleDetails {
  id: string;
  scheduled_time: string;
  status: string;
  fighter1: any;
  fighter2: any;
  winner?: any;
  total_bets_amount: number;
  fighter1_bets_amount: number;
  fighter2_bets_amount: number;
  fighter1_odds: number;
  fighter2_odds: number;
  battle_log?: any;
  betting_stats?: any;
  recent_bets?: any[];
  user_bet?: any;
}

@Component({
  selector: 'app-battle-details',
  standalone: true,
  imports: [CommonModule, MediaUrlPipe],
  template: `
    <div class="battle-details-page">
      <!-- 簡潔背景 -->
      <div class="details-background"></div>

      <!-- 頁面標題 -->
      <div class="details-header" *ngIf="battleDetails">
        <h1 class="details-title">⚔️ 戰鬥詳情</h1>
        <div class="battle-date">
          {{ formatBattleDate(battleDetails.scheduled_time) }}
        </div>
      </div>

      <!-- 戰鬥概覽 -->
      <div class="battle-overview" *ngIf="battleDetails">
        <div class="fighters-showcase">
          <!-- 左側選手 -->
          <div class="fighter-showcase left" [class.winner]="battleDetails?.winner?.id === battleDetails?.fighter1?.id">
            <div class="fighter-avatar">
              <img [src]="battleDetails?.fighter1?.character?.image_url | mediaUrl" 
                   [alt]="battleDetails?.fighter1?.character?.name">
              <div class="rank-badge">#{{ battleDetails?.fighter1?.current_rank }}</div>
              <div class="winner-crown" *ngIf="battleDetails?.winner?.id === battleDetails?.fighter1?.id">👑</div>
            </div>
            
            <div class="fighter-info">
              <h2 class="fighter-name">{{ battleDetails?.fighter1?.character?.name }}</h2>
              <div class="fighter-owner">{{ getPlayerName(battleDetails?.fighter1?.player) }}</div>
              <div class="fighter-level">Lv.{{ battleDetails?.fighter1?.character?.level }}</div>
              
              <div class="fighter-stats">
                <div class="stat">
                  <span class="stat-icon">💪</span>
                  <span class="stat-value">{{ battleDetails?.fighter1?.character?.strength }}</span>
                  <span class="stat-label">力量</span>
                </div>
                <div class="stat">
                  <span class="stat-icon">⚡</span>
                  <span class="stat-value">{{ battleDetails?.fighter1?.character?.agility }}</span>
                  <span class="stat-label">敏捷</span>
                </div>
                <div class="stat">
                  <span class="stat-icon">🍀</span>
                  <span class="stat-value">{{ battleDetails?.fighter1?.character?.luck }}</span>
                  <span class="stat-label">幸運</span>
                </div>
              </div>
              
              <div class="fighter-record">
                {{ battleDetails?.fighter1?.wins }}勝 {{ battleDetails?.fighter1?.losses }}敗 
                ({{ battleDetails?.fighter1?.win_rate }}%)
              </div>
            </div>

            <!-- 下注統計 -->
            <div class="betting-stats">
              <div class="odds">{{ battleDetails?.fighter1_odds }}x</div>
              <div class="bet-amount">
                {{ bettingService.formatAmount(battleDetails?.fighter1_bets_amount || 0) }} 金幣
              </div>
              <div class="bet-percentage">
                {{ getBetPercentage(battleDetails?.fighter1_bets_amount || 0, battleDetails?.total_bets_amount || 0) }}%
              </div>
            </div>
          </div>

          <!-- 中央VS區域 -->
          <div class="vs-showcase">
            <div class="vs-icon">VS</div>
            <div class="battle-result" *ngIf="battleDetails?.winner">
              <div class="result-icon">🏆</div>
              <div class="result-text">
                {{ battleDetails?.winner?.character?.name }} 獲勝！
              </div>
            </div>
            <div class="total-pool">
              <div class="pool-label">總獎池</div>
              <div class="pool-amount">
                {{ bettingService.formatAmount(battleDetails?.total_bets_amount || 0) }} 金幣
              </div>
            </div>
          </div>

          <!-- 右側選手 -->
          <div class="fighter-showcase right" [class.winner]="battleDetails?.winner?.id === battleDetails?.fighter2?.id">
            <div class="fighter-avatar">
              <img [src]="battleDetails?.fighter2?.character?.image_url | mediaUrl" 
                   [alt]="battleDetails?.fighter2?.character?.name">
              <div class="rank-badge">#{{ battleDetails?.fighter2?.current_rank }}</div>
              <div class="winner-crown" *ngIf="battleDetails?.winner?.id === battleDetails?.fighter2?.id">👑</div>
            </div>
            
            <div class="fighter-info">
              <h2 class="fighter-name">{{ battleDetails?.fighter2?.character?.name }}</h2>
              <div class="fighter-owner">{{ getPlayerName(battleDetails?.fighter2?.player) }}</div>
              <div class="fighter-level">Lv.{{ battleDetails?.fighter2?.character?.level }}</div>
              
              <div class="fighter-stats">
                <div class="stat">
                  <span class="stat-icon">💪</span>
                  <span class="stat-value">{{ battleDetails?.fighter2?.character?.strength }}</span>
                  <span class="stat-label">力量</span>
                </div>
                <div class="stat">
                  <span class="stat-icon">⚡</span>
                  <span class="stat-value">{{ battleDetails?.fighter2?.character?.agility }}</span>
                  <span class="stat-label">敏捷</span>
                </div>
                <div class="stat">
                  <span class="stat-icon">🍀</span>
                  <span class="stat-value">{{ battleDetails?.fighter2?.character?.luck }}</span>
                  <span class="stat-label">幸運</span>
                </div>
              </div>
              
              <div class="fighter-record">
                {{ battleDetails?.fighter2?.wins }}勝 {{ battleDetails?.fighter2?.losses }}敗 
                ({{ battleDetails?.fighter2?.win_rate }}%)
              </div>
            </div>

            <!-- 下注統計 -->
            <div class="betting-stats">
              <div class="odds">{{ battleDetails?.fighter2_odds }}x</div>
              <div class="bet-amount">
                {{ bettingService.formatAmount(battleDetails?.fighter2_bets_amount || 0) }} 金幣
              </div>
              <div class="bet-percentage">
                {{ getBetPercentage(battleDetails?.fighter2_bets_amount || 0, battleDetails?.total_bets_amount || 0) }}%
              </div>
            </div>
          </div>
        </div>
      </div>



      <!-- 戰鬥過程 -->
      <div class="battle-process" *ngIf="battleDetails?.battle_log?.battle_log">
        <div class="section-header">
          <h2>🎬 戰鬥過程</h2>
          <div class="battle-location" *ngIf="battleDetails?.battle_log?.battle_description">
            {{ getBattleLocation(battleDetails?.battle_log?.battle_description || '') }}
          </div>
        </div>

        <div class="battle-timeline">
          <div class="timeline-item" 
               *ngFor="let log of battleDetails?.battle_log?.battle_log || []; let i = index"
               [class.critical]="log.damage > 30"
               [class.final]="i === (battleDetails?.battle_log?.battle_log?.length || 0) - 1"
               [class.attacker-left]="isAttackerLeft(log.attacker)"
               [class.attacker-right]="!isAttackerLeft(log.attacker)">
            
            <!-- 回合標記 -->
            <div class="timeline-marker">
              <div class="round-badge">
                <span class="round-number">{{ i + 1 }}</span>
                <span class="round-label">回合</span>
              </div>
            </div>
            
            <!-- 戰鬥內容卡片 -->
            <div class="battle-card">
              <!-- 攻擊者頭像 -->
              <div class="attacker-avatar">
                <img [src]="getCharacterAvatar(log.attacker) | mediaUrl" 
                     [alt]="log.attacker"
                     class="character-avatar">
                <div class="character-name">{{ log.attacker }}</div>
              </div>
              
              <!-- 攻擊箭頭和動作 -->
              <div class="attack-action">
                <div class="action-arrow">⚔️</div>
                <div class="action-name">{{ log.action }}</div>
              </div>
              
              <!-- 防守者頭像 -->
              <div class="defender-avatar">
                <img [src]="getCharacterAvatar(log.defender) | mediaUrl" 
                     [alt]="log.defender"
                     class="character-avatar">
                <div class="character-name">{{ log.defender }}</div>
              </div>
              
              <!-- 戰鬥描述 -->
              <div class="battle-description">
                <p>{{ log.description }}</p>
              </div>
              
              <!-- 傷害和血量信息 -->
              <div class="damage-result">
                <div class="damage-dealt" [class.critical-damage]="log.damage > 30">
                  <span class="damage-icon">💥</span>
                  <span class="damage-number">{{ log.damage }}</span>
                  <span class="damage-label">傷害</span>
                </div>
                <div class="hp-remaining" [class.low-hp]="log.remaining_hp < 30">
                  <span class="hp-icon">❤️</span>
                  <span class="hp-number">{{ log.remaining_hp }}</span>
                  <span class="hp-label">HP</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="battle-conclusion" *ngIf="battleDetails?.battle_log?.battle_description">
          <div class="conclusion-icon">🎭</div>
          <div class="conclusion-text">
            {{ battleDetails?.battle_log?.battle_description }}
          </div>
        </div>
      </div>

      <!-- 戰鬥未完成提示 -->
      <div class="battle-pending" *ngIf="battleDetails && !battleDetails?.battle_log?.battle_log" style="text-align: center; padding: 40px; background: #fff3cd; border-radius: 10px; margin: 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
        <h3>戰鬥進行中</h3>
        <p>戰鬥還在進行中，詳細戰鬥過程將在戰鬥結束後顯示。</p>
        <p><strong>當前狀態:</strong> {{ battleDetails?.status }}</p>
        <button class="retry-btn" (click)="loadBattleDetails()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
          刷新戰鬥狀態
        </button>
      </div>

      <!-- 下注統計 -->
      <div class="betting-section" *ngIf="battleDetails?.betting_stats">
        <div class="section-header">
          <h2>📊 下注統計</h2>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">{{ battleDetails?.betting_stats?.total_bets || 0 }}</div>
            <div class="stat-label">總下注數</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-value">{{ bettingService.formatAmount(battleDetails?.total_bets_amount || 0) }}</div>
            <div class="stat-label">總獎池</div>
          </div>
          
          <div class="stat-card fighter1">
            <div class="stat-icon">👤</div>
            <div class="stat-value">{{ battleDetails?.betting_stats?.fighter1_bets_count || 0 }}</div>
            <div class="stat-label">{{ battleDetails?.fighter1?.character?.name || '選手1' }} 支持者</div>
          </div>
          
          <div class="stat-card fighter2">
            <div class="stat-icon">👤</div>
            <div class="stat-value">{{ battleDetails?.betting_stats?.fighter2_bets_count || 0 }}</div>
            <div class="stat-label">{{ battleDetails?.fighter2?.character?.name || '選手2' }} 支持者</div>
          </div>
        </div>
      </div>

      <!-- 最近下注 -->
      <div class="recent-bets-section" *ngIf="battleDetails?.recent_bets?.length">
        <div class="section-header">
          <h2>🎲 最近下注</h2>
        </div>

        <div class="bets-list">
          <div class="bet-item" *ngFor="let bet of battleDetails?.recent_bets || []">
            <div class="bet-user">{{ bet.username }}</div>
            <div class="bet-choice">
              支持 {{ getFighterName(bet.chosen_fighter) }}
            </div>
            <div class="bet-amount">{{ bet.amount }} 金幣</div>
            <div class="bet-time">{{ formatDate(bet.created_at) }}</div>
          </div>
        </div>
      </div>

      <!-- 用戶下注 -->
      <div class="user-bet-section" *ngIf="battleDetails?.user_bet">
        <div class="section-header">
          <h2>🎯 您的下注</h2>
        </div>

        <div class="user-bet-card">
          <div class="bet-details">
            <div class="chosen-fighter">
              <img [src]="battleDetails?.user_bet?.chosen_fighter?.character?.image_url | mediaUrl" 
                   [alt]="battleDetails?.user_bet?.chosen_fighter?.character?.name">
              <span>{{ battleDetails?.user_bet?.chosen_fighter?.character?.name }}</span>
            </div>
            <div class="bet-amount">{{ battleDetails?.user_bet?.bet_amount }} 金幣</div>
            <div class="bet-odds">{{ battleDetails?.user_bet?.odds_at_bet }}x</div>
            <div class="potential-payout">
              潛在獲利: {{ battleDetails?.user_bet?.potential_payout }} 金幣
            </div>
          </div>
          
          <div class="bet-result" *ngIf="battleDetails?.status === 'completed'">
            <div class="result-status" [class.won]="battleDetails?.user_bet?.is_winner" [class.lost]="!battleDetails?.user_bet?.is_winner">
              {{ battleDetails?.user_bet?.is_winner ? '🎉 獲勝' : '😞 失敗' }}
            </div>
            <div class="payout-amount" *ngIf="battleDetails?.user_bet?.is_winner">
              +{{ battleDetails?.user_bet?.payout_amount }} 金幣
            </div>
          </div>
        </div>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入戰鬥詳情...</p>
      </div>

      <!-- 錯誤狀態 -->
      <div class="error-section" *ngIf="error">
        <div class="error-icon">❌</div>
        <h2>載入失敗</h2>
        <p>{{ error }}</p>
        <button class="retry-btn" (click)="loadBattleDetails()">重試</button>
      </div>

      <!-- 返回按鈕 -->
      <div class="back-nav">
        <button class="back-btn" (click)="goBack()">
          <span>← 返回</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./battle-details.component.scss']
})
export class BattleDetailsComponent implements OnInit {
  battleDetails: BattleDetails | null = null;
  loading: boolean = true;
  error: string = '';
  battleId: string = '';
  
  battleParticles = Array.from({ length: 10 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2
  }));

  constructor(
    public bettingService: BettingService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.battleId = this.route.snapshot.params['id'];
    if (this.battleId) {
      this.loadBattleDetails();
    } else {
      this.error = '無效的戰鬥ID';
      this.loading = false;
    }
  }

  loadBattleDetails(): void {
    this.loading = true;
    this.error = '';
    
    this.bettingService.getBattleDetails(this.battleId).subscribe({
      next: (response) => {
        this.battleDetails = response;
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load battle details:', error);
        this.error = '載入戰鬥詳情失敗';
        this.loading = false;
      }
    });
  }

  formatBattleDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) {
      return '剛剛';
    } else if (minutes < 60) {
      return `${minutes}分鐘前`;
    } else {
      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return `${hours}小時前`;
      } else {
        return date.toLocaleDateString('zh-TW');
      }
    }
  }

  getBetPercentage(amount: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((amount / total) * 100);
  }

  getPlayerName(player: any): string {
    return player?.nickname || player?.user?.username || '未知玩家';
  }

  getBattleLocation(description: string): string {
    // 嘗試從戰鬥描述中提取地點信息
    const locationMatch = description.match(/在(.+?)中|在(.+?)上|在(.+?)裡/);
    return locationMatch ? locationMatch[1] || locationMatch[2] || locationMatch[3] : '神秘戰場';
  }

  getFighterName(fighterId: string): string {
    if (!this.battleDetails) return '';
    
    if (fighterId === this.battleDetails?.fighter1?.id) {
      return this.battleDetails?.fighter1?.character?.name || '未知選手';
    } else if (fighterId === this.battleDetails?.fighter2?.id) {
      return this.battleDetails?.fighter2?.character?.name || '未知選手';
    }
    return '未知選手';
  }

  isAttackerLeft(attackerName: string): boolean {
    // 判斷攻擊者是否是左側選手
    return this.battleDetails?.fighter1?.character?.name === attackerName;
  }

  getCharacterAvatar(characterName: string): string {
    // 根據角色名稱獲取頭像
    if (this.battleDetails?.fighter1?.character?.name === characterName) {
      return this.battleDetails.fighter1.character.image_url;
    } else if (this.battleDetails?.fighter2?.character?.name === characterName) {
      return this.battleDetails.fighter2.character.image_url;
    }
    return '/assets/game/default-avatar.png'; // 預設頭像
  }

  goBack(): void {
    window.history.back();
  }
}
