import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';
import { CreateComponent } from './create/create.component';
import { OAuthCallbackComponent } from './auth/oauth-callback.component';
import { authGuard } from './guards/auth.guard';
import { LandingComponent } from './pages/landing/landing.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/:provider/callback', component: OAuthCallbackComponent },
  { 
    path: 'profile', 
    component: ProfileComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'create', 
    component: CreateComponent,
    canActivate: [authGuard]
  },
  {
    path: 'battle',
    loadComponent: () => import('./battle/battle.component').then(m => m.BattleComponent),
    canActivate: [authGuard]
  },
  {
    path: 'history',
    loadComponent: () => import('./history/history.component').then(m => m.HistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./pages/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
    canActivate: [authGuard]
  },
  { path: '', component: LandingComponent },
  { path: '**', redirectTo: '/' },
];