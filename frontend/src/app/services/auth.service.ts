import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface TokenResponse {
  access: string;
  refresh: string;
  player_id?: string;
  username?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.backendBaseUrl + '/api/token/';
  private refreshUrl = environment.backendBaseUrl + '/api/token/refresh/';
  private oauthUrl = environment.backendBaseUrl + '/api/oauth/';
  private socialLoginUrl = environment.backendBaseUrl + '/api/social-login/';
  private web3AuthUrl = environment.backendBaseUrl + '/api/auth/web3-login/';
  private web3NonceUrl = environment.backendBaseUrl + '/api/auth/web3-nonce/';

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(this.apiUrl, { username, password })
      .pipe(
        tap(response => this.setTokens(response.access, response.refresh))
      );
  }

  oauthLogin(provider: string, code: string, redirectUri: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.oauthUrl}${provider}/`, { 
      code,
      redirect_uri: redirectUri
    }).pipe(
      tap(response => this.setTokens(response.access, response.refresh))
    );
  }

  socialLogin(provider: string, idToken: string): Observable<TokenResponse> {
    console.log('Attempting social login with:', { provider, idToken });
    return this.http.post<TokenResponse>(this.socialLoginUrl, {
      provider,
      id_token: idToken
    }).pipe(
      tap(response => {
        console.log('Social login response:', response);
        this.setTokens(response.access, response.refresh);
      })
    );
  }

  web3Login(address: string, signature: string, nonce: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(
      this.web3AuthUrl,
      { address, signature, nonce }
    ).pipe(
      tap(response => {
        this.setTokens(response.access, response.refresh);
        localStorage.setItem('wallet_address', address);
      })
    );
  }

  setTokens(access: string, refresh: string) {
    localStorage.setItem('jwt-token', access);
    localStorage.setItem('refresh-token', refresh);
  }

  setToken(token: string) {
    localStorage.setItem('jwt-token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('jwt-token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh-token');
  }

  refreshToken(): Observable<TokenResponse> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return new Observable(observer => observer.error('No refresh token available'));
    }
    return this.http.post<TokenResponse>(this.refreshUrl, { refresh }).pipe(
      tap((tokens: TokenResponse) => {
        this.setToken(tokens.access);
        // 後端可能會在 refresh 時也回傳一個新的 refresh token
        if (tokens.refresh) {
          localStorage.setItem('refresh-token', tokens.refresh);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('jwt-token');
    localStorage.removeItem('refresh-token');
    this.router.navigate(['/login']);
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  isLoggedIn(): boolean {
    return this.isTokenValid();
  }

  getWeb3Nonce(address: string): Promise<{ nonce: string, message: string } | null> {
    return this.http
      .get<{ nonce: string, message: string }>(`${this.web3NonceUrl}?address=${address}`)
      .toPromise()
      .then(resp => resp || null)
      .catch(() => null);
  }
} 