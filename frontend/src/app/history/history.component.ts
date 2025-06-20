import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BattleService } from '../services/battle.service';
import { BattleLogComponent } from '../components/battle-log/battle-log.component';
import { Battle } from '../interfaces/battle.interface';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, BattleLogComponent],
  template: `
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-4xl font-pixel font-bold text-center text-rpg-gold mb-8 animate-pulse-slow">
        📜 戰鬥史詩
      </h1>

      <div *ngIf="isLoading" class="text-center">
        <div class="text-4xl animate-spin">⏳</div>
      </div>

      <div *ngIf="!isLoading && battleHistory.length === 0" class="text-center">
        <div class="rpg-card p-8 max-w-md mx-auto">
          <div class="text-6xl mb-4">📜</div>
          <h2 class="text-2xl font-bold text-white mb-4">No Battles Yet</h2>
          <p class="text-gray-300 mb-6">
            Your legend is yet to be written. Go forth and fight!
          </p>
          <a routerLink="/battle" class="rpg-button inline-block">
            前往戰鬥
          </a>
        </div>
      </div>

      <div *ngIf="!isLoading && battleHistory.length > 0" class="max-w-4xl mx-auto">
        <!-- Statistics Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="rpg-card p-6 text-center">
            <div class="text-3xl font-bold text-green-400 mb-2">{{totalWins}}</div>
            <div class="text-green-300 text-sm">Total Victories</div>
          </div>
          <div class="rpg-card p-6 text-center">
            <div class="text-3xl font-bold text-red-400 mb-2">{{totalLosses}}</div>
            <div class="text-red-300 text-sm">Total Defeats</div>
          </div>
          <div class="rpg-card p-6 text-center">
            <div class="text-3xl font-bold text-yellow-400 mb-2">{{overallWinRate}}%</div>
            <div class="text-yellow-300 text-sm">Overall Win Rate</div>
          </div>
        </div>

        <!-- Battle List -->
        <div class="space-y-4">
          <div *ngFor="let battle of battleHistory; trackBy: trackByBattleId" 
               class="rpg-card p-6">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
              <div class="flex items-center space-x-4 mb-4 lg:mb-0">
                <div class="text-4xl">
                  {{battle.winner.id === battle.character1.id ? '👑' : '💀'}}
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white">
                    {{battle.character1.name}} vs {{battle.character2.name}}
                  </h3>
                  <p class="text-gray-400 text-sm">{{battle.created_at | date:'medium'}}</p>
                </div>
              </div>
              
              <div class="flex items-center space-x-4">
                <div class="text-center">
                  <div class="font-bold text-lg"
                       [ngClass]="{
                         'text-green-400': battle.winner.id === battle.character1.id,
                         'text-red-400': battle.winner.id !== battle.character1.id
                       }">
                    {{battle.winner.id === battle.character1.id ? 'VICTORY' : 'DEFEAT'}}
                  </div>
                </div>
                <button 
                  (click)="toggleBattleLog(battle.id)"
                  class="rpg-button-secondary text-sm">
                  {{expandedBattles.has(battle.id) ? 'Hide' : 'Show'}} Log
                </button>
              </div>
            </div>

            <!-- Battle Summary -->
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="bg-blue-900/30 rounded-lg p-3 border border-blue-500/30">
                <h4 class="font-semibold text-blue-300 mb-2">{{battle.character1.name}}</h4>
                <div class="text-sm space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-400">Strength:</span>
                    <span class="text-white">{{battle.character1.strength}}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Agility:</span>
                    <span class="text-white">{{battle.character1.agility}}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Luck:</span>
                    <span class="text-white">{{battle.character1.luck}}</span>
                  </div>
                </div>
              </div>
              
              <div class="bg-red-900/30 rounded-lg p-3 border border-red-500/30">
                <h4 class="font-semibold text-red-300 mb-2">{{battle.character2.name}}</h4>
                <div class="text-sm space-y-1">
                  <div class="flex justify-between">
                    <span class="text-gray-400">Strength:</span>
                    <span class="text-white">{{battle.character2.strength}}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Agility:</span>
                    <span class="text-white">{{battle.character2.agility}}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Luck:</span>
                    <span class="text-white">{{battle.character2.luck}}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Expandable Battle Log -->
            <div *ngIf="expandedBattles.has(battle.id)" class="mt-4">
              <app-battle-log [battleResult]="battle"></app-battle-log>
            </div>
          </div>
        </div>

        <!-- Load More Button (if needed) -->
        <div *ngIf="battleHistory.length >= 10" class="text-center mt-8">
          <button class="rpg-button-secondary">
            Load More Battles
          </button>
        </div>
      </div>
    </div>
  `,
  // styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  battleHistory: Battle[] = [];
  expandedBattles = new Set<string>();
  isLoading = true;

  constructor(private battleService: BattleService) {}

  ngOnInit(): void {
    this.battleService.battleHistory$.subscribe(history => {
      this.battleHistory = history;
      this.isLoading = false;
    });
  }

  get totalWins(): number {
    return this.battleHistory.filter(battle => battle.winner.id === battle.character1.id).length;
  }

  get totalLosses(): number {
    return this.battleHistory.filter(battle => battle.winner.id !== battle.character1.id).length;
  }

  get overallWinRate(): number {
    const total = this.battleHistory.length;
    return total > 0 ? Math.round((this.totalWins / total) * 100) : 0;
  }

  toggleBattleLog(battleId: string): void {
    if (this.expandedBattles.has(battleId)) {
      this.expandedBattles.delete(battleId);
    } else {
      this.expandedBattles.add(battleId);
    }
  }

  trackByBattleId(index: number, battle: Battle): string {
    return battle.id;
  }
}