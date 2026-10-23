/**
 * Release — cut a version: bump, write the changelog, delete finished plans,
 * commit, tag, push.
 *
 * Default bump is `minor`; `patch` and `major` are explicit, and `major` needs
 * `--yes` (the release skill asks the user first). The changelog is built from
 * the commits since the last `vX.Y.Z` tag and lands in `docs/releases/vX.Y.Z.md`,
 * which the workflow uses as the GitHub Release body.
 *
 * Usage:
 *   node scripts/release.mjs [patch|minor|major] [--dry-run] [--no-push] [--yes]
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { commitSubjectsSince, lastReleaseTag, renderChangelog, todayLocal } from "./changelog.mjs";
import { bumpVersion, ROOT, readVersion, writeVersion } from "./version.mjs";

const KINDS = ["patch", "minor", "major"];

/**
 * Plans whose every checklist item is checked and which still has at least one
 * checked item — i.e. finished, so a release deletes them. A plan with an open
 * `- [ ]` item (or no checklist at all) stays.
 */
export function findFinishedPlans(root = ROOT) {
  const dir = join(root, "docs/plans");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const done = (text.match(/- \[x\]/g) ?? []).length;
      const open = (text.match(/- \[ \]/g) ?? []).length;
      return done > 0 && open === 0;
    })
    .map((file) => `docs/plans/${file}`);
}

function git(args, { capture = false } = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
}

function parseArgs(argv) {
  const flags = { kind: "minor", dryRun: false, noPush: false, yes: false };
  const positional = [];
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--no-push") flags.noPush = true;
    else if (arg === "--yes" || arg === "-y") flags.yes = true;
    else if (arg.startsWith("--")) throw new Error(`unknown flag: ${arg}`);
    else positional.push(arg);
  }
  if (positional[0]) flags.kind = positional[0];
  return flags;
}

function main(argv) {
  const flags = parseArgs(argv);

  if (!KINDS.includes(flags.kind)) {
    console.error(`unknown bump: "${flags.kind}" (expected ${KINDS.join(", ")})`);
    process.exit(1);
  }
  if (flags.kind === "major" && !flags.yes) {
    console.error("a major release needs --yes (confirm with the user first)");
    process.exit(1);
  }

  const current = readVersion();
  const next = bumpVersion(current, flags.kind);
  const tag = `v${next}`;
  const date = todayLocal();
  const since = lastReleaseTag();
  const commits = commitSubjectsSince(since);
  const changes = renderChangelog({ version: next, date, commits });
  const plans = findFinishedPlans();

  console.log(`release ${current} -> ${next} (${flags.kind}); range ${since ?? "root"}..HEAD`);
  if (plans.length > 0) {
    console.log(`finished plans to delete:\n  ${plans.join("\n  ")}`);
  }
  console.log(`\n--- docs/releases/${tag}.md ---\n`);
  console.log(changes);

  if (flags.dryRun) {
    console.log("(dry run — nothing written)");
    return;
  }

  writeVersion(next);

  const releasesDir = join(ROOT, "docs/releases");
  mkdirSync(releasesDir, { recursive: true });
  writeFileSync(join(releasesDir, `${tag}.md`), changes, "utf8");

  for (const plan of plans) rmSync(join(ROOT, plan), { force: true });

  git(["add", "-A"]);
  git(["commit", "-m", `chore(release): ${tag}`]);
  git(["tag", tag]);
  console.log(`committed and tagged ${tag}`);

  if (flags.noPush) {
    console.log("skipped push (--no-push)");
    return;
  }
  git(["push"]);
  git(["push", "origin", tag]);
  console.log("pushed branch and tag");
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
