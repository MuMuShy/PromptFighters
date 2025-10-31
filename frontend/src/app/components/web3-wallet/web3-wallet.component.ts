import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../services/web3.service';
import { AuthService } from '../../services/auth.service';
import { DeviceService } from '../../services/device.service';
import { Router } from '@angular/router';
import { ethers } from 'ethers';

export interface WalletLoginEvent {
  type: 'success' | 'error';
  message?: string;
}

@Component({
  selector: 'app-web3-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="web3-wallet-container">
      <!-- 手機版提示訊息 -->
      <div *ngIf="deviceService.isMobile" class="mobile-hint">
        <div class="hint-card">
          <p>📱 使用手機請透過 MetaMask App 直接瀏覽遊戲，或是用電腦開啟 WalletConnect 即可使用</p>
        </div>
      </div>
      
      <!-- 所有錢包選項（桌面和手機都顯示） -->
      <div class="wallet-grid">
        <button 
          (click)="connectWallet('metamask')" 
          class="wallet-btn"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'metamask'">
          <img src="assets/metamask-seeklogo.svg" alt="MetaMask" class="wallet-icon" />
        </button>
        <button 
          (click)="connectWallet('walletconnect')" 
          class="wallet-btn"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'walletconnect'">
          <img src="assets/walletconnect-seeklogo.svg" alt="WalletConnect" class="wallet-icon" />
        </button>
        <button 
          (click)="connectSocial('google')" 
          class="wallet-btn"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'google'">
          <img src="assets/google-icon-logo-svgrepo-com.svg" alt="Google" class="wallet-icon" />
        </button>
        <button 
          (click)="connectSocial('facebook')" 
          class="wallet-btn"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'facebook'">
          <img src="assets/facebook-color-svgrepo-com.svg" alt="Facebook" class="wallet-icon" />
        </button>
        <button 
          (click)="connectSocial('apple')" 
          class="wallet-btn"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'apple'">
          <img src="assets/apple.svg" alt="Apple" class="wallet-icon" />
        </button>
      </div>
      
      <!-- 連接狀態指示器 -->
      <div *ngIf="isConnecting" class="connecting-overlay">
        <div class="connecting-spinner"></div>
        <p class="connecting-text">正在連接 {{ getConnectingText() }}...</p>
      </div>
    </div>
  `,
  styleUrls: ['./web3-wallet.component.scss']
})
export class Web3WalletComponent {
  @Input() disabled = false;
  @Output() loginResult = new EventEmitter<WalletLoginEvent>();

  isConnecting = false;
  connectingType: string | null = null;

  constructor(
    private web3Service: Web3Service,
    private authService: AuthService,
    private router: Router,
    public  deviceService: DeviceService
  ) {}

  // 連接傳統錢包
  async connectWallet(type: 'metamask' | 'walletconnect' | 'coinbase') {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.connectingType = type;

    try {
      let address: string | null = null;
      if (type === 'metamask') {
        if (!(window as any).ethereum) {
          throw new Error('未偵測到 MetaMask，請先安裝或開啟擴充套件');
        }
        address = await this.web3Service.connectMetamask();
      } else {
        address = await this.web3Service.connectWithThirdweb(type);
      }

      if (!address) {
        throw new Error('錢包連接失敗');
      }

      await this.performWeb3Login(address, type);
    } catch (error: any) {
      console.error(`${type} 登入失敗:`, error);
      this.loginResult.emit({
        type: 'error',
        message: `${type} 登入失敗: ${error.message}`
      });
    } finally {
      this.isConnecting = false;
      this.connectingType = null;
    }
  }

  // 連接社交錢包
  async connectSocial(provider: 'google' | 'facebook' | 'apple') {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.connectingType = provider;

    try {
      const address = await this.web3Service.connectSocial(provider);
      if (!address) {
        throw new Error('社交錢包連接失敗');
      }

      await this.performWeb3Login(address, 'social');
    } catch (error: any) {
      console.error(`${provider} 社交登入失敗:`, error);
      this.loginResult.emit({
        type: 'error',
        message: `${provider} 社交登入失敗: ${error.message}`
      });
    } finally {
      this.isConnecting = false;
      this.connectingType = null;
    }
  }

  // 統一的 Web3 登入處理
  private async performWeb3Login(address: string, loginMethod: string) {
    try {
      // 取得 nonce
      const nonceResp = await this.authService.getWeb3Nonce(address);
      const nonce = nonceResp?.nonce;
      const message = nonceResp?.message;
      
      if (!nonce || !message) {
        throw new Error('無法取得驗證訊息');
      }

      // 簽名
      let signature: string;
      let socialEmail: string | undefined;
      
      if (loginMethod === 'metamask') {
        // 優先使用 thirdweb 當前錢包簽名（避免 unknown account #0）
        if (this.web3Service.currentWallet) {
          const sig = await this.web3Service.signMessage(message);
          if (!sig) throw new Error('簽名失敗');
          signature = sig;
        } else {
          // 回退到原生 MetaMask：先請求帳戶，再取得 signer
          const eth = (window as any).ethereum;
          if (!eth) throw new Error('未偵測到 MetaMask');
          await eth.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.providers.Web3Provider(eth);
          const signer = await provider.getSigner();
          signature = await signer.signMessage(message);
        }
      } else {
        const sig = await this.web3Service.signMessage(message);
        if (!sig) {
          throw new Error('簽名失敗');
        }
        signature = sig;
        
        // 如果是社交錢包，嘗試取得 email 用於帳號整合
        if (loginMethod === 'social' && this.web3Service.currentWallet) {
          try {
            const account = this.web3Service.currentWallet.getAccount();
            if (account && account.details) {
              socialEmail = account.details.email;
            }
          } catch (e) {
            console.log('無法取得社交帳號 email:', e);
          }
        }
      }

      // 後端驗證，傳送登入方法和社交 email
      this.authService.web3Login(address, signature, nonce, loginMethod, socialEmail).subscribe({
        next: (res) => {
          this.loginResult.emit({ type: 'success' });
          this.router.navigate(['/profile']);
        },
        error: (error) => {
          console.error('錢包驗證失敗:', error);
          this.loginResult.emit({
            type: 'error',
            message: '錢包驗證失敗'
          });
        }
      });
    } catch (error: any) {
      throw error;
    }
  }

  // 取得連接中的文字
  getConnectingText(): string {
    const textMap: { [key: string]: string } = {
      'metamask': 'MetaMask',
      'walletconnect': 'WalletConnect',
      'coinbase': 'Coinbase Wallet',
      'google': 'Google 社交錢包',
      'facebook': 'Facebook 社交錢包',
      'apple': 'Apple 社交錢包'
    };
    return textMap[this.connectingType || ''] || '錢包';
  }

}