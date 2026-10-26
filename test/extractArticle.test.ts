import { describe, expect, it } from "vitest";
import {
  charsetOf,
  decodeHtml,
  extract,
  normalizeDate,
  pickPublisher,
} from "../scripts/extract-article.mjs";
import { MIN_NEWS_WORDS } from "../scripts/triage-candidates.mjs";

/** Enough real words to clear the body gate. */
const longBody = (subject: string) =>
  Array.from({ length: 70 }, (_, index) => `${subject} sentence ${index} about the robot.`).join(
    " ",
  );

const page = (head: string, body: string) =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("extraction ladder", () => {
  it("prefers the JSON-LD articleBody over a publisher selector", () => {
    const html = page(
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "The Robot Report" },
          {
            "@type": "NewsArticle",
            headline: "Eka Robotics raises $150M",
            datePublished: "2026-10-24T12:34:27+00:00",
            articleBody: longBody("Structured"),
          },
        ],
      })}</script>`,
      `<article><h1>Eka Robotics raises $150M</h1>
        <div class="entry-content">${longBody("Selector")}</div></article>`,
    );

    const result = extract(html, "https://www.therobotreport.com/eka");

    expect(result.extractor).toBe("json-ld");
    expect(result.title).toBe("Eka Robotics raises $150M");
    expect(result.date).toBe("2026-10-24");
    expect(result.text).toContain("Structured sentence");
    expect(result.text).not.toContain("Selector sentence");
    expect(result.ok).toBe(true);
  });

  it("beats the generic heuristic with the publisher selector", () => {
    const html = page(
      `<meta property="og:title" content="OMRON acquires OnLogic" />
       <meta property="article:published_time" content="2026-10-26T08:00:00+00:00" />`,
      `<div class="site-wrap">
         <div class="sidebar"><p>${longBody("Sidebar")}</p></div>
         <article><h1>OMRON acquires OnLogic</h1>
           <div class="entry-content"><p>${longBody("Publisher")}</p></div>
         </article>
       </div>`,
    );

    const result = extract(html, "https://www.therobotreport.com/omron-onlogic");

    expect(result.extractor).toBe("publisher:therobotreport.com");
    expect(result.text).toContain("Publisher sentence");
    expect(result.text).not.toContain("Sidebar sentence");
    expect(result.date).toBe("2026-10-26");
  });

  it("falls back to the densest paragraph container when the publisher is unknown", () => {
    const html = page(
      `<title>Unitree shows H2 humanoid - Example News</title>`,
      `<nav><a href="/a">Home</a><a href="/b">Robots</a></nav>
       <div class="layout">
         <aside><p>${longBody("Aside")}</p></aside>
         <div class="story"><h1>Unitree shows H2 humanoid</h1>
           <p>${longBody("Generic")}</p></div>
       </div>
       <footer>Example News, all rights reserved</footer>`,
    );

    const result = extract(html, "https://example.test/unitree-h2");

    expect(result.extractor).toBe("generic");
    expect(result.text).toContain("Generic sentence");
    expect(result.ok).toBe(true);
    expect(result.title).toBe("Unitree shows H2 humanoid");
  });

  it("keeps navigation, footer and aside text out of the body", () => {
    const html = page(
      "",
      `<div id="page">
         <nav class="breadcrumbs">NAVIGATION MARKER</nav>
         <article><p>${longBody("Story")}</p></article>
         <aside>ASIDE MARKER</aside>
         <footer>FOOTER MARKER</footer>
       </div>`,
    );

    const result = extract(html, "https://example.test/noise");

    expect(result.text).toContain("Story sentence");
    for (const marker of ["NAVIGATION MARKER", "ASIDE MARKER", "FOOTER MARKER"]) {
      expect(result.text).not.toContain(marker);
    }
  });

  it("fails a short or empty body instead of calling it a story", () => {
    const html = page("", `<article><div class="entry-content"><p>Too short.</p></div></article>`);

    const result = extract(html, "https://www.therobotreport.com/stub");

    expect(result.ok).toBe(false);
    expect(result.words).toBeLessThan(MIN_NEWS_WORDS);
    expect(result.reason).toContain("too-short");
  });

  it("decodes a shift_jis page whose charset is declared only in a meta tag", () => {
    // ロボット in shift_jis: each kana is two bytes.
    const kana = [0x83, 0x8d, 0x83, 0x7b, 0x83, 0x62, 0x83, 0x67];
    const head = Buffer.from(
      '<meta http-equiv="content-type" content="text/html;charset=shift_jis"><title>',
      "latin1",
    );
    const bytes = new Uint8Array([...head, ...kana, ...Buffer.from("</title>", "latin1")]);

    expect(charsetOf(bytes, "text/html")).toBe("shift_jis");
    expect(decodeHtml(bytes, "text/html")).toContain("ロボット");
  });

  it("reads the gb1323 typo as gb18030 rather than throwing", () => {
    // 机器人 in gb18030.
    const han = [0xbb, 0xfa, 0xc6, 0xf7, 0xc8, 0xcb];
    const head = Buffer.from('<meta charset="gb1323"><p>', "latin1");
    const bytes = new Uint8Array([...head, ...han, ...Buffer.from("</p>", "latin1")]);

    expect(decodeHtml(bytes, "text/html")).toContain("机器人");
  });
});

describe("publisher table", () => {
  it("matches a publisher by host, including a subdomain", () => {
    expect(
      pickPublisher("https://monoist.itmedia.co.jp/mn/articles/2610/23/news021.html")?.host,
    ).toBe("itmedia.co.jp");
    expect(pickPublisher("https://www.robot-china.com/news/202610/26/97144.html")?.selector).toBe(
      "#content",
    );
    expect(pickPublisher("https://example.test/story")).toBe(null);
  });
});

describe("dates", () => {
  it("normalises ISO, CJK and English dates to YYYY-MM-DD", () => {
    expect(normalizeDate("2026-10-24T12:34:27+00:00")).toBe("2026-10-24");
    expect(normalizeDate("日期：2026-10-26")).toBe("2026-10-26");
    expect(normalizeDate("2026年10月26日 06:00")).toBe("2026-10-26");
    expect(normalizeDate("Published: Oct 22, 2026 10:27 PM")).toBe("2026-10-22");
    expect(normalizeDate("")).toBe(null);
    expect(normalizeDate("no date here")).toBe(null);
  });
});
