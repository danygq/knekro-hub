// TypeScript types used across the app
// Keep interfaces small and focused; expand as you add features.

export type GameStatus = 'ojeadita' | 'en_progreso' | 'completado' | 'volo_alto';

export interface StreamLog {
  id: string; // UUID or provider ID
  title: string;
  started_at: string; // ISO timestamp
  ended_at?: string; // ISO timestamp, undefined if live
  is_live: boolean;
  duration_seconds?: number;
  game_id?: string; // reference to Game.id
  vod_url?: string; // Twitch VOD
  youtube_url?: string; // optional YouTube upload
  notes?: string;
}

export interface Game {
  id: string; // UUID or slug
  title: string;
  slug?: string; // friendly URL segment
  description?: string;
  cover_url?: string;
  platforms?: string[];
  status: GameStatus;
  play_count?: number; // times played on stream
  added_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  tags?: string[];
}

export interface GotyItem {
  id: string;
  year: number;
  rank: number; // 1 = top
  game_id: string; // reference to Game.id
  votes?: number;
  notes?: string;
  tier?: string; // optional tier label used by interactive tier list
}
