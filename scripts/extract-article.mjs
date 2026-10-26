#!/usr/bin/env node
// Publisher-aware article extraction.
//
// The shared `article-extractor` skill is one generic Readability pass: it knows
// nothing about a site, so a lazy-loaded body, a `#cmsBody` in shift_jis or a
// Korean CMS template costs a story. Roughly one candidate in five failed that
// way. This script is the cheap ladder that gets those back:
//
//   1. JSON-LD (`Article`/`NewsArticle` `articleBody`) and the `article:*` meta —
//      the publisher states the text, the title and the date itself.
//   2. A per-publisher selector from PUBLISHERS below, verified against live
//      articles (see docs/article-sources.md).
//   3. A generic heuristic: the container whose paragraphs hold the most text
//      and the least navigation.
//
//   node scripts/extract-article.mjs --url <url> [--out body.json]
//
// Output: { url, title, date, text, words, mojibake, extractor, ok, reason }.
// `ok` comes from checkBody in scripts/triage-candidates.mjs — a body under
// MIN_NEWS_WORDS words or one that smells of mojibake is a failed extraction,
// not a short story.

import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { checkBody, countWords, looksMojibake } from "./triage-candidates.mjs";

/** A newsroom page behind a WAF rejects the fetcher's own user agent. */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Fetch budget per attempt. Two attempts at most, never a retry loop. */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Verified against live articles on 2026-10-27: each selector had to yield the
 * body of three articles of its publisher. A publisher that is not here (or whose
 * selector stops matching) falls through to the generic heuristic — that is the
 * designed degradation, not an error.
 *
 * `dateSelector` is only set where the date is neither in JSON-LD nor in a meta
 * tag; the document-wide date scan is the last resort.
 */
export const PUBLISHERS = [
  {
    host: "irobotnews.com",
    name: "로봇신문",
    selector: "#article-view-content-div",
    dateSelector: ".article-info",
  },
  {
    host: "therobotreport.com",
    name: "The Robot Report",
    selector: ".entry-content",
  },
  {
    host: "globaltimes.cn",
    name: "Global Times",
    selector: ".article_content",
  },
  {
    host: "infranken.de",
    name: "inFranken.de",
    selector: ".text_teaser",
  },
  {
    host: "briefia.fr",
    name: "Brief.IA",
    selector: "main .prose",
  },
  {
    host: "01net.com",
    name: "01net",
    selector: ".entry-content",
  },
  {
    // MONOist articles live on monoist.itmedia.co.jp, the feed on
    // rss.itmedia.co.jp; one entry serves both. `#cmsBody` also carries the
    // related-article list and the copyright line, `.subscription` is the body
    // alone. The page is shift_jis with the charset declared only in a meta tag,
    // hence the decode ladder below.
    host: "itmedia.co.jp",
    name: "MONOist / ITmedia",
    selector: "#cmsBody .subscription",
    dateSelector: "#cmsDate",
  },
  {
    host: "robotstart.info",
    name: "ロボスタ",
    selector: "article.arti-body",
    dateSelector: "time[datetime]",
  },
  {
    host: "robot-china.com",
    name: "中国机器人网",
    selector: "#content",
    dateSelector: ".m3l div.info",
  },
  {
    host: "leiphone.com",
    name: "雷峰网",
    selector: ".lphArticle-detail",
    dateSelector: ".article-info .time",
  },
  {
    host: "qbitai.com",
    name: "量子位",
    selector: "div.article",
    dateSelector: ".article-info .time",
  },
  {
    host: "zhidx.com",
    name: "智东西",
    selector: "div.post-content",
    dateSelector: "span.time",
  },
  {
    host: "chinaagv.com",
    name: "中国AGV网",
    selector: "#viewcontentbox",
    dateSelector: ".showbox span",
  },
  {
    host: "prtimes.jp",
    name: "PR TIMES",
    selector: "#press-release-body",
  },
];

/**
 * Charset labels that lie. `gb1323` (OFweek) is not a codepage at all — it is a
 * typo for `gb2312`/`gb18030`, and TextDecoder throws on it, which is how a
 * Chinese page becomes an empty body. `gb2312` and `gbk` are subsets of gb18030,
 * and `iso-8859-1` in the wild is usually windows-1252.
 */
