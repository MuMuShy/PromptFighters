import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService, Language } from '../../services/language.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatMenuModule, MatIconModule],
  template: `
    <button 
      mat-button 
      [matMenuTriggerFor]="languageMenu"
      class="language-selector-btn">
      <span class="flag">{{ currentLanguage?.flag }}</span>
      <span class="language-name">{{ currentLanguage?.name }}</span>
      <mat-icon>expand_more</mat-icon>
    </button>

    <mat-menu #languageMenu="matMenu" class="language-menu">
      <button 
        mat-menu-item 
        *ngFor="let language of availableLanguages"
        (click)="changeLanguage(language.code)"
        [class.active]="language.code === currentLanguageCode">
        <span class="flag">{{ language.flag }}</span>
        <span class="language-name">{{ language.name }}</span>
        <mat-icon *ngIf="language.code === currentLanguageCode">check</mat-icon>
      </button>
    </mat-menu>
  `,
  styles: [`
    .language-selector-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px 16px;
      min-width: 140px;
      justify-content: space-between;
      transition: all 0.2s ease;
    }

    .language-selector-btn:hover {
      background-color: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .flag {
      font-size: 18px;
      line-height: 1;
    }

    .language-name {
      font-size: 14px;
      font-weight: 500;
    }

    :host ::ng-deep .language-menu {
      background-color: #1f2937;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item {
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      min-height: 48px;
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item.active {
      background-color: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item .flag {
      font-size: 18px;
      width: 24px;
      text-align: center;
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item .language-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }

    :host ::ng-deep .language-menu .mat-mdc-menu-item mat-icon {
      color: #10b981;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    @media (max-width: 768px) {
      .language-selector-btn {
        min-width: 120px;
        padding: 6px 12px;
      }
      
      .language-name {
        display: none;
      }
    }
  `]
})
export class LanguageSelectorComponent implements OnInit, OnDestroy {
  availableLanguages: Language[] = [];
  currentLanguage: Language | undefined;
  currentLanguageCode: string = 'en';
  
  private destroy$ = new Subject<void>();

  constructor(private languageService: LanguageService) {}

  ngOnInit(): void {
    this.availableLanguages = this.languageService.getAvailableLanguages();
    
    // 訂閱當前語言變化
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(languageCode => {
        this.currentLanguageCode = languageCode;
        this.currentLanguage = this.languageService.getCurrentLanguageInfo();
      });

    // 初始化語言設定
    this.languageService.initializeLanguage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  changeLanguage(languageCode: string): void {
    if (languageCode !== this.currentLanguageCode) {
      this.languageService.changeLanguage(languageCode);
    }
  }
}