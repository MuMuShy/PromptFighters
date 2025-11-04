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
      
      // 檢查用戶登入方式，決定恢復哪種錢包
      this.checkAndRestoreWallet();
    } catch (error) {
      console.error('Failed to create thirdweb client:', error);
      console.log('Environment object:', environment);
    }
  }

  /**
   * 根據用戶登入方式檢查並恢復對應的錢包
   */
  private async checkAndRestoreWallet() {
    try {
      // 從 localStorage 獲取登入方式
      const loginMethod = localStorage.getItem('login_method') || '';
      const hasToken = !!localStorage.getItem('jwt-token');
      const isSocialLogin = ['google', 'facebook', 'apple', 'social'].includes(loginMethod);
      
      console.log('🔍 檢查登入方式:', loginMethod, '是否為社交登入:', isSocialLogin, '是否有 token:', hasToken);
      
      if (isSocialLogin) {
        // 社交登入：嘗試恢復 thirdweb in-app wallet
        // 對於已登入的社交用戶，thirdweb 應該已經有會話
        await this.restoreInAppWallet();
      } else {
        // 非社交登入：檢查 MetaMask
        await this.checkMetamaskConnection();
      }
    } catch (error) {
      console.log('檢查並恢復錢包失敗:', error);
    }
  }

  /**
   * 嘗試恢復 thirdweb in-app wallet（社交登入）
   */
  private async restoreInAppWallet() {
    try {
      if (!this.client) {
        return;
      }

      // 檢查是否有已保存的會話或用戶已登入
      const hasStoredSession = this.checkStoredSession();
      const walletAddress = localStorage.getItem('wallet_address');
      const loginMethod = localStorage.getItem('login_method');
      
      if (!hasStoredSession && !walletAddress) {
        // 沒有會話數據且沒有 wallet_address，不嘗試恢復
        console.log('ℹ️ 未發現已保存的會話數據或 wallet_address');
        return;
      }

      const wallet = inAppWallet();
      // 先設置 wallet 實例，這樣即使恢復失敗也能供後續使用
      this.currentWallet = wallet;
      
      // 嘗試獲取已連接的帳戶（如果之前已連接）
      try {
        // thirdweb 的 in-app wallet 會自動從 localStorage 恢復會話
        // 但需要先調用 getAccount() 來觸發會話恢復
        const account = wallet.getAccount();
        if (account && account.address) {
          console.log('🔗 檢測到已連接的 thirdweb in-app wallet:', account.address);
          
          this.connectionStatus.next({
            connected: true,
            address: account.address,
            walletType: 'social'
          });
          console.log('✅ thirdweb in-app wallet 實例已恢復');
          return;
        }
      } catch (e) {
        // getAccount() 可能拋出錯誤，這表示會話可能已過期或無效
        console.log('getAccount() 失敗，會話可能已過期或需要重新連接:', e);
        
        // 如果用戶已登入且有 wallet_address，嘗試靜默恢復會話
        // 檢查 thirdweb 的 localStorage 中是否有會話數據
        if (walletAddress && loginMethod && ['google', 'facebook', 'apple', 'social'].includes(loginMethod)) {
          console.log('🔍 嘗試從 localStorage 檢查 thirdweb 會話...');
          
          // 檢查 localStorage 中的所有 thirdweb 相關 key
          const allKeys = Object.keys(localStorage);
          const thirdwebKeys = allKeys.filter(key => 
            key.toLowerCase().includes('thirdweb') || 
            key.toLowerCase().includes('wallet') ||
            key.toLowerCase().includes('embedded')
          );
          
          console.log('🔍 發現的 thirdweb 相關 keys:', thirdwebKeys);
          
          // 如果有 thirdweb 相關的 key，嘗試手動觸發會話恢復
          if (thirdwebKeys.length > 0) {
            console.log('🔍 發現 thirdweb 會話數據，嘗試恢復...');
            // 注意：thirdweb 的會話恢復可能需要通過 connect 方法，但這會觸發彈窗
            // 我們暫時只設置 wallet 實例，讓後續調用時自動處理
          }
        }
      }
      
      // 即使無法獲取帳戶，對於已登入的社交用戶，我們仍然設置 wallet 實例
      // 如果後端有保存 wallet_address，我們認為用戶已經有 thirdweb 錢包，只是會話暫時失效
      // 我們可以設置連接狀態為已連接（使用後端保存的地址），這樣其他組件可以正常使用
      if (walletAddress) {
        console.log('ℹ️ 已設置 wallet 實例，用戶已登入（wallet_address:', walletAddress, '），但 thirdweb 會話未激活');
        console.log('✅ 使用後端保存的 wallet_address 作為已連接狀態:', walletAddress);
        
        // 設置連接狀態（使用後端保存的地址）
        // 這樣即使 thirdweb 會話暫時失效，系統也能正常運作
        this.connectionStatus.next({
          connected: true,
          address: walletAddress,
          walletType: 'social'
        });
        console.log('✅ 已更新連接狀態為已連接（使用後端保存的地址）');
      } else {
        console.log('ℹ️ 已設置 wallet 實例，但未檢測到活動會話');
      }
    } catch (error) {
      console.log('恢復 thirdweb in-app wallet 失敗:', error);
    }
  }

  /**
   * 檢查是否有已保存的 thirdweb 會話
   */
  private checkStoredSession(): boolean {
    try {
      // thirdweb 通常在 localStorage 中保存會話信息
      // 檢查是否有相關的 key
      const keys = Object.keys(localStorage);
      const thirdwebKeys = keys.filter(key => 
        key.includes('thirdweb') || 
        key.includes('inAppWallet') || 
        key.includes('embeddedWallet') ||
        key.includes('in-app-wallet')
      );
      
      if (thirdwebKeys.length > 0) {
        console.log('🔍 發現 thirdweb 相關的 localStorage keys:', thirdwebKeys);
        return true;
      }
      
      // 也可以檢查是否有 JWT token（表示用戶已登入）
      const hasToken = localStorage.getItem('jwt-token');
      const loginMethod = localStorage.getItem('login_method');
      const walletAddress = localStorage.getItem('wallet_address');
      
      // 如果用戶已登入且是社交登入，且後端有保存 wallet_address，應該有 thirdweb 會話
      if (hasToken && loginMethod && ['google', 'facebook', 'apple', 'social'].includes(loginMethod) && walletAddress) {
        console.log('🔍 用戶已通過社交登入，後端有 wallet_address，應該有 thirdweb 會話');
        return true;
      }
      
      return false;
    } catch (e) {
      console.warn('檢查會話失敗:', e);
      return false;
    }
  }

  /**
   * 檢查 MetaMask 是否已連接，並恢復 currentWallet
   */
  private async checkMetamaskConnection() {
    try {
      if ((window as any).ethereum && this.client) {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_accounts' 
        });
        
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          console.log('🔗 檢測到已連接的 MetaMask 錢包:', address);
          
          // 恢復 thirdweb wallet 實例
          try {
            const wallet = createWallet('io.metamask');
            // 嘗試重新連接（如果已經連接，這不會失敗）
            await wallet.connect({ client: this.client, chain: this.mantleChain });
            this.currentWallet = wallet;
            console.log('✅ MetaMask wallet 實例已恢復');
          } catch (e) {
            console.warn('恢復 MetaMask wallet 實例失敗，可能需要重新連接:', e);
          }
          
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

  /**
   * 獲取 thirdweb client（供其他服務使用）
   */
  getClient() {
    if (!this.client) {
      throw new Error('thirdweb client 未初始化');
    }
    return this.client;
  }

  /**
   * 獲取 Mantle Chain 配置
   */
  getMantleChain() {
    return this.mantleChain;
  }

  // 連接 Metamask（使用 thirdweb，設置 currentWallet）
  async connectMetamask(): Promise<string | null> {
    try {
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }

      // 使用 thirdweb 連接 MetaMask
      return await this.connectWithThirdweb('metamask');
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
          // 社交登入應該通過 connectSocial 方法調用，這裡不應該直接調用
          throw new Error('請使用 connectSocial() 方法進行社交登入');
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
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }

      const wallet = inAppWallet();
      
      // 先嘗試檢查是否已有會話（靜默恢復）
      try {
        const existingAccount = wallet.getAccount();
        if (existingAccount && existingAccount.address) {
          console.log('✅ 發現已存在的會話，直接使用:', existingAccount.address);
          this.currentWallet = wallet;
          this.connectionStatus.next({
            connected: true,
            address: existingAccount.address,
            walletType: 'social'
          });
          return existingAccount.address;
        }
      } catch (e) {
        // 沒有會話，需要連接
        console.log('沒有已存在的會話，開始連接...');
      }
      
      // 如果沒有會話，進行連接
      await wallet.connect({ client: this.client, strategy: provider });
      
      const account = wallet.getAccount();
      if (!account) {
        throw new Error('社交登入失敗');
      }
      
      const address = account.address;
      this.currentWallet = wallet; // 設置 currentWallet
      
      this.connectionStatus.next({
        connected: true,
        address,
        walletType: 'social'
      });
      
      console.log('✅ 社交登入成功，錢包地址:', address);
      return address;
    } catch (error) {
      console.error('社交登入失敗:', error);
      return null;
    }
  }

  /**
   * 嘗試靜默恢復社交登入的錢包（不觸發彈窗）
   * 用於已登入用戶但 thirdweb 會話可能失效的情況
   * 
   * 注意：如果會話未激活，此方法會返回後端保存的地址，但實際會話仍然未激活
   * 需要執行 Web3 操作時，應該調用 tryReconnectSocialWallet() 來重新連接
   */
  async trySilentRestoreSocialWallet(): Promise<string | null> {
    try {
      const walletAddress = localStorage.getItem('wallet_address');
      const loginMethod = localStorage.getItem('login_method');
      
      if (!walletAddress || !loginMethod || !['google', 'facebook', 'apple', 'social'].includes(loginMethod)) {
        return null;
      }
      
      if (!this.client) {
        return null;
      }
      
      const wallet = inAppWallet();
      this.currentWallet = wallet;
      
      try {
        const account = wallet.getAccount();
        
        // 如果 account 為 undefined，表示會話未激活
        if (!account) {
          console.warn('⚠️ trySilentRestoreSocialWallet: getAccount() 返回 undefined，會話未激活');
          console.warn('⚠️ 無法靜默恢復會話，使用後端保存的地址:', walletAddress);
          
          // 即使會話未激活，我們仍然設置連接狀態（使用後端地址）
          // 這樣系統可以繼續運作，但實際的 Web3 操作（如購買）會失敗
          // 用戶需要重新連接才能進行鏈上操作
          this.connectionStatus.next({
            connected: true,
            address: walletAddress,
            walletType: 'social'
          });
          console.log('⚠️ 已設置連接狀態（使用後端地址），但實際會話未激活');
          return walletAddress; // 返回後端地址，但標記為未激活
        } else if (account && account.address) {
          console.log('✅ 靜默恢復成功:', account.address);
          this.connectionStatus.next({
            connected: true,
            address: account.address,
            walletType: 'social'
          });
          return account.address;
        }
      } catch (e: any) {
        console.log('靜默恢復失敗，會話可能已過期:', e);
        
        // 即使拋出錯誤，如果後端有地址，我們仍然使用它
        if (walletAddress) {
          console.warn('⚠️ 使用後端保存的地址作為臨時方案:', walletAddress);
          this.connectionStatus.next({
            connected: true,
            address: walletAddress,
            walletType: 'social'
          });
          return walletAddress;
        }
      }
      
      return null;
    } catch (error) {
      console.log('嘗試靜默恢復失敗:', error);
      return null;
    }
  }
  
  /**
   * 嘗試重新連接社交登入的錢包（可能會觸發彈窗）
   * 用於會話失效時，需要執行 Web3 操作的情況
   * 
   * @param provider 社交登入方式（google, facebook, apple）
   * @returns 錢包地址，如果失敗返回 null
   */
  async tryReconnectSocialWallet(provider?: 'google' | 'facebook' | 'apple'): Promise<string | null> {
    try {
      const loginMethod = localStorage.getItem('login_method') || provider;
      const walletAddress = localStorage.getItem('wallet_address');
      
      if (!loginMethod || !['google', 'facebook', 'apple', 'social'].includes(loginMethod)) {
        console.warn('⚠️ 無法重新連接：未找到有效的登入方式');
        return null;
      }
      
      if (!this.client) {
        throw new Error('thirdweb client 未初始化');
      }
      
      // 確定要使用的 provider
      let socialProvider: 'google' | 'facebook' | 'apple' = 'google';
      if (loginMethod === 'google' || loginMethod === 'social') {
        socialProvider = 'google';
      } else if (loginMethod === 'facebook') {
        socialProvider = 'facebook';
      } else if (loginMethod === 'apple') {
        socialProvider = 'apple';
      }
      
      console.log('🔍 嘗試重新連接社交錢包，provider:', socialProvider);
      
      // 嘗試重新連接（這可能會觸發彈窗，但對於已登入用戶，thirdweb 可能會自動恢復）
      const wallet = inAppWallet();
      
      try {
        // 先嘗試檢查是否已有會話
        const existingAccount = wallet.getAccount();
        if (existingAccount && existingAccount.address) {
          console.log('✅ 發現已恢復的會話:', existingAccount.address);
          this.currentWallet = wallet;
          this.connectionStatus.next({
            connected: true,
            address: existingAccount.address,
            walletType: 'social'
          });
          return existingAccount.address;
        }
      } catch (e) {
        console.log('檢查會話失敗，需要重新連接:', e);
      }
      
      // 如果沒有會話，嘗試重新連接
      // 注意：這可能會觸發彈窗，但對於已登入用戶，thirdweb 可能會自動恢復會話
      console.log('⚠️ 會話未激活，嘗試重新連接（可能會觸發彈窗）...');
      await wallet.connect({ client: this.client, strategy: socialProvider });
      
      const account = wallet.getAccount();
      if (!account || !account.address) {
        throw new Error('重新連接失敗：無法獲取賬戶');
      }
      
      this.currentWallet = wallet;
      this.connectionStatus.next({
        connected: true,
        address: account.address,
        walletType: 'social'
      });
      
      console.log('✅ 重新連接成功:', account.address);
      return account.address;
    } catch (error: any) {
      console.error('重新連接失敗:', error);
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

  /**
   * 更新連接狀態（供外部組件使用，例如檢測到 social login 錢包時）
   */
  updateConnectionStatus(connected: boolean, address?: string, walletType?: string): void {
    this.connectionStatus.next({
      connected,
      address,
      walletType
    });
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