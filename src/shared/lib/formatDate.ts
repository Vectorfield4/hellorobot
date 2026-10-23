const MONTHS_RU = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * WordPress returns either a full ISO timestamp (`2026-10-23T12:00:00`) or a
 * plain `YYYY-MM-DD`. The time part carries no meaning here (posts are
 * scheduled at a fixed hour), so the UI shows the date only: `23 октября 2026`.
 */
export function formatDate(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const match = raw.match(ISO_DATE);
  if (!match) return raw;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isValid) return raw;

  return `${day} ${MONTHS_RU[month - 1]} ${year}`;
}
