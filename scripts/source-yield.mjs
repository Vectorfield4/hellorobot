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
// | metric          | meaning                                                    |
// |-----------------|------------------------------------------------------------|
// | items           | candidates the fetcher returned for it                     |
// | fresh           | candidates inside the triage window (undated capped at 20) |
// | stories         | shortlisted stories it is attached to (primary or retold)  |
// | surfaced        | published articles that came out of those stories          |
// | cited           | published articles whose source_url host is one of its own |
// | published       | every article attributed to it, host fallback included     |
// | hostAttributed  | of `published`, the ones that only a host match explains   |
// | yield           | stories / fresh                                            |
// | publishedRate   | surfaced / stories                                         |
//
// `surfaced` and `cited` are two different claims and the report keeps both.
// `cited` is what we quoted: the article's `source_url` sits on this feed's host.
// `surfaced` is what the feed is for: it brought the story that became the
// article, even when the article quotes somebody else's URL. Google News raising
// a Bedrock story that we then wrote from thenextweb.com is a `surfaced` for
// Google News and a `cited` for nobody — correct, and the reason the weight is
// fed by `surfaced`. An aggregator's candidates always point at itself, so its
// `cited` is zero by construction while its `surfaced` is the honest number.
//
// Attribution runs per published article, strongest evidence first:
//
// 1. `url`   — the article's `source_url` is one of this run's candidates, so the
//              feed that carried that exact URL surfaced the story.
// 2. `story` — the article matches a shortlisted cluster, by a URL from its
//              `retold` list or by title. Titles are compared in the language
//              they arrived in: a shared company and a shared amount is one
//              story, which is what survives translation. A Russian headline
//              that keeps no Latin name does not match and falls through.
// 3. `host`  — last resort: the article's host is one of the feed's candidate
//              hosts. This is the old rule, and it is exactly the rule that gave
//              one trade host five publications for a single story, so it is
//              counted and printed as `hostAttributed` instead of being silently
//              mixed into the evidence.
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
import {
  canonicalUrl,
  DEFAULT_UNDATED_CAP,
  fingerprint,
  knownFromArticles,
  sameStory,
  sameStoryTranslated,
  sourceTier,
} from "./triage-candidates.mjs";

/**
 * weight = clamp(0.6, 1.2, 0.6 + 2.0 × publishedRate), publishedRate = surfaced/stories.
 *
 * Why this shape:
 * - The useful signal is not volume but *conversion*: how many of a source's
 *   stories survived triage and reached a published article. A feed that hands
 *   over 200 automotive items and one robot story is not a good feed.
 * - The numerator is `surfaced`, not the host-level article count: the feed is
 *   paid for discovery. Counting citations instead rewarded the publisher we
 *   quoted and gave the aggregator that actually found the story a zero.
 * - `surfaced` can exceed `stories` when two articles retell one story. The ratio
 *   then says so in the open — the clamp bounds the weight, not the number.
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

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
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
 * Every published article we can see: the frontmatter archive (`source_url` plus
 * the Russian title, which is what a story match needs) and the daily log, which
 * records the slug of a post even after the frontmatter was forgotten. A log entry
 * borrows the title of its archive file when there is one; two records of the same
 * story collapse into one, keyed by canonical URL.
 */
export function readPublishedArticles({ articles = null, collected = null } = {}) {
  const bySlug = new Map();
  if (articles) {
    for (const entry of knownFromArticles(resolve(articles))) bySlug.set(entry.slug, entry);
  }

  const byUrl = new Map();
  const add = (url, title, slug) => {
    const key = canonicalUrl(url) || url;
    if (!key || byUrl.has(key)) return;
    byUrl.set(key, { title: title ?? null, url, slug: slug ?? null });
  };
  for (const entry of bySlug.values()) {
    if (entry.url) add(entry.url, entry.title, entry.slug);
  }
  if (collected) {
    for (const log of listLogs(resolve(collected))) {
      for (const item of log.items ?? []) {
        if (!item.source_url) continue;
        const known = item.slug ? bySlug.get(item.slug) : null;
        add(item.source_url, known?.title ?? null, item.slug ?? null);
      }
    }
  }
  return [...byUrl.values()].sort((left, right) =>
    left.url === right.url ? 0 : left.url < right.url ? -1 : 1,
  );
}

function clustersOf(shortlist) {
  if (!shortlist) return null;
  if (Array.isArray(shortlist)) return shortlist;
  if (Array.isArray(shortlist.shortlist)) return shortlist.shortlist;
  return null;
}

