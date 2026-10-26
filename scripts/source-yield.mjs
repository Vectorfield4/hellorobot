#!/usr/bin/env node
// Measured source weight: what each feed actually produced, not what it promised.
//
// `weight` in scripts/sources.json was a hand estimate: a profile publisher was
// assumed better than a broad tech feed. This script answers the same question
// from the run's own artefacts, so the estimate can be replaced by a number:
//
//   node scripts/source-yield.mjs --candidates docs/research/candidates-<date>.json \
//     --shortlist docs/research/shortlist-<date>.json \
//     --collected docs/collected --articles articles \
//     --out docs/research/source-yield.json
//
//   node scripts/source-yield.mjs apply --yield docs/research/source-yield.json \
//     --sources scripts/sources.json [--dry-run]
//
// Metrics per source:
//
// | metric        | meaning                                                        |
// |---------------|----------------------------------------------------------------|
// | items         | candidates the fetcher returned for it                          |
// | fresh         | candidates inside the triage window (undated ones capped at 20) |
// | stories       | shortlisted stories it is attached to (primary or retold)       |
// | published     | published articles whose source host is one of its hosts        |
// | yield         | stories / fresh                                                  |
// | publishedRate | published / stories                                              |
//
// `published` is a host-level count over the whole archive, not just this run's
// stories, so it answers "does work from this host reach the site" rather than
// "did this batch convert". A trade host that already carries five published
// articles therefore shows 5 against 1 story; the formula's clamp absorbs the
// ratio, and the printed reason says which number is which. An aggregator can
// never match by host — its candidates point at news.google.com while the archive
// stores the publisher's URL — so its rate is 0 by construction, not by failure.
//
// `fresh = 0` gives null metrics, never zero: a feed that returned nothing this
// run (arXiv at the weekend, a newsroom between releases) is unmeasured, and a
// zero would quietly drop it to the floor of the weight range.
//
// Idempotent by construction: apply rewrites only the number after `"weight":`,
// keeps every other byte of the file, and writes nothing when the plan is empty.

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listLogs } from "./collected.mjs";
import { DEFAULT_UNDATED_CAP, knownFromArticles } from "./triage-candidates.mjs";

/**
 * weight = clamp(0.6, 1.2, 0.6 + 2.0 × publishedRate), rounded to 0.1.
 *
 * Why this shape:
 * - The useful signal is not volume but *conversion*: how many of a source's
 *   stories survived triage and reached a published article. A feed that hands
 *   over 200 automotive items and one robot story is not a good feed.
 * - The range is deliberately narrow (0.6–1.2, i.e. ×0.55 to ×1.1 around 1.0) so
 *   a single run cannot bury a publisher; a bad batch moves the weight by 0.1,
 *   a few good runs move it to the ceiling.
 * - The slope is steep on purpose: publishedRate is small in practice (a source
 *   yields dozens of candidates, a couple of stories, at most one article), so
 *   the whole useful interval is 0…0.3. There 0.15 → 0.9 and 0.3 → 1.2.
 * - 0.6 is a floor, not a kill switch: an unproductive source stays in the list
 *   at reduced weight and can recover. Removing a source is a human decision.
 */
export const WEIGHT_BASE = 0.6;
export const WEIGHT_SLOPE = 2.0;
export const WEIGHT_MIN = 0.6;
export const WEIGHT_MAX = 1.2;

/** Aggregators republish; their candidate host never matches a published source_url. */
const AGGREGATOR_HOSTS = new Set(["news.google.com"]);

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

/** The proposed weight for a conversion rate, or null when the rate is unknown. */ export function weightFor(
  publishedRate,
) {
  if (publishedRate === null || publishedRate === undefined || !Number.isFinite(publishedRate)) {
    return null;
  }
  const raw = WEIGHT_BASE + WEIGHT_SLOPE * publishedRate;
  const clamped = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw));
  return Math.round(clamped * 10) / 10;
}

