import { Component, NgZone, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { Web3WalletComponent, WalletLoginEvent } from '../components/web3-wallet/web3-wallet.component';
declare global {
  interface Window { handleCredentialResponse: (response: any) => void; }
}
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, Web3WalletComponent],
  template: `
    <div class="login-container">
      <div class="rpg-card p-10 max-w-sm w-full text-center">
        <h1 class="title">登入</h1>
        <!-- <div class="text-center mb-8">
          <h2 class="subtitle">歡迎來到英雄對戰</h2>
          <p class="text-gray-300 mb-4">使用以下方式登入以開始你的冒險</p>
        </div> -->
        <div class="space-y-4">
          <!-- <div *ngIf="isLoadingGoogle" class="google-loading">
            <div class="loading-spinner"></div>
            <p>正在載入登入按鈕...</p>
          </div>
          <div id="google-signin-btn"></div>
          <button *ngIf="showFallbackButton" 
                  (click)="retryGoogleButton()" 
                  class="fallback-button">
            重新載入登入按鈕
          </button> -->
          
          <!-- Web3 錢包登入組件 -->
          <app-web3-wallet 
            [disabled]="isLoadingGoogle"
            (loginResult)="onWalletLoginResult($event)">
          </app-web3-wallet>
        </div>
        <div class="terms">
          <p>登入即表示您同意我們的</p>
          <div class="mt-1 space-x-2">
            <a href="/terms" target="_blank">服務條款</a>
            <span>和</span>
            <a href="/privacy" target="_blank">隱私政策</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  isLoadingGoogle = true;
  showFallbackButton = false;
  private destroy$ = new Subject<void>();
  private renderAttempts = 0;
  private maxRenderAttempts = 10;

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/profile']);
      return;
    }

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
    // timer(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
    //   this.tryRenderGoogleButton();
    // });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private tryRenderGoogleButton(): void {
    this.renderAttempts++;
    this.isLoadingGoogle = true;
    this.showFallbackButton = false;

    const g = (window as any).google;
    const buttonElement = document.getElementById('google-signin-btn');

    if (g && g.accounts && g.accounts.id && buttonElement) {
      try {
        buttonElement.innerHTML = '';
        
        g.accounts.id.initialize({
          client_id: '950693364773-f8v3kpslccvtt645k13adlh661fpma6a.apps.googleusercontent.com',
          callback: window.handleCredentialResponse,
          auto_select: false
        });

        g.accounts.id.renderButton(buttonElement, { 
          theme: 'outline', 
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular'
        });

        this.isLoadingGoogle = false;
        console.log('Google Sign-In button rendered successfully');
        
      } catch (error) {
        console.error('Error rendering Google button:', error);
        this.handleRenderFailure();
      }
    } else if (this.renderAttempts < this.maxRenderAttempts) {
      const delay = Math.min(300 * this.renderAttempts, 2000);
      console.log(`Google Sign-In not ready, retrying in ${delay}ms (attempt ${this.renderAttempts}/${this.maxRenderAttempts})`);
      
      timer(delay).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.tryRenderGoogleButton();
      });
    } else {
      this.handleRenderFailure();
    }
  }

  private handleRenderFailure(): void {
    this.isLoadingGoogle = false;
    this.showFallbackButton = true;
    console.error('Google Sign-In button failed to render after multiple attempts');
  }

  retryGoogleButton(): void {
    this.renderAttempts = 0;
    this.tryRenderGoogleButton();
  }

  // 處理 Web3 錢包登入結果
  onWalletLoginResult(event: WalletLoginEvent) {
    if (event.type === 'error') {
      console.error('錢包登入失敗:', event.message);
      alert(event.message || '錢包登入失敗');
    }
    // 成功情況由 Web3WalletComponent 內部處理跳轉
  }
} 