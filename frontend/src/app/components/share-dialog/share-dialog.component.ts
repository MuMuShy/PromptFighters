import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShareService, ShareCardData } from '../../services/share.service';
import { Character } from '../../interfaces/character.interface';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="share-dialog-overlay" (click)="close()">
      <div class="share-dialog-content" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2>分享你的戰鬥英雄</h2>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        
        <div class="dialog-body">
          <!-- 預覽區域 -->
          <div class="preview-container" *ngIf="!isGenerating && previewImageUrl">
            <img [src]="previewImageUrl" alt="Share Card" class="preview-image" />
          </div>
          
          <!-- 載入中 -->
          <div class="generating-container" *ngIf="isGenerating">
            <div class="spinner"></div>
            <p>正在生成分享卡片...</p>
          </div>
          
          <!-- 錯誤訊息 -->
          <div class="error-container" *ngIf="errorMessage">
            <p class="error-text">{{ errorMessage }}</p>
            <button class="retry-btn" (click)="generateCard()">重試</button>
          </div>
        </div>
        
        <div class="dialog-footer" *ngIf="previewImageUrl && !isGenerating">
          <button class="share-btn twitter" (click)="shareToTwitter()" title="分享到 Twitter">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
            </svg>
            Twitter
          </button>
          
          <button class="share-btn facebook" (click)="shareToFacebook()" title="分享到 Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
            </svg>
            Facebook
          </button>
          
          <button class="share-btn download" (click)="downloadImage()" title="下載圖片">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            下載
          </button>
          
          <button class="share-btn copy" (click)="copyToClipboard()" title="複製圖片">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            複製
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./share-dialog.component.scss']
})
export class ShareDialogComponent implements OnInit {
  @Input() character!: Character;
  @Input() playerStats?: ShareCardData['playerStats'];
  @Output() closed = new EventEmitter<void>();
  
  previewImageUrl: string | null = null;
  isGenerating = false;
  errorMessage: string | null = null;

  constructor(
    private shareService: ShareService,
    private dialogService: DialogService
  ) {}

  ngOnInit() {
    this.generateCard();
  }

  async generateCard() {
    this.isGenerating = true;
    this.errorMessage = null;
    
    try {
      const data: ShareCardData = {
        character: this.character,
        playerStats: this.playerStats
      };
      
      this.previewImageUrl = await this.shareService.generateShareCard(data);
    } catch (error: any) {
      console.error('生成分享卡片失敗:', error);
      this.errorMessage = error.message || '生成失敗，請重試';
    } finally {
      this.isGenerating = false;
    }
  }

  shareToTwitter() {
    if (!this.previewImageUrl) return;
    
    const text = `🔥 我的 ${this.character.name} (${this.getRarityLabel(this.character.rarity)}) 正在戰鬥中！加入我一起對戰吧！`;
    this.shareService.shareToTwitter(this.previewImageUrl, text, this.character);
  }

  shareToFacebook() {
    if (!this.previewImageUrl) return;
    
    const url = window.location.origin;
    this.shareService.shareToFacebook(this.previewImageUrl, url);
  }

  downloadImage() {
    if (!this.previewImageUrl) return;
    
    const filename = `prompt-fighters-${this.character.name}-${Date.now()}.png`;
    this.shareService.downloadImage(this.previewImageUrl, filename);
    
    this.dialogService.success('成功', '圖片已下載！');
  }

  async copyToClipboard() {
    if (!this.previewImageUrl) return;
    
    const success = await this.shareService.copyImageToClipboard(this.previewImageUrl);
    if (success) {
      this.dialogService.success('成功', '圖片已複製到剪貼板！');
    } else {
      this.dialogService.error('錯誤', '複製失敗，請嘗試下載');
    }
  }

  close() {
    this.closed.emit();
  }

  private getRarityLabel(rarity: number): string {
    const labels: { [key: number]: string } = {
      1: 'N', 2: 'R', 3: 'SR', 4: 'SSR', 5: 'UR'
    };
    return labels[rarity] || 'N';
  }
}

