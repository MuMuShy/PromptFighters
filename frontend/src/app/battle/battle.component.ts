import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CharacterService } from '../services/character.service';
import { BattleService } from '../services/battle.service';
import { Character } from '../interfaces/character.interface';
import { Battle } from '../interfaces/battle.interface';
import { CharacterCardComponent } from '../shared/character-card.component';
import { BattleLogComponent } from '../components/battle-log/battle-log.component';
import { trigger, transition, style, animate } from '@angular/animations';
import { MediaUrlPipe } from '../pipes/media-url.pipe';

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
export class BattleComponent implements OnInit {
  playerCharacter: Character | null = null;
  opponent: Character | null = null;
  battleResult: Battle | null = null;
  isLoading = false;
  battleStarted = false;
  showResultOverlay = false;
  currentRound = 0;
  playerHealth = 100;
  opponentHealth = 100;
  isPlayerBeingAttacked = false;
  isOpponentBeingAttacked = false;

  constructor(
    private characterService: CharacterService,
    private battleService: BattleService
  ) {}

  ngOnInit(): void {
    this.characterService.currentCharacter$.subscribe(character => {
      if (character) {
        this.playerCharacter = character;
      }
    });
  }

  findNewOpponent(): void {
    this.isLoading = true;
    this.battleResult = null;
    this.battleStarted = false;
    this.opponent = null;
    this.resetHealth();
    
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

    this.isLoading = true;
    this.battleStarted = true;
    this.showResultOverlay = false;
    this.currentRound = 0;
    this.resetHealth();

    this.battleService.startBattle(this.playerCharacter, this.opponent).subscribe({
      next: (result) => {
        this.battleResult = result;
        this.isLoading = false;

        // 逐回合顯示 log 和更新血量
        this.currentRound = 0;
        const battleLog = result.battle_log.battle_log;
        const totalRounds = battleLog.length;
        const roundInterval = 1000; // 1秒一回合

        const showNextRound = () => {
          if (this.currentRound < totalRounds) {
            const log = battleLog[this.currentRound];
            this.updateHealth(log);
            this.currentRound++;
            setTimeout(showNextRound, roundInterval);
          } else {
            setTimeout(() => {
              this.showResultOverlay = true;
            }, 800);
          }
        };
        showNextRound();
      },
      error: (error) => {
        console.error('戰鬥發生錯誤:', error);
        this.isLoading = false;
        this.battleStarted = false;
      }
    });
  }

  private updateHealth(log: any): void {
    console.log(log);
    if (log.attacker === this.playerCharacter?.name) {
      // 玩家攻擊對手
      this.isOpponentBeingAttacked = true;
      this.opponentHealth = log.remaining_hp <= 0 ? 0 : log.remaining_hp;
      setTimeout(() => {
        this.isOpponentBeingAttacked = false;
      }, 500);
    } else {
      // 對手攻擊玩家
      this.isPlayerBeingAttacked = true;
      this.playerHealth = log.remaining_hp <= 0 ? 0 : log.remaining_hp;
      setTimeout(() => {
        this.isPlayerBeingAttacked = false;
      }, 500);
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
    this.resetHealth();
    this.findNewOpponent();
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
}