import { Component, NgZone, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Web3Service } from '../services/web3.service';
import { ethers } from 'ethers';

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
        <h1 class="title">Prompt Fighters</h1>
        <div class="text-center mb-8">
          <h2 class="subtitle">歡迎來到英雄對戰</h2>
          <p class="text-gray-300 mb-4">使用以下方式登入以開始你的冒險</p>
        </div>
        <div class="space-y-4">
          <div *ngIf="isLoadingGoogle" class="google-loading">
            <div class="loading-spinner"></div>
            <p>正在載入登入按鈕...</p>
          </div>
          <div id="google-signin-btn"></div>
          <button *ngIf="showFallbackButton" 
                  (click)="retryGoogleButton()" 
                  class="fallback-button">
            重新載入登入按鈕
          </button>
          <button (click)="loginWithWallet()" class="wallet-login-btn simple-metamask-btn">
            以錢包登入 (Metamask)
          </button>
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
    private auth: AuthService,
    private web3Service: Web3Service
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
    timer(100).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.tryRenderGoogleButton();
    });
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

  async loginWithWallet() {
    const address = await this.web3Service.connectMetamask();
    if (!address) {
      alert('錢包連接失敗');
      return;
    }
    try {
      // 1. 取得 nonce 與 message
      const nonceResp = await this.auth.getWeb3Nonce(address);
      const nonce = nonceResp?.nonce;
      const message = nonceResp?.message;
      if (!nonce || !message) {
        alert('無法取得驗證訊息');
        return;
      }

      console.log('Sign message:', message);

      // 3. 用錢包簽名 message
      const provider = (window as any).ethereum
        ? new ethers.BrowserProvider((window as any).ethereum)
        : null;
      if (!provider) {
        alert('找不到錢包提供者');
        return;
      }
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      // 4. 呼叫 AuthService 統一處理登入
      this.auth.web3Login(address, signature, nonce).subscribe({
        next: (res) => {
          this.router.navigate(['/profile']);
        },
        error: () => alert('錢包驗證失敗'),
      });
    } catch (err) {
      console.error('登入流程失敗', err);
      alert('登入流程失敗');
    }
  }
} 