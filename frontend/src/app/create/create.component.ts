import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterService } from '../services/character.service';
import { CharacterCardComponent } from '../shared/character-card.component';
import { AuthService } from '../services/auth.service';
import { Character } from '../interfaces/character.interface';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule, CharacterCardComponent],
  template: `
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-4xl font-pixel font-bold text-center text-rpg-gold mb-8 animate-pulse-slow">
        🎨 Create Your Character
      </h1>
      <div class="max-w-4xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Creation Form -->
          <div class="rpg-card p-6">
            <h2 class="text-2xl font-bold text-white mb-6">Character Generator</h2>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Character Concept
              </label>
              <input 
                type="text" 
                [(ngModel)]="characterPrompt"
                placeholder="e.g., 炒麵戰士, Shadow Ninja, Fire Mage..."
                class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rpg-gold focus:border-transparent"
                [disabled]="isGenerating">
              <p class="text-xs text-gray-400 mt-1">
                Enter a creative concept for your character. Be imaginative!
              </p>
            </div>
            <button 
              (click)="generateCharacter()"
              [disabled]="!characterPrompt.trim() || isGenerating"
              class="rpg-button w-full mb-4"
              [class.opacity-50]="!characterPrompt.trim() || isGenerating">
              <span *ngIf="!isGenerating">🎲 Generate Character</span>
              <span *ngIf="isGenerating" class="flex items-center justify-center">
                <span class="animate-spin mr-2">⚡</span>
                Generating...
              </span>
            </button>
            <div *ngIf="generatedCharacter && !isGenerating" class="space-y-4">
              <div class="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                <h3 class="text-green-400 font-semibold mb-2">✨ Character Generated!</h3>
                <p class="text-green-200 text-sm">
                  Your character has been created with unique stats and abilities.
                  Review the details and save when ready!
                </p>
              </div>
              <div class="flex space-x-3">
                <button 
                  (click)="saveCharacter()"
                  class="rpg-button flex-1">
                  查看角色
                </button>
                <!-- <button 
                  (click)="generateCharacter()"
                  class="rpg-button-secondary flex-1">
                  🎲 Regenerate
                </button> -->
              </div>
            </div>
            <!-- Tips -->
            <div class="mt-8 bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <h3 class="text-blue-400 font-semibold mb-2">💡 Pro Tips</h3>
              <ul class="text-blue-200 text-sm space-y-1">
                <li>• Mix languages and concepts for unique characters</li>
                <li>• Food-based warriors can be surprisingly powerful</li>
                <li>• Each generation creates different stats and skills</li>
                <li>• Higher stats give advantages in battle</li>
              </ul>
            </div>
          </div>
          <!-- Character Preview -->
          <div class="rpg-card p-6">
            <h2 class="text-2xl font-bold text-white mb-6">Character Preview</h2>
            <div *ngIf="!generatedCharacter" class="text-center py-12">
              <div class="text-6xl mb-4 animate-bounce-slow">🎭</div>
              <h3 class="text-xl font-bold text-white mb-2">Preview</h3>
              <p class="text-gray-300">
                Enter a character concept and generate to see your warrior!
              </p>
            </div>
            <div *ngIf="generatedCharacter">
              <app-character-card [character]="generatedCharacter"></app-character-card>
            </div>
          </div>
        </div>
        <!-- Example Characters -->
        <div class="mt-12">
          <h2 class="text-2xl font-bold text-center text-white mb-6">
            🌟 Example Characters
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              *ngFor="let example of examplePrompts"
              (click)="characterPrompt = example; generateCharacter()"
              class="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600 rounded-lg p-3 text-center transition-all duration-200 hover:scale-105"
              [disabled]="isGenerating">
              <div class="text-2xl mb-1">{{getExampleEmoji(example)}}</div>
              <div class="text-white text-sm font-medium">{{example}}</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CreateComponent {
  characterPrompt = '';
  generatedCharacter: Character | null = null;
  isGenerating = false;

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
        // 啟動自動刷新圖片
        this.characterService.pollCharacterImage(char.id, token).subscribe(updatedChar => {
          this.generatedCharacter = updatedChar;
          if (!updatedChar.image_url.includes('placeholder')) {
            this.isGenerating = false;
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
      this.router.navigate(['/profile']);
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
}