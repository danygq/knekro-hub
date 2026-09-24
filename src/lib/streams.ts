import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CalendarDay,
  CalendarMonthData,
  MonthlyGameRankingItem,
  RawStreamActivity,
  StreamActivitySegment,
  StreamWithActivities,
} from "../types/streams";
import {
  formatDurationSeconds,
  formatSpanishMonthYear,
  formatStreamDuration,
  formatStreamStartTime,
  getCalendarMonthBounds,
  getStreamMadridEpoch,
  toMadridDateTimeString,
} from "./time";
import { isIgnoredTwitchCategory } from "./twitch/constants";

/**
 * Calculates continuous category transition segments with start times, end times,
 * and exact elapsed durations for each activity within a stream broadcast.
 */
export function calculateActivitySegments(
  startedAt: string,
  endedAt: string | null,
  rawActivities: RawStreamActivity[],
): StreamActivitySegment[] {
  if (!rawActivities || rawActivities.length === 0) {
    const isLive = endedAt == null;
    const startEpoch = getStreamMadridEpoch(startedAt);
    let endEpoch: number | null = null;

    if (endedAt) {
      endEpoch = getStreamMadridEpoch(endedAt);
    } else {
      const nowStr = toMadridDateTimeString();
      endEpoch = Date.parse(nowStr.replace(" ", "T") + "Z");
    }

    const durationSeconds =
      startEpoch && endEpoch
        ? Math.max(0, Math.floor((endEpoch - startEpoch) / 1000))
        : 0;

    return [
      {
        id: 0,
        category_id: "0",
        category_name: "Directo en Twitch",
        start_time: formatStreamStartTime(startedAt),
        end_time: isLive ? "En curso" : formatStreamStartTime(endedAt),
        duration_text: formatStreamDuration(startedAt, endedAt),
        duration_seconds: durationSeconds,
        is_current: isLive,
        game_id: null,
        game_name: null,
        cover_url: null,
        avg_vote: null,
        status_name: null,
      },
    ];
  }

  const segments: StreamActivitySegment[] = [];

  for (let i = 0; i < rawActivities.length; i++) {
    const current = rawActivities[i];
    const next = rawActivities[i + 1];

    const startTime = formatStreamStartTime(current.event_timestamp);
    const startEpoch = getStreamMadridEpoch(current.event_timestamp);

    let endTime: string;
    let endEpoch: number | null = null;
    let isCurrent = false;

    if (next) {
      endTime = formatStreamStartTime(next.event_timestamp);
      endEpoch = getStreamMadridEpoch(next.event_timestamp);
      isCurrent = false;
    } else if (endedAt) {
      endTime = formatStreamStartTime(endedAt);
      endEpoch = getStreamMadridEpoch(endedAt);
      isCurrent = false;
    } else {
      endTime = "En curso";
      const nowStr = toMadridDateTimeString();
      endEpoch = Date.parse(nowStr.replace(" ", "T") + "Z");
      isCurrent = true;
    }

    const durationSeconds =
      startEpoch && endEpoch
        ? Math.max(0, Math.floor((endEpoch - startEpoch) / 1000))
        : 0;

    const durationText = formatStreamDuration(
      current.event_timestamp,
      next ? next.event_timestamp : endedAt,
    );

    segments.push({
      id: current.id,
      category_id: current.category_id,
      category_name: current.category_name,
      start_time: startTime,
      end_time: endTime,
      duration_text: durationText,
      duration_seconds: durationSeconds,
      is_current: isCurrent,
      game_id: current.game_id != null ? Number(current.game_id) : null,
      game_name: current.game_name ?? null,
      cover_url: current.cover_url ?? null,
      avg_vote: current.avg_vote != null ? Number(current.avg_vote) : null,
      status_name: current.status_name ?? null,
    });
  }

  return segments;
}

/**
 * Maps a raw database row from get_streams_by_date_range or get_stream_by_id
 * into a typed StreamWithActivities domain model.
 */
export function mapRawStream(raw: any): StreamWithActivities {
  const rawActivities = raw.activities;
  const activities: RawStreamActivity[] = Array.isArray(rawActivities)
    ? rawActivities
    : typeof rawActivities === "string"
      ? JSON.parse(rawActivities)
      : [];

  const startedAt = String(raw.started_at);
  const endedAt = raw.ended_at ? String(raw.ended_at) : null;

  const startDatePrefix = startedAt.slice(0, 10);
  const endDatePrefix = endedAt ? endedAt.slice(0, 10) : null;
  const spansNextDay =
    endDatePrefix != null && startDatePrefix !== endDatePrefix;

  const isLive = endedAt == null;
  const segments = calculateActivitySegments(startedAt, endedAt, activities);

  return {
    id: Number(raw.id),
    started_at: startedAt,
    ended_at: endedAt,
    twitch_id: raw.twitch_id ?? null,
    start_time_text: formatStreamStartTime(startedAt),
    end_time_text: endedAt ? formatStreamStartTime(endedAt) : "En directo",
    spans_next_day: spansNextDay,
    total_duration_text: formatStreamDuration(startedAt, endedAt),
    is_live: isLive,
    segments,
  };
}

/**
 * Loads and constructs all calendar month data including adjacent padding days,
 * querying streams via atomic RPC get_streams_by_date_range.
 * Streams are strictly anchored to the calendar day they started (DATE(started_at)).
 */
