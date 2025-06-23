import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, timer, of, Subscription } from 'rxjs';
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

  private periodicSub: Subscription | null = null;

  constructor(private http: HttpClient) { }

  /**
   * 單次檢查伺服器健康狀態。
   * @returns Observable<boolean> 代表是否在線
   */
  checkOnce(): void {
    this.http.get<{status: string}>(`${this.apiBaseUrl}/api/health/`).pipe(
      timeout(5000),
      tap(() => this.updateStatus(true)),
      catchError(() => {
        this.updateStatus(false);
        return of(null);
      })
    ).subscribe();
  }

  /**
   * 開始定期檢查伺服器健康狀況。
   * @param interval - 檢查間隔（毫秒），預設為 60 秒。
   * @returns Subscription，可用於隨時停止檢查
   */
  startPeriodicChecks(interval: number = 60000): Subscription {
    if (this.periodicSub) {
      this.periodicSub.unsubscribe();
    }
    this.periodicSub = timer(0, interval).pipe(
      switchMap(() => 
        this.http.get<{status: string}>(`${this.apiBaseUrl}/api/health/`).pipe(
          timeout(5000)
        )
      ),
      tap(() => this.updateStatus(true)),
      catchError(() => {
        this.updateStatus(false);
        return of(null);
      })
    ).subscribe();
    return this.periodicSub;
  }

  /**
   * 停止定期健康檢查。
   */
  stopPeriodicChecks(): void {
    if (this.periodicSub) {
      this.periodicSub.unsubscribe();
      this.periodicSub = null;
    }
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