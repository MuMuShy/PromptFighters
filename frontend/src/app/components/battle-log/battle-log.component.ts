import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { Battle } from '../../interfaces/battle.interface';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-battle-log',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MediaUrlPipe
  ],
  templateUrl: './battle-log.component.html',
  styleUrls: ['./battle-log.component.scss']
})
export class BattleLogComponent implements OnInit, AfterViewChecked, OnChanges {
  @Input() battleResult!: Battle;
  @Input() currentRound: number = 0;
  @ViewChild('logContainer') logContainer!: ElementRef;
  private lastRound = 0;
  animatedHp: number[] = [];

  constructor() {
    console.log('BattleLogComponent constructed');
  }

  ngOnInit(): void {
    console.log('Battle Result:', this.battleResult);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentRound'] && this.battleResult) {
      this.animateHp();
    }
  }

  ngAfterViewChecked(): void {
    if (this.currentRound !== this.lastRound) {
      this.scrollToBottom();
      this.lastRound = this.currentRound;
    }
  }

  animateHp(): void {
    if (!this.battleResult) return;
    const logs = this.battleResult.battle_log.battle_log;
    // 只對新顯示的那一回合做動畫
    for (let i = 0; i < this.currentRound; i++) {
      this.animatedHp[i] = logs[i].remaining_hp;
    }
    if (this.currentRound > 0) {
      const idx = this.currentRound - 1;
      const target = logs[idx].remaining_hp;
      let from = idx > 0 ? logs[idx - 1].remaining_hp : 100;
      if (from === undefined) from = 100;
      if (from === target) {
        this.animatedHp[idx] = target;
        return;
      }
      const step = (from - target) / 20;
      let current = from;
      this.animatedHp[idx] = from;
      const interval = setInterval(() => {
        current -= step;
        if ((step > 0 && current <= target) || (step < 0 && current >= target)) {
          this.animatedHp[idx] = target;
          clearInterval(interval);
        } else {
          this.animatedHp[idx] = Math.round(current);
        }
      }, 20);
    }
  }

  scrollToBottom(): void {
    try {
      if (this.logContainer) {
        this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  isWinner(name: string): boolean {
    return this.battleResult.winner.name === name;
  }
} 