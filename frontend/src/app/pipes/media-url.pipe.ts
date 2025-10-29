import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

@Pipe({
  name: 'mediaUrl',
  standalone: true
})
export class MediaUrlPipe implements PipeTransform {
  transform(value: string | null): string {
    console.log('🔧 [MediaUrlPipe] 輸入值:', value);
    
    if (!value) {
      console.log('⚠️ [MediaUrlPipe] 值為空，返回空字串');
      return '';
    }
    
    // 如果是完整的 URL（以 http:// 或 https:// 開頭），直接返回
    if (value.startsWith('http://') || value.startsWith('https://')) {
      console.log('✅ [MediaUrlPipe] 完整URL，直接返回:', value);
      return value;
    }
    
    // 如果是相對路徑（以 /media/ 開頭），加上後端 base URL
    if (value.startsWith('/media/')) {
      const fullUrl = `${environment.backendBaseUrl}${value}`;
      console.log('🔗 [MediaUrlPipe] 相對路徑，拼接完整URL:', {
        input: value,
        backendBaseUrl: environment.backendBaseUrl,
        output: fullUrl
      });
      return fullUrl;
    }
    
    // 其他情況直接返回原始值
    console.log('➡️ [MediaUrlPipe] 其他情況，直接返回原值:', value);
    return value;
  }
} 