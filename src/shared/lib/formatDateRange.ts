const MONTHS_SHORT_RU = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

interface Day {
  year: number;
  month: number;
  day: number;
  time: number;
}

/** Parses the calendar day of a WordPress date, ignoring any time part. */
function parseDay(value?: string | null): Day | null {
  const match = (value ?? "").trim().match(ISO_DATE);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isValid) return null;

  return { year, month, day, time: parsed.getTime() };
}

/**
 * Compact span of the dates on a page: `18–23 окт`, `28 сен – 3 окт`,
 * `28 дек 2025 – 3 янв 2026`. A single known day collapses to `23 окт`;
 * when nothing parses it returns an em dash.
 */
export function formatDateRange(values: Array<string | null | undefined>): string {
  let earliest: Day | null = null;
  let latest: Day | null = null;

  for (const value of values) {
    const day = parseDay(value);
    if (!day) continue;
    if (!earliest || day.time < earliest.time) earliest = day;
    if (!latest || day.time > latest.time) latest = day;
  }

  if (!earliest || !latest) return "—";

  const earliestMonth = MONTHS_SHORT_RU[earliest.month - 1];
  const latestMonth = MONTHS_SHORT_RU[latest.month - 1];

  if (earliest.time === latest.time) return `${earliest.day} ${earliestMonth}`;

  const sameYear = earliest.year === latest.year;
  const latestLabel = sameYear
    ? `${latest.day} ${latestMonth}`
    : `${latest.day} ${latestMonth} ${latest.year}`;

  if (sameYear && earliest.month === latest.month) {
    return `${earliest.day}–${latestLabel}`;
  }

  const earliestLabel = sameYear
    ? `${earliest.day} ${earliestMonth}`
    : `${earliest.day} ${earliestMonth} ${earliest.year}`;

  return `${earliestLabel} – ${latestLabel}`;
}
