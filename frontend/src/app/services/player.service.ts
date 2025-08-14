import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PlayerResources {
  gold: number;
  prompt: number;
  prompt_power: number;
  exp_potion: number;
  energy: number;
  max_energy: number;
}

interface SpendResourcesRequest {
  gold_cost?: number;
  prompt_cost?: number;
  prompt_power_cost?: number;
  exp_potion_cost?: number;
  energy_cost?: number;
}

interface SpendResourcesResponse {
  success: boolean;
  error?: string;
  gold?: number;
  prompt?: number;
  prompt_power?: number;
  exp_potion?: number;
  energy?: number;
  max_energy?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private apiUrl = environment.backendBaseUrl + '/api';
  private resourcesSubject = new BehaviorSubject<PlayerResources>({
    gold: 0,
    prompt: 0,
    prompt_power: 0,
    exp_potion: 0,
    energy: 0,
    max_energy: 100
  });

  public resources$ = this.resourcesSubject.asObservable();
  private energyTimer: any;
  private energyRecoverySubject = new BehaviorSubject<{nextRecoveryMinutes: number, isRecovering: boolean}>({
    nextRecoveryMinutes: 0,
    isRecovering: false
  });
  public energyRecovery$ = this.energyRecoverySubject.asObservable();

  constructor(private http: HttpClient) {
    this.startEnergyRecoveryTimer();
  }

  getResources(): Observable<PlayerResources> {
    return this.http.get<PlayerResources>(`${this.apiUrl}/player/resources/`).pipe(
      tap(resources => this.resourcesSubject.next(resources))
    );
  }

  spendResources(request: SpendResourcesRequest): Observable<SpendResourcesResponse> {
    return this.http.post<SpendResourcesResponse>(`${this.apiUrl}/player/spend/`, request).pipe(
      tap(response => {
        if (response.success && response.gold !== undefined) {
          this.resourcesSubject.next({
            gold: response.gold!,
            prompt: response.prompt!,
            prompt_power: response.prompt_power!,
            exp_potion: response.exp_potion!,
            energy: response.energy!,
            max_energy: response.max_energy!
          });
        }
      })
    );
  }

  getCurrentResources(): PlayerResources {
    return this.resourcesSubject.value;
  }

  updateResources(resources: PlayerResources): void {
    this.resourcesSubject.next(resources);
  }

  getProfile(playerId?: string): Observable<any> {
    let url = `${this.apiUrl}/player/profile/`;
    if (playerId) {
      url += `?player_id=${playerId}`;
    }
    return this.http.get<any>(url);
  }

  updateNickname(nickname: string) {
    return this.http.patch<any>(`${this.apiUrl}/player/profile/`, { nickname });
  }

  private startEnergyRecoveryTimer(): void {
    // 每分鐘檢查一次體力恢復
    this.energyTimer = interval(60000).subscribe(() => {
      this.updateEnergyRecoveryStatus();
    });
    
    // 立即檢查一次
    this.updateEnergyRecoveryStatus();
  }

  private updateEnergyRecoveryStatus(): void {
    const resources = this.resourcesSubject.value;
    if (resources.energy < resources.max_energy) {
      // 計算到下次體力恢復還有幾分鐘
      const now = Date.now();
      const nextRecovery = Math.ceil(10 - ((now / 60000) % 10));
      
      this.energyRecoverySubject.next({
        nextRecoveryMinutes: nextRecovery,
        isRecovering: true
      });

      // 自動更新資源（每10分鐘呼叫一次API更新）
      if (nextRecovery === 10) {
        this.getResources().subscribe();
      }
    } else {
      this.energyRecoverySubject.next({
        nextRecoveryMinutes: 0,
        isRecovering: false
      });
    }
  }

  getEnergyRecoveryInfo(): {nextRecoveryMinutes: number, isRecovering: boolean} {
    return this.energyRecoverySubject.value;
  }

  ngOnDestroy(): void {
    if (this.energyTimer) {
      this.energyTimer.unsubscribe();
    }
  }
}