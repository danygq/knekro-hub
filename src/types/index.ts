// TypeScript types used across the app
// Keep interfaces small and focused; expand as you add features.

export interface GameStatus {
  id: number;
  name: string;
}

export interface Category {
  id: number; // provider/category id (e.g., Twitch category id or UUID)
  name: string; // display name, e.g. "Just Chatting"
  game_id?: string; // optional reference to Game.id if this category maps to a known game
  url?: string; // optional link to provider/category page
  // add other provider-specific metadata here later (language, box_art_url, etc.)
}

export interface StreamLog {
  id: number; // UUID or provider ID
  title: string;
  started_at: string; // ISO timestamp
  ended_at?: string; // ISO timestamp, undefined if live
  is_live: boolean;
  duration_seconds?: number;
  categories: Category[]; // list of categories for the stream (always present, can be empty)
  vod_url?: string; // Twitch VOD
  youtube_url?: string; // optional YouTube upload
  notes?: string;
}

export interface Game {
  id: number; // UUID or slug
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
  id: number;
  year: number;
  rank: number; // 1 = top
  game_id: number; // reference to Game.id
  votes?: number;
  notes?: string;
  tier?: string; // optional tier label used by interactive tier list
}
