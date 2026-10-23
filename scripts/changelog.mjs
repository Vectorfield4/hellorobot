/**
 * Changelog — turn the commits since the last release tag into the release note.
 *
 * Commits follow Conventional Commits (`type(scope): description`). Known types
 * land in their group; everything else (and any non-conforming subject) lands in
 * "Other". Merge commits and the release commit itself are dropped.
 *
 * Usage:
 *   node scripts/changelog.mjs [version] [--since <tag>] [--date YYYY-MM-DD]
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { GROUPS, groupOf } from "./commit-convention.mjs";
import { ROOT, readVersion } from "./version.mjs";

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/;

/** `"feat(api)!: drop v1"` → `{ type, scope, breaking, description }`, else null. */
export function parseCommit(subject) {
  const match = CONVENTIONAL.exec(subject.trim());
  if (!match) return null;
  return {
    type: match[1].toLowerCase(),
    scope: match[2] ?? null,
    breaking: Boolean(match[3]),
    description: match[4].trim(),
  };
}

/** Merge commits and the release commit never appear in a changelog. */
export function isSkippable(subject) {
  const line = subject.trim();
  if (/^merge\b/i.test(line)) return true;
  const parsed = parseCommit(line);
  return parsed?.type === "chore" && parsed.scope === "release";
}

/** Bucket subjects (strings or `{ subject }`) into the ordered groups. */
export function groupCommits(commits) {
  const buckets = new Map(GROUPS.map((group) => [group.key, { ...group, items: [] }]));

  for (const raw of commits) {
    const subject = (typeof raw === "string" ? raw : raw.subject).trim();
    if (!subject || isSkippable(subject)) continue;
    const parsed = parseCommit(subject);
    const group = groupOf(parsed?.type ?? "");
    buckets
      .get(group.key)
      .items.push(parsed ?? { type: "", scope: null, breaking: false, description: subject });
  }

  return [...buckets.values()].filter((group) => group.items.length > 0);
}

function formatItem(item) {
  const scope = item.scope ? `\`${item.scope}\`: ` : "";
  const bang = item.breaking ? "⚠️ " : "";
  return `- ${bang}${scope}${item.description}`;
}

/** The `docs/releases/vX.Y.Z.md` body: grouped, emoji-titled, CRLF. */
export function renderChangelog({ version, date, commits }) {
  const groups = groupCommits(commits);
  const lines = [`# v${version} — ${date}`, ""];
  if (groups.length === 0) {
    lines.push("_No changes._", "");
  }
  for (const group of groups) {
    lines.push(`## ${group.emoji} ${group.title}`, "");
    for (const item of group.items) lines.push(formatItem(item));
    lines.push("");
  }
  return `${lines.join("\r\n").replace(/(\r\n)+$/, "")}\r\n`;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

/** Today as `YYYY-MM-DD` in the machine's local timezone (not UTC). */
export function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The greatest reachable `vX.Y.Z` tag, or null when the repo has none yet. */
export function lastReleaseTag() {
  try {
    return (
      git(["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*"]).trim() || null
    );
  } catch {
    return null;
  }
}

/** Non-merge commit subjects in `<tag>..HEAD` (or all of `HEAD` when no tag). */
export function commitSubjectsSince(tag) {
  try {
    const out = git(["log", tag ? `${tag}..HEAD` : "HEAD", "--no-merges", "--pretty=format:%s"]);
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const USAGE = `Usage:
  node scripts/changelog.mjs [version] [--since <tag>] [--date YYYY-MM-DD]`;

function main(argv) {
  const [versionArg, ...rest] = argv;
  if (versionArg?.startsWith("--")) {
    console.error(USAGE);
    process.exit(1);
  }
  const version = versionArg ?? readVersion();
  let since = lastReleaseTag();
  let date = todayLocal();
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--since") {
      index += 1;
      since = rest[index] ?? null;
    } else if (rest[index] === "--date") {
      index += 1;
      date = rest[index] ?? date;
    }
  }
  console.log(renderChangelog({ version, date, commits: commitSubjectsSince(since) }));
}

/** True only when this file is the node entrypoint, never when imported. */
function isEntrypoint() {
  try {
    return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main(process.argv.slice(2));
}
