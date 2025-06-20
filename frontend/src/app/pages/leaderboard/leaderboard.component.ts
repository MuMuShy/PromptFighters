import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterService } from '../../services/character.service';
import { Character } from '../../interfaces/character.interface';
import { RouterModule } from '@angular/router';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MediaUrlPipe],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: Character[] = [];
  isLoading = true;

  constructor(private characterService: CharacterService) { }

  ngOnInit(): void {
    this.characterService.getLeaderboard().subscribe({
      next: (data) => {
        this.leaderboard = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load leaderboard', err);
        this.isLoading = false;
      }
    });
  }
} 