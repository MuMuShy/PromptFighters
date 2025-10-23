import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private currentLocale: string = 'zh-Hant'; // 預設中文
  private localeSubject = new BehaviorSubject<string>(this.currentLocale);
  public locale$ = this.localeSubject.asObservable();

  constructor() {
    // 從 localStorage 讀取語言設定
    this.loadSavedLocale();
  }

  private loadSavedLocale() {
    const savedLocale = localStorage.getItem('preferred-locale');
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh-Hant')) {
      this.currentLocale = savedLocale;
      this.localeSubject.next(this.currentLocale);
    }
  }

  getCurrentLocale(): string {
    return this.currentLocale;
  }

  isEnglish(): boolean {
    return this.currentLocale === 'en';
  }

  isChinese(): boolean {
    return this.currentLocale === 'zh-Hant';
  }

  // 切換語言 - 只改變當前頁面語言，不跳轉
  switchLanguage(locale: string) {
    if (locale === 'en' || locale === 'zh-Hant') {
      this.currentLocale = locale;
      this.localeSubject.next(this.currentLocale);
      // 保存到 localStorage
      localStorage.setItem('preferred-locale', locale);
    }
  }
}
