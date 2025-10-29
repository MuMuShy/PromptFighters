import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface MintNFTResponse {
  success: boolean;
  message: string;
  data?: {
    token_id: number;
    tx_hash: string;
    contract_address: string;
    owner_wallet: string;
    opensea_url: string;
    explorer_url: string;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NftService {
  private apiUrl = environment.backendBaseUrl + '/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * 鑄造角色 NFT
   */
  mintCharacterNFT(characterId: string, walletAddress: string): Observable<MintNFTResponse> {
    const headers = this.getAuthHeaders();
    return this.http.post<MintNFTResponse>(
      `${this.apiUrl}/characters/${characterId}/mint/`,
      { wallet_address: walletAddress },
      { headers }
    );
  }

  /**
   * 驗證 NFT 所有權
   */
  verifyOwnership(characterId: string, walletAddress: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get(
      `${this.apiUrl}/characters/${characterId}/verify-ownership/?wallet_address=${walletAddress}`,
      { headers }
    );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}

