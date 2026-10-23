/**
 * Связка «товар ↔ статья» идёт по тегам, а не по слагам: у русских тегов
 * WordPress слаги закодированы в проценты (`%d0%b3...`), и сравнивать их
 * хрупко. Нормализуем имя и сводим EN-варианты к русскому канону.
 */

/** Канон (имя тега в блоге) → английские и просторечные варианты. */
export const TAG_ALIASES: Record<string, string[]> = {
  гуманоиды: [
    "humanoid",
    "humanoids",
    "humanoid robot",
    "humanoid robots",
    "humanoid robotics",
    "гуманоид",
  ],
  коботы: [
    "cobot",
    "cobots",
    "collaborative robot",
    "collaborative robots",
    "collaborative robotics",
    "кобот",
  ],
  манипуляторы: [
    "manipulator",
    "manipulators",
    "robotic arm",
    "robot arm",
    "robot arms",
    "манипуляция",
    "манипуляции",
    "manipulation",
    "grasping",
    "grasp",
    "захват",
    "манипулятор",
  ],
  "мягкая робототехника": ["soft robotics", "soft robot", "soft robots"],
  "складская логистика": [
    "warehouse",
    "warehousing",
    "warehouse robotics",
    "warehouse logistics",
    "logistics",
    "intralogistics",
    "склад",
    "логистика",
  ],
  автономность: ["autonomy", "autonomous", "autonomous navigation", "автономия"],
  тактильность: ["tactile", "tactility", "tactile sensing", "touch sensing", "haptics"],
  "промышленная робототехника": ["industrial robotics", "industrial robot", "industrial robots"],
  "промышленная автоматизация": ["industrial automation", "factory automation"],
  "оборонная робототехника": ["defense robotics", "defence robotics", "military robotics"],
  "биоинспирированная робототехника": ["bioinspired robotics", "bio-inspired robotics"],
  навигация: ["navigation", "slam", "path planning"],
  "открытое железо": ["open hardware", "open source hardware", "open-source hardware"],
  электромобили: ["electric vehicles", "electric vehicle", "ev"],
  роботы: ["robot", "robots", "robot dog", "quadruped", "quadruped robot", "mobile robot"],
  робототехника: ["robotics"],
  исследования: ["research"],
  индустрия: ["industry"],
};

export function normalizeTag(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ALIAS_TO_CANON: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(TAG_ALIASES)) {
    const canonKey = normalizeTag(canon);
    map.set(canonKey, canonKey);
    for (const alias of aliases) {
      const aliasKey = normalizeTag(alias);
      if (aliasKey && !map.has(aliasKey)) map.set(aliasKey, canonKey);
    }
  }
  return map;
})();

/** Термин → канон: `Humanoid robots` и `гуманоиды` дают одно и то же. */
export function canonicalTag(value: string | undefined | null): string {
  const key = normalizeTag(value);
  if (!key) return "";
  return ALIAS_TO_CANON.get(key) ?? key;
}

export function sharesTag(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) return false;
  const rightCanon = new Set(right.map(canonicalTag));
  return left.some((tag) => rightCanon.has(canonicalTag(tag)));
}

/** Общие теги в каноне, без повторов; порядок — как в `left`. */
export function sharedTags(left: string[], right: string[]): string[] {
  const rightCanon = new Set(right.map(canonicalTag));
  const result: string[] = [];
  for (const tag of left) {
    const canon = canonicalTag(tag);
    if (canon && rightCanon.has(canon) && !result.includes(canon)) result.push(canon);
  }
  return result;
}
