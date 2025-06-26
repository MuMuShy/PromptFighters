import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PlayerResources {
  gold: number;
  diamond: number;
  prompt_power: number;
  energy: number;
  max_energy: number;
}

interface SpendResourcesRequest {
  gold_cost?: number;
  diamond_cost?: number;
  prompt_power_cost?: number;
  energy_cost?: number;
}

interface SpendResourcesResponse {
  success: boolean;
  error?: string;
  gold?: number;
  diamond?: number;
  prompt_power?: number;
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
    diamond: 0,
    prompt_power: 0,
    energy: 0,
    max_energy: 100
  });

  public resources$ = this.resourcesSubject.asObservable();

  constructor(private http: HttpClient) {}

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
            diamond: response.diamond!,
            prompt_power: response.prompt_power!,
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
}