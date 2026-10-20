#!/usr/bin/env node

// Universal article extractor (no API keys).
// Usage: node scripts/extract-article.mjs <url> [--out file.json]

import { writeFileSync } from "node:fs";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/extract-article.mjs <url> [--out file.json]");
  process.exit(1);
}

const outIdx = process.argv.indexOf("--out");
const outFile = outIdx >= 0 ? process.argv[outIdx + 1] : null;

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20000);
let html;
try {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: controller.signal,
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  html = await res.text();
} finally {
  clearTimeout(timer);
}

const dom = new JSDOM(html, { url });
const reader = new Readability(dom.window.document);
const article = reader.parse();

const result = article
  ? {
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      content: article.content,
      textContent: article.textContent,
      siteName: article.siteName,
      url,
    }
  : { error: "Could not extract article", url };

const json = JSON.stringify(result, null, 2);
if (outFile) {
  writeFileSync(outFile, json, "utf8");
  console.error(outFile ? `Wrote ${outFile}` : "");
} else {
  console.log(json);
}
