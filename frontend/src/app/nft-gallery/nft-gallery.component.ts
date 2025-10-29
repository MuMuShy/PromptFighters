import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService } from '../services/player.service';
import { Character } from '../interfaces/character.interface';

@Component({
  selector: 'app-nft-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nft-gallery.component.html',
  styleUrls: ['./nft-gallery.component.scss']
})
export class NftGalleryComponent implements OnInit {
  nftCharacters: Character[] = [];
  isLoading = true;

  constructor(private playerService: PlayerService) { }

  ngOnInit() {
    this.loadNFTs();
  }

  loadNFTs() {
    this.isLoading = true;

    this.playerService.getProfile().subscribe({
      next: (profile: any) => {
        this.nftCharacters = (profile.characters || []).filter((c: Character) => c.is_minted);
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('載入 NFT 失敗:', error);
        this.isLoading = false;
      }
    });
  }

  viewOnExplorer(character: Character) {
    if (!character.tx_hash) return;
    
    // 確保 tx_hash 有 0x 前綴
    const txHash = character.tx_hash.startsWith('0x') ? character.tx_hash : `0x${character.tx_hash}`;
    console.log('txHash: ', txHash);
    const url = `https://explorer.testnet.mantle.xyz/tx/${txHash}`;
    window.open(url, '_blank');
  }

  getRarityClass(rarity: number): string {
    const rarityMap: { [key: number]: string } = {
      1: 'common',
      2: 'rare',
      3: 'elite',
      4: 'epic',
      5: 'legendary'
    };
    return rarityMap[rarity] || 'common';
  }

  getRarityLabel(rarity: number): string {
    const rarityLabels: { [key: number]: string } = {
      1: 'N',
      2: 'R',
      3: 'SR',
      4: 'SSR',
      5: 'UR'
    };
    return rarityLabels[rarity] || 'N';
  }
}

