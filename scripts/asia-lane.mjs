#!/usr/bin/env node
// The Japanese/Chinese lane: a separate, capped pool for the feeds that cost double.
//
// A run's dump is ~1 800 candidates, of which the ja/zh publishers are ~560. They
// translate at roughly twice the tokens of an English item, so they must not be
// chosen by accident out of a 2 000-item pile — and they must not be dropped by
// the cap either. This script runs the shared fetcher over a filtered source list
// and keeps the freshest items per publisher, round-robin, so every publisher in
// the lane is represented instead of one 100-item Google News feed filling it.
//
//   node scripts/asia-lane.mjs [--date 2026-10-27] [--cap 60]
//
// Output: docs/research/candidates-asia-<date>.json (the capped pool) and
// docs/research/candidates-asia-<date>.raw.json (the uncapped fetch).
// sources.json is not touched: the filtered list goes to
// docs/research/sources-asia.json.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_UNDATED_CAP } from "./triage-candidates.mjs";

/** The lane exists for these two languages; add a code here and nowhere else. */
export const ASIA_LANGS = new Set(["ja", "zh"]);

/** The fetcher is shared code, mounted from the global skills repo. */
export const FETCHER = join(
  homedir(),
  ".config/opencode/skills/data/news-fetcher/scripts/fetch-candidates.mjs",
);

/** Default pool size: three runs' worth of Asian stories in one batch. */
export const DEFAULT_CAP = 60;

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The ja/zh slice of a source list, in the order the list has them. */
export function asiaSources(sources) {
  return sources.filter((source) => ASIA_LANGS.has(source.lang));
}

function dayOf(date) {
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

/**
 * One source's queue: dated items newest first, then its undated listing items in
 * page order (the position is the only freshness signal an HTML listing gives).
 * Undated items past `undatedCap` are dropped here, exactly as triage would.
 */
function queueFor(items, undatedCap) {
  const dated = [];
  const undated = [];
  let cut = 0;
  for (const item of items) {
    if (dayOf(item.date) === null) {
      if (undated.length < undatedCap) undated.push(item);
      else cut += 1;
    } else {
      dated.push(item);
    }
  }
  dated.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  return { queue: [...dated, ...undated], cut };
}

/**
 * Round-robin over the publishers, freshest first inside each, until the cap is
 * reached. Round-robin rather than a global sort: a global sort hands every slot
 * to the two dated Google News feeds and loses the native publishers the lane was
 * built for.
 */
export function capCandidates(items, { cap = DEFAULT_CAP, undatedCap = DEFAULT_UNDATED_CAP } = {}) {
  const bySource = new Map();
  for (const item of items) {
    const source = String(item.source ?? "").trim();
    if (!source) continue;
    const queue = bySource.get(source) ?? [];
    queue.push(item);
    bySource.set(source, queue);
  }

  const queues = [...bySource.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([source, sourceItems]) => ({ source, ...queueFor(sourceItems, undatedCap) }));

  const kept = [];
  let dropped = queues.reduce((sum, queue) => sum + queue.cut, 0);
  let index = 0;
  while (kept.length < cap) {
    let placed = false;
    for (const queue of queues) {
      if (kept.length >= cap) break;
      const next = queue.queue[index];
      if (!next) continue;
      kept.push(next);
      placed = true;
    }
    if (!placed) break;
    index += 1;
  }

  const keptKeys = new Set(kept.map((item) => item.url));
  for (const queue of queues) {
    for (const item of queue.queue) {
      if (!keptKeys.has(item.url)) dropped += 1;
    }
  }

  return {
    items: kept,
    dropped,
    perSource: queues.map((queue) => ({
      source: queue.source,
      available: queue.queue.length,
      kept: kept.filter((item) => item.source === queue.source).length,
    })),
  };
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    flags[arg.slice(2)] = argv[++i];
  }
  return flags;
}

export function run(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  const date = flags.date ?? today();
  const cap = flags.cap ? Number(flags.cap) : DEFAULT_CAP;
  const sourcesPath = resolve(flags.sources ?? "scripts/sources.json");
  const researchDir = resolve(flags["research-dir"] ?? "docs/research");
  mkdirSync(researchDir, { recursive: true });

  const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
  const asia = asiaSources(sources);
  if (asia.length === 0) {
    console.log("no ja/zh sources in the list");
    return { date, items: [], dropped: 0, perSource: [] };
  }

  const laneSources = join(researchDir, "sources-asia.json");
  writeFileSync(laneSources, `${JSON.stringify(asia, null, 2)}\n`, "utf8");

  const rawOut = join(researchDir, `candidates-asia-${date}.raw.json`);
  const out = join(researchDir, `candidates-asia-${date}.json`);
  try {
    unlinkSync(rawOut);
  } catch {
    // first run
  }

  console.log(`${asia.length} ja/zh sources -> ${laneSources}`);
  execFileSync(process.execPath, [FETCHER, "--sources", laneSources, "--out", rawOut], {
    stdio: ["ignore", "inherit", "inherit"],
  });

  const fetched = JSON.parse(readFileSync(rawOut, "utf8"));
  const capped = capCandidates(fetched, { cap });
  writeFileSync(out, `${JSON.stringify(capped.items, null, 2)}\n`, "utf8");

  console.log(
    `${fetched.length} fetched -> ${capped.items.length} kept (cap ${cap}, ${capped.dropped} dropped)`,
  );
  for (const row of capped.perSource) {
    console.log(`  ${row.source.padEnd(20).slice(0, 20)} ${row.kept}/${row.available}`);
  }
  console.log(`Wrote ${out}`);
  return { date, ...capped };
}

if (isEntryPoint()) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
