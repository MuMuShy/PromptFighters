import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Battle } from '../interfaces/battle.interface';
import { map } from 'rxjs/operators';
import { Character } from '../interfaces/character.interface';
export interface BattleAction {
  attacker: string;
  defender: string;
  action: string;
  damage: number;
  description: string;
  remaining_hp: number;
}

export interface BattleStartResponse {
  battle_id: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class BattleService {
  private battleHistorySubject = new BehaviorSubject<Battle[]>([]);
  public battleHistory$ = this.battleHistorySubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadBattleHistory();
  }

  getBattlesByCharacterId(characterId: string, token: string): Observable<Battle[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Battle[]>(`${environment.backendBaseUrl}/api/characters/${characterId}/battles/`, { headers });
  }

  private loadBattleHistory(): void {
    const stored = localStorage.getItem('rpg-battle-history');
    if (stored) {
      const history = JSON.parse(stored).map((battle: any) => ({
        ...battle,
        date: new Date(battle.date),
      }));
      this.battleHistorySubject.next(history);
    }
  }

  private saveBattleHistory(history: Battle[]): void {
    localStorage.setItem('rpg-battle-history', JSON.stringify(history));
  }

  getRandomOpponent(): Observable<Character> {
    return this.http.get<Character>(`${environment.backendBaseUrl}/api/characters/random/`);
  }

  startBattle(playerCharacterId: string, opponentCharacterId: string): Observable<BattleStartResponse> {
    const body = {
      player_character: playerCharacterId,
      opponent_character: opponentCharacterId
    };
    return this.http.post<BattleStartResponse>(`${environment.backendBaseUrl}/api/characters/battle/`, body);
    }

  getBattleResult(battleId: string): Observable<Battle> {
    return this.http.get<Battle>(`${environment.backendBaseUrl}/api/battles/${battleId}/`);
  }

  getBattleHistory(): Battle[] {
    return this.battleHistorySubject.value;
  }
}