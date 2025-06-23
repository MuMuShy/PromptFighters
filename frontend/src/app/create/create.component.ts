import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { CharacterCardComponent } from '../shared/character-card.component';
import { AuthService } from '../services/auth.service';
import { Character } from '../interfaces/character.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterCardComponent],
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.scss']
})
export class CreateComponent {
  mode: 'normal' | 'advanced' = 'normal';
  characterPrompt = '';
  advancedName = '';
  advancedPrompt = '';
  generatedCharacter: Character | null = null;
  isGenerating = false;
  showSuccessModal = false;

  examplePrompts = [
    '炒麵戰士',
    'Pizza Knight',
    'Sushi Ninja',
    'Bubble Tea Mage',
    'Ramen Master',
    'Taco Berserker',
    'Ice Cream Paladin',
    'Coffee Wizard'
  ];

  constructor(
    private characterService: CharacterService,
    private authService: AuthService,
    private router: Router
  ) {}

  generateCharacter(): void {
    if (!this.characterPrompt.trim()) return;
    this.isGenerating = true;
    const token = this.authService.getToken() || '';
    this.characterService.createCharacter(this.characterPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.isGenerating = false;
            this.showSuccessModal = true;
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        alert('建立失敗');
        this.isGenerating = false;
      }
    });
  }

  generateAdvancedCharacter(): void {
    if (!this.advancedPrompt.trim()) return;
    this.isGenerating = true;
    const token = this.authService.getToken() || '';
    this.characterService.advancedSummonCharacter(this.advancedName.trim(), this.advancedPrompt.trim(), token).subscribe({
      next: (char) => {
        this.generatedCharacter = char;
        const sub = this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.isGenerating = false;
            this.showSuccessModal = true;
            sub.unsubscribe();
          }
        });
      },
      error: (err) => {
        alert('建立失敗');
        this.isGenerating = false;
      }
    });
  }

  saveCharacter(): void {
    if (this.generatedCharacter) {
      this.characterService.saveCharacter(this.generatedCharacter);
      this.router.navigate(['/battle']);
    }
  }

  getExampleEmoji(prompt: string): string {
    const emojiMap: { [key: string]: string } = {
      '炒麵戰士': '🍜',
      'Pizza Knight': '🍕',
      'Sushi Ninja': '🍣',
      'Bubble Tea Mage': '🧋',
      'Ramen Master': '🍜',
      'Taco Berserker': '🌮',
      'Ice Cream Paladin': '🍦',
      'Coffee Wizard': '☕'
    };
    return emojiMap[prompt] || '⚔️';
  }

  closeModal(): void {
    this.showSuccessModal = false;
  }
}