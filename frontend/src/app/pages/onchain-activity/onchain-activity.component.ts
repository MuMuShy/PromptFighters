import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaUrlPipe } from '../../pipes/media-url.pipe';
import { HttpClientModule } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { OnchainService } from '../../services/onchain.service';
import { BattleService } from '../../services/battle.service';

@Component({
  selector: 'app-onchain-activity',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MediaUrlPipe],
  template: `
  <div class="onchain-page">
    <div class="header">
      <button class="back" (click)="goBack()">← BACK</button>
      <h1>On-chain Activity</h1>
    </div>

    <div class="list" *ngIf="items.length; else empty">
      <div class="item" *ngFor="let it of items">
        <div class="left">
          <div class="title">{{ getLeftName(it) }} VS {{ getRightName(it) }}</div>
          <div class="meta">
            <span class="winner" *ngIf="getWinnerName(it)">Winner: {{ getWinnerName(it) }}</span>
            <span class="time">{{ getTime(it) | date:'yyyy/MM/dd HH:mm' }}</span>
            <span class="status" [class.pending]="it.onchain_status==='pending'" [class.sent]="it.onchain_status==='sent'" [class.confirmed]="it.onchain_status==='confirmed'" [class.failed]="it.onchain_status==='failed'">{{ it.onchain_status || 'n/a' }}</span>
          </div>
        </div>
        <div class="links">
          <a class="link" *ngIf="getExplorer(it)" [href]="getExplorer(it)" target="_blank" rel="noopener">VIEW TX</a>
          <a class="link" *ngIf="getIpfs(it)" [href]="getIpfs(it)" target="_blank" rel="noopener">VIEW IPFS</a>
          <button class="link" (click)="toggleExpand(it)">{{ expandedId===it.battle_id ? 'Hide' : 'Details' }}</button>
        </div>

        <div class="rounds" *ngIf="expandedId===it.battle_id">
          <div class="fighters-header">
            <div class="fighter left">
              <img [src]="getLeftImage(it) | mediaUrl" alt="left" />
              <div class="name">{{ getLeftName(it) }}</div>
              <div class="hp-bar"><div class="fill" [style.width.%]="leftHpPercent"></div></div>
            </div>
            <div class="vs">VS</div>
            <div class="fighter right">
              <img [src]="getRightImage(it) | mediaUrl" alt="right" />
              <div class="name">{{ getRightName(it) }}</div>
              <div class="hp-bar"><div class="fill" [style.width.%]="rightHpPercent"></div></div>
            </div>
          </div>
          <div *ngIf="detailsState[it.battle_id]?.loading" class="desc">Loading rounds...</div>
          <div *ngIf="detailsState[it.battle_id]?.error" class="desc" style="color:#f87171;">{{ detailsState[it.battle_id]?.error }}</div>
          <div *ngIf="!detailsState[it.battle_id]?.loading && !detailsState[it.battle_id]?.error && (!battleLog || !battleLog.length)" class="desc">No rounds found</div>
          <div class="round" *ngFor="let r of battleLog; index as idx">
            <div class="round-left">
              <div class="round-idx">R{{ idx+1 }}</div>
              <div class="actors">{{ getName(r.attacker, it) }} → {{ getName(r.defender, it) }}</div>
            </div>
            <div class="round-right">
              <div class="damage">-{{ r.damage }}</div>
              <div class="remain">HP {{ r.remaining_hp }}</div>
            </div>
            <div class="mini-bars">
              <div class="mini left"><div class="fill" [style.width.%]="hpTimeline[idx]?.left"></div></div>
              <div class="mini right"><div class="fill" [style.width.%]="hpTimeline[idx]?.right"></div></div>
            </div>
            <div class="desc">{{ r.description }}</div>
          </div>
        </div>
      </div>
    </div>
    <ng-template #empty>
      <div class="empty">No on-chain records yet.</div>
    </ng-template>
  </div>
  `,
  styleUrls: ['./onchain-activity.component.scss']
})
export class OnchainActivityComponent implements OnInit {
  items: any[] = [];
  expandedId: string | null = null;
  battleLog: any[] | null = null;
  detailsState: { [id: string]: { loading: boolean; error: string | null } } = {};
  hpTimeline: { left: number; right: number }[] = [];
  readonly INITIAL_HP = 300;
  leftHpPercent = 100;
  rightHpPercent = 100;
  private rawHttp: HttpClient; // 不經過攔截器，避免自動帶 Authorization 造成 CORS
  constructor(private onchain: OnchainService, private battles: BattleService, private http: HttpClient, handler: HttpBackend, private router: Router, private route: ActivatedRoute) {
    this.rawHttp = new HttpClient(handler);
  }

