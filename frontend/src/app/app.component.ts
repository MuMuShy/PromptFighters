import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-rpg-dark via-rpg-purple to-rpg-blue">
      <nav class="bg-black/30 backdrop-blur-sm border-b border-rpg-gold/30 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex-shrink-0">
              <h1 class="text-xl font-pixel font-bold text-rpg-gold">⚔️ AI大亂鬥</h1>
            </div>
            <!-- Desktop Menu -->
            <div class="hidden md:block">
              <div class="ml-10 flex items-baseline space-x-4">
                <a routerLink="/profile" class="text-white hover:text-rpg-gold transition-colors px-3 py-2 rounded-md text-sm font-medium">Profile</a>
                <a routerLink="/create" class="text-white hover:text-rpg-gold transition-colors px-3 py-2 rounded-md text-sm font-medium">Create</a>
                <a routerLink="/battle" class="text-white hover:text-rpg-gold transition-colors px-3 py-2 rounded-md text-sm font-medium">Battle</a>
                <a routerLink="/leaderboard" class="text-white hover:text-rpg-gold transition-colors px-3 py-2 rounded-md text-sm font-medium">Leaderboard</a>
                <button *ngIf="isLoggedIn" (click)="logout()" class="ml-4 px-3 py-2 rounded-md bg-rpg-gold text-black font-bold hover:bg-yellow-400 transition-colors">登出</button>
              </div>
            </div>
            <!-- Mobile Menu Button -->
            <div class="-mr-2 flex md:hidden">
              <button (click)="toggleMenu()" type="button" class="inline-flex items-center justify-center p-2 rounded-md text-rpg-gold hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white" aria-controls="mobile-menu" aria-expanded="false">
                <span class="sr-only">Open main menu</span>
                <!-- Icon when menu is closed. -->
                <svg *ngIf="!isMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <!-- Icon when menu is open. -->
                <svg *ngIf="isMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile menu, show/hide based on menu state. -->
        <div class="md:hidden" id="mobile-menu" *ngIf="isMenuOpen">
          <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a routerLink="/profile" (click)="closeMenu()" class="text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium">Profile</a>
            <a routerLink="/create" (click)="closeMenu()" class="text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium">Create</a>
            <a routerLink="/battle" (click)="closeMenu()" class="text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium">Battle</a>
            <a routerLink="/leaderboard" (click)="closeMenu()" class="text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium">Leaderboard</a>
            <button *ngIf="isLoggedIn" (click)="logout(); closeMenu();" class="w-full text-left text-white hover:text-rpg-gold block px-3 py-2 rounded-md text-base font-medium">登出</button>
          </div>
        </div>
      </nav>
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  auth = inject(AuthService);
  router = inject(Router);
  isMenuOpen = false;

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
