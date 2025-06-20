import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Character, BattleResult, BattleLogEntry } from '../models/character.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Battle } from '../interfaces/battle.interface';
import { map } from 'rxjs/operators';

export interface BattleAction {
  attacker: string;
  defender: string;
  action: string;
  damage: number;
  description: string;
  remaining_hp: number;
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

  generateOpponent(): Character {
    const opponents = [
      'Shadow Assassin', 'Fire Dragon', 'Ice Queen', 'Lightning Wizard', 
      'Stone Golem', 'Wind Dancer', 'Dark Knight', 'Holy Priest'
    ];

    const skills = [
      { name: 'Shadow Strike', description: 'Strikes from the shadows', power: 115 },
      { name: 'Dragon Breath', description: 'Breathes devastating fire', power: 130 },
      { name: 'Frost Nova', description: 'Freezes and damages enemies', power: 105 },
      { name: 'Thunder Bolt', description: 'Calls lightning from the sky', power: 125 },
      { name: 'Earth Quake', description: 'Shakes the ground violently', power: 110 },
      { name: 'Wind Slash', description: 'Cuts with razor-sharp wind', power: 95 },
      { name: 'Dark Void', description: 'Drains life force', power: 120 },
      { name: 'Divine Light', description: 'Blinds and burns enemies', power: 100 }
    ];

    const name = opponents[Math.floor(Math.random() * opponents.length)];
    const skill = skills[Math.floor(Math.random() * skills.length)];

    return {
      id: 'opponent-' + Date.now(),
      name: name,
      prompt: 'AI Generated Opponent',
      image_url: `https://images.pexels.com/photos/4046554/pexels-photo-4046554.jpeg?auto=compress&cs=tinysrgb&w=400`,
      strength: Math.floor(Math.random() * 50) + 50,
      agility: Math.floor(Math.random() * 50) + 50,
      luck: Math.floor(Math.random() * 50) + 50,
      skill_description: skill.name,
      win_count: Math.floor(Math.random() * 20),
      loss_count: Math.floor(Math.random() * 15),
      created_at: new Date().toISOString()
    };
  }

  private calculateAttack(attacker: Character, defender: Character, turn: number): any {
    const useSkill = Math.random() < 0.3; // 30% chance to use skill
    const critical = Math.random() < (attacker.luck / 200); // Luck affects crit chance
    
    let baseDamage = Math.floor(Math.random() * 10) + 10;
    let action = 'Basic Attack';
    let skillUsed = undefined;

    if (useSkill) {
      baseDamage = Math.floor(Math.random() * 10) + 10;
      action = 'Skill Attack';
      skillUsed = attacker.skill_description;
    }

    // Apply attributes
    baseDamage += Math.floor(attacker.strength / 10);
    baseDamage -= Math.floor(defender.agility / 20); // Agility reduces damage taken

    if (critical) {
      baseDamage *= 1.5;
    }

    baseDamage = Math.max(1, Math.floor(baseDamage)); // Minimum 1 damage

    const messages = [
      `${attacker.name} strikes with tremendous force!`,
      `${attacker.name} unleashes a devastating attack!`,
      `${attacker.name} channels their inner power!`,
      `${attacker.name} moves with lightning speed!`,
      `${attacker.name} lands a crushing blow!`
    ];

    if (critical) {
      messages.push(`${attacker.name} lands a CRITICAL HIT!`);
    }

    if (useSkill) {
      messages.push(`${attacker.name} uses ${attacker.skill_description}!`);
    }

    return {
      damage: baseDamage,
      critical: critical,
      action: action,
      skillUsed: skillUsed,
      message: messages[Math.floor(Math.random() * messages.length)]
    };
  }

  getBattleHistory(): Battle[] {
    return this.battleHistorySubject.value;
  }

  // 獲取隨機對手
  getRandomOpponent(): Observable<Character> {
    return this.http.get<Character>(`${environment.backendBaseUrl}/api/characters/random/`);
  }

  // 開始戰鬥
  startBattle(player: Character, opponent: Character): Observable<Battle> {
    return this.http.post<any>(`${environment.backendBaseUrl}/api/characters/battle/`, {
      player_character: player.id,
      opponent_character: opponent.id
    }).pipe(
      map(response => {
        // 創建 Battle 對象
        const battle: Battle = {
          id: response.id || Date.now().toString(),
          character1: player,
          character2: opponent,
          winner: response.winner === player.id ? player : opponent,
          battle_log: {
            winner: response.winner,
            battle_log: response.battle_log,
            battle_description: response.battle_description
          },
          created_at: new Date().toISOString()
        };
        return battle;
      })
    );
  }
}