import { Component, Input, OnInit } from '@angular/core';
import { Character } from '../interfaces/character.interface';
import { CharacterService } from '../services/character.service';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-character-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-card.component.html',
  styleUrls: ['./character-card.component.scss']
})
export class CharacterCardComponent implements OnInit {
  @Input() character!: Character;
  @Input() token: string = '';

  constructor(private characterService: CharacterService) {}

  ngOnInit(): void {
    if (this.character.image_url.includes('placeholder')) {
      this.characterService.pollCharacterImage(this.character.id, this.token).subscribe(updatedChar => {
        this.character = updatedChar;
      });
    }
  }

  getFullImageUrl(imageUrl: string): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http')) return imageUrl;
    return environment.backendBaseUrl + imageUrl;
  }

  get winRate(): number {
    const total = this.character.win_count + this.character.loss_count;
    return total > 0 ? Math.round((this.character.win_count / total) * 100) : 0;
  }

  getRarityLabel(rarity: number): string {
    switch (rarity) {
      case 2: return 'R';
      case 3: return 'SR';
      case 4: return 'SSR';
      case 5: return 'UR';
      default: return 'N';
    }
  }

  getRarityInfo(rarity: number) {
    const rarityMap: { [key: number]: { name: string, color: string, stars: string } } = {
      1: { name: 'N', color: '#888888', stars: '★' },
      2: { name: 'R', color: '#4fd2ff', stars: '★★' },
      3: { name: 'SR', color: '#a259ff', stars: '★★★' },
      4: { name: 'SSR', color: '#ffb300', stars: '★★★★' },
      5: { name: 'UR', color: '#ff3c6e', stars: '★★★★★' }
    };
    return rarityMap[rarity] || rarityMap[1];
  }
}