/**
 * Every published source URL we can see: article frontmatter (`source_url`) and
 * the daily log. Two records of the same story collapse into one.
 */
export function readPublishedUrls({ articles = null, collected = null } = {}) {
  const urls = new Set();
  if (articles) {
    for (const entry of knownFromArticles(resolve(articles))) {
      if (entry.url) urls.add(entry.url);
    }
  }
  if (collected) {
    for (const log of listLogs(resolve(collected))) {
      for (const item of log.items ?? []) {
        if (item.source_url) urls.add(item.source_url);
      }
    }
  }
  return [...urls];
}

function clustersOf(shortlist) {
  if (!shortlist) return null;
  if (Array.isArray(shortlist)) return shortlist;
  if (Array.isArray(shortlist.shortlist)) return shortlist.shortlist;
  return null;
}

function windowOf(shortlist, from, to) {
  if (from || to) return { from: from ?? null, to: to ?? null, origin: "flags" };
  const window = shortlist?.window;
  if (window?.from || window?.to) {
    return { from: window.from ?? null, to: window.to ?? null, origin: "shortlist" };
  }
  return { from: null, to: null, origin: "none" };
}

/** Is this candidate inside the window? Undated items are taken positionally. */
function isFresh(item, window, seenUndated, undatedCap) {
  if (!window.from && !window.to) return true;
  const ms = Date.parse(item.date);
  if (Number.isNaN(ms)) {
    const seen = seenUndated.get(item.source) ?? 0;
    if (seen >= undatedCap) return false;
    seenUndated.set(item.source, seen + 1);
    return true;
  }
  if (window.from && ms < Date.parse(`${window.from}T00:00:00Z`)) return false;
  if (window.to && ms > Date.parse(`${window.to}T23:59:59Z`)) return false;
  return true;
}

function sortByName(left, right) {
  if (left.source === right.source) return 0;
  return left.source < right.source ? -1 : 1;
}

/**
 * The counter itself. Pure: everything it needs is passed in, so a test can build
 * a two-source dump and read the result without touching the network or the disk.
 */
export function measureYield({
  candidates,
  shortlist = null,
  publishedUrls = [],
  from = null,
  to = null,
  undatedCap = DEFAULT_UNDATED_CAP,
} = {}) {
  const window = windowOf(shortlist, from, to);
  const clusters = clustersOf(shortlist);

  const perSource = new Map();
  const entryFor = (source) => {
    if (!perSource.has(source)) {
      perSource.set(source, { source, hosts: new Set(), items: 0, fresh: 0, stories: 0 });
    }
    return perSource.get(source);
  };

  const seenUndated = new Map();
  for (const item of candidates ?? []) {
    const source = String(item.source ?? "").trim();
    if (!source) continue;
    const entry = entryFor(source);
    entry.items += 1;
    const host = hostOf(item.url);
    if (host) entry.hosts.add(host);
    if (isFresh(item, window, seenUndated, undatedCap)) entry.fresh += 1;
  }

  if (clusters) {
    const attributed = new Map();
    for (const cluster of clusters) {
      const names = new Set(
        [cluster.source, ...(cluster.retold ?? []).map((entry) => entry.source)].filter(Boolean),
      );
      const key = canonicalUrl(cluster.url) || cluster.title;
      for (const name of names) {
        const seen = attributed.get(name) ?? new Set();
        if (!seen.has(key)) {
          seen.add(key);
          entryFor(name).stories += 1;
        }
        attributed.set(name, seen);
      }
    }
  }

  const publishedByHost = new Map();
  for (const url of publishedUrls) {
    const host = hostOf(url);
    if (!host) continue;
    const seen = publishedByHost.get(host) ?? new Set();
    seen.add(canonicalUrl(url));
    publishedByHost.set(host, seen);
  }

  const rows = [...perSource.values()].map((entry) => {
    const hosts = [...entry.hosts].sort();
    const publishedKeys = new Set();
    for (const host of hosts) {
      for (const key of publishedByHost.get(host) ?? []) publishedKeys.add(key);
    }
    const published = publishedKeys.size;
    const aggregator = hosts.some((host) => AGGREGATOR_HOSTS.has(host));
    const measured = entry.fresh > 0 && clusters !== null;
    const storyYield = measured ? entry.stories / entry.fresh : null;
    const publishedRate = measured ? (entry.stories === 0 ? 0 : published / entry.stories) : null;
    return {
      source: entry.source,
      hosts,
      aggregator,
      items: entry.items,
      fresh: entry.fresh,
      stories: clusters ? entry.stories : null,
      published: clusters ? published : null,
      yield: storyYield,
      publishedRate,
      weight: weightFor(publishedRate),
      reason: reasonFor({ entry, clusters, published, aggregator }),
    };
  });

  rows.sort(sortByName);

  return {
    window,
    totals: {
      sources: rows.length,
      items: rows.reduce((sum, row) => sum + row.items, 0),
      fresh: rows.reduce((sum, row) => sum + row.fresh, 0),
      stories: clusters ? rows.reduce((sum, row) => sum + row.stories, 0) : null,
      published: clusters ? rows.reduce((sum, row) => sum + row.published, 0) : null,
    },
    sources: rows,
  };
}