const CHARSET_ALIASES = new Map([
  ["gb1323", "gb18030"],
  ["gb2312", "gb18030"],
  ["gbk", "gb18030"],
  ["gb_2312-80", "gb18030"],
  ["x-gbk", "gb18030"],
  ["shift-jis", "shift_jis"],
  ["sjis", "shift_jis"],
  ["x-sjis", "shift_jis"],
  ["windows-31j", "shift_jis"],
  ["iso-8859-1", "windows-1252"],
  ["latin1", "windows-1252"],
  ["eucjp", "euc-jp"],
]);

/** Elements that never carry the story. */
const NOISE = [
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "nav",
  "aside",
  "footer",
  "header",
  "svg",
  "figure figcaption",
  '[role="navigation"]',
  '[role="complementary"]',
  ".share",
  ".sharing",
  ".social",
  ".related",
  ".related-articles",
  ".comments",
  ".comment",
  ".newsletter",
  ".breadcrumb",
  ".breadcrumbs",
  ".advertisement",
  ".ad",
  ".ads",
  ".advert",
  ".tags",
  ".tag-list",
  ".author-box",
  ".sidebar",
  ".endlink",
  "#cmsCopyright",
].join(",");

const ARTICLE_TYPES =
  /^(Article|NewsArticle|BlogPosting|ReportageNewsArticle|AnalysisNewsArticle)$/i;

const DATE_TEXT =
  /(20\d{2})[-/年.]\s?(\d{1,2})[-/月.]\s?(\d{1,2})|(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})/i;

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The publisher whose domain owns this URL, or null for the generic heuristic. */
export function pickPublisher(url) {
  const host = hostOf(url);
  if (!host) return null;
  return PUBLISHERS.find((entry) => host === entry.host || host.endsWith(`.${entry.host}`)) ?? null;
}

