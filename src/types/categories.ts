// Stream category domain types (Twitch/provider categories on a stream).

export interface Category {
  id: number; // provider/category id (e.g., Twitch category id or UUID)
  name: string; // display name, e.g. "Just Chatting"
  game_id?: string; // optional reference to Game.id if this category maps to a known game
  url?: string; // optional link to provider/category page
  // add other provider-specific metadata here later (language, box_art_url, etc.)
}
