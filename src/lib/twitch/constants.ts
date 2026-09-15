/**
 * Twitch constants and helper definitions for Knekro Hub.
 */

export const DEFAULT_TWITCH_BROADCASTER_ID = "152633332";

export const TWITCH_EVENTSUB_SUBSCRIPTIONS = [
  { type: "stream.online", version: "1" },
  { type: "stream.offline", version: "1" },
  { type: "channel.update", version: "2" },
] as const;

export type TwitchEventSubType =
  (typeof TWITCH_EVENTSUB_SUBSCRIPTIONS)[number]["type"];

/**
 * Twitch category/game IDs that are non-game or excluded categories
 * that should not be inserted or reconciled into the `games` table.
 */
export const IGNORED_TWITCH_CATEGORIES: Record<string, string> = {
  "509663": "Eventos especiales",
  "509658": "Just Chatting",
  "509672": "IRL",
  "518203": "Deportes",
  "509667": "Comida y bebida",
  "26936": "Musica",
  "509659": "ASMR",
  "27284": "Retro",
  "66082": "Games + demos",
  "488190": "Poker",
  "498592": "I'm only sleeping",
  "1669431183": "DJ",
  "509660": "Art",
  "498566": "Slots",
  "499634": "Crypto",
  "509670": "Ciencia y tecnología",
  "116747788": "Piscinas, jacuzzis y playas",
  "515214": "Política",
  "743": "Ajedrez",
  "1599346425": "cotrabajo y estudio",
  "272263131": "animales, acuarios y zoológicos",
  "417752": "Talk shows y podcasts",
  "1469308723": "Desarrollo de software y juegos",
  "509673": "Manualidades y artesanía",
  "772157971": "Narrativa y escritura",
  "43579844": "LEGO y construcción con bloques",
  "1397210469": "miniaturas y modelos",
  "329951934": "Pokémon Community Game",
};

export const IGNORED_TWITCH_CATEGORY_IDS = new Set<string>(
  Object.keys(IGNORED_TWITCH_CATEGORIES),
);

/**
 * Returns true if the given category ID should be ignored during game reconciliation.
 */
export function isIgnoredTwitchCategory(
  categoryId: string | null | undefined,
): boolean {
  if (!categoryId) return false;
  return IGNORED_TWITCH_CATEGORY_IDS.has(categoryId.trim());
}

/**
 * Formats a Date or ISO timestamp into Europe/Madrid wall-clock timestamp string (YYYY-MM-DD HH:mm:ss).
 * This ensures Postgres timestamptz and timestamp columns store the local Spanish broadcast time.
 */
export function toMadridDateTimeString(
  dateInput?: string | Date | number | null,
): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(validDate);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Safely parses a stream timestamp string or Date object into a valid Date.
 */
export function parseStreamDate(
  dateInput: string | Date | null | undefined,
): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)
      ? trimmed.replace(" ", "T")
      : trimmed;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

/**
 * Extracts Madrid wall-clock epoch timestamp (in UTC pseudo-milliseconds) from any stream timestamp representation.
 * Supports strings formatted as "YYYY-MM-DD HH:mm:ss", ISO strings ("2026-09-15T19:36:00+00:00"), or Date instances.
 */
export function getStreamMadridEpoch(
  dateInput: string | Date | null | undefined,
): number | null {
  if (!dateInput) return null;

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/,
    );
    if (match) {
      const [, y, m, d, h, min, s] = match;
      const sec = s ?? "00";
      return Date.parse(`${y}-${m}-${d}T${h}:${min}:${sec}Z`);
    }
  }

  if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    const madridStr = toMadridDateTimeString(dateInput);
    return Date.parse(madridStr.replace(" ", "T") + "Z");
  }

  return null;
}

/**
 * Formats stream started_at time in Spain wall-clock time (HH:mm).
 * Example: "18:30"
 */
export function formatStreamStartTime(
  dateInput: string | Date | null | undefined,
): string {
  if (!dateInput) return "--:--";

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^\d{4}-\d{2}-\d{2}[T\s](\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
  }

  const date = parseStreamDate(dateInput);
  if (!date) return "--:--";

  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

/**
 * Formats elapsed stream duration since started_at into human-readable Spanish text.
 * Examples:
 * - "25 secs"
 * - "30 min y 20 secs"
 * - "1 h, 15 min y 30 secs"
 */
export function formatStreamElapsedTime(
  dateInput: string | Date | null | undefined,
  nowInput?: Date | number,
): string {
  if (!dateInput) return "0 secs";

  const startedMadridEpoch = getStreamMadridEpoch(dateInput);
  if (!startedMadridEpoch) return "0 secs";

  const madridNowStr = toMadridDateTimeString(nowInput);
  const nowMadridEpoch = Date.parse(madridNowStr.replace(" ", "T") + "Z");

  if (Number.isNaN(nowMadridEpoch)) return "0 secs";

  const elapsedMs = Math.max(0, nowMadridEpoch - startedMadridEpoch);
  const totalSeconds = Math.floor(elapsedMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const secUnit = seconds === 1 ? "sec" : "secs";
  const minUnit = "min";
  const hrUnit = "h";

  if (hours > 0) {
    return `${hours} ${hrUnit}, ${minutes} ${minUnit} y ${seconds} ${secUnit}`;
  }

  if (minutes > 0) {
    return `${minutes} ${minUnit} y ${seconds} ${secUnit}`;
  }

  return `${seconds} ${secUnit}`;
}
