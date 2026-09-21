// Stream domain types (home "Directo desde Twitch" section & calendar).

export interface Stream {
  id: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  twitch_id?: string | null;
}

export interface RawStreamActivity {
  id: number;
  event_timestamp: string;
  category_id: string;
  category_name: string;
  game_id: number | null;
  game_name: string | null;
  cover_url: string | null;
  avg_vote: number | null;
  status_name: string | null;
}

export interface StreamActivitySegment {
  id: number;
  category_id: string;
  category_name: string;
  start_time: string;
  end_time: string;
  duration_text: string;
  duration_seconds: number;
  is_current: boolean;
  game_id: number | null;
  game_name: string | null;
  cover_url: string | null;
  avg_vote: number | null;
  status_name: string | null;
}

export interface StreamWithActivities {
  id: number;
  started_at: string;
  ended_at: string | null;
  twitch_id: string | null;
  start_time_text: string;
  end_time_text: string;
  spans_next_day: boolean;
  total_duration_text: string;
  is_live: boolean;
  segments: StreamActivitySegment[];
}

export interface CalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  streams: StreamWithActivities[];
}

export interface CalendarMonthData {
  year: number;
  month: number;
  monthName: string;
  prevMonth: string; // YYYY-MM
  nextMonth: string; // YYYY-MM
  currentMonthStr: string; // YYYY-MM
  days: CalendarDay[];
}
