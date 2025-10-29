import '@angular/localize/init';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// 全局錯誤處理：處理 chunk 加載失敗
window.addEventListener('error', (event) => {
  // 檢查是否是動態導入失敗
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    console.error('動態模塊加載失敗，嘗試刷新頁面:', event.message);
    
    // 檢查是否在線
    if (navigator.onLine) {
      // 在線但文件缺失，可能是緩存問題，提示用戶刷新
      const shouldReload = confirm(
        '應用程式加載失敗，可能是緩存問題。\n\n是否重新載入頁面？'
      );
      if (shouldReload) {
        // 強制刷新（清除緩存）
        window.location.reload();
      }
    } else {
      // 離線狀態
      alert('網路連接已斷開，請檢查您的網路連接。');
    }
  }
}, true);

// 處理未捕獲的 Promise 拒絕（chunk 加載錯誤通常會觸發這個）
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error && typeof error.message === 'string' && error.message.includes('Failed to fetch dynamically imported module')) {
    console.error('未處理的 chunk 加載錯誤:', error);
    event.preventDefault(); // 防止錯誤輸出到控制台
    
    // 自動重試一次
    const windowWithFlag = window as Window & { chunkRetryAttempted?: boolean };
    if (!windowWithFlag.chunkRetryAttempted) {
      windowWithFlag.chunkRetryAttempted = true;
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
  }
});

bootstrapApplication(AppComponent, appConfig)
  .catch(err => {
    console.error('應用程式啟動失敗:', err);
    // 顯示友好的錯誤訊息
    document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif; background: #111827; color: #fff;">
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">⚠️ 應用程式載入失敗</h1>
        <p style="margin-bottom: 2rem; color: #9ca3af;">請嘗試刷新頁面或清除瀏覽器緩存</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">
          重新載入
        </button>
      </div>
    `;
  });