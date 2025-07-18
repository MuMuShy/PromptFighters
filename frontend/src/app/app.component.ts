import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './services/auth.service';
import { PlayerService } from './services/player.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { HealthCheckService } from './services/health-check.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  isMenuOpen = false;
  isLandingPage = false;
  isBattlePage = false;
  isServerOnline$: Observable<boolean>;
  gold = 0;
  prompt = 0;
  promptPower = 0;
  expPotion = 0;
  energy = 0;

  constructor(
    private healthCheckService: HealthCheckService,
    private playerService: PlayerService
  ) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      this.isLandingPage = (url === '/');
      this.isBattlePage = (url === '/battle');
      
      // 當導航到非 landing page 且已登入時，載入資源
      if (!this.isLandingPage && this.isLoggedIn) {
        this.loadPlayerResources();
      }
    });
    this.isServerOnline$ = this.healthCheckService.serverStatus$;
  }

  ngOnInit(): void {
    console.log('ngOnInit');
    console.log(this.isLoggedIn);
    this.healthCheckService.startPeriodicChecks();
    
    // 訂閱資源變化
    this.playerService.resources$.subscribe(resources => {
      this.gold = resources.gold;
      this.prompt = resources.prompt;
      this.promptPower = resources.prompt_power;
      this.expPotion = resources.exp_potion;
      this.energy = resources.energy;
    });
    
    // 只要已登入且不在 /profile 就自動導向 /profile
    if (this.isLoggedIn && this.router.url !== '/profile') {
      this.router.navigate(['/profile']);
    }
  }

  private loadPlayerResources(): void {
    this.playerService.getResources().subscribe({
      next: (resources) => {
        // 資源會透過 subscription 自動更新
      },
      error: (error) => {
        console.error('Failed to load player resources:', error);
      }
    });
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  logout() {
    this.auth.logout();
    this.closeMenu();
  }
}
