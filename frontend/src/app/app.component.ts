import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { HealthCheckService } from './services/health-check.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  template: `
    <!-- 維護中畫面: 只有在非 Landing Page 且伺服器離線時顯示 -->
    <div *ngIf="!isLandingPage && !(isServerOnline$ | async)" class="maintenance-overlay">
      <div class="maintenance-content">
        <img src="/assets/og_image.png" alt="Logo" class="logo">
        <h1 class="title">系統維護中</h1>
        <p class="message">我們正在進行必要的更新與維護，<br>請稍後再回來查看。</p>
        <div class="spinner"></div>
      </div>
    </div>

    <!-- 主要應用程式內容: 永遠顯示 Landing Page，或在伺服器在線時顯示其他頁面 -->
    <ng-container *ngIf="isLandingPage || (isServerOnline$ | async)">
      
      <!-- Landing Page 的 router-outlet 是獨立的 -->
      <router-outlet *ngIf="isLandingPage"></router-outlet>
      
      <!-- 其他頁面的佈局 -->
      <div *ngIf="!isLandingPage" class="app-container">
        <nav class="bg-black/30 backdrop-blur-sm border-b border-rpg-gold/30 sticky top-0 z-50 flex-shrink-0">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
              <div class="flex-shrink-0">
                <a routerLink="/" class="text-xl font-pixel font-bold text-rpg-gold">⚔️ AI大亂鬥</a>
              </div>
              <!-- Desktop Menu -->
              <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                  <a routerLink="/profile" class="nav-link">Profile</a>
                  <a routerLink="/create" class="nav-link">Create</a>
                  <a routerLink="/battle" class="nav-link">Battle</a>
                  <a routerLink="/leaderboard" class="nav-link">Leaderboard</a>
                  <button *ngIf="isLoggedIn" (click)="logout()" class="logout-btn">登出</button>
                </div>
              </div>
              <!-- Mobile Menu Button -->
              <div class="-mr-2 flex md:hidden">
                <button (click)="toggleMenu()" type="button" class="mobile-menu-btn" aria-controls="mobile-menu" aria-expanded="false">
                  <span class="sr-only">Open main menu</span>
                  <svg *ngIf="!isMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  <svg *ngIf="isMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
          <!-- Mobile menu -->
          <div class="md:hidden" id="mobile-menu" *ngIf="isMenuOpen">
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a routerLink="/profile" (click)="closeMenu()" class="mobile-nav-link">Profile</a>
              <a routerLink="/create" (click)="closeMenu()" class="mobile-nav-link">Create</a>
              <a routerLink="/battle" (click)="closeMenu()" class="mobile-nav-link">Battle</a>
              <a routerLink="/leaderboard" (click)="closeMenu()" class="mobile-nav-link">Leaderboard</a>
              <button *ngIf="isLoggedIn" (click)="logout(); closeMenu();" class="w-full text-left mobile-nav-link">登出</button>
            </div>
          </div>
        </nav>

        <main class="main-content" [class.contained-view]="!isBattlePage">
          <router-outlet></router-outlet>
        </main>
      </div>
      
    </ng-container>
  `,
  styles: [`
    /* Maintenance Overlay Styles are added here for completeness */
    .maintenance-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #111827; /* bg-gray-900 */
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      color: #d1d5db; /* text-gray-300 */
      text-align: center;
      font-family: 'Noto Sans TC', sans-serif;
    }

    .maintenance-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      padding: 2rem;
    }

    .maintenance-content .logo { width: 100px; height: auto; opacity: 0.8; }
    .maintenance-content .title { font-size: 2.5rem; font-weight: bold; color: #fcd34d; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
    .maintenance-content .message { font-size: 1.2rem; line-height: 1.6; max-width: 400px; }
    .maintenance-content .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(252, 211, 77, 0.2);
      border-top-color: #fcd34d;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-top: 1rem;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Original styles from the user */
    .app-container {
      @apply min-h-screen bg-gradient-to-br from-rpg-dark via-rpg-purple to-rpg-blue;
      display: flex;
      flex-direction: column;
    }
    .main-content {
      flex-grow: 1; /* This makes the main content fill the rest of the vertical space */
      display: flex;
      flex-direction: column;
    }
    /* This ensures the component rendered inside router-outlet also grows */
    .main-content > *:first-child {
      flex-grow: 1;
    }
    .contained-view {
      @apply max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8;
    }
    
    /* Common link styles */
    .nav-link { @apply text-white hover:text-rpg-gold transition-colors px-3 py-2 rounded-md text-sm font-medium; }
    .logout-btn { @apply ml-4 px-3 py-2 rounded-md bg-rpg-gold text-black font-bold hover:bg-yellow-400 transition-colors; }
    .mobile-menu-btn { @apply inline-flex items-center justify-center p-2 rounded-md text-rpg-gold hover:text-white hover:bg-white/10 focus:outline-none; }
    .mobile-nav-link { @apply text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium; }
  `]
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  isMenuOpen = false;
  isLandingPage = false;
  isBattlePage = false;
  isServerOnline$: Observable<boolean>;

  constructor(private healthCheckService: HealthCheckService) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      this.isLandingPage = (url === '/');
      this.isBattlePage = (url === '/battle');
    });
    this.isServerOnline$ = this.healthCheckService.serverStatus$;
  }

  ngOnInit(): void {
    this.healthCheckService.startPeriodicChecks();
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