/** A date as YYYY-MM-DD, or null. Handles ISO, dotted, CJK and English forms. */
export function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(DATE_TEXT);
  if (!match) {
    const iso = Date.parse(text);
    return Number.isNaN(iso) ? null : new Date(iso).toISOString().slice(0, 10);
  }
  if (match[1]) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  if (match[5]) {
    const month = MONTHS[match[5].slice(0, 3).toLowerCase()];
    const day = Number(match[4]);
    return `${match[6]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const month = MONTHS[match[7].slice(0, 3).toLowerCase()];
  const day = Number(match[8]);
  return `${match[9]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Charset from the response header, else from a meta tag in the first 4 KB. Many
 * publishers declare it only in HTML, and the fetch API always decodes as UTF-8.
 */
export function charsetOf(buffer, contentType = "") {
  const header = /charset=([^\s;]+)/i.exec(contentType ?? "");
  if (header) return header[1].replace(/^["']|["']$/g, "").toLowerCase();
  const head = Buffer.from(buffer).toString("latin1", 0, 4096);
  const meta =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) ??
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(head);
  return meta ? meta[1].toLowerCase() : "";
}

function decoderFor(label) {
  const resolved = CHARSET_ALIASES.get(label) ?? label;
  if (!resolved) return null;
  try {
    return new TextDecoder(resolved, { fatal: false });
  } catch {
    return null;
  }
}

/** Decode, and if the declared charset produces mojibake, try UTF-8 instead. */
export function decodeHtml(buffer, contentType = "") {
  const bytes = Buffer.from(buffer);
  const declared = charsetOf(bytes, contentType);
  const decoder = decoderFor(declared);
  if (decoder) {
    const text = decoder.decode(bytes);
    // A stale shift_jis/gbk declaration on a UTF-8 page decodes into mojibake.
    if (!looksMojibake(text)) return text;
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!looksMojibake(utf8)) return utf8;
  return decoder ? decoder.decode(bytes) : utf8;
}

/** Readable text of a block: noise removed, block boundaries turned into newlines. */
function textOf(node) {
  if (!node) return "";
  const doc = node.ownerDocument;
  const clone = node.cloneNode(true);
  for (const junk of clone.querySelectorAll(NOISE)) junk.remove();
  for (const br of clone.querySelectorAll("br")) {
    br.replaceWith(doc.createTextNode("\n"));
  }
  for (const block of clone.querySelectorAll("p,div,section,li,h1,h2,h3,h4,tr,blockquote")) {
    block.append(doc.createTextNode("\n"));
  }
  return clone.textContent
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function flattenJsonLd(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (value["@graph"]) flattenJsonLd(value["@graph"], out);
  out.push(value);
  return out;
}

/**
 * Step 1: what the publisher claims in machine-readable form. Cheap, structured
 * and — where `articleBody` is present — better than any selector.
 */
export function extractJsonLd(dom) {
  const found = { title: null, date: null, body: null };
  for (const script of dom.window.document.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try {
      data = JSON.parse(script.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ""));
    } catch {
      continue;
    }
    for (const node of flattenJsonLd(data)) {
      const type = node["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((entry) => ARTICLE_TYPES.test(String(entry)))) continue;
      if (!found.title && typeof node.headline === "string") found.title = node.headline.trim();
      if (!found.date && typeof node.datePublished === "string") found.date = node.datePublished;
      if (!found.body && typeof node.articleBody === "string" && node.articleBody.trim()) {
        found.body = node.articleBody.trim();
      }
    }
  }
  return found;
}

/** Step 1b: the `article:*` and OpenGraph meta tags, which most publishers fill. */
export function extractMeta(dom) {
  const doc = dom.window.document;
  const meta = (selector) => doc.querySelector(selector)?.getAttribute("content")?.trim() ?? null;
  return {
    title:
      meta('meta[property="og:title"]') ??
      meta('meta[name="twitter:title"]') ??
      meta('meta[name="title"]'),
    date:
      meta('meta[property="article:published_time"]') ??
      meta('meta[name="article:published_time"]') ??
      meta('meta[property="og:article:published_time"]') ??
      meta('meta[name="date"]') ??
      meta('meta[name="DC.date"]') ??
      meta('meta[itemprop="datePublished"]'),
    siteName: meta('meta[property="og:site_name"]'),
  };
}

/** Step 3: the container whose paragraphs hold the most story and the least chrome. */
export function genericContainer(dom) {
  const doc = dom.window.document;
  let best = null;
  for (const el of doc.querySelectorAll("article, main, div, section, td")) {
    const paragraphs = el.querySelectorAll("p");
    if (paragraphs.length === 0) continue;
    const paragraphText = [...paragraphs].map((p) => p.textContent).join(" ");
    const paragraphWords = countWords(paragraphText);
    if (paragraphWords < 40) continue;
    const allWords = countWords(el.textContent);
    if (allWords === 0) continue;
    const density = Math.min(1, paragraphWords / allWords);
    const linkWords = countWords([...el.querySelectorAll("a")].map((a) => a.textContent).join(" "));
    const score = paragraphWords * density - linkWords;
    if (!best || score > best.score) best = { el, score, paragraphWords };
  }
  return best ? best.el : null;
}

/** Title from JSON-LD, meta, the first h1, or <title> with the suffix cut off. */
function pickTitle(candidates) {
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text) return text;
  }
  return "";
}

/** `og:title` often carries HTML entities (`&#8217;`), JSON-LD does not. */
function decodeEntities(dom, text) {
  if (!text || !/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(text)) return text;
  const el = dom.window.document.createElement("textarea");
  el.innerHTML = text;
  return el.textContent;
}

/**
 * The ladder. Each rung is a candidate text; the first one that clears the body
 * gate wins. If none clears it, the longest is returned with ok: false, because a
 * wrong-but-short body and an empty body must not look alike.
 */
export function extract(html, url) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  for (const junk of doc.querySelectorAll(
    "script:not([type='application/ld+json']),style,noscript",
  )) {
    junk.remove();
  }
  const ld = extractJsonLd(dom);
  const meta = extractMeta(dom);
  const publisher = pickPublisher(url);

  const candidates = [];
  if (ld.body) {
    candidates.push({
      extractor: "json-ld",
      text: ld.body.replace(/\s*\n\s*/g, "\n").trim(),
    });
  }
  if (publisher) {
    const block = doc.querySelector(publisher.selector);
    const text = textOf(block);
    if (text && countWords(text) > 0) {
      candidates.push({ extractor: `publisher:${publisher.host}`, text });
    }
  }
  const generic = genericContainer(dom);
  if (generic) {
    const text = textOf(generic);
    if (text && countWords(text) > 0) candidates.push({ extractor: "generic", text });
  }

  const scored = candidates.map((candidate) => ({ ...candidate, ...checkBody(candidate.text) }));
  const winner =
    scored.find((candidate) => candidate.ok) ?? scored.sort((a, b) => b.words - a.words)[0];

  const dateSelectorText = publisher?.dateSelector
    ? doc.querySelector(publisher.dateSelector)?.textContent
    : null;
  const date =
    normalizeDate(decodeEntities(dom, ld.date)) ??
    normalizeDate(decodeEntities(dom, meta.date)) ??
    normalizeDate(decodeEntities(dom, dateSelectorText)) ??
    normalizeDate(doc.body?.textContent ?? "");

  const title = pickTitle([
    decodeEntities(dom, ld.title),
    decodeEntities(dom, meta.title),
    doc.querySelector("h1")?.textContent,
    doc.title.split(/\s+[-|–—]\s+/)[0],
  ]);

  if (!winner) {
    return {
      url,
      title,
      date,
      text: "",
      words: 0,
      mojibake: false,
      extractor: "none",
      ok: false,
      reason: "no article container",
    };
  }

  return {
    url,
    title,
    date,
    text: winner.text,
    words: winner.words,
    mojibake: winner.mojibake,
    extractor: winner.extractor,
    ok: winner.ok,
    reason: winner.reason,
  };
}

/** Second attempt user agent: some WAFs block one browser and let another through. */
export const FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";

/** Statuses where a second call is worth one attempt; 404 is not one of them. */
const RETRY_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

/**
 * One browser-UA attempt, then one fallback with another UA. A 403/429/5xx or a
 * dropped connection gets that fallback; a 404 is final. After two attempts the
 * caller gets an honest refusal instead of a shell page parsed as a story.
 */
export async function fetchPage(url) {
  let last = null;
  for (const userAgent of [BROWSER_UA, FALLBACK_UA]) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9,ja;q=0.8,zh;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        last = { ok: false, status: res.status, error: `http ${res.status}` };
        if (!RETRY_STATUS.has(res.status)) return last;
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!/html|xml/i.test(contentType) && contentType) {
        last = { ok: false, status: res.status, error: `not html: ${contentType}` };
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        status: res.status,
        charset: charsetOf(buffer, contentType),
        html: decodeHtml(buffer, contentType),
      };
    } catch (error) {
      last = { ok: false, status: 0, error: error.cause?.code ?? error.message };
    }
  }
  return last;
}

/** Fetch and extract in one call. Never throws on a network failure. */
export async function extractFromUrl(url) {
  const page = await fetchPage(url);
  if (!page?.ok) {
    return {
      url,
      title: null,
      date: null,
      text: "",
      words: 0,
      mojibake: false,
      extractor: "none",
      ok: false,
      reason: page?.error ?? "fetch failed",
    };
  }
  const result = extract(page.html, url);
  return { ...result, charset: page.charset || null };
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    flags[name] = argv[++i];
  }
  return flags;
}

export async function run(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  if (!flags.url) throw new Error("extract-article needs --url");
  const result = await extractFromUrl(flags.url);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (flags.out) {
    mkdirSync(dirname(resolve(flags.out)), { recursive: true });
    writeFileSync(resolve(flags.out), json, "utf8");
    console.log(
      `${result.ok ? "ok" : "fail"}: ${result.words} words via ${result.extractor}` +
        `${result.reason && !result.ok ? ` (${result.reason})` : ""} -> ${flags.out}`,
    );
  } else {
    console.log(json);
  }
  if (!result.ok) process.exitCode = 1;
  return result;
}

if (isEntryPoint()) {
  await run();
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
