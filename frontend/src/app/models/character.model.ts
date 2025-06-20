export interface Character {
  id: string;
  name: string;
  prompt: string;
  image_url: string;
  strength: number;
  agility: number;
  luck: number;
  skill_description: string;
  win_count: number;
  loss_count: number;
  created_at: string;
}

export interface BattleResult {
  id: string;
  winner: Character;
  battle_log: {
    attacker: string;
    defender: string;
    action: string;
    damage: number;
    description: string;
    remaining_hp: number;
  }[];
  battle_description: string;
  duration?: number;
  date?: Date;
}

export interface BattleLogEntry {
  turn: number;
  attacker: string;
  defender: string;
  action: string;
  damage: number;
  critical: boolean;
  skillUsed?: string;
  message: string;
}