function reasonFor({ entry, clusters, published, aggregator }) {
  if (clusters === null) return "no shortlist: stories unknown";
  if (entry.fresh === 0) return `unmeasured: 0 fresh of ${entry.items} items`;
  if (aggregator) {
    return `aggregator: published not attributable, ${entry.stories}/${entry.fresh} stories kept`;
  }
  return `${entry.stories}/${entry.fresh} stories kept, ${published} published from this host`;
}

/**
 * The plan an apply would write: which source moves where, and why. A source with
 * no proposed weight keeps the current one — it was not measured this run.
 */
export function planWeights(report, sourceFile) {
  const current = new Map(sourceFile.map((entry) => [entry.name, entry.weight]));
  return report.sources
    .filter((row) => row.weight !== null)
    .map((row) => {
      const from = current.get(row.source);
      return {
        source: row.source,
        from: typeof from === "number" ? from : null,
        to: row.weight,
        reason: row.reason,
        changed: typeof from === "number" ? from !== row.weight : true,
      };
    });
}

/**
 * Rewrite only the numbers after `"weight":`, so the file keeps its comments,
 * its field order and its indentation. Returns the new text and the changes.
 */
export function applyWeights(rawText, plan) {
  const wanted = new Map(
    plan
      .filter((entry) => entry.changed && entry.from !== null)
      .map((entry) => [entry.source, entry.to]),
  );
  const eol = rawText.includes("\r\n") ? "\r\n" : "\n";
  const trailing = rawText.endsWith(eol) ? eol : "";
  const lines = (trailing ? rawText.slice(0, -eol.length) : rawText).split(eol);
  let name = null;
  const changes = [];
  const out = lines.map((line) => {
    const nameMatch = line.match(/^\s*"name":\s*"((?:[^"\\]|\\.)*)"/);
    if (nameMatch) {
      name = JSON.parse(`"${nameMatch[1]}"`);
      return line;
    }
    const weightMatch = line.match(/^(\s*"weight":\s*)(-?\d+(?:\.\d+)?)(\s*,?\s*)$/);
    if (!weightMatch || name === null) return line;
    if (!wanted.has(name)) return line;
    const next = wanted.get(name);
    if (Number(weightMatch[2]) === next) return line;
    changes.push({ source: name, from: Number(weightMatch[2]), to: next });
    return `${weightMatch[1]}${next}${weightMatch[3]}`;
  });
  return { text: `${out.join(eol)}${trailing}`, changes };
}

function parseArgs(argv) {
  const first = argv[0];
  const hasCommand = Boolean(first) && !first.startsWith("--");
  const command = hasCommand ? first : "measure";
  const rest = hasCommand ? argv.slice(1) : argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "dry-run") {
      flags.dryRun = true;
      continue;
    }
    flags[key] = rest[++i];
  }
  return { command, flags };
}

