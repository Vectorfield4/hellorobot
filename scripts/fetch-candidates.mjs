#!/usr/bin/env node
// Key-free robotics news candidate fetcher.
// Usage: node scripts/fetch-candidates.mjs > candidates.json

const SOURCES = [
  { name: "arXiv cs.RO", url: "http://rss.arxiv.org/rss/cs.RO", type: "rss" },
  { name: "Google News (ru)", url: "https://news.google.com/rss/search?q=%D1%80%D0%BE%D0%B1%D0%BE%D1%82%D0%BE%D1%82%D0%B5%D1%85%D0%BD%D0%B8%D0%BA%D0%B0&hl=ru&gl=RU&ceid=RU:ru", type: "rss" },
  { name: "IEEE Spectrum (robots)", url: "https://spectrum.ieee.org/rss/robotics", type: "rss" },
  { name: "The Robot Report", url: "https://www.therobotreport.com/feed/", type: "rss" },
  { name: "Hacker News", url: "https://hn.algolia.com/api/v1/search?query=robotics&tags=story&hitsPerPage=20", type: "hn" },
  { name: "Reddit r/robotics", url: "https://www.reddit.com/r/robotics/new.json?limit=20", type: "reddit" },
];

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "hellorobot-fetcher/1.0" }, signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  for (const m of xml.matchAll(itemRe)) {
    const block = m[0];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || block.match(/<title>(.*?)<\/title>/i))?.[1]?.trim();
    const link = (block.match(/<link>(.*?)<\/link>/i))?.[1]?.trim();
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/i))?.[1]?.trim();
    if (title && link) items.push({ source, title, url: link, date: pubDate || null });
  }
  return items;
}

async function fetchSource(s) {
  try {
    const text = await fetchText(s.url);
    if (s.type === "rss") return parseRSS(text, s.name);
    if (s.type === "hn") {
      const json = JSON.parse(text);
      return (json.hits || []).map((h) => ({
        source: s.name,
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        date: h.created_at,
      }));
    }
    if (s.type === "reddit") {
      const json = JSON.parse(text);
      return (json.data?.children || []).map((c) => ({
        source: s.name,
        title: c.data.title,
        url: c.data.url,
        date: new Date(c.data.created_utc * 1000).toISOString(),
      }));
    }
    return [];
  } catch (e) {
    console.error(`[skip] ${s.name}: ${e.message}`);
    return [];
  }
}

const all = [];
for (const s of SOURCES) {
  const items = await fetchSource(s);
  all.push(...items);
}

// dedup by url
const seen = new Set();
const unique = all.filter((it) => {
  if (seen.has(it.url)) return false;
  seen.add(it.url);
  return true;
});

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

// ... (existing fetch code stays)

const json = JSON.stringify(unique, null, 2);
if (outFile) {
  const fs = await import("node:fs");
  fs.writeFileSync(outFile, json, "utf8");
  console.error(`Wrote ${unique.length} candidates to ${outFile}`);
} else {
  console.log(json);
  console.error(`Fetched ${all.length} items, ${unique.length} unique.`);
}