export async function loadStreamsForCalendar(
  client: SupabaseClient,
  year: number,
  month: number,
): Promise<CalendarMonthData> {
  const bounds = getCalendarMonthBounds(year, month);
  const monthName = formatSpanishMonthYear(year, month);

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);

  const pad = (n: number) => String(n).padStart(2, "0");
  const prevMonth = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonth = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;
  const currentMonthStr = `${year}-${pad(month)}`;

  const todayMadridStr = toMadridDateTimeString().slice(0, 10);

  const { data, error } = await client.rpc("get_streams_by_date_range", {
    p_start_date: bounds.startDateStr,
    p_end_date: bounds.endDateStr,
  });

  if (error) {
    console.error("Error executing get_streams_by_date_range RPC:", error);
  }

  const streamsByDate = new Map<string, StreamWithActivities[]>();

  if (Array.isArray(data)) {
    for (const raw of data) {
      const stream = mapRawStream(raw);
      const inceptionDateStr = stream.started_at.slice(0, 10);
      const list = streamsByDate.get(inceptionDateStr) ?? [];
      list.push(stream);
      streamsByDate.set(inceptionDateStr, list);
    }
  }

  // Iterate day by day from startDateStr to endDateStr
  const days: CalendarDay[] = [];
  const currentCursor = new Date(bounds.startDateStr + "T00:00:00");
  const endCursor = new Date(bounds.endDateStr + "T00:00:00");

  while (currentCursor <= endCursor) {
    const dateStr = `${currentCursor.getFullYear()}-${pad(currentCursor.getMonth() + 1)}-${pad(currentCursor.getDate())}`;
    const dayNumber = currentCursor.getDate();
    const isCurrentMonth = currentCursor.getMonth() === month - 1;
    const isToday = dateStr === todayMadridStr;
    const isFuture = dateStr > todayMadridStr;
    const streams = streamsByDate.get(dateStr) ?? [];

    days.push({
      dateStr,
      dayNumber,
      isCurrentMonth,
      isToday,
      isFuture,
      streams,
    });

    currentCursor.setDate(currentCursor.getDate() + 1);
  }

  return {
    year,
    month,
    monthName,
    prevMonth,
    nextMonth,
    currentMonthStr,
    days,
  };
}

/**
 * Loads a single stream by ID with its complete activity history and calculated segments.
 */
export async function loadStreamById(
  client: SupabaseClient,
  streamId: number,
): Promise<StreamWithActivities | null> {
  const { data, error } = await client
    .rpc("get_stream_by_id", { p_stream_id: streamId })
    .maybeSingle();

  if (error) {
    console.error("Error executing get_stream_by_id RPC:", error);
    return null;
  }

  if (!data) return null;

  return mapRawStream(data);
}

/**
 * Aggregates all game segments for streams belonging exclusively to the selected calendar month
 * (filtering day.isCurrentMonth === true and cataloged games with game_id != null),
 * sorted descending by total duration played.
 */
export function calculateMonthlyGameRankings(
  monthData: CalendarMonthData,
): MonthlyGameRankingItem[] {
  if (!monthData?.days || monthData.days.length === 0) {
    return [];
  }

  interface AggregatedGame {
    game_id: number;
    game_name: string;
    cover_url: string | null;
    avg_vote: number | null;
    status_name: string | null;
    total_duration_seconds: number;
    stream_ids: Set<number>;
  }

  const map = new Map<number, AggregatedGame>();

  for (const day of monthData.days) {
    // Only aggregate days strictly within the target month (exclude calendar grid padding days)
    if (!day.isCurrentMonth || !day.streams) continue;

    for (const stream of day.streams) {
      if (!stream.segments) continue;

      for (const segment of stream.segments) {
        if (
          segment.game_id == null ||
          isIgnoredTwitchCategory(segment.category_id)
        ) {
          continue;
        }

        const gameId = segment.game_id;
        let entry = map.get(gameId);

        if (!entry) {
          entry = {
            game_id: gameId,
            game_name:
              segment.game_name ?? segment.category_name ?? `Juego #${gameId}`,
            cover_url: segment.cover_url ?? null,
            avg_vote: segment.avg_vote ?? null,
            status_name: segment.status_name ?? null,
            total_duration_seconds: 0,
            stream_ids: new Set<number>(),
          };
          map.set(gameId, entry);
        }

        entry.total_duration_seconds += segment.duration_seconds;
        entry.stream_ids.add(stream.id);

        if (!entry.cover_url && segment.cover_url) {
          entry.cover_url = segment.cover_url;
        }
        if (entry.avg_vote == null && segment.avg_vote != null) {
          entry.avg_vote = segment.avg_vote;
        }
        if (!entry.status_name && segment.status_name) {
          entry.status_name = segment.status_name;
        }
      }
    }
  }

  const items: MonthlyGameRankingItem[] = Array.from(map.values())
    .sort((a, b) => {
      if (b.total_duration_seconds !== a.total_duration_seconds) {
        return b.total_duration_seconds - a.total_duration_seconds;
      }
      if (b.stream_ids.size !== a.stream_ids.size) {
        return b.stream_ids.size - a.stream_ids.size;
      }
      return a.game_name.localeCompare(b.game_name);
    })
    .map((item, index) => ({
      game_id: item.game_id,
      game_name: item.game_name,
      cover_url: item.cover_url,
      avg_vote: item.avg_vote,
      status_name: item.status_name,
      total_duration_seconds: item.total_duration_seconds,
      total_duration_text: formatDurationSeconds(item.total_duration_seconds),
      stream_count: item.stream_ids.size,
      rank: index + 1,
    }));

  return items;
}
