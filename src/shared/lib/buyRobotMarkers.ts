/**
 * Разбор тела поста на сегменты: обычный HTML и места, где нужен блок
 * «Купить робота». Маркер живёт в тексте статьи, поэтому его можно ставить
 * в любом месте материала, а не только в конце.
 *
 *   <!-- buy-robot -->                     блок по тегам статьи
 *   <!-- buy-robot: гуманоиды, коботы -->  блок по указанным тегам
 */

export type BuyRobotSegment =
  | { type: "html"; value: string }
  | { type: "products"; tags: string[] | null };

const MARKER_SOURCE = "<!--\\s*buy\\s*-\\s*robot\\s*(?::([\\s\\S]*?))?\\s*-->";

function parseTags(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const tags = raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : null;
}

export function splitBuyRobotMarkers(html: string): BuyRobotSegment[] {
  if (!html) return [];

  const segments: BuyRobotSegment[] = [];
  const pattern = new RegExp(MARKER_SOURCE, "gi");
  let lastIndex = 0;
  let match = pattern.exec(html);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "html", value: html.slice(lastIndex, match.index) });
    }
    segments.push({ type: "products", tags: parseTags(match[1]) });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(html);
  }

  if (lastIndex < html.length) {
    segments.push({ type: "html", value: html.slice(lastIndex) });
  }

  return segments;
}
