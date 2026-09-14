// Stream domain types (home "Directo desde Twitch" section).

import type { Category } from "./categories";

export interface Stream {
  id: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  twitch_id?: string | null;
}

export interface StreamLog {
  id: number;
  title: string;
  started_at: string;
  ended_at?: string;
  is_live: boolean;
  duration_seconds?: number;
  categories: Category[];
  vod_url?: string;
  youtube_url?: string;
  notes?: string;
}