/** Every feed attached to a cluster: the one that owns the URL and the retold ones. */
function sourcesOf(cluster) {
  const names = new Set();
  for (const name of [cluster.source, ...(cluster.retold ?? []).map((entry) => entry.source)]) {
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * Which feeds surfaced the story this article tells, strongest evidence first.
 * Credit goes to the item that matched — the cluster's own title/URL or the
 * specific retold entry's — not to every feed the cluster happens to contain: a
 * cluster can swallow 160 candidates, and handing each of them a story for one
 * article is how a metric stops meaning anything. An empty `sources` list means
 * only the host fallback is left, and the caller has to say so in the report.
 */
export function attributeArticle(article, { byUrl, clusters }) {
  const canonical = canonicalUrl(article.url);
  if (canonical) {
    const source = byUrl.get(canonical);
    if (source) return { via: "url", sources: [source] };
  }

  const mine = article.title ? fingerprint({ title: article.title }) : null;
  const matched = new Set();
  const tells = (entry) => {
    if (!mine || !entry?.title) return false;
    const theirs = fingerprint({ title: entry.title });
    return sameStory(mine, theirs) || sameStoryTranslated(mine, theirs);
  };

  for (const cluster of clusters ?? []) {
    if (canonical && canonicalUrl(cluster.url) === canonical) matched.add(cluster.source);
    else if (tells(cluster)) matched.add(cluster.source);
    for (const entry of cluster.retold ?? []) {
      if (canonical && canonicalUrl(entry.url) === canonical) matched.add(entry.source);
      else if (tells(entry)) matched.add(entry.source);
    }
  }

  const sources = [...matched].filter(Boolean);
  return { via: sources.length > 0 ? "story" : "host", sources };
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
 *
 * `articles` is the honest input: published pieces with a title, which is what a
 * story match needs. `publishedUrls` stays for callers that only have URLs (the
 * daily log without the archive): those can be matched by URL and by host, and no
 * title means no story match.
 */
export function measureYield({
  candidates,
  shortlist = null,
  articles = [],
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
      perSource.set(source, {
        source,
        hosts: new Set(),
        items: 0,
        fresh: 0,
        stories: 0,
        aggregator: false,
      });
    }
    return perSource.get(source);
  };

  const byUrl = new Map();
  const byHost = new Map();
  const seenUndated = new Map();
  for (const item of candidates ?? []) {
    const source = String(item.source ?? "").trim();
    if (!source) continue;
    const entry = entryFor(source);
    entry.items += 1;
    if (sourceTier(item) === 2) entry.aggregator = true;
    const host = hostOf(item.url);
    if (host) {
      entry.hosts.add(host);
      const names = byHost.get(host) ?? new Set();
      names.add(source);
      byHost.set(host, names);
    }
    const canonical = canonicalUrl(item.url);
    if (canonical && !byUrl.has(canonical)) byUrl.set(canonical, source);
    if (isFresh(item, window, seenUndated, undatedCap)) entry.fresh += 1;
  }

  if (clusters) {
    const attributed = new Map();
    for (const cluster of clusters) {
      const key = canonicalUrl(cluster.url) || cluster.title;
      for (const name of sourcesOf(cluster)) {
        const seen = attributed.get(name) ?? new Set();
        if (!seen.has(key)) {
          seen.add(key);
          entryFor(name).stories += 1;
        }
        attributed.set(name, seen);
      }
    }
  }

  const published = [
    ...(articles ?? []).map((article) => ({
      title: article.title ?? null,
      url: article.url ?? "",
    })),
    ...(publishedUrls ?? []).map((url) => ({ title: null, url })),
  ];

  const surfacedCount = new Map();
  const publishedCount = new Map();
  const hostCount = new Map();
  const citedKeys = new Map();
  const via = { url: 0, story: 0, host: 0, none: 0 };
  const attributions = [];
  let unattributed = 0;

  const bump = (map, name) => map.set(name, (map.get(name) ?? 0) + 1);

  for (const article of published) {
    const citedBy = byHost.get(hostOf(article.url));
    if (citedBy) {
      const key = canonicalUrl(article.url) || article.url;
      for (const name of citedBy) {
        const seen = citedKeys.get(name) ?? new Set();
        seen.add(key);
        citedKeys.set(name, seen);
      }
    }

    const hit = attributeArticle(article, { byUrl, clusters });
    const evidence = hit.sources.filter((name) => perSource.has(name));
    if (evidence.length > 0) {
      via[hit.via] += 1;
      attributions.push({
        url: article.url,
        title: article.title ?? null,
        via: hit.via,
        sources: evidence,
      });
      for (const name of evidence) {
        bump(surfacedCount, name);
        bump(publishedCount, name);
      }
      continue;
    }
    if (!citedBy || citedBy.size === 0) {
      via.none += 1;
      unattributed += 1;
      attributions.push({
        url: article.url,
        title: article.title ?? null,
        via: "none",
        sources: [],
      });
      continue;
    }
    via.host += 1;
    const byHostRule = [...citedBy].sort();
    attributions.push({
      url: article.url,
      title: article.title ?? null,
      via: "host",
      sources: byHostRule,
    });
    for (const name of byHostRule) {
      bump(publishedCount, name);
      bump(hostCount, name);
    }
  }

  attributions.sort((left, right) => (left.url === right.url ? 0 : left.url < right.url ? -1 : 1));

  const rows = [...perSource.values()].map((entry) => {
    const hosts = [...entry.hosts].sort();
    const surfaced = surfacedCount.get(entry.source) ?? 0;
    const publishedHere = publishedCount.get(entry.source) ?? 0;
    const hostAttributed = hostCount.get(entry.source) ?? 0;
    const cited = citedKeys.get(entry.source)?.size ?? 0;
    const measured = entry.fresh > 0 && clusters !== null;
    const storyYield = measured ? entry.stories / entry.fresh : null;
    const publishedRate = measured ? (entry.stories === 0 ? 0 : surfaced / entry.stories) : null;
    return {
      source: entry.source,
      hosts,
      aggregator: entry.aggregator,
      items: entry.items,
      fresh: entry.fresh,
      stories: clusters ? entry.stories : null,
      published: clusters ? publishedHere : null,
      surfaced: clusters ? surfaced : null,
      cited,
      hostAttributed: clusters ? hostAttributed : null,
      yield: storyYield,
      publishedRate,
      weight: weightFor(publishedRate),
      reason: reasonFor({
        entry,
        clusters,
        surfaced,
        cited,
        hostAttributed,
        aggregator: entry.aggregator,
      }),
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
      surfaced: clusters ? rows.reduce((sum, row) => sum + row.surfaced, 0) : null,
      cited: rows.reduce((sum, row) => sum + row.cited, 0),
      hostAttributed: clusters ? rows.reduce((sum, row) => sum + row.hostAttributed, 0) : null,
      articles: published.length,
      unattributed,
      via,
    },
    sources: rows,
    attributions,
  };
}

function reasonFor({ entry, clusters, surfaced, cited, hostAttributed, aggregator }) {
  if (clusters === null) return "no shortlist: stories unknown";
  if (entry.fresh === 0) return `unmeasured: 0 fresh of ${entry.items} items`;
  const parts = [
    `${entry.stories}/${entry.fresh} stories kept`,
    `${surfaced} surfaced`,
    `${cited} cited`,
  ];
  if (hostAttributed > 0) parts.push(`${hostAttributed} by host only`);
  if (aggregator) parts.push("aggregator: credit comes from stories surfaced, not cited");
  return parts.join(", ");
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
    attributions: report.attributions,
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
  const articles = readPublishedArticles({
    articles: flags.articles ?? null,
    collected: flags.collected ?? null,
  });
  const report = measureYield({
    candidates,
    shortlist,
    articles,
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
      `${totals.stories ?? "?"} stories, ${totals.surfaced ?? "?"} surfaced, ` +
      `${totals.cited} cited (${totals.articles} articles: ${totals.via.url} by url, ` +
      `${totals.via.story} by story, ${totals.via.host} by host, ${totals.via.none} unattributed)`,
  );
  const measured = report.sources
    .filter((entry) => entry.fresh > 0)
    .sort(
      (left, right) =>
        (right.surfaced ?? 0) - (left.surfaced ?? 0) ||
        (right.cited ?? 0) - (left.cited ?? 0) ||
        left.source.localeCompare(right.source),
    );
  for (const row of measured) {
    const rate = row.publishedRate === null ? "   -" : row.publishedRate.toFixed(2);
    const host = row.hostAttributed ? ` host ${String(row.hostAttributed).padStart(2)}` : "";
    console.log(
      `  ${row.source.padEnd(24).slice(0, 24)} fresh ${String(row.fresh).padStart(4)}  ` +
        `stories ${String(row.stories).padStart(3)}  surfaced ${String(row.surfaced).padStart(2)}  ` +
        `cited ${String(row.cited).padStart(2)}${host}  rate ${rate}  weight ${row.weight ?? "-"}`,
    );
  }
  const weak = (report.attributions ?? []).filter(
    (entry) => entry.via === "host" || entry.via === "none",
  );
  if (weak.length > 0) {
    console.log("articles no story could claim:");
    for (const entry of weak) {
      const who = entry.via === "host" ? `host: ${entry.sources.join(", ")}` : "unattributed";
      console.log(`  [${entry.via}] ${entry.url} (${who})`);
    }
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
