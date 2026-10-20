import { describe, expect, it } from "vitest";
import { canonicalizeUrl, dedup, parseRSS } from "../scripts/fetch-candidates.mjs";

describe("canonicalizeUrl", () => {
  it("strips tracking params and normalizes", () => {
    expect(canonicalizeUrl("http://example.com/a/?utm_source=x&foo=1#frag")).toBe(
      "https://example.com/a?foo=1",
    );
  });
  it("handles invalid input gracefully", () => {
    expect(canonicalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

describe("parseRSS", () => {
  it("extracts items with CDATA titles", () => {
    const xml = `<rss><channel><item><title><![CDATA[Hello]]></title><link>http://e.com/x?utm_source=1</link><pubDate>Mon, 01 Jan 2024</pubDate></item></item></channel></rss>`;
    const items = parseRSS(xml, "src");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Hello");
    expect(items[0].url).toBe("https://e.com/x");
  });
});

describe("dedup", () => {
  it("removes duplicates by canonical url", () => {
    const items = [
      { source: "a", title: "t", url: "http://e.com/x?utm_source=1", date: null },
      { source: "b", title: "t2", url: "https://e.com/x", date: null },
    ];
    expect(dedup(items)).toHaveLength(1);
  });
});
