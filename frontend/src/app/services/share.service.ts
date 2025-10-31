import { Injectable } from '@angular/core';
import { Character } from '../interfaces/character.interface';
import { environment } from '../../environments/environment';

export interface ShareCardData {
  character: Character;
  playerName?: string;
  playerStats?: {
    totalFighters: number;
    totalBattles: number;
    winRate: number;
    urCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  // 手機格式：9:16 豎版（適合 Instagram Story、手機分享等）
  // 縮小尺寸：720x1280（較小但仍保持比例）
  private readonly CARD_WIDTH = 720;
  private readonly CARD_HEIGHT = 1280;

  constructor() {}

  /**
   * 生成分享卡片圖片
   */
  async generateShareCard(data: ShareCardData): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = this.CARD_WIDTH;
      canvas.height = this.CARD_HEIGHT;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('無法創建 Canvas 上下文'));
        return;
      }

      // 加載角色圖片
      const charImage = new Image();
      
      // 構建圖片 URL（跨域圖片會自動使用後端代理）
      let imageUrl = this.buildImageUrl(data.character.image_url);
      console.log('[ShareService] 嘗試加載圖片:', imageUrl);
      
      // 如果是通過後端代理加載，設置 crossOrigin（後端已設置 CORS）
      // 如果是直接的外部 URL，嘗試設置 crossOrigin
      if (imageUrl.includes('/api/proxy-image/')) {
        // 通過後端代理，可以安全設置 crossOrigin
        charImage.crossOrigin = 'anonymous';
      } else if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
        // 直接的外部 URL，嘗試使用 anonymous（但可能失敗）
        charImage.crossOrigin = 'anonymous';
      }
      
      charImage.onload = async () => {
        try {
          console.log('[ShareService] 圖片加載成功，開始繪製');
          
          // 繪製背景
          this.drawBackground(ctx, data.character);
          
          // 繪製角色圖片
          await this.drawCharacterImage(ctx, charImage, data.character);
          
          // 繪製角色信息
          this.drawCharacterInfo(ctx, data.character);
          
          // 繪製統計數據
          if (data.playerStats) {
            this.drawPlayerStats(ctx, data.playerStats);
          }
          
          // 繪製遊戲 Logo 和召喚文字
          this.drawGameBranding(ctx);
          
          // 轉換為圖片 URL
          const imageUrl = canvas.toDataURL('image/png');
          console.log('[ShareService] 分享卡片生成成功');
          resolve(imageUrl);
        } catch (error: any) {
          console.error('[ShareService] 繪製過程中出錯:', error);
          reject(new Error('生成分享卡片失敗: ' + (error.message || '未知錯誤')));
        }
      };
      
      charImage.onerror = (error: any) => {
        console.error('[ShareService] 圖片加載失敗:', {
          url: imageUrl,
          error: error,
          originalUrl: data.character.image_url
        });
        
        // 如果設置了 crossOrigin 失敗，嘗試不設置 crossOrigin 重試
        if (charImage.crossOrigin === 'anonymous') {
          console.log('[ShareService] 嘗試不使用 crossOrigin 重新加載');
          charImage.crossOrigin = null as any;
          charImage.src = imageUrl;
          return;
        }
        
        reject(new Error(`無法加載角色圖片: ${imageUrl}`));
      };
      
      // 設置圖片來源
      charImage.src = imageUrl;
    });
  }

  /**
   * 繪製背景（深色背景作為備用）
   */
  private drawBackground(ctx: CanvasRenderingContext2D, character: Character) {
    // 深色背景（圖片會覆蓋大部分）
    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(0, 0, this.CARD_WIDTH, this.CARD_HEIGHT);
  }

  /**
   * 繪製角色圖片（滿版顯示）
   */
  private async drawCharacterImage(
    ctx: CanvasRenderingContext2D, 
    image: HTMLImageElement, 
    character: Character
  ) {
    // 滿版顯示，覆蓋整個卡片
    ctx.save();
    
    // 計算圖片縮放，保持比例並覆蓋整個區域
    const cardAspect = this.CARD_WIDTH / this.CARD_HEIGHT;
    const imgAspect = image.width / image.height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imgAspect > cardAspect) {
      // 圖片更寬，以高度為準
      drawHeight = this.CARD_HEIGHT;
      drawWidth = drawHeight * imgAspect;
      drawX = (this.CARD_WIDTH - drawWidth) / 2;
      drawY = 0;
    } else {
      // 圖片更高，以寬度為準
      drawWidth = this.CARD_WIDTH;
      drawHeight = drawWidth / imgAspect;
      drawX = 0;
      drawY = (this.CARD_HEIGHT - drawHeight) / 2;
    }
    
    // 繪製滿版圖片
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    
    // 添加底部漸層遮罩（確保文字可讀性）
    const gradient = ctx.createLinearGradient(0, this.CARD_HEIGHT * 0.6, 0, this.CARD_HEIGHT);
    gradient.addColorStop(0, 'rgba(10, 15, 28, 0)');
    gradient.addColorStop(0.5, 'rgba(10, 15, 28, 0.7)');
    gradient.addColorStop(1, 'rgba(10, 15, 28, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, this.CARD_HEIGHT * 0.6, this.CARD_WIDTH, this.CARD_HEIGHT * 0.4);
    
    // 添加頂部半透明遮罩（放置稀有度等信息）
    const topGradient = ctx.createLinearGradient(0, 0, 0, this.CARD_HEIGHT * 0.3);
    topGradient.addColorStop(0, 'rgba(10, 15, 28, 0.8)');
    topGradient.addColorStop(1, 'rgba(10, 15, 28, 0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, this.CARD_WIDTH, this.CARD_HEIGHT * 0.3);
    
    ctx.restore();
  }

  /**
   * 繪製角色信息（疊加在圖片上）
   */
  private drawCharacterInfo(ctx: CanvasRenderingContext2D, character: Character) {
    const rarityInfo = this.getRarityInfo(character.rarity);
    
    ctx.save();
    
    // 頂部：稀有度和等級（左上角）+ 屬性（右側，同一行）
    const topY = 53;
    
    // 稀有度和等級（左側）
    ctx.font = 'bold 38px Arial';
    ctx.fillStyle = rarityInfo.color;
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 2;
    ctx.fillText(`${rarityInfo.name} ${rarityInfo.stars}`, 27, topY);
    
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Lv.${character.level}`, 27, topY + 40);
    
    // 屬性（右側，橫向排列，與稀有度同一行）
    ctx.textAlign = 'right';
    ctx.shadowBlur = 5;
    
    const attributes = [
      { label: 'STR', value: character.strength, color: '#ff6b6b' },
      { label: 'AGI', value: character.agility, color: '#4ecdc4' },
      { label: 'LUK', value: character.luck, color: '#ffe66d' }
    ];
    
    const rightEdge = this.CARD_WIDTH - 27;
    const attributeGap = 80; // 屬性之間的間距
    let currentX = rightEdge;
    
    // 從右到左排列屬性
    attributes.reverse().forEach((attr) => {
      ctx.fillStyle = attr.color;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`${attr.label}`, currentX, topY - 7);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`${attr.value}`, currentX, topY + 23);
      currentX -= attributeGap;
    });
    
    ctx.textAlign = 'left';
    
    // 底部：角色名稱和更多信息
    const bottomY = this.CARD_HEIGHT * 0.75;
    
    // 角色名稱（大號，居中）
    ctx.font = 'bold 59px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.fillText(character.name.toUpperCase(), this.CARD_WIDTH * 0.5, bottomY);
    
    // 角色技能描述（如果有）
    if (character.skill_description) {
      ctx.font = '28px Arial';
      ctx.fillStyle = '#cccccc';
      ctx.shadowBlur = 4;
      const maxWidth = this.CARD_WIDTH * 0.8;
      const text = character.skill_description.length > 80 
        ? character.skill_description.substring(0, 80) + '...' 
        : character.skill_description;
      const lines = this.wrapText(ctx, text, maxWidth);
      lines.forEach((line, index) => {
        ctx.fillText(line, this.CARD_WIDTH * 0.5, bottomY + 53 + (index * 33));
      });
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * 繪製玩家統計（橫向排列，在品牌標識上方）
   */
  private drawPlayerStats(ctx: CanvasRenderingContext2D, stats: any) {
    const baseY = this.CARD_HEIGHT - 167; // 在 "JOIN THE BATTLE" 上方，增加距離
    
    ctx.save();
    ctx.textAlign = 'center';
    
    // 統計項目（橫向排列）
    const items = [
      { label: 'Fighters', value: stats.totalFighters },
      { label: 'Battles', value: stats.totalBattles },
      { label: 'Win Rate', value: `${stats.winRate}%` },
      { label: 'UR', value: stats.urCount }
    ];
    
    const itemSpacing = this.CARD_WIDTH / (items.length + 1);
    const labelY = baseY; // 標籤在上
    const valueY = baseY + 47; // 數值在下
    
    items.forEach((item, index) => {
      const x = itemSpacing * (index + 1);
      
      // 標籤（小號，在上）
      ctx.font = '24px Arial';
      ctx.fillStyle = '#888888';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      ctx.fillText(item.label, x, labelY);
      
      // 數值（大號，粗體，在下）
      ctx.font = 'bold 37px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.fillText(item.value.toString(), x, valueY);
    });
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * 繪製遊戲品牌標識（簡潔版）
   */
  private drawGameBranding(ctx: CanvasRenderingContext2D) {
    const bottomY = this.CARD_HEIGHT - 53; // 調整位置，為統計數據留空間
    
    ctx.save();
    ctx.textAlign = 'center';
    
    // 召喚文字（適中大小）
    ctx.font = 'bold 35px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.fillText('JOIN THE BATTLE', this.CARD_WIDTH * 0.5, bottomY);
    
    // 網址（小號，不搶眼）
    ctx.font = '21px Arial';
    ctx.fillStyle = '#666666';
    ctx.shadowBlur = 3;
    ctx.fillText(environment.appUrl || 'promptfighters.app', this.CARD_WIDTH * 0.5, bottomY + 33);
    
    ctx.restore();
  }

  /**
   * 獲取稀有度信息
   */
  private getRarityInfo(rarity: number) {
    const rarityMap: { [key: number]: { name: string, color: string, stars: string } } = {
      1: { name: 'N', color: '#888888', stars: '★' },
      2: { name: 'R', color: '#4fd2ff', stars: '★★' },
      3: { name: 'SR', color: '#a259ff', stars: '★★★' },
      4: { name: 'SSR', color: '#ffb300', stars: '★★★★' },
      5: { name: 'UR', color: '#ff3c6e', stars: '★★★★★' }
    };
    return rarityMap[rarity] || rarityMap[1];
  }

  /**
   * 分享到 Twitter
   */
  shareToTwitter(imageUrl: string, text: string, character: Character) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(environment.appUrl || '')}`;
    window.open(url, '_blank');
  }

  /**
   * 分享到 Facebook
   */
  shareToFacebook(imageUrl: string, url: string) {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank');
  }

  /**
   * 下載分享圖片
   */
  downloadImage(imageUrl: string, filename: string = 'share-card.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = imageUrl;
    link.click();
  }

  /**
   * 複製圖片到剪貼板
   */
  async copyImageToClipboard(imageUrl: string): Promise<boolean> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    } catch (error) {
      console.error('複製圖片失敗:', error);
      return false;
    }
  }

  /**
   * 構建圖片 URL（與 MediaUrlPipe 邏輯一致）
   * 對於外部 URL（如 R2），使用後端代理來避免 CORS 問題
   */
  private buildImageUrl(imageUrl: string): string {
    if (!imageUrl) {
      return '';
    }
    
    // 如果是完整的外部 URL（跨域），使用後端代理
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // 檢查是否是跨域（與當前域名不同）
      const urlObj = new URL(imageUrl, window.location.href);
      const currentOrigin = window.location.origin;
      
      // 如果是跨域，使用後端代理
      if (urlObj.origin !== currentOrigin && urlObj.origin !== environment.backendBaseUrl) {
        return `${environment.backendBaseUrl}/api/proxy-image/?url=${encodeURIComponent(imageUrl)}`;
      }
      
      // 同源，直接返回
      return imageUrl;
    }
    
    // 如果是相對路徑（以 /media/ 開頭），加上後端 base URL
    if (imageUrl.startsWith('/media/')) {
      return `${environment.backendBaseUrl}${imageUrl}`;
    }
    
    // 如果沒有前綴，嘗試加上 /media/ 前綴
    if (!imageUrl.startsWith('/')) {
      return `${environment.backendBaseUrl}/media/${imageUrl}`;
    }
    
    // 其他情況直接加上後端 base URL
    return `${environment.backendBaseUrl}${imageUrl}`;
  }

  /**
   * 繪製圓角矩形（輔助方法）
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 文字換行處理（輔助方法）
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }
}

