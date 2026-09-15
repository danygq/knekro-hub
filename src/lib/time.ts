/**
 * Time and date formatting utilities for Knekro Hub.
 * Handles Spain/Madrid wall-clock conversions and duration formatting.
 */

const MADRID_TZ = "Europe/Madrid";

// Cached formatter for converting Date instances to Europe/Madrid wall-clock strings
const madridDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Formats a Date or ISO timestamp into Europe/Madrid wall-clock timestamp string (YYYY-MM-DD HH:mm:ss).
 * Stored as timestamp without time zone in Postgres.
 */
export function toMadridDateTimeString(
  dateInput?: string | Date | number | null,
): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const parts = madridDateTimeFormatter.formatToParts(validDate);
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
 * Supports strings formatted as "YYYY-MM-DD HH:mm:ss", ISO strings ("2026-09-15T17:36:00"), or Date instances.
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
 * Example: "17:36"
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
    timeZone: MADRID_TZ,
  });
}

/**
 * Formats stream timestamp into Spanish display date (e.g. "15 sept, 17:36").
 */
export function formatStreamDate(
  dateInput: string | Date | null | undefined,
): string {
  if (!dateInput) return "--";

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      const [, y, m, d, h, min] = match;
      const date = new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(h),
        Number(min),
      );
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  const date = parseStreamDate(dateInput);
  if (!date) return "--";

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MADRID_TZ,
  });
}

/**
 * Formats elapsed stream duration since started_at into human-readable Spanish text.
 * Examples:
 * - "25 secs"
 * - "30 min y 20 secs"
 * - "2 h, 53 min y 30 secs"
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
