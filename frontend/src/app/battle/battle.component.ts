import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CharacterService } from '../services/character.service';
import { BattleService, BattleStartResponse } from '../services/battle.service';
import { Character } from '../interfaces/character.interface';
import { Battle } from '../interfaces/battle.interface';
import { CharacterCardComponent } from '../shared/character-card.component';
import { BattleLogComponent } from '../components/battle-log/battle-log.component';
import { trigger, transition, style, animate } from '@angular/animations';
import { MediaUrlPipe } from '../pipes/media-url.pipe';
import { Subscription, timer } from 'rxjs';
import { switchMap, takeWhile, tap } from 'rxjs/operators';

// Add this interface for clarity
interface BattleLogEntry {
  description: string;
  type: 'attack' | 'damage' | 'defense' | 'info' | 'critical';
  // Add other properties from your actual log structure
  [key: string]: any; 
}

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    CharacterCardComponent,
    BattleLogComponent,
    MediaUrlPipe
  ],
  templateUrl: './battle.component.html',
  styleUrls: ['./battle.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class BattleComponent implements OnInit, OnDestroy {
  playerCharacter: Character | null = null;
  opponent: Character | null = null;
  battleResult: Battle & { battle_log: { battle_log: BattleLogEntry[] } } | null = null;
  isLoading = false;
  battleStarted = false;
  showResultOverlay = false;
  currentRound = 0;
  playerHealth = 100;
  opponentHealth = 100;
  isPlayerBeingAttacked = false;
  isOpponentBeingAttacked = false;
  isBattleLogComplete = false;
  
  // 戰鬥進度動畫相關
  battleProgressStep = 0;
  currentBattlePhase = '初始化戰鬥...';
  currentBattleDescription = '戰士們正在進入競技場';
  isPlayerAttacking = false;
  isOpponentAttacking = false;
  
  private battlePhases = [
    { phase: '初始化戰鬥...', description: '戰士們正在進入競技場' },
    { phase: '激烈交鋒中', description: '雙方正在展開猛烈攻擊' },
    { phase: '決定性時刻', description: '戰況進入白熱化階段' },
    { phase: '分出勝負', description: '勝負即將揭曉...' }
  ];

  private pollingSubscription: Subscription | null = null;
  private characterSubscription: Subscription | null = null;

  constructor(
    private characterService: CharacterService,
    private battleService: BattleService
  ) {}

  ngOnInit(): void {
    this.characterSubscription = this.characterService.currentCharacter$.subscribe(character => {
      if (character) {
        this.playerCharacter = character;
        if (!this.opponent) {
            this.findNewOpponent();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.characterSubscription?.unsubscribe();
    this.stopPolling();
  }

  findNewOpponent(): void {
    this.isLoading = true;
    this.battleResult = null;
    this.battleStarted = false;
    this.opponent = null;
    this.resetHealth();
    this.showResultOverlay = false;
    
    this.battleService.getRandomOpponent().subscribe({
      next: (opponent) => {
        this.opponent = opponent;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('尋找對手失敗:', error);
        this.isLoading = false;
      }
    });
  }

  startBattle(): void {
    if (!this.playerCharacter || !this.opponent) return;

    this.battleStarted = true;
    this.showResultOverlay = false;
    this.currentRound = 0;
    this.isBattleLogComplete = false;
    this.resetHealth();
    
    // 重置戰鬥進度動畫
    this.battleProgressStep = 0;
    this.startBattleProgressAnimation();

    this.battleService.startBattle(this.playerCharacter.id, this.opponent.id).subscribe({
      next: (response: BattleStartResponse) => {
        this.pollForBattleResult(response.battle_id);
      },
      error: (error) => {
        console.error('啟動戰鬥失敗:', error);
        this.battleStarted = false;
      }
    });
  }

  private pollForBattleResult(battleId: string): void {
    this.stopPolling();

    this.pollingSubscription = timer(0, 1500)
      .pipe(
        switchMap(() => this.battleService.getBattleResult(battleId)),
        takeWhile(battle => battle.status === 'PENDING', true)
      )
      .subscribe({
        next: (battle) => {
          if (battle.status !== 'PENDING') {
            this.stopPolling();
            console.log('battle', battle);

            // Process battle log to add types
            if (battle.battle_log && battle.battle_log.battle_log) {
              battle.battle_log.battle_log = battle.battle_log.battle_log.map(log => ({
                ...log,
                type: this.getLogEntryType(log.description)
              }));
            }
            this.battleResult = battle as any;
            
            if (this.battleResult?.battle_log) {
                const battleLog = this.battleResult.battle_log.battle_log;
                const totalRounds = battleLog.length;
                const roundInterval = 1000;

                const showNextRound = () => {
                  if (this.currentRound < totalRounds) {
                      const log = battleLog[this.currentRound];
                      this.updateHealth(log);
                      this.currentRound++;
                      setTimeout(showNextRound, roundInterval);
                  } else {
                      // All logs are finished, now we can show overlays
                      this.isBattleLogComplete = true; 
                      setTimeout(() => {
                        this.showResultOverlay = true;
                      }, 800);
                  }
                };
                showNextRound();
            } else {
                console.error("Battle completed but battle_log is null", battle);
                this.battleStarted = false;
            }
          }
        },
        error: (error) => {
          console.error('輪詢戰鬥結果失敗:', error);
          this.battleStarted = false;
          this.stopPolling();
        }
      });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private updateHealth(log: any): void {
    if (log.attacker === this.playerCharacter?.name) {
      this.isOpponentBeingAttacked = true;
      this.opponentHealth = log.remaining_hp <= 0 ? 0 : log.remaining_hp;
      setTimeout(() => { this.isOpponentBeingAttacked = false; }, 500);
    } else {
      this.isPlayerBeingAttacked = true;
      this.playerHealth = log.remaining_hp <= 0 ? 0 : log.remaining_hp;
      setTimeout(() => { this.isPlayerBeingAttacked = false; }, 500);
    }
  }

  private resetHealth(): void {
    this.playerHealth = 100;
    this.opponentHealth = 100;
    this.isPlayerBeingAttacked = false;
    this.isOpponentBeingAttacked = false;
  }

  resetBattle(): void {
    this.battleResult = null;
    this.battleStarted = false;
    this.showResultOverlay = false;
    this.currentRound = 0;
    this.isBattleLogComplete = false;
    this.battleProgressStep = 0;
    this.resetHealth();
    this.findNewOpponent();
  }
  
  private startBattleProgressAnimation(): void {
    // 開始隨機攻擊動畫
    this.startRandomAttackAnimations();
    
    // 戰鬥進度階段
    setTimeout(() => {
      this.battleProgressStep = 1;
      this.currentBattlePhase = this.battlePhases[1].phase;
      this.currentBattleDescription = this.battlePhases[1].description;
    }, 1000);
    
    setTimeout(() => {
      this.battleProgressStep = 2;
      this.currentBattlePhase = this.battlePhases[2].phase;
      this.currentBattleDescription = this.battlePhases[2].description;
    }, 3000);
    
    setTimeout(() => {
      this.battleProgressStep = 3;
      this.currentBattlePhase = this.battlePhases[3].phase;
      this.currentBattleDescription = this.battlePhases[3].description;
    }, 5000);
  }
  
  private startRandomAttackAnimations(): void {
    const attackInterval = setInterval(() => {
      if (!this.battleStarted || this.battleResult) {
        clearInterval(attackInterval);
        return;
      }
      
      // 隨機選擇攻擊者
      const isPlayerTurn = Math.random() > 0.5;
      
      if (isPlayerTurn) {
        this.isPlayerAttacking = true;
        setTimeout(() => {
          this.isPlayerAttacking = false;
        }, 600);
      } else {
        this.isOpponentAttacking = true;
        setTimeout(() => {
          this.isOpponentAttacking = false;
        }, 600);
      }
    }, 1200 + Math.random() * 800); // 隨機間隔 1.2-2 秒
  }

  private calculatePower(character: Character): number {
    return character.strength + character.agility + character.luck;
  }

  private generateBattleLog(player: Character, opponent: Character, winner: Character): any[] {
    const log = [];
    const totalRounds = 3;
    let playerHp = 100;
    let opponentHp = 100;

    for (let i = 0; i < totalRounds; i++) {
      // 玩家回合
      const playerDamage = Math.floor(Math.random() * player.strength);
      opponentHp -= playerDamage;
      log.push({
        attacker: player.name,
        defender: opponent.name,
        action: '普通攻擊',
        damage: playerDamage,
        description: `${player.name}發動了猛烈的攻擊！`,
        remaining_hp: Math.max(0, opponentHp)
      });

      if (opponentHp <= 0) break;

      // 對手回合
      const opponentDamage = Math.floor(Math.random() * opponent.strength);
      playerHp -= opponentDamage;
      log.push({
        attacker: opponent.name,
        defender: player.name,
        action: '普通攻擊',
        damage: opponentDamage,
        description: `${opponent.name}進行了反擊！`,
        remaining_hp: Math.max(0, playerHp)
      });

      if (playerHp <= 0) break;
    }

    return log;
  }

  // Helper function to determine log type for styling
  private getLogEntryType(description: string): BattleLogEntry['type'] {
    const desc = description.toLowerCase();
    if (desc.includes('爆擊') || desc.includes('致命一擊')) return 'critical';
    if (desc.includes('攻擊') || desc.includes('造成傷害') || desc.includes('揮舞')) return 'attack';
    if (desc.includes('格擋') || desc.includes('閃避') || desc.includes('防禦')) return 'defense';
    return 'info';
  }
}