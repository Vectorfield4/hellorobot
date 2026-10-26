#!/usr/bin/env node
// Story-level triage for a news-fetcher dump.
//
// A dump of 2 000 candidates carries roughly 20 stories: one event arrives as a
// vendor release, a trade-press write-up, a Google News rerun and a translated
// retelling in two more languages. URL deduplication collapses none of that, and
// a retelling that wins the race becomes a second article about the same fact.
// This script answers the missing question: which candidates describe the same story?
//
//   node scripts/triage-candidates.mjs --file docs/research/candidates-<date>.json \
//     --from 2026-10-25 --to 2026-10-26 [--top 40] [--undated-cap 20] [--out shortlist.json]
//   node scripts/triage-candidates.mjs body --file <extracted-body.txt>
//
// `body` is the parsing gate: a news item shorter than MIN_NEWS_WORDS is a failed
// extraction (paywall, JS shell, wrong block), not a short story. Silent truncation
// is worse than a 403 because it looks like success.

import { readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A story may be retold across this many days and still count as the same event. */
export const STORY_WINDOW_DAYS = 3;

/** Anything below this is a broken extraction, not a brief. */
export const MIN_NEWS_WORDS = 300;

/** Undated listings (CN/JP HTML feeds) are taken positionally: page order is newest first. */
export const DEFAULT_UNDATED_CAP = 20;

const DAY_MS = 86_400_000;

const STOPWORDS = new Set(
  `a an the and or of for to in on at by with from as is are was were be been this that these
   those its it their his her new next how why what when who will can could may might not no
   vs s t r u e p n d c b f g h j k l m o q w x y z`
    .split(/\s+/)
    .filter(Boolean),
);

// Capitalised words that say nothing about which company a story is about.
const ENTITY_STOPWORDS = new Set([
  "the",
  "new",
  "robot",
  "robots",
  "robotics",
  "humanoid",
  "humanoids",
  "ai",
  "ceo",
  "ipo",
  "inc",
  "ltd",
  "corp",
  "group",
  "labs",
  "systems",
  "company",
  "startup",
]);

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

/** Latin-1 and typographic ranges that real Russian, Japanese or Chinese text never uses. */
// Three-letter marks that name a topic, not a company: they appear in unrelated
// stories and would merge them. A short company mark («D.R») is not in this list.
const WEAK_ENTITIES = new Set([
  "mit",
  "ai",
  "ces",
  "ieee",
  "icra",
  "ros",
  "api",
  "usb",
  "gpu",
  "cpu",
  "llm",
  "agi",
  "saas",
  "ceo",
  "ipo",
  "nato",
  "eu",
  "un",
  "us",
  "uk",
  "cn",
  "jp",
]);

const MOJIBAKE_CHARS =
  /[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u2018-\u201f\u2020-\u2022]/g;

const SCALE_BY_UNIT = new Map([
  ["k", 1e3],
  ["thousand", 1e3],
  ["тыс", 1e3],
  ["m", 1e6],
  ["mn", 1e6],
  ["mln", 1e6],
  ["million", 1e6],
  ["млн", 1e6],
  ["миллион", 1e6],
  ["миллиона", 1e6],
  ["миллионов", 1e6],
  ["b", 1e9],
  ["bn", 1e9],
  ["billion", 1e9],
  ["млрд", 1e9],
  ["миллиард", 1e9],
  ["миллиарда", 1e9],
  ["миллиардов", 1e9],
  ["t", 1e12],
  ["trillion", 1e12],
  ["万", 1e4],
  ["亿", 1e8],
  ["億", 1e8],
  ["억", 1e8],
  ["조", 1e12],
]);

const CJK_SCALE = [
  ["亿", 1e8],
  ["億", 1e8],
  ["억", 1e8],
  ["万", 1e4],
  ["조", 1e12],
];

// Aggregators and outlets that reprint someone else's reporting. Inside a story
// cluster they lose to the original, whatever their position in the feed.
const RETOLD_HOSTS = new Set([
  "news.google.com",
  "irobotnews.com",
  "www.irobotnews.com",
  "globaltimes.cn",
  "www.globaltimes.cn",
  "cnbeta.com",
  "www.cnbeta.com",
  "ithome.com",
  "www.ithome.com",
  "tmtpost.com",
  "www.tmtpost.com",
  "geekpark.net",
  "www.geekpark.net",
]);

// Trade press: reporting with its own sourcing, but not the actor of the story.
const TRADE_HOSTS = new Set([
  "therobotreport.com",
  "www.therobotreport.com",
  "spectrum.ieee.org",
  "techcrunch.com",
  "www.wired.com",
  "robohub.org",
  "arxiv.org",
  "discourse.ros.org",
  "rss.itmedia.co.jp",
  "robotstart.info",
  "robot-china.com",
  "www.robot-china.com",
  "leiphone.com",
  "www.leiphone.com",
  "qbitai.com",
  "www.qbitai.com",
  "zhidx.com",
  "chinaagv.com",
  "www.chinaagv.com",
  "response.jp",
  "xtech.nikkei.com",
]);

const ROBOT_WORDS =
  /robot|robotic|humanoid|automation|manipulator|agv|amr|cobot|exoskeleton|embodied|дрон|робот|человекоподоб|манипулятор|ロボット|ヒューマノイド|フィジカルai|協働|具身|机器人|人形|机械臂|灵巧手|自动化|로봇|자율주행|휴머노이드/i;

// Titles that never become a story here: an expo invitation carries no fact.
// Each rule needs its context word, so «выставка» alone does not kill a report
// about a robot shown at one.
const KILL_RULES = [
  {
    reason: "expo-invitation",
    title: /(приглаша|invitation|invite you|ご案内|邀请函|邀请您|诚邀)/i,
    context: /(expo|exhibition|выставк|展示会|展会|cemat|waic|world robot conference|工博会)/i,
  },
  {
    reason: "webinar",
    title: /(webinar|вебинар|ウェビナー|网络研讨会|在线研讨会)/i,
  },
  {
    reason: "award-list",
    title: /(award|наград|лауреат|受賞|获奖|ranking|ランキング|排行榜|榜单|top \d+)/i,
  },
  {
    reason: "concept-render",
    title: /(concept art|концепт|рендер|レンダリング|概念图)/i,
  },
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function dayOf(date) {
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY_MS);
}

/** Lowercased word and CJK-bigram set of a title; the unit of similarity. */
export function titleTokens(title) {
  const normalised = String(title ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u3000-\u303f\uff01-\uff65]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const tokens = new Set();
  for (const chunk of normalised.split(/\s+/)) {
    if (!chunk) continue;
    if (CJK.test(chunk)) {
      if (chunk.length === 1) tokens.add(chunk);
      for (let i = 0; i < chunk.length - 1; i += 1) tokens.add(chunk.slice(i, i + 2));
      continue;
    }
    if (chunk.length < 3 || STOPWORDS.has(chunk) || /^\d+$/.test(chunk)) continue;
    tokens.add(chunk);
  }
  return tokens;
}

/** Latin-script proper nouns: the part of a title that survives translation. */
export function titleEntities(title) {
  const entities = new Set();
  for (const match of String(title ?? "").matchAll(/\b[A-Z][A-Za-z0-9&.+'-]{2,}\b/g)) {
    const word = match[0].toLowerCase();
    if (ENTITY_STOPWORDS.has(word)) continue;
    entities.add(word);
  }
  return entities;
}

function scaleOf(unit) {
  const direct = SCALE_BY_UNIT.get(unit);
  if (direct) return direct;
  for (const [marker, scale] of CJK_SCALE) {
    if (unit.includes(marker)) return scale;
  }
  return undefined;
}

/**
 * Amounts as absolute values. "$300M", "300 млн" and "3억 달러" all become
 * 300000000, which is what lets a translated retelling collapse into the original.
 */
export function numberSignature(title) {
  const numbers = new Set();
  const text = String(title ?? "")
    .normalize("NFKC")
    .toLowerCase();
  // The lookbehind keeps model designations out: «H2» or «RTX4090» are names,
  // and the «2» inside them would otherwise merge unrelated stories.
  const pattern = /(?<![\p{L}\p{N}])(\d[\d.,]*)\s*([a-zа-я\u4e00-\u9fff\uac00-\ud7af]*)/gu;
  for (const match of text.matchAll(pattern)) {
    const digits = match[1].replace(/[,\s]/g, "");
    const value = Number(digits);
    if (!Number.isFinite(value)) continue;
    // Years are not amounts and would merge every story of one year.
    if (value >= 2000 && value <= 2099 && Number.isInteger(value)) continue;
    numbers.add(String(Math.round(value)));
    const scale = scaleOf((match[2] ?? "").trim());
    if (scale) numbers.add(String(Math.round(value * scale)));
  }
  return numbers;
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function intersects(left, right) {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of small) if (large.has(value)) return true;
  return false;
}

/** A money amount, as opposed to a specification number. */
function sharesLargeAmount(left, right) {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const value of small) {
    if (Number(value) >= 1e6 && large.has(value)) return true;
  }
  return false;
}

function fingerprint(item) {
  const title = String(item.title ?? "");
  return {
    tokens: titleTokens(title),
    entities: titleEntities(title),
    numbers: numberSignature(title),
    day: dayOf(item.date),
    script: CJK.test(title) ? "cjk" : "latin",
  };
}

/**
 * Do two candidates describe one event? Either the titles are nearly the same
 * words, or they share a company and an amount — which is what survives when a
 * retelling is written in another language.
 */
export function sameStory(left, right, windowDays = STORY_WINDOW_DAYS) {
  if (left.tokens.size === 0 || right.tokens.size === 0) return false;
  if (left.day !== null && right.day !== null && Math.abs(left.day - right.day) > windowDays) {
    return false;
  }
  const overlap = jaccard(left.tokens, right.tokens);
  if (overlap >= 0.45) return true;
  if (!intersects(left.entities, right.entities)) return false;
  // One company and one large amount is one event: nobody raises the same sum twice.
  if (sharesLargeAmount(left.numbers, right.numbers)) return true;
  if (intersects(left.numbers, right.numbers) && overlap >= 0.2) return true;
  // Across scripts the only thing left of the original is the company name, so
  // the entity is the signal. Two facts about one company written in two
  // languages will merge here; the cluster keeps every source URL, so the cost
  // is a visible retold list rather than a lost story.
  // Across scripts the only thing left of the original is the company name, so
  // the entity is the signal — as long as it names a company and not a topic.
  const distinctive = [...left.entities].some(
    (entity) => entity.length >= 2 && !WEAK_ENTITIES.has(entity) && right.entities.has(entity),
  );
  return distinctive && left.script !== right.script;
}

/** 0 = the actor of the story, 1 = trade press, 2 = aggregator or reprint. */
export function sourceTier(item) {
  const host = hostOf(item.url);
  if (/^google news/i.test(item.source ?? "") || RETOLD_HOSTS.has(host)) return 2;
  if (TRADE_HOSTS.has(host)) return 1;
  return 0;
}

function killReason(title) {
  for (const rule of KILL_RULES) {
    if (!rule.title.test(title)) continue;
    if (rule.context && !rule.context.test(title)) continue;
    return rule.reason;
  }
  return null;
}

/** Words in a body, counting CJK characters at roughly 1.5 per word. */
export function countWords(text) {
  const body = String(text ?? "");
  let latin = 0;
  let cjk = 0;
  for (const token of body.split(/\s+/)) {
    if (!token) continue;
    if (CJK.test(token)) {
      for (const char of token) if (CJK.test(char)) cjk += 1;
    } else if (/\p{L}|\p{N}/u.test(token)) {
      latin += 1;
    }
  }
  return latin + Math.round(cjk / 1.5);
}

/** UTF-8 read as a single-byte codepage leaves this fingerprint. */
export function looksMojibake(text) {
  const body = String(text ?? "");
  const hits = body.match(MOJIBAKE_CHARS)?.length ?? 0;
  if (hits < 3) return false;
  const letters = body.replace(/\s+/g, "").length || 1;
  return hits / letters >= 0.12;
}

/**
 * The parsing gate. `ok: false` means extract again or drop the candidate —
 * never write an article from this body.
 */
export function checkBody(text) {
  const words = countWords(text);
  const mojibake = looksMojibake(text);
  if (mojibake) return { ok: false, words, mojibake, reason: "mojibake" };
  if (words < MIN_NEWS_WORDS) {
    return { ok: false, words, mojibake, reason: `too-short: ${words} < ${MIN_NEWS_WORDS}` };
  }
  return { ok: true, words, mojibake, reason: "ok" };
}

function prepare(item) {
  return { item, ...fingerprint(item), tier: sourceTier(item) };
}

function knownFingerprint(entry) {
  return {
    fingerprint: fingerprint({ title: entry.title, date: null }),
    slug: entry.slug,
    url: entry.url,
  };
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase().replace(/^www\./, "")}${path}`;
  } catch {
    return "";
  }
}

/**
 * The archive: every article already published. A story that is two days old but
 * arrives today as a translated retelling is not fresh news, and URL matching
 * misses it because the retelling has its own address.
 */
export function knownFromArticles(dir) {
  const entries = [];
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return entries;
  }
  for (const name of names) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const raw = readFileSync(join(dir, name), "utf8");
    const title = frontmatterField(raw, "title");
    if (!title) continue;
    entries.push({
      title,
      slug: frontmatterField(raw, "slug") ?? name.replace(/\.ru\.md$/, ""),
      url: frontmatterField(raw, "source_url"),
    });
  }
  return entries;
}

function frontmatterField(raw, key) {
  const frontmatter = String(raw ?? "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const match = frontmatter[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
}

/**
 * The last gate before publishing. A candidate is compared in the language it
 * arrived in, where a retelling may keep nothing of the original. A draft is
 * compared in the language it will be read in, against titles already published:
 * that is where a translated retelling of an old story finally shows up.
 */
export function checkDraft(file, articlesDir = "articles") {
  const raw = readFileSync(file, "utf8");
  const title = frontmatterField(raw, "title");
  if (!title) throw new Error(`${file} has no frontmatter title`);
  const slug = frontmatterField(raw, "slug");
  const mine = fingerprint({ title, date: null });
  const matches = knownFromArticles(articlesDir)
    .filter((entry) => entry.slug !== slug)
    .filter((entry) => sameStory(mine, fingerprint({ title: entry.title, date: null })))
    .map((entry) => ({ slug: entry.slug, title: entry.title }));

  const verdict = matches.length > 0 ? "duplicate" : "ok";
  console.log(`${verdict}: ${title}`);
  for (const match of matches) console.log(`  matches ${match.slug}: ${match.title}`);
  return { verdict, title, slug, matches };
}

function findKnown(cluster, known) {
  const url = canonicalUrl(cluster.url);
  if (url) {
    for (const entry of known) {
      if (entry.url && canonicalUrl(entry.url) === url) return { slug: entry.slug, match: "url" };
    }
  }
  const fingerprintOfCluster = fingerprint({ title: cluster.title, date: null });
  for (const entry of known) {
    if (sameStory(fingerprintOfCluster, entry.fingerprint)) {
      return { slug: entry.slug, match: "story" };
    }
  }
  return null;
}

/** Union-find over same-story pairs; 2 000 items is ~2M comparisons, cheap enough. */
function clusterEntries(entries, windowDays = STORY_WINDOW_DAYS) {
  const parent = entries.map((_, index) => index);
  const find = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (!sameStory(entries[i], entries[j], windowDays)) continue;
      const left = find(i);
      const right = find(j);
      if (left !== right) parent[right] = left;
    }
  }
  const groups = new Map();
  entries.forEach((entry, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(entry);
    groups.set(root, group);
  });
  return [...groups.values()];
}

function scoreCluster(primary, members) {
  const why = [];
  let score = 3 - primary.tier;
  why.push(primary.tier === 0 ? "primary source" : primary.tier === 1 ? "trade press" : "retold");
  if (primary.numbers.size > 0) {
    score += 1;
    why.push("carries an amount");
  }
  if (primary.item.date) {
    score += 0.5;
    why.push("dated");
  }
  if (ROBOT_WORDS.test(primary.item.title)) {
    score += 0.5;
    why.push("robotics");
  }
  if (members.length > 1) {
    score += 0.5;
    why.push(`${members.length} sources`);
  }
  return { score: Math.round(score * 10) / 10, why };
}

/**
 * Filters, clusters and ranks a fetcher dump. Returns the shortlist plus every
 * dropped candidate with the reason, so a quiet drop is never invisible.
 */
export function triage(items, options = {}) {
  const {
    from = null,
    to = null,
    undatedCap = DEFAULT_UNDATED_CAP,
    top = 0,
    windowDays = STORY_WINDOW_DAYS,
    known = [],
  } = options;
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : null;
  const toMs = to ? Date.parse(`${to}T23:59:59Z`) : null;

  const dropped = [];
  const kept = [];
  const undatedSeen = new Map();

  for (const item of items) {
    const title = String(item.title ?? "").trim();
    if (!title) {
      dropped.push({ ...item, reason: "empty-title" });
      continue;
    }
    const killed = killReason(title);
    if (killed) {
      dropped.push({ ...item, reason: killed });
      continue;
    }
    const ms = Date.parse(item.date);
    if (Number.isNaN(ms)) {
      const seen = undatedSeen.get(item.source) ?? 0;
      if (seen >= undatedCap) {
        dropped.push({ ...item, reason: `undated past cap ${undatedCap}` });
        continue;
      }
      undatedSeen.set(item.source, seen + 1);
      kept.push(item);
      continue;
    }
    if (fromMs !== null && ms < fromMs) {
      dropped.push({ ...item, reason: "stale" });
      continue;
    }
    if (toMs !== null && ms > toMs) {
      dropped.push({ ...item, reason: "outside window" });
      continue;
    }
    kept.push(item);
  }

  const entries = kept.map(prepare);
  const groups = clusterEntries(entries, windowDays);
  const clusters = groups.map((members) => {
    const sorted = [...members].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const left = a.item.date ? Date.parse(a.item.date) : Number.POSITIVE_INFINITY;
      const right = b.item.date ? Date.parse(b.item.date) : Number.POSITIVE_INFINITY;
      if (left !== right) return left - right;
      return a.item.url < b.item.url ? -1 : 1;
    });
    const primary = sorted[0];
    const { score, why } = scoreCluster(primary, sorted);
    return {
      key: [...primary.tokens].sort().slice(0, 6).join("-"),
      title: primary.item.title,
      url: primary.item.url,
      source: primary.item.source,
      tier: primary.tier,
      date: primary.item.date ?? null,
      score,
      why,
      retold: sorted.slice(1).map((entry) => ({
        source: entry.item.source,
        url: entry.item.url,
        tier: entry.tier,
        title: entry.item.title,
      })),
    };
  });

  clusters.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const archive = (known ?? []).map(knownFingerprint);
  const covered = [];
  const fresh = [];
  for (const cluster of clusters) {
    const hit = archive.length > 0 ? findKnown(cluster, archive) : null;
    if (hit) covered.push({ ...cluster, covered_by: hit.slug, match: hit.match });
    else fresh.push(cluster);
  }

  const limit = top > 0 ? Math.min(top, fresh.length) : fresh.length;
  const shortlist = fresh.slice(0, limit);
  const rest = fresh.slice(limit).map((cluster) => ({
    title: cluster.title,
    url: cluster.url,
    source: cluster.source,
    reason: "past --top",
  }));

  return {
    window: { from, to, days: windowDays },
    stats: {
      input: items.length,
      kept: kept.length,
      clusters: clusters.length,
      shortlist: shortlist.length,
      covered: covered.length,
      dropped: dropped.length,
    },
    shortlist,
    covered,
    dropped: [
      ...dropped,
      ...covered.map((cluster) => ({
        title: cluster.title,
        url: cluster.url,
        source: cluster.source,
        reason: `already-published: ${cluster.covered_by}`,
      })),
      ...rest,
    ],
  };
}

function parseArgs(argv) {
  const first = argv[0];
  const hasCommand = Boolean(first) && !first.startsWith("--");
  const command = hasCommand ? first : "cluster";
  const rest = hasCommand ? argv.slice(1) : argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    flags[name] = rest[++i];
  }
  return { command, flags };
}

export function run(argv = process.argv.slice(2)) {
  const { command, flags } = parseArgs(argv);

  if (command === "body") {
    if (!flags.file) throw new Error("body needs --file");
    const result = checkBody(readFileSync(resolve(flags.file), "utf8"));
    console.log(
      `${result.ok ? "ok" : "fail"}: ${result.words} words, mojibake=${result.mojibake} (${result.reason})`,
    );
    return result;
  }

  if (command === "draft") {
    if (!flags.file) throw new Error("draft needs --file");
    return checkDraft(resolve(flags.file), resolve(flags["known-articles"] ?? "articles"));
  }

  if (command !== "cluster") {
    throw new Error(
      "Usage: triage-candidates.mjs cluster --file <candidates.json> | body --file <body.txt> | draft --file <article.md>",
    );
  }
  if (!flags.file) throw new Error("cluster needs --file");

  const items = JSON.parse(readFileSync(resolve(flags.file), "utf8"));
  const known = flags["known-articles"] ? knownFromArticles(resolve(flags["known-articles"])) : [];
  const result = triage(items, {
    from: flags.from ?? null,
    to: flags.to ?? null,
    undatedCap: flags["undated-cap"] ? Number(flags["undated-cap"]) : DEFAULT_UNDATED_CAP,
    top: flags.top ? Number(flags.top) : 0,
    known,
  });

  if (flags.out) {
    writeFileSync(resolve(flags.out), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  const { stats } = result;
  console.log(
    `${stats.input} candidates -> ${stats.clusters} stories (${stats.dropped} dropped, ` +
      `${stats.kept} in window, ${stats.covered} already published), shortlist ${stats.shortlist}`,
  );
  for (const cluster of result.shortlist.slice(0, 12)) {
    const retold = cluster.retold.length > 0 ? ` (+${cluster.retold.length} retold)` : "";
    console.log(`  ${cluster.score.toFixed(1)}  [${cluster.source}] ${cluster.title}${retold}`);
  }
  for (const cluster of result.covered.slice(0, 6)) {
    console.log(`  covered  ${cluster.title} -> ${cluster.covered_by} (${cluster.match})`);
  }
  if (flags.out) console.log(`Wrote ${flags.out}`);
  return result;
}

const invokedDirectly = isEntryPoint();

try {
  if (invokedDirectly) run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
