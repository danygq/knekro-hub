// GOTY awards domain types (yearly rankings; see docs/GOTY.md).

export interface GotyItem {
  id: number;
  year: number;
  rank: number; // 1 = top
  game_id: number; // reference to Game.id
  votes?: number;
  notes?: string;
  tier?: string; // optional tier label used by interactive tier list
}
