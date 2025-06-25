import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Web3Service } from '../../services/web3.service';
import { AuthService } from '../../services/auth.service';
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
      <div class="wallet-grid" style="margin-top:1.2rem;grid-template-columns:repeat(2,1fr);gap:1.2rem 1.2rem;">
        <button 
          (click)="connectOther('email')" 
          class="wallet-btn long"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'email'">
          <span class="wallet-name">Email登入</span>
        </button>
        <button 
          (click)="connectOther('phone')" 
          class="wallet-btn long"
          [disabled]="isConnecting"
          [class.loading]="connectingType === 'phone'">
          <span class="wallet-name">手機登入</span>
        </button>
      </div>
      <!-- 連接狀態指示器 -->
      <div *ngIf="isConnecting" class="connecting-overlay">
        <div class="connecting-spinner"></div>
        <p class="connecting-text">正在連接 {{ getConnectingText() }}...</p>
      </div>
      <!-- Email/Phone 輸入彈窗 -->
      <div *ngIf="showInputModal" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ modalData.title }}</h3>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <input 
              #inputField
              [type]="modalData.inputType"
              [placeholder]="modalData.placeholder"
              [(ngModel)]="inputValue"
              class="modal-input"
              (keyup.enter)="confirmInput()"
              autofocus>
            <div *ngIf="showCodeInput" class="verification-section">
              <p class="verification-hint">請檢查您的{{ modalData.type === 'email' ? 'Email' : '手機簡訊' }}，輸入收到的驗證碼</p>
              <input 
                type="text"
                placeholder="請輸入 6 位數驗證碼"
                [(ngModel)]="verificationCode"
                class="modal-input verification-input"
                maxlength="6"
                (keyup.enter)="confirmVerification()">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="closeModal()">取消</button>
            <button 
              class="btn-confirm" 
              (click)="showCodeInput ? confirmVerification() : confirmInput()"
              [disabled]="!inputValue || (showCodeInput && !verificationCode)">
              {{ showCodeInput ? '驗證' : '發送驗證碼' }}
            </button>
          </div>
        </div>
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
  showInputModal = false;
  showCodeInput = false;
  inputValue = '';
  verificationCode = '';
  
  modalData: {
    type: 'email' | 'phone';
    title: string;
    placeholder: string;
    inputType: string;
  } = {
    type: 'email',
    title: '',
    placeholder: '',
    inputType: 'text'
  };

  constructor(
    private web3Service: Web3Service,
    private authService: AuthService,
    private router: Router
  ) {}

  // 連接傳統錢包
  async connectWallet(type: 'metamask' | 'walletconnect' | 'coinbase') {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.connectingType = type;

    try {
      let address: string | null = null;

      if (type === 'metamask') {
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

  // 連接其他方式
  async connectOther(type: 'email' | 'phone') {
    if (this.isConnecting) return;
    
    this.modalData = {
      type,
      title: type === 'email' ? '請輸入 Email 地址' : '請輸入手機號碼',
      placeholder: type === 'email' ? '例如: user@example.com' : '例如: +886912345678',
      inputType: type === 'email' ? 'email' : 'tel'
    };
    
    this.inputValue = '';
    this.verificationCode = '';
    this.showCodeInput = false;
    this.showInputModal = true;
  }

  // 確認輸入
  async confirmInput() {
    if (!this.inputValue.trim()) return;

    this.isConnecting = true;
    this.connectingType = this.modalData.type;

    try {
      // 發送驗證碼
      await this.web3Service.sendVerificationCode(this.modalData.type, this.inputValue);
      this.showCodeInput = true;
    } catch (error: any) {
      console.error('發送驗證碼失敗:', error);
      this.loginResult.emit({
        type: 'error',
        message: '發送驗證碼失敗: ' + error.message
      });
      this.closeModal();
    }
  }

  // 確認驗證碼
  async confirmVerification() {
    if (!this.verificationCode.trim()) return;

    try {
      const address = await this.web3Service.connectWithVerification(
        this.modalData.type,
        this.inputValue,
        this.verificationCode
      );

      if (!address) {
        throw new Error('驗證失敗');
      }

      await this.performWeb3Login(address, this.modalData.type);
      this.closeModal();
    } catch (error: any) {
      console.error('驗證失敗:', error);
      this.loginResult.emit({
        type: 'error',
        message: '驗證失敗: ' + error.message
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
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        const signer = await provider.getSigner();
        signature = await signer.signMessage(message);
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

  // 關閉彈窗
  closeModal() {
    this.showInputModal = false;
    this.showCodeInput = false;
    this.inputValue = '';
    this.verificationCode = '';
    this.isConnecting = false;
    this.connectingType = null;
  }

  // 取得連接中的文字
  getConnectingText(): string {
    const textMap: { [key: string]: string } = {
      'metamask': 'MetaMask',
      'walletconnect': 'WalletConnect',
      'coinbase': 'Coinbase Wallet',
      'google': 'Google 社交錢包',
      'facebook': 'Facebook 社交錢包',
      'apple': 'Apple 社交錢包',
      'email': 'Email 錢包',
      'phone': '手機錢包'
    };
    return textMap[this.connectingType || ''] || '錢包';
  }
}