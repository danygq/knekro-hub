// Stream log domain types (home "Directo desde Twitch" section; table not yet built).

import type { Category } from "./categories";

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
