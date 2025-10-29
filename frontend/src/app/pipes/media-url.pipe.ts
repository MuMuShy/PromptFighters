import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({
  name: 'mediaUrl',
  standalone: true
})
export class MediaUrlPipe implements PipeTransform {
  transform(value: string | null): string {
    if (!value) {
      return '';
    }
    
    // 如果是完整的 URL（以 http:// 或 https:// 開頭），直接返回
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    
    // 如果是相對路徑（以 /media/ 開頭），加上後端 base URL
    if (value.startsWith('/media/')) {
      const fullUrl = `${environment.backendBaseUrl}${value}`;
      return fullUrl;
    }
    
    // 其他情況直接返回原始值
    return value;
  }
} 