  ngOnInit(): void {
    const characterId = this.route.snapshot.queryParamMap.get('characterId');
    if (characterId) {
      this.onchain.getCharacterOnchainHistory(characterId, 50).subscribe({
        next: (res) => {
          this.items = res.items || [];
        }
      });
    } else {
      this.onchain.getPlayerRecentOnchain(20).subscribe({
        next: (res) => {
          // 相容兩種可能的回傳格式
          this.items = (res as any).recent_onchain_activity || (res as any).items || [];
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  buildExplorer(tx: string): string {
    if (!tx) return '';
    const t = tx.startsWith('0x') ? tx : ('0x' + tx);
    return `https://explorer.sepolia.mantle.xyz/tx/${t}`;
  }

  getLeftName(it: any): string {
    return it.player_character_name || it.character1 || it.left_name || 'Fighter A';
  }
  getRightName(it: any): string {
    return it.opponent_name || it.character2 || it.right_name || 'Fighter B';
  }
  getWinnerName(it: any): string | null {
    return it.winner_name || it.winner || null;
  }
  getTime(it: any): string | Date | null {
    return it.onchain_timestamp || it.timestamp || it.created_at || null;
  }
  getExplorer(it: any): string | null {
    if (it.explorer_url) return it.explorer_url;
    const tx = it.onchain_tx_hash || it.tx_hash;
    return tx ? this.buildExplorer(tx) : null;
  }
  getIpfs(it: any): string | null {
    if (it.ipfs_gateway_url) return it.ipfs_gateway_url;
    return it.ipfs_cid ? `https://gateway.pinata.cloud/ipfs/${it.ipfs_cid}` : null;
  }

  toggleExpand(it: any): void {
    if (this.expandedId === it.battle_id) {
      this.expandedId = null;
      this.battleLog = null;
      return;
    }
    this.expandedId = it.battle_id;
    this.detailsState[it.battle_id] = { loading: true, error: null };
    this.battles.getBattleResult(it.battle_id).subscribe({
      next: (b: any) => {
        const log = b?.battle_log?.battle_log || b?.battle_log || [];
        if (Array.isArray(log) && log.length) {
          this.battleLog = log;
          this.detailsState[it.battle_id] = { loading: false, error: null };
          this.computeHpTimeline(it);
        } else {
          this.tryLoadFromIpfs(it);
        }
      },
      error: () => {
        this.tryLoadFromIpfs(it);
      }
    });
  }

  private tryLoadFromIpfs(it: any): void {
    const url = this.getIpfs(it);
    if (!url) {
      this.battleLog = [];
      this.detailsState[it.battle_id] = { loading: false, error: 'No IPFS URL' };
      return;
    }
    // 解析 CID
    const cidMatch = url.match(/\/ipfs\/([^/?#]+)/);
    const cid = cidMatch ? cidMatch[1] : null;
    const gateways = cid ? [
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`
    ] : [url];

    const tryNext = (idx: number) => {
      if (idx >= gateways.length) {
        this.battleLog = [];
        this.detailsState[it.battle_id] = { loading: false, error: 'Failed to load from IPFS' };
        return;
      }
      const target = gateways[idx];
      // 使用 rawHttp 避開攔截器，避免夾帶 Authorization 觸發預檢
      this.rawHttp.get(target, { withCredentials: false }).subscribe({
        next: (json: any) => {
          const log = json?.battle_log?.battle_log || json?.battle_log || [];
          if (Array.isArray(log)) {
            this.battleLog = log;
            this.detailsState[it.battle_id] = { loading: false, error: null };
            this.computeHpTimeline(it);
          } else {
            // 結構不符，視為失敗，嘗試下一個
            tryNext(idx + 1);
          }
        },
        error: (e) => {
          console.warn('IPFS gateway failed:', target, e);
          tryNext(idx + 1);
        }
      });
    };

    tryNext(0);
  }

  getName(idOrName: string, it: any): string {
    if (!idOrName) return '';
    if (idOrName === it.player_character_name) return it.player_character_name;
    if (idOrName === it.opponent_name) return it.opponent_name;
    return idOrName;
  }

  getLeftImage(it: any): string | null {
    if (it.player_character_image_url) return it.player_character_image_url;
    if (it.left_image_url) return it.left_image_url;
    return null;
  }

  getRightImage(it: any): string | null {
    if (it.opponent_image_url) return it.opponent_image_url;
    if (it.right_image_url) return it.right_image_url;
    return null;
  }

  private computeHpTimeline(it: any): void {
    const leftName = this.getLeftName(it);
    const rightName = this.getRightName(it);
    let left = this.INITIAL_HP;
    let right = this.INITIAL_HP;
    this.hpTimeline = [];
    (this.battleLog || []).forEach((r: any) => {
      const atk = this.getName(r.attacker, it);
      if (atk === leftName) {
        right = Math.max(0, right - (r.damage || 0));
      } else {
        left = Math.max(0, left - (r.damage || 0));
      }
      this.hpTimeline.push({
        left: Math.round((left / this.INITIAL_HP) * 100),
        right: Math.round((right / this.INITIAL_HP) * 100),
      });
    });
    const last = this.hpTimeline[this.hpTimeline.length - 1] || { left: 100, right: 100 };
    this.leftHpPercent = last.left;
    this.rightHpPercent = last.right;
  }
}


