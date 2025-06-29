import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CharacterService } from '../../services/character.service';
import { Character } from '../../interfaces/character.interface';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';
import { PlayerService, PlayerResources } from '../../services/player.service';

@Component({
  standalone: true,
  selector: 'app-character-detail',
  templateUrl: './character-detail.component.html',
  styleUrls: ['./character-detail.component.scss'],
  imports: [CommonModule, MediaUrlPipe]
})
export class CharacterDetailComponent implements OnInit {
  character: Character | null = null;
  maxExp: number = 0;
  expPotion: number = 0;

  constructor(
    private route: ActivatedRoute,
    private characterService: CharacterService,
    private playerService: PlayerService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const token = localStorage.getItem('your-token-key') || '';
    if (id) {
      this.characterService.getCharacter(id, token).subscribe(char => {
        this.character = char;
        this.maxExp = this.getMaxExp(char.level);
      });
    }
    this.playerService.getResources().subscribe(res => {
      this.expPotion = res.exp_potion;
    });
  }

  getMaxExp(level: number): number {
    const LEVEL_CONFIGS: any = {
      1: 100, 2: 120, 3: 150, 4: 200, 5: 270, 6: 350, 7: 450, 8: 600, 9: 800, 10: 1000,
      11: 1200, 12: 1440, 13: 1720, 14: 2060, 15: 2470, 16: 2960, 17: 3550, 18: 4260, 19: 5110, 20: 6130,
      21: 7350, 22: 8820, 23: 10580, 24: 12700, 25: 15240, 26: 18290, 27: 21950, 28: 26340, 29: 31610, 30: 37930,
      31: 45520, 32: 54620, 33: 65540, 34: 78650, 35: 94380, 36: 113260, 37: 135910, 38: 163090, 39: 195710, 40: 234850,
      41: 281820, 42: 338180, 43: 405820, 44: 486980, 45: 584380, 46: 701260, 47: 841510, 48: 1009810, 49: 1211770, 50: 0
    };
    return LEVEL_CONFIGS[level] || 0;
  }

  get expPercent(): number {
    if (!this.character || !this.maxExp) return 0;
    return Math.min(100, Math.round((this.character.experience / this.maxExp) * 100));
  }

  levelUp() {
    // TODO: 串接升級API
    alert('升級功能尚未實作');
  }
}