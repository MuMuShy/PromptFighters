import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { createThirdwebClient } from 'thirdweb';
import { createWallet } from 'thirdweb/wallets';
import { defineChain } from 'thirdweb/chains';
import { inAppWallet, preAuthenticate } from 'thirdweb/wallets/in-app';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class Web3Service {
  private client: any;
  public currentWallet: any = null;
  private connectionStatus = new BehaviorSubject<{
    connected: boolean;
    address?: string;
    walletType?: string;
  }>({ connected: false });

  // Mantle 鏈配置
  private mantleChain = defineChain({
    id: environment.mantleChainId,
    name: 'Mantle',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [environment.mantleRpcUrl],
      },
      public: {
        http: [environment.mantleRpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: 'Mantle Explorer',
        url: environment.mantleExplorerUrl,
      },
    },
  });

  constructor() {
    console.log('environment.thirdwebClientId', environment.thirdwebClientId);
    
    // 確保 clientId 存在且不是預設值
    const clientId = environment.thirdwebClientId;
    if (!clientId || clientId === 'your_thirdweb_client_id') {
      console.error('Invalid thirdweb clientId. Please set a valid clientId in environment.ts');
      return;
    }
    
    try {
      this.client = createThirdwebClient({
        clientId: clientId
      });
      console.log('thirdweb client created successfully:', this.client);
      console.log('Client structure:', Object.keys(this.client));
      
      // 檢查並恢復 MetaMask 連接狀態
      this.checkMetamaskConnection();
    } catch (error) {
      console.error('Failed to create thirdweb client:', error);
      console.log('Environment object:', environment);
    }
  }

  // 檢查 MetaMask 是否已連接
  private async checkMetamaskConnection() {
    try {
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_accounts' 
        });
        
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          console.log('🔗 檢測到已連接的 MetaMask 錢包:', address);
          
          this.connectionStatus.next({
            connected: true,
            address,
            walletType: 'metamask'
          });
        }
      }
    } catch (error) {
      console.log('檢查 MetaMask 連接狀態失敗:', error);
    }
  }

  get connectionStatus$(): Observable<any> {
    return this.connectionStatus.asObservable();
  }

  // 連接 Metamask（保留原有功能，但使用舊版 ethers 語法）
  async connectMetamask(): Promise<string | null> {
    try {
      if (!(window as any).ethereum) {
        alert('請先安裝 Metamask');
        return null;
      }
      // 請求帳戶授權
      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      this.connectionStatus.next({
        connected: true,
        address,
        walletType: 'metamask'
      });
      
      return address;
    } catch (err) {
      console.error('連接 Metamask 失敗', err);
      return null;
    }
  }

  // thirdweb Connect - 支援多種錢包
  async connectWithThirdweb(walletType: 'metamask' | 'walletconnect' | 'coinbase' | 'email' | 'phone' | 'social'): Promise<string | null> {
    try {
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }
      
      console.log('Attempting to connect wallet type:', walletType);
      console.log('Using client:', this.client);
      
      let wallet;
      
      switch (walletType) {
        case 'metamask':
          wallet = createWallet('io.metamask');
          await wallet.connect({ client: this.client, chain: this.mantleChain });
          break;
        case 'coinbase':
          wallet = createWallet('com.coinbase.wallet');
          await wallet.connect({ client: this.client, chain: this.mantleChain });
          break;
        case 'walletconnect':
          wallet = createWallet('walletConnect');
          await wallet.connect({ client: this.client, chain: this.mantleChain });
          break;
        case 'email': {
          wallet = inAppWallet();
          const email = prompt('請輸入 Email');
          if (!email) throw new Error('Email 必填');
          // 1. 發送驗證碼
          await preAuthenticate({ client: this.client, strategy: 'email', email });
          const verificationCode = prompt('請輸入收到的驗證碼');
          if (!verificationCode) throw new Error('驗證碼必填');
          // 2. connect
          await wallet.connect({
            client: this.client,
            strategy: 'email',
            email,
            verificationCode,
          });
          break;
        }
        case 'phone': {
          wallet = inAppWallet();
          const phoneNumber = prompt('請輸入手機號碼');
          if (!phoneNumber) throw new Error('手機號碼必填');
          await preAuthenticate({ client: this.client, strategy: 'phone', phoneNumber });
          const verificationCode = prompt('請輸入收到的驗證碼');
          if (!verificationCode) throw new Error('驗證碼必填');
          await wallet.connect({
            client: this.client,
            strategy: 'phone',
            phoneNumber,
            verificationCode,
          });
          break;
        }
        case 'social': {
          wallet = inAppWallet();
          const provider = prompt('請輸入社交登入方式（google/facebook/apple）');
          if (!provider || !['google', 'facebook', 'apple'].includes(provider)) throw new Error('provider 必填且必須為 google/facebook/apple');
          await wallet.connect({ client: this.client, strategy: provider as any });
          break;
        }
        default:
          throw new Error('不支援的錢包類型');
      }

      console.log('Wallet connected, getting account...');
      const account = wallet.getAccount();
      if (!account) {
        throw new Error('無法取得帳戶地址');
      }

      const address = account.address;
      console.log('Got address:', address);
      this.currentWallet = wallet;
      
      this.connectionStatus.next({
        connected: true,
        address,
        walletType
      });

      return address;
    } catch (error) {
      console.error('thirdweb 連接失敗:', error);
      return null;
    }
  }

  // 社交登入（Google, Facebook, Apple 等）
  async connectSocial(provider: 'google' | 'facebook' | 'apple'): Promise<string | null> {
    try {
      const wallet = inAppWallet();
      await wallet.connect({ client: this.client, strategy: provider });
      const account = wallet.getAccount();
      if (!account) {
        throw new Error('社交登入失敗');
      }
      const address = account.address;
      this.currentWallet = wallet;
      this.connectionStatus.next({
        connected: true,
        address,
        walletType: 'social'
      });
      return address;
    } catch (error) {
      console.error('社交登入失敗:', error);
      return null;
    }
  }

  // 手機錢包連接（WalletConnect）
  async connectMobile(): Promise<string | null> {
    return this.connectWithThirdweb('walletconnect');
  }

  // 簽名訊息
  async signMessage(message: string): Promise<string | null> {
    try {
      if (!this.currentWallet) {
        throw new Error('請先連接錢包');
      }

      const account = this.currentWallet.getAccount();
      if (!account) {
        throw new Error('無法取得帳戶');
      }

      const signature = await account.signMessage({ message });
      return signature;
    } catch (error) {
      console.error('簽名失敗:', error);
      return null;
    }
  }

  // 中斷連接
  async disconnect(): Promise<void> {
    try {
      if (this.currentWallet) {
        await this.currentWallet.disconnect();
        this.currentWallet = null;
      }
      
      this.connectionStatus.next({ connected: false });
    } catch (error) {
      console.error('中斷連接失敗:', error);
    }
  }

  // 取得當前連接狀態
  getCurrentConnection() {
    return this.connectionStatus.value;
  }

  // 檢查錢包是否已連接
  isWalletConnected(): boolean {
    return this.connectionStatus.value.connected;
  }

  // 獲取當前連接的錢包地址
  getWalletAddress(): string | undefined {
    return this.connectionStatus.value.address;
  }

  // 切換到 Mantle 鏈
  async switchToMantle(): Promise<boolean> {
    try {
      if (!this.currentWallet) {
        return false;
      }

      await this.currentWallet.switchChain(this.mantleChain);
      return true;
    } catch (error) {
      console.error('切換到 Mantle 鏈失敗:', error);
      return false;
    }
  }

  // 發送驗證碼
  async sendVerificationCode(type: 'email' | 'phone', value: string): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }

      if (type === 'email') {
        await preAuthenticate({ 
          client: this.client, 
          strategy: 'email', 
          email: value 
        });
      } else {
        await preAuthenticate({ 
          client: this.client, 
          strategy: 'phone', 
          phoneNumber: value 
        });
      }
    } catch (error) {
      console.error('發送驗證碼失敗:', error);
      throw error;
    }
  }

  // 使用驗證碼連接錢包
  async connectWithVerification(type: 'email' | 'phone', value: string, verificationCode: string): Promise<string | null> {
    try {
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }

      const wallet = inAppWallet();
      
      if (type === 'email') {
        await wallet.connect({
          client: this.client,
          strategy: 'email',
          email: value,
          verificationCode,
        });
      } else {
        await wallet.connect({
          client: this.client,
          strategy: 'phone',
          phoneNumber: value,
          verificationCode,
        });
      }

      const account = wallet.getAccount();
      if (!account) {
        throw new Error('無法取得帳戶地址');
      }

      const address = account.address;
      this.currentWallet = wallet;
      
      this.connectionStatus.next({
        connected: true,
        address,
        walletType: type
      });

      return address;
    } catch (error) {
      console.error('驗證碼連接失敗:', error);
      return null;
    }
  }

  // 使用 thirdweb 進行錢包登入（整合到現有登入流程）
  async loginWithThirdwebWallet(walletType: string): Promise<{ address: string; signature: string; nonce: string } | null> {
    try {
      // 1. 連接錢包
      const address = await this.connectWithThirdweb(walletType as any);
      if (!address) {
        throw new Error('錢包連接失敗');
      }

      // 2. 取得 nonce（需要呼叫後端 API）
      // 這裡暫時先返回地址，實際 nonce 和簽名需要在調用方處理
      return { address, signature: '', nonce: '' };
    } catch (error) {
      console.error('thirdweb 錢包登入失敗:', error);
      return null;
    }
  }
}