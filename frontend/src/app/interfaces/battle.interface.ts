import { Character } from './character.interface';

export interface BattleLog {
    attacker: string;
    defender: string;
    action: string;
    damage: number;
    description: string;
    remaining_hp: number;
}

export interface BattleResult {
    winner: string;
    battle_log: BattleLog[];
    battle_description: string;
}

export interface BattleRewards {
    gold: number;
    exp_potion: number;
    rarity_bonus: number;
    victory: boolean;
}

export interface Battle {
    id: string;
    character1: Character;
    character2: Character;
    winner: Character;
    battle_log: {
        winner: string;
        battle_log: {
            attacker: string;
            defender: string;
            action: string;
            damage: number;
            description: string;
            remaining_hp: number;
        }[];
        battle_description: string;
        battle_rewards?: BattleRewards;
    };
    created_at: string;
    status: 'PENDING' | 'COMPLETED' | 'ERROR';
} 