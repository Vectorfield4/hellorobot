const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  deg: "°",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Числовые сущности внутри HTML описания: `&#8212;` — это типографский знак,
 * а не разметка. Угловые скобки и амперсанд оставляем закодированными, чтобы
 * декодирование не создало тег.
 */
export function decodeNumericEntities(html: string): string {
  const safe = (code: number, original: string) => {
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return original;
    const char = String.fromCodePoint(code);
    return /[<>&]/.test(char) ? original : char;
  };
  return html
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => safe(Number.parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, code: string) => safe(Number(code), match));
}

/** HTML из WordPress → чистый текст для анонсов, meta и поиска. */
export function toPlainText(html: string | undefined | null): string {
  if (!html) return "";
  const withBreaks = html.replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|div|li|h[1-6])>/gi, " ");
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  if (max <= 0) return "";
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}…`;
}
