import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BattleOnchainInfo {
  id: string;
  onchain_status?: 'pending' | 'sent' | 'confirmed' | 'failed' | null;
  tx_hash?: string | null;
  block_number?: number | null;
  timestamp?: string | null;
  contract?: string | null;
  ipfs_cid?: string | null;
  result_hash?: string | null;
  explorer_url?: string;
  ipfs_gateway?: string;
}

@Injectable({ providedIn: 'root' })
export class OnchainService {
  private api = `${environment.backendBaseUrl}`;

  constructor(private http: HttpClient) {}

  getBattleOnchain(battleId: string): Observable<BattleOnchainInfo> {
    return this.http.get<BattleOnchainInfo>(`${this.api}/api/battles/${battleId}/onchain/`);
  }

  getPlayerRecentOnchain(limit = 10): Observable<{ items: any[] }> {
    return this.http.get<{ items: any[] }>(`${this.api}/api/player/onchain/recent/?limit=${limit}`);
  }

  getCharacterOnchainHistory(characterId: string, limit = 20): Observable<{ character_id: string; items: any[] }> {
    return this.http.get<{ character_id: string; items: any[] }>(`${this.api}/api/characters/${characterId}/onchain/history/?limit=${limit}`);
  }
}


