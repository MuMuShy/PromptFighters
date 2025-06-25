# thirdweb Connect 設定指南

本文件說明如何設定 thirdweb Connect 以支援多種錢包登入方式，包括 Web3 錢包、社交登入、Email 錢包等。

## 1. 必要的 API Keys

### thirdweb Client ID
1. 前往 [thirdweb Dashboard](https://thirdweb.com/dashboard)
2. 建立新專案或選擇現有專案
3. 在專案設定中找到 `Client ID`
4. 複製 Client ID 並更新環境變數

### WalletConnect Project ID
1. 前往 [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. 建立新專案
3. 在專案設定中找到 `Project ID`
4. 複製 Project ID 並更新環境變數

## 2. 環境變數設定

### 開發環境 (`frontend/src/environments/environment.ts`)
```typescript
export const environment = {
  // ... 其他設定
  thirdwebClientId: 'your_actual_thirdweb_client_id',
  walletConnectProjectId: 'your_actual_walletconnect_project_id',
};
```

### 生產環境 (`frontend/src/environments/environment.prod.ts`)
```typescript
export const environment = {
  // ... 其他設定
  thirdwebClientId: process.env['THIRDWEB_CLIENT_ID'] || 'fallback_client_id',
  walletConnectProjectId: process.env['WALLETCONNECT_PROJECT_ID'] || 'fallback_project_id',
};
```

## 3. 支援的登入方式

### 傳統 Web3 錢包
- **MetaMask**: 使用現有的 ethers.js 整合
- **WalletConnect**: 支援所有 WalletConnect 相容錢包
- **Coinbase Wallet**: 官方 Coinbase 錢包

### 社交錢包 (thirdweb In-App Wallet)
- **Google**: Google 帳號登入，自動生成錢包
- **Facebook**: Facebook 帳號登入
- **Apple**: Apple ID 登入

### 其他登入方式
- **Email Wallet**: 使用 Email 地址登入
- **Phone Wallet**: 使用手機號碼登入

## 4. Mantle 鏈設定

遊戲配置為在 Mantle 鏈上運行：
- **Chain ID**: 5000
- **RPC URL**: https://rpc.mantle.xyz
- **Explorer**: https://explorer.mantle.xyz

### 為什麼選擇 Mantle？
1. **低手續費**: 比 Ethereum 主網便宜 95%
2. **EVM 相容**: 完全相容現有 Web3 工具
3. **高效能**: 更快的交易確認
4. **生態支援**: 豐富的 DeFi 和 Gaming 生態

## 5. 後端模型更新

Player 模型已擴展以支援多種登入方式：

```python
class Player(models.Model):
    # 新增欄位
    wallet_address = models.CharField(max_length=42, null=True, blank=True, unique=True)
    login_method = models.CharField(max_length=20, choices=LOGIN_METHOD_CHOICES, default='google')
    chain_id = models.IntegerField(default=5000)  # Mantle 主網
    thirdweb_user_id = models.CharField(max_length=100, null=True, blank=True)
    social_provider = models.CharField(max_length=20, null=True, blank=True)
```

## 6. 手機端支援

### WalletConnect 整合
- 手機用戶可以使用 WalletConnect 掃描 QR Code
- 支援所有主流手機錢包 (MetaMask Mobile, Trust Wallet, Rainbow 等)

### 社交登入
- 在手機瀏覽器中可直接使用社交帳號登入
- 自動生成託管錢包，無需下載額外 App

## 7. 部署注意事項

### 前端部署
1. 在 CI/CD 環境中設定環境變數：
   ```bash
   THIRDWEB_CLIENT_ID=your_client_id
   WALLETCONNECT_PROJECT_ID=your_project_id
   ```

2. 確保 Domain 設定正確：
   - thirdweb Dashboard 中加入允許的網域
   - WalletConnect 專案中設定正確的 Origin

### 安全考量
1. **Client ID 公開**: thirdweb Client ID 是公開的，可安全放在前端
2. **Project ID 公開**: WalletConnect Project ID 也是公開的
3. **私鑰管理**: 所有私鑰都由用戶或 thirdweb 託管服務管理
4. **簽名驗證**: 後端仍使用密碼學驗證確保安全性

## 8. 測試流程

### 本地測試
1. 啟動後端 Docker 服務
2. 啟動前端開發服務器
3. 測試各種登入方式
4. 檢查錢包連接和簽名功能

### 手機測試
1. 在同一網路下訪問開發服務器
2. 測試 WalletConnect 掃碼功能
3. 測試社交登入在手機瀏覽器中的表現

## 9. 常見問題

### Q: thirdweb Connect 免費嗎？
A: 基本功能免費，高級功能可能收費。詳見 thirdweb 定價頁面。

### Q: 用戶的私鑰如何管理？
A: 
- Web3 錢包：用戶自己管理
- 社交錢包：由 thirdweb 託管服務管理
- Email/Phone 錢包：由 thirdweb 託管服務管理

### Q: 如果 thirdweb 服務中斷怎麼辦？
A: Web3 錢包(MetaMask)仍可正常使用，社交錢包可能暫時無法使用。

### Q: 可以同時支援多個鏈嗎？
A: 可以，但目前專案專注於 Mantle 鏈以提供最佳遊戲體驗。