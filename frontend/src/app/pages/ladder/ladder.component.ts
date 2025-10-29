import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BettingService, LadderRank } from '../../services/betting.service';
import { CharacterService } from '../../services/character.service';
import { Character } from '../../interfaces/character.interface';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-ladder',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaUrlPipe],
  template: `
    <div class="ladder-page">
      <!-- 背景效果 -->
      <div class="ladder-background">
        <div class="trophy-particles">
          <div class="trophy-particle" *ngFor="let p of trophyParticles" 
               [style.left.%]="p.x" 
               [style.top.%]="p.y"
               [style.animation-delay.s]="p.delay">🏆</div>
        </div>
      </div>

      <!-- 頁面標題 -->
      <div class="ladder-header">
        <p class="ladder-subtitle">爭奪榮耀 • 角逐王座 • 證明實力</p>
        
        <div class="season-info" *ngIf="seasonInfo">
          <div class="season-name">{{ seasonInfo.name }}</div>
          <div class="prize-pool">獎金池: {{ bettingService.formatAmount(seasonInfo.prize_pool) }} 金幣</div>
        </div>
      </div>

      <!-- 加入天梯按鈕 -->
      <div class="join-section" *ngIf="!hasJoinedLadder && eligibleCharacters.length > 0">
        <div class="join-card">
          <h2>加入天梯競技</h2>
          <p>選擇一個角色參加天梯賽（無等級限制）</p>
          
          <div class="character-selection">
            <div class="character-option" 
                 *ngFor="let char of eligibleCharacters"
                 [class.selected]="selectedCharacter?.id === char.id"
                 (click)="selectCharacter(char)">
              <img [src]="char.image_url | mediaUrl" [alt]="char.name">
              <div class="char-info">
                <div class="char-name">{{ char.name }}</div>
                <div class="char-level">Lv.{{ char.level }}</div>
                <div class="char-stats">
                  💪{{ char.strength }} ⚡{{ char.agility }} 🍀{{ char.luck }}
                </div>
              </div>
            </div>
          </div>
          
          <button class="join-btn" 
                  [disabled]="!selectedCharacter || joining"
                  (click)="joinLadder()">
            {{ joining ? '加入中...' : '加入天梯' }}
          </button>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="rankings-section">
        <div class="rankings-header">
          <h2>當前排名</h2>
          <div class="ranking-stats">
            <span>總參賽者: {{ rankings.length }}</span>
            <span>活躍選手: {{ activeRankings.length }}</span>
          </div>
        </div>

        <!-- 前三名特殊顯示 -->
        <div class="top-three" *ngIf="rankings.length >= 3">
          <div class="podium">
            <!-- 第二名 -->
            <div class="podium-place second" *ngIf="rankings[1]">
              <div class="rank-medal silver">🥈</div>
              <div class="fighter-card">
                <img [src]="rankings[1].character.image_url | mediaUrl" 
                     [alt]="rankings[1].character.name">
                <div class="fighter-info">
                  <div class="fighter-name">{{ rankings[1].character.name }}</div>
                  <div class="fighter-owner">{{ getPlayerName(rankings[1].player) }}</div>
                  <div class="fighter-points">{{ rankings[1].rank_points }}分</div>
                  <div class="fighter-record">{{ rankings[1].wins }}勝{{ rankings[1].losses }}敗</div>
                </div>
              </div>
            </div>

            <!-- 第一名 -->
            <div class="podium-place first" *ngIf="rankings[0]">
              <div class="rank-medal gold">🥇</div>
              <div class="fighter-card champion">
                <img [src]="rankings[0].character.image_url | mediaUrl" 
                     [alt]="rankings[0].character.name">
                <div class="fighter-info">
                  <div class="fighter-name">{{ rankings[0].character.name }}</div>
                  <div class="fighter-owner">{{ getPlayerName(rankings[0].player) }}</div>
                  <div class="fighter-points">{{ rankings[0].rank_points }}分</div>
                  <div class="fighter-record">{{ rankings[0].wins }}勝{{ rankings[0].losses }}敗</div>
                </div>
                <div class="champion-crown">👑</div>
              </div>
            </div>

            <!-- 第三名 -->
            <div class="podium-place third" *ngIf="rankings[2]">
              <div class="rank-medal bronze">🥉</div>
              <div class="fighter-card">
                <img [src]="rankings[2].character.image_url | mediaUrl" 
                     [alt]="rankings[2].character.name">
                <div class="fighter-info">
                  <div class="fighter-name">{{ rankings[2].character.name }}</div>
                  <div class="fighter-owner">{{ getPlayerName(rankings[2].player) }}</div>
                  <div class="fighter-points">{{ rankings[2].rank_points }}分</div>
                  <div class="fighter-record">{{ rankings[2].wins }}勝{{ rankings[2].losses }}敗</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 完整排名列表 -->
        <div class="rankings-list">
          <div class="ranking-item" 
               *ngFor="let rank of rankings; let i = index"
               [class.own-character]="isOwnCharacter(rank)"
               [class.top-rank]="i < 3">
            
            <div class="rank-position">
              <span class="rank-number" *ngIf="i >= 3">#{{ rank.current_rank }}</span>
              <span class="rank-medal" *ngIf="i < 3">
                {{ i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉' }}
              </span>
            </div>

            <div class="character-avatar">
              <img [src]="rank.character.image_url | mediaUrl" [alt]="rank.character.name">
              <div class="rarity-badge" [style.background-color]="bettingService.getRarityColor(rank.character.rarity)">
                {{ bettingService.getRarityLabel(rank.character.rarity) }}
              </div>
            </div>

            <div class="character-details">
              <div class="character-name">{{ rank.character.name }}</div>
              <div class="character-owner">{{ getPlayerName(rank.player) }}</div>
              <div class="character-level">Lv.{{ rank.character.level }}</div>
            </div>

            <div class="character-stats">
              <div class="stat-item">
                <span class="stat-icon">💪</span>
                <span class="stat-value">{{ rank.character.strength }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">⚡</span>
                <span class="stat-value">{{ rank.character.agility }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">🍀</span>
                <span class="stat-value">{{ rank.character.luck }}</span>
              </div>
            </div>

            <div class="ranking-stats">
              <div class="points">{{ rank.rank_points }}分</div>
              <div class="record">{{ rank.wins }}勝 {{ rank.losses }}敗</div>
              <div class="win-rate">勝率 {{ rank.win_rate }}%</div>
            </div>

            <div class="ranking-status">
              <div class="status-badge" [class.eligible]="rank.is_eligible">
                {{ rank.is_eligible ? '可參戰' : '不可參戰' }}
              </div>
              <div class="last-battle" *ngIf="rank.last_battle_at">
                上次參戰: {{ formatDate(rank.last_battle_at) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 載入更多 -->
        <div class="load-more" *ngIf="rankings.length >= 50">
          <button class="load-more-btn" (click)="loadMore()" [disabled]="loading">
            {{ loading ? '載入中...' : '載入更多' }}
          </button>
        </div>
      </div>

      <!-- 空狀態 -->
      <div class="empty-state" *ngIf="rankings.length === 0 && !loading">
        <div class="empty-icon">🏆</div>
        <h2>天梯尚無參賽者</h2>
        <p>成為第一個加入天梯的勇者！</p>
      </div>

      <!-- 載入中 -->
      <div class="loading-section" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>載入排行榜中...</p>
      </div>

      <!-- 返回按鈕 -->
      <div class="back-nav">
        <button class="back-btn" (click)="goBack()">
          <span>← 返回競技場</span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./ladder.component.scss']
})
export class LadderComponent implements OnInit, OnDestroy {
  rankings: LadderRank[] = [];
  seasonInfo: any = null;
  eligibleCharacters: any[] = [];
  selectedCharacter: any = null;
  hasJoinedLadder: boolean = false;
  joining: boolean = false;
  loading: boolean = true;
  
  trophyParticles = Array.from({ length: 15 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 3
  }));
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    public bettingService: BettingService,
    private characterService: CharacterService,
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
    
    // 載入天梯排名
    this.bettingService.getLadderRankings().subscribe({
      next: (response) => {
        this.rankings = response.rankings;
        this.seasonInfo = response.season;
        this.checkIfJoined();
        this.loading = false;
      },
      error: (error) => {
        console.error('載入天梯排名失敗:', error);
        this.loading = false;
      }
    });
    
    // 載入玩家角色
    const token = localStorage.getItem('access_token');
    if (token) {
      this.characterService.getAllCharacters(token).subscribe({
        next: (characters: Character[]) => {
          this.eligibleCharacters = characters; // 移除等級限制，所有角色都可參加
        },
        error: (error: any) => {
          console.error('載入角色失敗:', error);
        }
      });
    }
  }
  
  private checkIfJoined(): void {
    // 檢查是否已經加入天梯（這裡需要根據實際API調整）
    // 暫時假設如果在排名中找到玩家的角色就表示已加入
    this.hasJoinedLadder = this.rankings.some(rank => 
      rank.player.user.username === this.getCurrentUsername()
    );
  }
  
  private getCurrentUsername(): string {
    // 這裡需要從認證服務獲取當前用戶名
    return localStorage.getItem('username') || '';
  }
  
  get activeRankings(): LadderRank[] {
    return this.rankings.filter(rank => rank.is_eligible);
  }
  
  getPlayerName(player: any): string {
    return player.nickname || player.user.username;
  }
  
  isOwnCharacter(rank: LadderRank): boolean {
    return rank.player.user.username === this.getCurrentUsername();
  }
  
  selectCharacter(character: any): void {
    this.selectedCharacter = character;
  }
  
  joinLadder(): void {
    if (!this.selectedCharacter) return;
    
    this.joining = true;
    this.bettingService.joinLadder(this.selectedCharacter.id).subscribe({
      next: (response) => {
        alert('成功加入天梯！');
        this.hasJoinedLadder = true;
        this.selectedCharacter = null;
        this.loadData(); // 重新載入數據
        this.joining = false;
      },
      error: (error) => {
        alert('加入天梯失敗：' + (error.error?.error || '請稍後再試'));
        this.joining = false;
      }
    });
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  loadMore(): void {
    // 實現載入更多功能
    this.loading = true;
    // 這裡可以調用API載入更多排名
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  }
  
  goBack(): void {
    this.router.navigate(['/arena']);
  }
}
