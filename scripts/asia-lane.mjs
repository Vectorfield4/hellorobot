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
// Two passes, never three. The first pass is the lane list. If some publishers came
// back with nothing, the second pass asks the fetcher for those publishers only:
// a slow origin under load (leiphone answers in ~11 s against a 15 s client
// timeout) and a blocked one look identical from here, and one retry is what
// separates them. A second empty answer is an answer, and it stays in the
// metadata as `stillEmpty` rather than disappearing.
//
//   node scripts/asia-lane.mjs [--date 2026-10-27] [--cap 60]
//
// Output: docs/research/candidates-asia-<date>.json (the capped pool),
// docs/research/candidates-asia-<date>.raw.json (the first, uncapped fetch),
// docs/research/candidates-asia-<date>.retry.raw.json (the retry, when one ran)
// and docs/research/candidates-asia-<date>.meta.json (what was retried, what came
// back, what stayed empty). The pool itself stays a bare array — triage,
// published-check and source-yield all read it as one — so the retry record goes
// to the sibling file. sources.json is not touched: the filtered list goes to
// docs/research/sources-asia.json.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalUrl, DEFAULT_UNDATED_CAP } from "./triage-candidates.mjs";

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

/**
 * The publishers that answered with nothing. Matched by name, which is what the
 * fetcher copies into `item.source`, so a renamed source would look empty and be
 * retried once — cheap, and visible in the metadata.
 */
export function emptySources(sources, items) {
  const answered = new Set(items.map((item) => String(item.source ?? "").trim()));
  return sources.filter((source) => !answered.has(String(source.name ?? "").trim()));
}

/**
 * The union of two passes, first occurrence wins. The retry re-fetches only the
 * empty publishers, but a listing can shift between passes and hand back a URL
 * the first pass already had; one story is one candidate.
 */
export function dedupeByUrl(items) {
  const seen = new Set();
  const kept = [];
  for (const item of items) {
    const key = canonicalUrl(item.url) || `${item.source ?? ""}\u0000${item.title ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }
  return kept;
}

/**
 * The lane's two passes. Everything but the injected `runner` is pure, so a test
 * can hand in a runner that returns nothing for one publisher on the first pass
 * and data on the second, and read the metadata without touching the network.
 */
export function fetchLane(sources, runner) {
  const first = runner({ sources, pass: 1 }) ?? [];
  const missing = emptySources(sources, first);
  if (missing.length === 0) {
    return { items: dedupeByUrl(first), retried: [], recovered: [], stillEmpty: [] };
  }

  const second = runner({ sources: missing, pass: 2 }) ?? [];
  const answered = new Set(second.map((item) => String(item.source ?? "").trim()));
  const names = missing.map((source) => source.name);
  return {
    items: dedupeByUrl([...first, ...second]),
    retried: names,
    recovered: names.filter((name) => answered.has(name)),
    stillEmpty: names.filter((name) => !answered.has(name)),
  };
}

/**
 * The real pass runner: write the source list, shell out to the shared fetcher,
 * read what it wrote. `pass` names the files, so the retry never overwrites the
 * first fetch and both stay inspectable afterwards.
 */
export function defaultRunner({ researchDir, date }) {
  return ({ sources, pass }) => {
    const tag = pass === 1 ? "" : "-retry";
    const listPath = join(researchDir, `sources-asia${tag}.json`);
    const outPath = join(researchDir, `candidates-asia-${date}${tag}.raw.json`);
    writeFileSync(listPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
    try {
      unlinkSync(outPath);
    } catch {
      // first run, or nothing stale to remove
    }
    execFileSync(process.execPath, [FETCHER, "--sources", listPath, "--out", outPath], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    return JSON.parse(readFileSync(outPath, "utf8"));
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

export function run(argv = process.argv.slice(2), { runner = null } = {}) {
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
    return {
      date,
      items: [],
      dropped: 0,
      perSource: [],
      retried: [],
      recovered: [],
      stillEmpty: [],
    };
  }

  console.log(`${asia.length} ja/zh sources in the lane`);
  const lane = fetchLane(asia, runner ?? defaultRunner({ researchDir, date }));
  const capped = capCandidates(lane.items, { cap });

  const out = join(researchDir, `candidates-asia-${date}.json`);
  const metaOut = join(researchDir, `candidates-asia-${date}.meta.json`);
  writeFileSync(out, `${JSON.stringify(capped.items, null, 2)}\n`, "utf8");
  writeFileSync(
    metaOut,
    `${JSON.stringify(
      {
        date,
        cap,
        lane: asia.map((source) => source.name),
        fetched: lane.items.length,
        kept: capped.items.length,
        dropped: capped.dropped,
        retried: lane.retried,
        recovered: lane.recovered,
        stillEmpty: lane.stillEmpty,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `${lane.items.length} fetched -> ${capped.items.length} kept (cap ${cap}, ${capped.dropped} dropped)`,
  );
  if (lane.retried.length > 0) {
    console.log(`retried ${lane.retried.length}: ${lane.retried.join(", ")}`);
    console.log(`  recovered ${lane.recovered.length}: ${lane.recovered.join(", ") || "none"}`);
    if (lane.stillEmpty.length > 0) {
      console.log(`  still empty after retry: ${lane.stillEmpty.join(", ")}`);
    }
  }
  for (const row of capped.perSource) {
    console.log(`  ${row.source.padEnd(20).slice(0, 20)} ${row.kept}/${row.available}`);
  }
  console.log(`Wrote ${out}`);
  return {
    date,
    ...capped,
    retried: lane.retried,
    recovered: lane.recovered,
    stillEmpty: lane.stillEmpty,
  };
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
