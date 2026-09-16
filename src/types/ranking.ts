// Rankings domain types (yearly rankings per user; see docs/modules/rankings.md).

export interface RankingCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  cover_url?: string | null;
  created_at?: string;
}

export interface RankingItem {
  id: number;
  user_id: string;
  year: number;
  category_id: number;
  game_id: number; // reference to Game.id
  rank: number; // 1 = Gold, 2 = Silver, 3 = Bronze, etc.
  created_at?: string;
}
