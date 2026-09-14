// Twitch EventSub and Helix domain types.

export interface TwitchChannelUpdate {
  id: number;
  created_at: string;
  event_timestamp: string | null;
  category_id: string | null;
  category_name: string | null;
}

export interface TwitchEventSubSubscription {
  id: string;
  status: string;
  type: string;
  version: string;
  condition: Record<string, string>;
  transport: {
    method: string;
    callback: string;
  };
  created_at: string;
}

export interface TwitchStreamOnlineEvent {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  type: string;
  started_at: string;
}

export interface TwitchStreamOfflineEvent {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
}

export interface TwitchChannelUpdateEvent {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  title: string;
  language: string;
  category_id: string;
  category_name: string;
  content_classification_labels?: string[];
}

export interface TwitchEventSubNotificationPayload {
  subscription: TwitchEventSubSubscription;
  event:
    | TwitchStreamOnlineEvent
    | TwitchStreamOfflineEvent
    | TwitchChannelUpdateEvent;
}
