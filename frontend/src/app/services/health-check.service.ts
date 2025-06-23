import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, timer, of } from 'rxjs';
import { switchMap, catchError, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private apiBaseUrl = environment.backendBaseUrl;
  
  // 使用 BehaviorSubject 來保存最新的伺服器狀態
  // true: 在線, false: 離線
  // 初始值設為 true，樂觀地認為伺服器是在線的
  private serverStatus = new BehaviorSubject<boolean>(true);
  
  // 將狀態作為 Observable 暴露出去，供其他元件訂閱
  public serverStatus$ = this.serverStatus.asObservable();

  constructor(private http: HttpClient) { }

  /**
   * 開始定期檢查伺服器健康狀況。
   * @param interval - 檢查間隔（毫秒），預設為 15 秒。
   */
  startPeriodicChecks(interval: number = 15000): void {
    // 使用 timer 來創建一個定期觸發的 Observable
    timer(0, interval).pipe(
      // 每次觸發時，切換到 health check 的 HTTP 請求
      switchMap(() => 
        this.http.get<{status: string}>(`${this.apiBaseUrl}/api/health/`).pipe(
          // 5 秒超時機制
          timeout(5000) 
        )
      ),
      // 處理請求成功的情況
      tap(() => this.updateStatus(true)),
      // 處理任何錯誤（網路錯誤、伺服器 5xx 錯誤等）
      catchError(() => {
        this.updateStatus(false);
        // 返回一個 'of(null)' 來讓 observable 鏈繼續下去，不會因為一次錯誤就終止
        return of(null);
      })
    ).subscribe();
  }

  /**
   * 更新伺服器狀態，只有在狀態改變時才發出新值。
   * @param isOnline - 新的狀態
   */
  private updateStatus(isOnline: boolean): void {
    if (this.serverStatus.getValue() !== isOnline) {
      this.serverStatus.next(isOnline);
      if(isOnline) {
        console.log('Server is back online.');
      } else {
        console.error('Server is offline or unreachable.');
      }
    }
  }
} 