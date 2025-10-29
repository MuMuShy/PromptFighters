import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LadderRank {
  id: string;
  player: {
    id: string;
    user: {
      username: string;
    };
    nickname?: string;
  };
  character: {
    id: string;
    name: string;
    image_url: string;
    level: number;
    strength: number;
    agility: number;
    luck: number;
    rarity: number;
  };
  rank_points: number;
  wins: number;
  losses: number;
  current_rank: number;
  win_rate: number;
  is_eligible: boolean;
  last_battle_at?: string;
}

export interface ScheduledBattle {
  id: string;
  fighter1: LadderRank;
  fighter2: LadderRank;
  scheduled_time: string;
  betting_start_time: string;
  betting_end_time: string;
  status: 'scheduled' | 'betting_open' | 'betting_closed' | 'in_progress' | 'completed' | 'cancelled';
  winner?: LadderRank;
  total_bets_amount: number;
  fighter1_bets_amount: number;
  fighter2_bets_amount: number;
  fighter1_odds: number;
  fighter2_odds: number;
  time_until_battle: string;
  time_until_betting_ends: string;
  user_bet?: BattleBet;
  can_bet?: boolean;
}

export interface BattleBet {
  id: string;
  battle: string;
  player: any;
  chosen_fighter: LadderRank;
  bet_amount: number;
  odds_at_bet: number;
  potential_payout: number;
  actual_payout?: number;
  is_winner?: boolean;
  payout_amount: number;
  is_settled: boolean;
  created_at: string;
  settled_at?: string;
  battle_info?: {
    id: string;
    scheduled_time: string;
    status: string;
    fighter1_name: string;
    fighter2_name: string;
    winner_name?: string;
    is_completed: boolean;
  };
}

export interface BettingStats {
  id: string;
  player: any;
  total_bets: number;
  total_bet_amount: number;
  total_winnings: number;
  win_count: number;
  win_rate: number;
  net_profit: number;
  current_streak: number;
  best_streak: number;
}

@Injectable({
  providedIn: 'root'
})
export class BettingService {
  private apiUrl = `${environment.backendBaseUrl}/api/ladder`;
  
  // 實時數據流
  private currentBattleSubject = new BehaviorSubject<ScheduledBattle | null>(null);
  public currentBattle$ = this.currentBattleSubject.asObservable();
  
  private rankingsSubject = new BehaviorSubject<LadderRank[]>([]);
  public rankings$ = this.rankingsSubject.asObservable();
  
  constructor(private http: HttpClient) {
    // 每10秒更新當前戰鬥（更頻繁的輪詢）
    this.startCurrentBattlePolling();
  }
  
  private startCurrentBattlePolling(): void {
    interval(10000) // 改為10秒
      .pipe(
        switchMap(() => this.getCurrentBettingBattle()),
        tap(battle => this.currentBattleSubject.next(battle))
      )
      .subscribe();
    
    // 立即獲取一次
    this.getCurrentBettingBattle().subscribe(battle => {
      this.currentBattleSubject.next(battle);
    });
  }
  
  // 獲取天梯排名
  getLadderRankings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/rankings/`).pipe(
      tap(response => this.rankingsSubject.next(response.rankings))
    );
  }
  
  // 獲取即將到來的戰鬥
  getUpcomingBattles(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/battles/upcoming/`);
  }
  
  // 獲取當前可下注的戰鬥
  getCurrentBettingBattle(): Observable<ScheduledBattle | null> {
    return this.http.get<ScheduledBattle>(`${this.apiUrl}/battles/current/`).pipe(
      tap(battle => console.log('Current battle updated:', battle))
    );
  }
  
  // 獲取戰鬥詳情
  getBattleDetails(battleId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/battles/${battleId}/`);
  }
  
  // 下注
  placeBet(battleId: string, fighterId: string, amount: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bet/`, {
      battle_id: battleId,
      fighter_id: fighterId,
      amount: amount
    }).pipe(
      tap(() => {
        // 下注成功後立即更新當前戰鬥
        this.getCurrentBettingBattle().subscribe(battle => {
          this.currentBattleSubject.next(battle);
        });
      })
    );
  }
  
  // 獲取我的下注記錄
  getMyBets(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/my-bets/`);
  }
  
  // 獲取下注統計
  getBettingStats(): Observable<BettingStats> {
    return this.http.get<BettingStats>(`${this.apiUrl}/stats/`);
  }
  
  // 獲取歷史戰鬥記錄
  getBattleHistory(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/battles/history/`);
  }
  
  // 加入天梯
  joinLadder(characterId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/join/`, {
      character_id: characterId
    }).pipe(
      tap(() => {
        // 加入成功後更新排名
        this.getLadderRankings().subscribe();
      })
    );
  }
  
  // 計算時間差
  getTimeRemaining(targetTime: string): { 
    hours: number; 
    minutes: number; 
    seconds: number; 
    total: number;
    isExpired: boolean;
  } {
    const now = new Date().getTime();
    const target = new Date(targetTime).getTime();
    const difference = target - now;
    
    if (difference <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
    }
    
    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds, total: difference, isExpired: false };
  }
  
  // 格式化金額
  formatAmount(amount: number): string {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(1) + 'K';
    }
    return amount.toString();
  }
  
  // 獲取稀有度標籤
  getRarityLabel(rarity: number): string {
    switch (rarity) {
      case 2: return 'R';
      case 3: return 'SR';
      case 4: return 'SSR';
      case 5: return 'UR';
      default: return 'N';
    }
  }
  
  // 獲取稀有度顏色
  getRarityColor(rarity: number): string {
    switch (rarity) {
      case 2: return '#4ade80'; // green-400
      case 3: return '#60a5fa'; // blue-400
      case 4: return '#a855f7'; // purple-500
      case 5: return '#f59e0b'; // amber-500
      default: return '#9ca3af'; // gray-400
    }
  }
}
