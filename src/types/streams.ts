// Stream domain types (home "Directo desde Twitch" section).

export interface Stream {
  id: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  twitch_id?: string | null;
}