/** The report without the parts that would make a second identical run differ. */
function stableReport(report, inputs) {
  return {
    inputs,
    window: report.window,
    totals: report.totals,
    sources: report.sources,
  };
}

export function run(argv = process.argv.slice(2)) {
  const { command, flags } = parseArgs(argv);

  if (command === "apply") {
    if (!flags.yield) throw new Error("apply needs --yield");
    const report = JSON.parse(readFileSync(resolve(flags.yield), "utf8"));
    const sourcesPath = resolve(flags.sources ?? "scripts/sources.json");
    const raw = readFileSync(sourcesPath, "utf8");
    const sourceFile = JSON.parse(raw);
    const plan = planWeights(report, sourceFile);
    const { text, changes } = applyWeights(raw, plan);

    const moved = plan.filter((entry) => entry.changed);
    for (const entry of plan) {
      const mark = entry.changed ? "->" : "  ";
      const from = entry.from === null ? "  -  " : entry.from.toFixed(1);
      console.log(
        `${mark} ${entry.source}: ${from} ${entry.changed ? "->" : "  "} ${entry.to.toFixed(1)}  ${entry.reason}`,
      );
    }
    if (moved.length === 0) {
      console.log("no weight changes");
      return { changes: [], written: false };
    }
    if (flags.dryRun) {
      console.log(
        `dry run: ${changes.length} weight(s) would change in ${flags.sources ?? "scripts/sources.json"}`,
      );
      return { changes, written: false };
    }
    writeFileSync(sourcesPath, text, "utf8");
    console.log(
      `updated ${changes.length} weight(s) in ${flags.sources ?? "scripts/sources.json"}`,
    );
    return { changes, written: true };
  }

  if (command !== "measure") {
    throw new Error(
      "Usage: source-yield.mjs --candidates <dump.json> [--shortlist <shortlist.json>] | apply --yield <report.json> [--dry-run]",
    );
  }
  if (!flags.candidates) throw new Error("source-yield needs --candidates");

  const candidates = JSON.parse(readFileSync(resolve(flags.candidates), "utf8"));
  const shortlist = flags.shortlist
    ? JSON.parse(readFileSync(resolve(flags.shortlist), "utf8"))
    : null;
  const publishedUrls = readPublishedUrls({
    articles: flags.articles ?? null,
    collected: flags.collected ?? null,
  });
  const report = measureYield({
    candidates,
    shortlist,
    publishedUrls,
    from: flags.from ?? null,
    to: flags.to ?? null,
    undatedCap: flags["undated-cap"] ? Number(flags["undated-cap"]) : DEFAULT_UNDATED_CAP,
  });

  const inputs = {
    candidates: flags.candidates,
    shortlist: flags.shortlist ?? null,
    articles: flags.articles ?? null,
    collected: flags.collected ?? null,
  };
  const payload = stableReport(report, inputs);
  if (flags.out) {
    writeFileSync(resolve(flags.out), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  const { totals } = report;
  console.log(
    `${totals.sources} sources, ${totals.items} items, ${totals.fresh} fresh, ` +
      `${totals.stories ?? "?"} stories, ${totals.published ?? "?"} published`,
  );
  for (const row of report.sources.filter((entry) => entry.fresh > 0).slice(0, 15)) {
    const rate = row.publishedRate === null ? "   -" : row.publishedRate.toFixed(2);
    console.log(
      `  ${row.source.padEnd(24).slice(0, 24)} fresh ${String(row.fresh).padStart(4)}  ` +
        `stories ${String(row.stories).padStart(3)}  published ${String(row.published).padStart(2)}  ` +
        `rate ${rate}  weight ${row.weight ?? "-"}`,
    );
  }
  if (flags.out) console.log(`Wrote ${flags.out}`);
  return payload;
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
