import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  quest_type: string;
  quest_type_display: string;
  target_count: number;
  reward_gold: number;
  reward_diamond: number;
  reward_prompt_power: number;
  reward_energy: number;
  is_active: boolean;
}

export interface PlayerDailyQuest {
  id: string;
  quest: DailyQuest;
  current_count: number;
  is_completed: boolean;
  is_claimed: boolean;
  date: string;
  completed_at?: string;
  claimed_at?: string;
  progress_percentage: number;
}

export interface DailyStats {
  total_quests: number;
  completed_quests: number;
  claimed_rewards: number;
  completion_rate: number;
  login_streak: number;
  quests: PlayerDailyQuest[];
}

export interface ClaimRewardResponse {
  success: boolean;
  message?: string;
  error?: string;
  rewards?: {
    gold: number;
    diamond: number;
    prompt_power: number;
    energy: number;
  };
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  login_streak?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DailyQuestService {
  private apiUrl = environment.backendBaseUrl + '/api';
  private dailyStatsSubject = new BehaviorSubject<DailyStats | null>(null);
  public dailyStats$ = this.dailyStatsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getDailyStats(): Observable<DailyStats> {
    return this.http.get<DailyStats>(`${this.apiUrl}/daily-quests/`).pipe(
      tap(stats => this.dailyStatsSubject.next(stats))
    );
  }

  claimReward(questId: string): Observable<ClaimRewardResponse> {
    return this.http.post<ClaimRewardResponse>(`${this.apiUrl}/daily-quests/`, {
      quest_id: questId
    }).pipe(
      tap(response => {
        if (response.success) {
          // 重新載入統計資料
          this.getDailyStats().subscribe();
        }
      })
    );
  }

  checkIn(): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.apiUrl}/checkin/`, {}).pipe(
      tap(response => {
        if (response.success) {
          // 重新載入統計資料
          this.getDailyStats().subscribe();
        }
      })
    );
  }

  updateQuestProgress(questType: string, increment: number = 1): Observable<any> {
    return this.http.post(`${this.apiUrl}/quest-progress/`, {
      quest_type: questType,
      increment: increment
    });
  }

  getCurrentStats(): DailyStats | null {
    return this.dailyStatsSubject.value;
  }

  // 獲取任務類型的圖標
  getQuestIcon(questType: string): string {
    const iconMap: { [key: string]: string } = {
      'daily_checkin': '📅',
      'battle_count': '⚔️',
      'battle_win': '🏆',
      'character_summon': '✨',
      'login_streak': '🔥'
    };
    return iconMap[questType] || '📋';
  }

  // 獲取任務類型的顏色
  getQuestColor(questType: string): string {
    const colorMap: { [key: string]: string } = {
      'daily_checkin': '#4ade80',
      'battle_count': '#f59e0b',
      'battle_win': '#ef4444',
      'character_summon': '#8b5cf6',
      'login_streak': '#f97316'
    };
    return colorMap[questType] || '#6b7280';
  }

  // 格式化獎勵文字
  formatRewards(quest: DailyQuest): { type: string, amount: number }[] {
    const rewards: { type: string, amount: number }[] = [];
    if (quest.reward_gold > 0) {
      rewards.push({ type: 'gold', amount: quest.reward_gold });
    }
    if (quest.reward_diamond > 0) {
      rewards.push({ type: 'diamond', amount: quest.reward_diamond });
    }
    if (quest.reward_prompt_power > 0) {
      rewards.push({ type: 'prompt_power', amount: quest.reward_prompt_power });
    }
    if (quest.reward_energy > 0) {
      rewards.push({ type: 'energy', amount: quest.reward_energy });
    }
    return rewards;
  }
}