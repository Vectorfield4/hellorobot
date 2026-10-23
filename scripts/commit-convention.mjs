/**
 * Commit convention — the shared list of accepted prefixes and their changelog
 * group. One source for both the `commit-msg` validator and the changelog, so a
 * new prefix is added once.
 *
 * The repo mixes Conventional Commits (`feat`, `fix`, `docs`) with its own area
 * prefixes (`content`, `skill`, `agent`, `news`, `diagrams`, …). Both are
 * accepted and split into the groups below; the last group catches the rest.
 */

/** Ordered groups; a type not listed anywhere falls into the last one. */
export const GROUPS = [
  { key: "feature", emoji: "🚀", title: "Features", types: ["feat"] },
  {
    key: "content",
    emoji: "📰",
    title: "Content",
    types: ["content", "copy", "news", "seo"],
  },
  {
    key: "service",
    emoji: "🧩",
    title: "Services & Solutions",
    types: ["service", "services", "solution", "solutions"],
  },
  { key: "agent", emoji: "🤖", title: "Skills & Agents", types: ["skill", "agent", "jev"] },
  {
    key: "interface",
    emoji: "🎨",
    title: "Interface",
    types: ["ui", "app-bar", "home", "pricing", "filters", "i18n", "icons", "diagrams", "assets"],
  },
  { key: "docs", emoji: "📝", title: "Documentation", types: ["docs", "plan"] },
  { key: "fix", emoji: "🐛", title: "Fixes", types: ["fix"] },
  { key: "refactor", emoji: "♻️", title: "Refactoring", types: ["refactor"] },
  {
    key: "chore",
    emoji: "⚙️",
    title: "Maintenance",
    types: ["chore", "style", "test", "perf", "build", "ci", "revert", "init", "publish"],
  },
  { key: "other", emoji: "🧺", title: "Other", types: [] },
];

/** Every accepted prefix, for the commit-msg validator. */
export const ALL_TYPES = GROUPS.flatMap((group) => group.types);

/** The group a type belongs to; unknown types land in the last group. */
export function groupOf(type) {
  return GROUPS.find((group) => group.types.includes(type)) ?? GROUPS[GROUPS.length - 1];
}
