#!/usr/bin/env node
// Key-free robotics news candidate fetcher.
// Usage: node scripts/fetch-candidates.mjs [--out file.json]

export function canonicalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.protocol = "https:";
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (/^utm_/i.test(p) || /^(fbclid|gclid|ref|source)$/i.test(p)) u.searchParams.delete(p);
    }
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    u.pathname = path;
    return u.toString();
  } catch {
    return raw;
  }
}

export function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  for (const m of xml.matchAll(itemRe)) {
    const block = m[0];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
      block.match(/<title>(.*?)<\/title>/i))?.[1]?.trim();
    const link = block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1]?.trim();
    if (title && link)
      items.push({ source, title, url: canonicalizeUrl(link), date: pubDate || null });
  }
  return items;
}

export function parseAtom(xml, source) {
  const items = [];
  const entryRe = /<entry[\s\S]*?<\/entry>/gi;
  for (const m of xml.matchAll(entryRe)) {
    const block = m[0];
    const title = block.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim();
    const link = block.match(/<link[^>]*href=["'](.*?)["']/i)?.[1]?.trim();
    const updated = block.match(/<(updated|published)>(.*?)<\/\1>/i)?.[2]?.trim();
    if (title && link)
      items.push({ source, title, url: canonicalizeUrl(link), date: updated || null });
  }
  return items;
}

export function dedup(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = canonicalizeUrl(it.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SOURCES = [
  { name: "arXiv cs.RO", url: "http://rss.arxiv.org/rss/cs.RO", type: "rss" },
  { name: "IEEE Spectrum (robots)", url: "https://spectrum.ieee.org/rss/robotics", type: "rss" },
  { name: "The Robot Report", url: "https://www.therobotreport.com/feed/", type: "rss" },
  {
    name: "TechCrunch (Robotics)",
    url: "https://techcrunch.com/category/robotics/feed/",
    type: "rss",
  },
  { name: "Wired (all)", url: "https://www.wired.com/feed/", type: "rss" },
  { name: "ROS Discourse", url: "https://discourse.ros.org/latest.rss", type: "rss" },
  {
    name: "Hacker News",
    url: "https://hn.algolia.com/api/v1/search?query=robotics&tags=story&hitsPerPage=20",
    type: "hn",
  },
];

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "hellorobot-fetcher/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(s) {
  try {
    const text = await fetchText(s.url);
    if (s.type === "rss") return parseRSS(text, s.name);
    if (s.type === "atom") return parseAtom(text, s.name);
    if (s.type === "hn") {
      const json = JSON.parse(text);
      return (json.hits || []).map((h) => ({
        source: s.name,
        title: h.title,
        url: canonicalizeUrl(h.url || `https://news.ycombinator.com/item?id=${h.objectID}`),
        date: h.created_at,
      }));
    }
    return [];
  } catch (e) {
    console.error(`[skip] ${s.name}: ${e.message}`);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;

  const all = [];
  for (const s of SOURCES) {
    const items = await fetchSource(s);
    all.push(...items);
  }
  const unique = dedup(all);

  const json = JSON.stringify(unique, null, 2);
  if (outFile) {
    const fs = await import("node:fs");
    fs.writeFileSync(outFile, json, "utf8");
    console.error(`Wrote ${unique.length} candidates to ${outFile}`);
  } else {
    console.log(json);
    console.error(`Fetched ${all.length} items, ${unique.length} unique.`);
  }
}

if (process.argv[1]?.endsWith("fetch-candidates.mjs")) main();
