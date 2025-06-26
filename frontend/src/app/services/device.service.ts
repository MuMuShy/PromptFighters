import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private _isMobile: boolean;

  constructor() {
    this._isMobile = this.detectMobile();
  }

  private detectMobile(): boolean {
    // 檢查 User Agent
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // 檢查是否為手機或平板設備
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
    const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
    
    // 檢查螢幕寬度
    const isMobileScreen = window.innerWidth <= 768;
    
    // 檢查觸控支援
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 綜合判斷
    return isMobileUserAgent || (isMobileScreen && isTouchDevice);
  }

  get isMobile(): boolean {
    return this._isMobile;
  }

  get isDesktop(): boolean {
    return !this._isMobile;
  }

  // 檢查是否為 iOS 設備
  get isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  // 檢查是否為 Android 設備
  get isAndroid(): boolean {
    return /Android/.test(navigator.userAgent);
  }

  // 檢查是否在 MetaMask App 內瀏覽器中
  get isInMetaMaskApp(): boolean {
    return /MetaMaskMobile/.test(navigator.userAgent);
  }

  // 檢查是否在其他錢包 App 內瀏覽器中
  get isInWalletApp(): boolean {
    const walletUserAgents = [
      'MetaMaskMobile',
      'Trust',
      'CoinbaseWallet',
      'Rainbow',
      'imToken'
    ];
    return walletUserAgents.some(wallet => navigator.userAgent.includes(wallet));
  }

  // 取得 MetaMask 深層連結
  getMetaMaskDeepLink(url: string = window.location.href): string {
    if (this.isIOS) {
      return `metamask://dapp/${url.replace(/^https?:\/\//, '')}`;
    } else if (this.isAndroid) {
      return `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=io.metamask;end`;
    }
    return url;
  }

  // 取得適合手機的錢包連結
  getMobileWalletLinks() {
    const currentUrl = window.location.href;
    return {
      metamask: this.getMetaMaskDeepLink(currentUrl),
      trust: `trust://open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`,
      rainbow: `rainbow://dapp?url=${encodeURIComponent(currentUrl)}`,
      coinbase: `cbwallet://dapp?url=${encodeURIComponent(currentUrl)}`
    };
  }
}