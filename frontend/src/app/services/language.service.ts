import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLanguageSubject = new BehaviorSubject<string>('zh-Hant');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  private readonly languages: Language[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'zh-Hant', name: '繁體中文', flag: '🇹🇼' }
  ];

  constructor(private translate: TranslateService) {
    // 設置默認語言
    this.translate.setDefaultLang('zh-Hant');
    
    // 從 localStorage 讀取用戶偏好語言
    const savedLanguage = localStorage.getItem('preferred-language') || 'zh-Hant';
    if (this.isValidLanguage(savedLanguage)) {
      this.setLanguage(savedLanguage);
    } else {
      this.setLanguage('zh-Hant');
    }
  }

  /**
   * 獲取所有可用語言
   */
  getAvailableLanguages(): Language[] {
    return this.languages;
  }

  /**
   * 獲取當前語言代碼
   */
  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  /**
   * 獲取當前語言資訊
   */
  getCurrentLanguageInfo(): Language | undefined {
    return this.languages.find(lang => lang.code === this.getCurrentLanguage());
  }

  /**
   * 設置語言
   */
  private setLanguage(languageCode: string): void {
    this.translate.use(languageCode);
    this.currentLanguageSubject.next(languageCode);
  }

  /**
   * 切換語言（即時切換，無需重新載入頁面）
   */
  changeLanguage(languageCode: string): void {
    if (!this.isValidLanguage(languageCode)) {
      console.error(`不支援的語言代碼: ${languageCode}`);
      return;
    }

    // 保存用戶偏好
    localStorage.setItem('preferred-language', languageCode);
    
    // 即時切換語言
    this.setLanguage(languageCode);
  }

  /**
   * 檢查語言代碼是否有效
   */
  private isValidLanguage(languageCode: string): boolean {
    return this.languages.some(lang => lang.code === languageCode);
  }

  /**
   * 初始化語言設定（在應用啟動時調用）
   */
  initializeLanguage(): void {
    // ngx-translate會自動處理初始化，這裡留空或做額外的設定
  }
}