import { Component, NgZone, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

declare global {
  interface Window { handleCredentialResponse: (response: any) => void; }
}
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  template: `
    <div class="login-container">
      <div class="rpg-card p-10 max-w-sm w-full text-center">
        <h1 class="title">🎮 AI Hero Battle</h1>
        <div class="text-center mb-8">
          <h2 class="subtitle">歡迎來到英雄對戰</h2>
          <p class="text-gray-300 mb-4">使用以下方式登入以開始你的冒險</p>
        </div>
        <div class="space-y-4">
          <div id="google-signin-btn"></div>
        </div>
        <div class="terms">
          <p>登入即表示您同意我們的</p>
          <div class="mt-1 space-x-2">
            <a href="#" target="_blank">服務條款</a>
            <span>和</span>
            <a href="#" target="_blank">隱私政策</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit {
  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    window.handleCredentialResponse = (response: any) => {
      const id_token = response.credential;
      this.auth.socialLogin('google', id_token).subscribe({
        next: (res) => {
          this.ngZone.run(() => this.router.navigate(['/profile']));
        },
        error: (error) => {
          console.error('Login failed:', error);
          if (error.status === 401) {
            console.error('Unauthorized - Check if the token is valid');
          } else if (error.status === 400) {
            console.error('Bad Request - Check the request format');
          }
        }
      });
    };
  }

  ngAfterViewInit(): void {
    const tryRenderGoogleButton = (retryCount = 5) => {
      const g = (window as any).google;
      if (g && g.accounts && g.accounts.id) {
        // --- Google's GSI script is ready ---
        g.accounts.id.initialize({
          client_id: '950693364773-f8v3kpslccvtt645k13adlh661fpma6a.apps.googleusercontent.com',
          callback: window.handleCredentialResponse,
          auto_select: false
        });
        g.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large' }
        );
      } else if (retryCount > 0) {
        // --- Script not ready, try again in 300ms ---
        setTimeout(() => tryRenderGoogleButton(retryCount - 1), 300);
      } else {
        // --- Failed after multiple retries ---
        console.error('Google Sign-In script failed to load after multiple retries.');
      }
    };

    // Start the rendering attempt
    tryRenderGoogleButton();
  }
} 