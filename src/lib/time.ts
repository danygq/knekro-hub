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

/**
 * Formats duration between two stream timestamps into Spanish concise duration string.
 * Example: "7 h 1 min", "45 min", "30 secs".
 */
export function formatStreamDuration(
  startedAt: string | Date | null | undefined,
  endedAt?: string | Date | null | undefined,
): string {
  if (!startedAt) return "--";

  const startEpoch = getStreamMadridEpoch(startedAt);
  if (!startEpoch) return "--";

  let endEpoch: number | null = null;
  if (endedAt) {
    endEpoch = getStreamMadridEpoch(endedAt);
  } else {
    const nowStr = toMadridDateTimeString();
    endEpoch = Date.parse(nowStr.replace(" ", "T") + "Z");
  }

  if (!endEpoch || endEpoch < startEpoch) return "--";

  const totalSeconds = Math.floor((endEpoch - startEpoch) / 1000);
  return formatDurationSeconds(totalSeconds);
}

/**
 * Formats a duration in seconds into Spanish concise string.
 * Examples: "7 h 1 min", "45 min", "20 secs".
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 min";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${seconds} secs`;
}

/**
 * Formats year and month into Spanish capitalized title.
 * Example: (2026, 9) => "Septiembre 2026"
 */
export function formatSpanishMonthYear(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString("es-ES", {
    month: "long",
  });
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${year}`;
}

/**
 * Formats a date string (YYYY-MM-DD or full timestamp) into full Spanish date.
 * Example: "2026-09-20" => "Domingo, 20 de septiembre de 2026"
 */
export function formatSpanishFullDate(
  dateInput: string | Date | null | undefined,
): string {
  if (!dateInput) return "--";

  const date = parseStreamDate(dateInput);
  if (!date) return String(dateInput);

  const formatted = date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: MADRID_TZ,
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Calculates start and end calendar bounds (inclusive dates YYYY-MM-DD)
 * for a month grid aligned to Monday..Sunday (7 columns).
 */
export function getCalendarMonthBounds(
  year: number,
  month: number,
): {
  startDateStr: string;
  endDateStr: string;
  firstDayOfMonthStr: string;
  lastDayOfMonthStr: string;
} {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Day of week: 0=Sun, 1=Mon, ..., 6=Sat.
  // We want 0=Mon, 6=Sun:
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - startDayOfWeek);

  const endDayOfWeek = (lastDay.getDay() + 6) % 7;
  const trailingDays = 6 - endDayOfWeek;
  const gridEnd = new Date(year, month - 1, lastDay.getDate() + trailingDays);

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    startDateStr: formatDate(gridStart),
    endDateStr: formatDate(gridEnd),
    firstDayOfMonthStr: formatDate(firstDay),
    lastDayOfMonthStr: formatDate(lastDay),
  };
}
