export interface Character {
    id: string;
    name: string;
    image_url: string;
    prompt: string;
    strength: number;
    agility: number;
    luck: number;
    skill_description: string;
    win_count: number;
    loss_count: number;
    created_at: string;
    win_rate: number;
    rarity: number;
    rarity_name: string;
    star_count: number;
    player: string;
    player_display_name: string;
    experience: number;
    level: number;
    
    // NFT 相關欄位
    is_minted?: boolean;
    token_id?: number;
    contract_address?: string;
    owner_wallet?: string;
    minted_at?: string;
    tx_hash?: string;
} 