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
}