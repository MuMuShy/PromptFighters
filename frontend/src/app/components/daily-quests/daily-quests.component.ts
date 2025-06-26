import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyQuestService, DailyStats, PlayerDailyQuest, ClaimRewardResponse } from '../../services/daily-quest.service';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-daily-quests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-quests.component.html',
  styleUrls: ['./daily-quests.component.scss']
})
export class DailyQuestsComponent implements OnInit, OnDestroy {
  dailyStats: DailyStats | null = null;
  isLoading = false;
  showRewardModal = false;
  lastClaimedReward: ClaimRewardResponse | null = null;
  showCheckInModal = false;
  checkInMessage = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private dailyQuestService: DailyQuestService,
    private playerService: PlayerService
  ) {}

  ngOnInit() {
    this.loadDailyStats();
    
    // 訂閱每日統計變化
    const statsSub = this.dailyQuestService.dailyStats$.subscribe(stats => {
      this.dailyStats = stats;
    });
    this.subscriptions.push(statsSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadDailyStats() {
    this.isLoading = true;
    this.dailyQuestService.getDailyStats().subscribe({
      next: (stats) => {
        this.dailyStats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('載入每日任務失敗:', error);
        this.isLoading = false;
      }
    });
  }

  checkIn() {
    this.dailyQuestService.checkIn().subscribe({
      next: (response) => {
        if (response.success) {
          this.checkInMessage = `簽到成功！已連續登入 ${response.login_streak} 天`;
          this.showCheckInModal = true;
        } else {
          this.checkInMessage = response.message || '簽到失敗';
          this.showCheckInModal = true;
        }
      },
      error: (error) => {
        this.checkInMessage = '簽到失敗，請稍後再試';
        this.showCheckInModal = true;
      }
    });
  }

  claimReward(quest: PlayerDailyQuest) {
    if (!quest.is_completed || quest.is_claimed) {
      return;
    }

    this.dailyQuestService.claimReward(quest.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.lastClaimedReward = response;
          this.showRewardModal = true;
          // 更新玩家資源
          this.playerService.getResources().subscribe();
        } else {
          console.error('領取獎勵失敗:', response.error);
        }
      },
      error: (error) => {
        console.error('領取獎勵失敗:', error);
      }
    });
  }

  closeRewardModal() {
    this.showRewardModal = false;
    this.lastClaimedReward = null;
  }

  closeCheckInModal() {
    this.showCheckInModal = false;
    this.checkInMessage = '';
  }

  getQuestIcon(questType: string): string {
    return this.dailyQuestService.getQuestIcon(questType);
  }

  getQuestColor(questType: string): string {
    return this.dailyQuestService.getQuestColor(questType);
  }

  formatRewards(quest: PlayerDailyQuest): { type: string, amount: number }[] {
    return this.dailyQuestService.formatRewards(quest.quest);
  }

  get completionPercentage(): number {
    return this.dailyStats?.completion_rate || 0;
  }

  get canCheckIn(): boolean {
    if (!this.dailyStats) return false;
    
    const checkInQuest = this.dailyStats.quests.find(q => q.quest.quest_type === 'daily_checkin');
    return checkInQuest ? !checkInQuest.is_completed : false;
  }

  get hasUnclaimedRewards(): boolean {
    if (!this.dailyStats) return false;
    
    return this.dailyStats.quests.some(q => q.is_completed && !q.is_claimed);
  }

  getProgressBarClass(quest: PlayerDailyQuest): string {
    if (quest.is_completed) {
      return 'completed';
    } else if (quest.progress_percentage > 0) {
      return 'in-progress';
    }
    return 'not-started';
  }

  get rewardGold(): number {
    return this.lastClaimedReward?.rewards?.gold || 0;
  }

  get rewardDiamond(): number {
    return this.lastClaimedReward?.rewards?.diamond || 0;
  }

  get rewardPromptPower(): number {
    return this.lastClaimedReward?.rewards?.prompt_power || 0;
  }

  get rewardEnergy(): number {
    return this.lastClaimedReward?.rewards?.energy || 0;
  }
}