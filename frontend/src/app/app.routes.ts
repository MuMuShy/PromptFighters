import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProfileComponent } from './profile/profile.component';
import { CreateComponent } from './create/create.component';
import { OAuthCallbackComponent } from './auth/oauth-callback.component';
import { authGuard } from './guards/auth.guard';
import { LandingComponent } from './pages/landing/landing.component';
import { BattlesIntroComponent } from './pages/intro/battles-intro.component';
import { GameGuideComponent } from './pages/intro/game-guide.component';
import { AboutComponent } from './pages/intro/about.component';
import { HeroesIntroComponent } from './pages/intro/heroes-intro.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/:provider/callback', component: OAuthCallbackComponent },
  
  // 介绍页面 - 无需登录
  { path: 'intro/heroes', component: HeroesIntroComponent },
  { path: 'intro/battles', component: BattlesIntroComponent },
  { path: 'intro/guide', component: GameGuideComponent },
  { path: 'intro/about', component: AboutComponent },
  
  { 
    path: 'profile', 
    component: ProfileComponent,
    canActivate: [authGuard]
  },
  {
    path: 'profile/:playerId',
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
  {
    path: 'daily-quests',
    loadComponent: () => import('./components/daily-quests/daily-quests.component').then(m => m.DailyQuestsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'upgrade/:characterId',
    loadComponent: () => import('./upgrade/upgrade.component').then(m => m.UpgradeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'arena',
    loadComponent: () => import('./pages/arena/arena.component').then(m => m.ArenaComponent),
    canActivate: [authGuard]
  },
  {
    path: 'ladder',
    loadComponent: () => import('./pages/ladder/ladder.component').then(m => m.LadderComponent),
    canActivate: [authGuard]
  },
  {
    path: 'my-bets',
    loadComponent: () => import('./pages/my-bets/my-bets.component').then(m => m.MyBetsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'upcoming-battles',
    loadComponent: () => import('./pages/upcoming-battles/upcoming-battles.component').then(m => m.UpcomingBattlesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'battle-history',
    loadComponent: () => import('./pages/battle-history/battle-history.component').then(m => m.BattleHistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'battle-details/:id',
    loadComponent: () => import('./pages/battle-details/battle-details.component').then(m => m.BattleDetailsComponent),
    canActivate: [authGuard]
  },
  { path: '', component: LandingComponent },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy-policy.component').then(m => m.PrivacyPolicyComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms-of-service.component').then(m => m.TermsOfServiceComponent)
  },
  { path: '**', redirectTo: 'login' },
];