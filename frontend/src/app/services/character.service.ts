import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, timer, switchMap, takeWhile, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Character } from '../interfaces/character.interface';

@Injectable({
  providedIn: 'root'
})
export class CharacterService {
  private apiUrl = environment.backendBaseUrl + '/api/characters/';
  private currentCharacterSubject = new BehaviorSubject<Character | null>(null);
  public currentCharacter$ = this.currentCharacterSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCharacterFromStorage();
  }

  private loadCharacterFromStorage(): void {
    const stored = localStorage.getItem('rpg-character');
    if (stored) {
      const character = JSON.parse(stored);
      this.currentCharacterSubject.next(character);
    }
  }

  private saveCharacterToStorage(character: Character): void {
    localStorage.setItem('rpg-character', JSON.stringify(character));
  }

  saveCharacter(character: Character): void {
    this.currentCharacterSubject.next(character);
    this.saveCharacterToStorage(character);
  }

  getCurrentCharacter(): Character | null {
    return this.currentCharacterSubject.value;
  }

  createCharacter(prompt: string, token: string): Observable<Character> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<Character>(this.apiUrl, { prompt }, { headers });
  }

  getCharacter(id: string, token: string): Observable<Character> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Character>(`${this.apiUrl}${id}/`, { headers });
  }

  getAllCharacters(token: string): Observable<Character[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<Character[]>(this.apiUrl, { headers });
  }

  pollCharacterImage(id: string, token: string, intervalMs = 3000): Observable<Character> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getCharacter(id, token)),
      takeWhile(char => char.image_url.includes('placeholder'), true)
    );
  }

  getLeaderboard(): Observable<Character[]> {
    return this.http.get<Character[]>(`${environment.backendBaseUrl}/api/leaderboard/`);
  }

  advancedSummonCharacter(name: string, prompt: string, token: string): Observable<Character> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<Character>(
      this.apiUrl + 'advanced_summon/',
      { name, prompt },
      { headers }
    );
  }

  // 角色升級相關方法
  getUpgradeInfo(characterId: string, token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<any>(`${environment.backendBaseUrl}/api/characters/${characterId}/info/`, { headers });
  }

  addExperience(characterId: string, amount: number, token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<any>(
      `${environment.backendBaseUrl}/api/characters/${characterId}/add-exp/`,
      { amount },
      { headers }
    );
  }

  levelUpCharacter(characterId: string, token: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post<any>(
      `${environment.backendBaseUrl}/api/characters/${characterId}/level-up/`,
      {},
      { headers }
    );
  }
}