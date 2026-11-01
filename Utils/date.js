const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Tehran";

/**
 * Extract date/time parts in the given timezone using Intl.DateTimeFormat
 */
export const getTimezoneParts = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(d);
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10), // 1-12
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
};

/**
 * Returns a Date object normalized to UTC midnight for today's calendar date in app timezone.
 * Consistent and deterministic for Prisma @db.Date.
 */
export const todayDate = (now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const parts = getTimezoneParts(now, timezone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
};

/**
 * Parses YYYY-MM-DD string or Date object into a UTC midnight Date.
 */
export const toDateOnly = (strOrDate, timezone = DEFAULT_TIMEZONE) => {
  if (typeof strOrDate === "string") {
    const trimmed = strOrDate.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) {
      throw new Error(`Invalid date format (expected YYYY-MM-DD): ${strOrDate}`);
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // Verify valid calendar day (e.g. Feb 30 becomes March 2)
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Invalid calendar date: ${strOrDate}`);
    }
    return date;
  }

  if (strOrDate instanceof Date) {
    const parts = getTimezoneParts(strOrDate, timezone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  }

  throw new Error("toDateOnly expects a YYYY-MM-DD string or Date object");
};

/**
 * Format a Date object into YYYY-MM-DD
 */
export const formatDate = (date, timezone = DEFAULT_TIMEZONE) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  // If already at UTC midnight
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const parts = getTimezoneParts(d, timezone);
  const m = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${m}-${day}`;
};

/**
 * Adds n days to a Date object (calendar date arithmetic)
 */
export const addDays = (date, n) => {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

/**
 * Returns an array of Dates between startDate and endDate inclusive
 */
export const datesBetween = (startDate, endDate) => {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const dates = [];
  let current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    dates.push(new Date(current.getTime()));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

/**
 * Minutes elapsed since 00:00:00 of the current day in app timezone
 */
export const minutesSinceMidnight = (now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const parts = getTimezoneParts(now, timezone);
  return parts.hour * 60 + parts.minute;
};

/**
 * Validates whether a string is a valid YYYY-MM-DD ISO date string
 */
export const isIsoDateString = (str) => {
  if (typeof str !== "string") return false;
  try {
    toDateOnly(str);
    return true;
  } catch {
    return false;
  }
};
