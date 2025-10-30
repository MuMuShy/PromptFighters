import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CharacterService } from '../services/character.service';
import { BattleService, BattleStartResponse, BattleError } from '../services/battle.service';
import { PlayerService } from '../services/player.service';
import { OnchainService, BattleOnchainInfo } from '../services/onchain.service';
import { Character } from '../interfaces/character.interface';
import { Battle } from '../interfaces/battle.interface';


import { trigger, transition, style, animate } from '@angular/animations';
import { MediaUrlPipe } from '../pipes/media-url.pipe';
import { Subscription, timer, interval } from 'rxjs';
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
    ]),
    // Toast 進出動效（右側滑入、上移淡出）
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(120%)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class BattleComponent implements OnInit, OnDestroy {
  maxHp = 300; // 與後端同步的最大 HP
  playerCharacter: Character | null = null;
  opponent: Character | null = null;
  battleResult: Battle & { battle_log: { battle_log: BattleLogEntry[] } } | null = null;
  isLoading = false;
  battleStarted = false;
  showResultOverlay = false;
  currentRound = 0;
  playerHealth = this.maxHp; // 提高初始血量，配合後端
  opponentHealth = this.maxHp;
  isPlayerBeingAttacked = false;
  isOpponentBeingAttacked = false;
  isBattleLogComplete = false;
  // On-chain 通知
  onchainNotice: string | null = null;
  onchainLink: string | null = null;
  onchainStatus: BattleOnchainInfo['onchain_status'] = null;
  
  // 多條跑馬燈堆疊
  toasts: { id: number; text: string; link?: string | null }[] = [];
  private toastSeq = 0;

  // 體力和錯誤處理
  energyError: string | null = null;
  showRewards = false;
  battleRewards: any = null;
  
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
  private onchainPollingSub: Subscription | null = null;

  constructor(
    private characterService: CharacterService,
    private battleService: BattleService,
    private playerService: PlayerService,
    private onchainService: OnchainService
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
    this.stopOnchainPolling();
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

    this.energyError = null;
    this.battleStarted = true;
    this.showResultOverlay = false;
    this.showRewards = false;
    this.currentRound = 0;
    this.isBattleLogComplete = false;
    this.resetHealth();
    
    // 重置戰鬥進度動畫
    this.battleProgressStep = 0;
    this.startBattleProgressAnimation();

    this.battleService.startBattle(this.playerCharacter.id, this.opponent.id).subscribe({
      next: (response: BattleStartResponse) => {
        // 戰鬥開始後立即更新資源（消耗體力）
        this.playerService.getResources().subscribe();
        this.pollForBattleResult(response.battle_id);
      },
      error: (errorResponse) => {
        console.error('啟動戰鬥失敗:', errorResponse);
        this.battleStarted = false;
        
        // 處理體力不足錯誤
        if (errorResponse.error && errorResponse.error.error === 'Energy insufficient') {
          const error: BattleError = errorResponse.error;
          this.energyError = `體力不足！需要 ${error.required_energy} 點體力，目前剩餘 ${error.current_energy} 點。${Math.ceil(error.next_recovery_minutes)} 分鐘後恢復 1 點體力。`;
        } else {
          this.energyError = '戰鬥啟動失敗，請重試';
        }
        // 更新資源以反映最新狀態
        this.playerService.getResources().subscribe();
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

            // 調試：完整輸出戰鬥結果
            console.log('🎯 完整戰鬥結果:', battle);
            console.log('🏆 獲勝者信息:', battle.winner);
            console.log('📋 戰鬥日誌:', battle.battle_log);
            
            // Process battle log to add types
            if (battle.battle_log && battle.battle_log.battle_log) {
              console.log('📝 戰鬥日誌條目:', battle.battle_log.battle_log);
              battle.battle_log.battle_log = battle.battle_log.battle_log.map(log => ({
                ...log,
                type: this.getLogEntryType(log.description)
              }));
            }
            this.battleResult = battle as any;
            
            // 提取戰鬥獎勵
            if (this.battleResult?.battle_log?.battle_rewards) {
              this.battleRewards = this.battleResult.battle_log.battle_rewards;
            }
            
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
                      
                      // 立即更新玩家資源
                      this.playerService.getResources().subscribe();
                      
                      setTimeout(() => {
                        this.showResultOverlay = true;
                        // 直接顯示獎勵，不要延遲
                        this.showRewards = true;
                      }, 800);
                  }
                };
                showNextRound();
            } else {
                console.error("Battle completed but battle_log is null", battle);
                this.battleStarted = false;
            }
            // 嘗試拉取 on-chain 資訊，並顯示狀態序列（即便已確認也先顯示 Pending）
            const bid = (this.battleResult as any)?.id || battleId;
            if (bid) {
              this.showOnchainToast('On-chain: Pending...');
              this.fetchOnchainInfo(bid, true);
              this.startOnchainPolling(bid);
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
    console.log('戰鬥日誌詳細:', {
      attacker: log.attacker,
      defender: log.defender,
      damage: log.damage,
      remaining_hp: log.remaining_hp,
      playerCharacterId: this.playerCharacter?.id,
      opponentId: this.opponent?.id,
      playerName: this.playerCharacter?.name,
      opponentName: this.opponent?.name,
      description: log.description
    });
    
    // 根據戰鬥日誌，remaining_hp 應該是被攻擊者的剩餘血量
    // 但讓我們先用更安全的方式：手動計算血量變化
    
    if (log.defender === this.playerCharacter?.id) {
      // 玩家被攻擊
      console.log(`玩家 ${this.playerCharacter?.name} 被攻擊，受到 ${log.damage} 傷害`);
      this.isPlayerBeingAttacked = true;
      
      // 使用 remaining_hp 直接設置
      const newHealth = Math.max(0, log.remaining_hp);
      console.log(`玩家血量: ${this.playerHealth} → ${newHealth}`);
      this.playerHealth = newHealth;
      
      setTimeout(() => { this.isPlayerBeingAttacked = false; }, 500);
      
    } else if (log.defender === this.opponent?.id) {
      // 對手被攻擊
      console.log(`對手 ${this.opponent?.name} 被攻擊，受到 ${log.damage} 傷害`);
      this.isOpponentBeingAttacked = true;
      
      // 使用 remaining_hp 直接設置
      const newHealth = Math.max(0, log.remaining_hp);
      console.log(`對手血量: ${this.opponentHealth} → ${newHealth}`);
      this.opponentHealth = newHealth;
      
      setTimeout(() => { this.isOpponentBeingAttacked = false; }, 500);
    }
    
    // 處理攻擊動畫
    if (log.attacker === this.playerCharacter?.id) {
      console.log(`玩家 ${this.playerCharacter?.name} 發動攻擊`);
      this.isPlayerAttacking = true;
      setTimeout(() => { this.isPlayerAttacking = false; }, 600);
    } else if (log.attacker === this.opponent?.id) {
      console.log(`對手 ${this.opponent?.name} 發動攻擊`);
      this.isOpponentAttacking = true;
      setTimeout(() => { this.isOpponentAttacking = false; }, 600);
    }
  }

  private resetHealth(): void {
    this.playerHealth = this.maxHp;
    this.opponentHealth = this.maxHp;
    this.isPlayerBeingAttacked = false;
    this.isOpponentBeingAttacked = false;
  }

  resetBattle(): void {
    this.battleResult = null;
    this.battleStarted = false;
    this.showResultOverlay = false;
    this.showRewards = false;
    this.battleRewards = null;
    this.energyError = null;
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
  
  private showOnchainToast(text: string, link?: string) {
    const id = ++this.toastSeq;
    this.toasts.unshift({ id, text, link: link || null });
    // 預設 5 秒後自動移除（若之後又推送 Confirmed 會再插入一條）
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
    }, 5000);
  }

  private fetchOnchainInfo(battleId: string, forceSequence = false): void {
    this.onchainService.getBattleOnchain(battleId).subscribe({
      next: (info) => {
        this.onchainStatus = info.onchain_status || null;
        // 即便已是 confirmed，也先跑一次 Pending -> Confirmed 的體驗
        if (forceSequence && info.onchain_status === 'confirmed') {
          this.showOnchainToast('On-chain: Pending...');
          setTimeout(() => {
            this.showOnchainToast('On-chain: Confirmed', info.explorer_url);
          }, 1200);
          return;
        }
        if (info.onchain_status === 'pending') {
          this.showOnchainToast('On-chain: Pending...');
        } else if (info.onchain_status === 'sent') {
          this.showOnchainToast('On-chain: Sent', info.explorer_url);
        } else if (info.onchain_status === 'confirmed') {
          this.showOnchainToast('On-chain: Confirmed', info.explorer_url);
          this.stopOnchainPolling();
        } else if (info.onchain_status === 'failed') {
          this.showOnchainToast('On-chain: Failed', info.explorer_url);
          this.stopOnchainPolling();
        }
      },
      error: () => {
        // 忽略錯誤，不阻塞 UI
      }
    });
  }

  private startOnchainPolling(battleId: string): void {
    this.stopOnchainPolling();
    this.onchainPollingSub = interval(5000).subscribe(() => {
      this.fetchOnchainInfo(battleId);
    });
  }

  private stopOnchainPolling(): void {
    if (this.onchainPollingSub) {
      this.onchainPollingSub.unsubscribe();
      this.onchainPollingSub = null;
    }
  }

  // 將當前血量換算為百分比（0-100）
  getHealthPercent(current: number): number {
    const max = this.maxHp;
    if (max <= 0) return 0;
    const pct = (current / max) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
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
        attacker: player.id,  // 使用 ID 而不是 name
        defender: opponent.id, // 使用 ID 而不是 name
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
        attacker: opponent.id, // 使用 ID 而不是 name
        defender: player.id,   // 使用 ID 而不是 name
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