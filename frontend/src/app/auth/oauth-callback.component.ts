import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="flex items-center justify-center min-h-screen bg-gray-900">
      <div class="text-center text-white">
        <mat-spinner color="accent" diameter="80" class="mx-auto"></mat-spinner>
        <h2 class="text-xl text-white mb-4 mt-6">登入中...</h2>
        <p>正在為您連接到魔法世界...</p>
      </div>
    </div>
  `
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    console.log('OAuthCallbackComponent initialized');
    // 获取URL中的授权码
    const code = this.route.snapshot.queryParamMap.get('code');
    const provider = this.route.snapshot.paramMap.get('provider');
    const redirectUri = `${window.location.origin}/auth/${provider}/callback`;

    if (!code || !provider) {
      this.router.navigate(['/login']);
      return;
    }

    // 发送授权码到后端进行验证
    this.auth.oauthLogin(provider, code, redirectUri).subscribe({
      next: (response) => {
        this.auth.setTokens(response.access, response.refresh);
        const redirectUrl = localStorage.getItem('redirectAfterLogin') || '/profile';
        localStorage.removeItem('redirectAfterLogin');
        this.router.navigate([redirectUrl]);
      },
      error: (error) => {
        console.error('OAuth login failed:', error);
        this.router.navigate(['/login']);
      }
    });
  }
} 