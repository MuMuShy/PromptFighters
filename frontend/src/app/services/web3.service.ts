import { Injectable } from '@angular/core';
import { ethers } from 'ethers';

@Injectable({ providedIn: 'root' })
export class Web3Service {
  // 連接 Metamask，回傳地址
  async connectMetamask(): Promise<string | null> {
    try {
      if (!(window as any).ethereum) {
        alert('請先安裝 Metamask');
        return null;
      }
      // 請求帳戶授權
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      return address;
    } catch (err) {
      console.error('連接 Metamask 失敗', err);
      return null;
    }
  }

  // 你可以根據需求寫 connectCoinbase、connectInAppWallet 等
}