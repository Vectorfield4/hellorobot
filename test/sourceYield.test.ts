import { describe, expect, it } from "vitest";
import { applyWeights, measureYield, planWeights, weightFor } from "../scripts/source-yield.mjs";

const candidate = (source: string, url: string, date: string | null = "2026-10-26") => ({
  source,
  title: `${source} story`,
  url,
  date,
});

const SOURCES = [
  { name: "The Robot Report", url: "https://www.therobotreport.com/feed/", weight: 1.1 },
  { name: "arXiv cs.RO", url: "http://rss.arxiv.org/rss/cs.RO", weight: 1.0 },
  { name: "Google News (en)", url: "https://news.google.com/rss", weight: 0.9 },
];

/** A tiny two-source run: one converts to a published article, one does not. */
function fixture() {
  const candidates = [
    candidate("The Robot Report", "https://www.therobotreport.com/a"),
    candidate("The Robot Report", "https://www.therobotreport.com/b"),
    candidate("Elsevier Robotics", "https://www.sciencedirect.com/x", "2026-10-20"),
  ];
  const shortlist = {
    window: { from: "2026-10-25", to: "2026-10-26", days: 3 },
    shortlist: [
      {
        title: "Eka raises $150M",
        url: "https://www.therobotreport.com/a",
        source: "The Robot Report",
        retold: [],
      },
      {
        title: "Unitree ships H2",
        url: "https://www.elsevier.com/robot",
        source: "Elsevier Robotics",
        retold: [],
      },
    ],
  };
  return { candidates, shortlist };
}

describe("weight formula", () => {
  it("maps a conversion rate onto the 0.6–1.2 band", () => {
    expect(weightFor(0)).toBe(0.6);
    expect(weightFor(0.1)).toBe(0.8);
    expect(weightFor(0.15)).toBe(0.9);
    expect(weightFor(0.3)).toBe(1.2);
    expect(weightFor(0.9)).toBe(1.2);
    expect(weightFor(null)).toBe(null);
  });
});

describe("source yield", () => {
  it("counts items, fresh, stories and published per source", () => {
    const { candidates, shortlist } = fixture();
    const report = measureYield({
      candidates,
      shortlist,
      publishedUrls: ["https://www.therobotreport.com/a"],
    });
    const robotReport = report.sources.find((row) => row.source === "The Robot Report");
    const elsevier = report.sources.find((row) => row.source === "Elsevier Robotics");

    expect(robotReport?.items).toBe(2);
    expect(robotReport?.fresh).toBe(2);
    expect(robotReport?.stories).toBe(1);
    expect(robotReport?.published).toBe(1);
    expect(robotReport?.publishedRate).toBe(1);
    expect(robotReport?.weight).toBe(1.2);

    // Stale: outside the window from the shortlist, so unmeasured, not zero.
    expect(elsevier?.fresh).toBe(0);
    expect(elsevier?.yield).toBe(null);
    expect(elsevier?.publishedRate).toBe(null);
    expect(elsevier?.weight).toBe(null);
    expect(elsevier?.reason).toContain("unmeasured");
  });

  it("leaves metrics null when the fresh count is zero", () => {
    const report = measureYield({
      candidates: [candidate("arXiv cs.RO", "http://rss.arxiv.org/rss/cs.RO/1", "2026-10-01")],
      shortlist: { window: { from: "2026-10-25", to: "2026-10-26" }, shortlist: [] },
    });

    expect(report.sources[0].fresh).toBe(0);
    expect(report.sources[0].yield).toBe(null);
    expect(report.sources[0].publishedRate).toBe(null);
  });

  it("counts a retold source as attached to the story but not as published", () => {
    const report = measureYield({
      candidates: [
        candidate("Google News (en)", "https://news.google.com/rss/articles/abc"),
        candidate("The Robot Report", "https://www.therobotreport.com/a"),
      ],
      shortlist: {
        window: { from: "2026-10-25", to: "2026-10-26" },
        shortlist: [
          {
            title: "Eka raises $150M",
            url: "https://www.therobotreport.com/a",
            source: "The Robot Report",
            retold: [
              { source: "Google News (en)", url: "https://news.google.com/rss/articles/abc" },
            ],
          },
        ],
      },
      publishedUrls: ["https://www.therobotreport.com/a"],
    });

    const google = report.sources.find((row) => row.source === "Google News (en)");
    expect(google?.stories).toBe(1);
    expect(google?.published).toBe(0);
    expect(google?.aggregator).toBe(true);
    expect(google?.weight).toBe(0.6);
  });

  it("is deterministic: the same input yields the same report", () => {
    const { candidates, shortlist } = fixture();
    const options = {
      candidates,
      shortlist,
      publishedUrls: ["https://www.therobotreport.com/a"],
    };

    expect(JSON.stringify(measureYield(options))).toBe(JSON.stringify(measureYield(options)));
  });
});

describe("apply", () => {
  const report = {
    inputs: { candidates: "c.json", shortlist: "s.json", articles: null, collected: null },
    ...measureYield({
      candidates: [
        candidate("The Robot Report", "https://www.therobotreport.com/a"),
        candidate("arXiv cs.RO", "http://rss.arxiv.org/rss/cs.RO/1"),
        candidate("arXiv cs.RO", "http://rss.arxiv.org/rss/cs.RO/2"),
      ],
      shortlist: {
        window: { from: "2026-10-25", to: "2026-10-26" },
        shortlist: [
          {
            title: "Eka raises $150M",
            url: "https://www.therobotreport.com/a",
            source: "The Robot Report",
            retold: [],
          },
        ],
      },
      publishedUrls: ["https://www.therobotreport.com/a"],
    }),
  };
  const sourcesText = `${JSON.stringify(SOURCES, null, 2)}\n`;

  it("only moves sources that were measured, and keeps the rest", () => {
    const plan = planWeights(report, SOURCES);
    const byName = new Map(plan.map((entry) => [entry.source, entry]));

    expect(byName.get("The Robot Report")?.to).toBe(1.2);
    expect(byName.get("arXiv cs.RO")?.to).toBe(0.6);
    // A source that returned nothing this run keeps its current weight.
    expect(byName.has("Google News (en)")).toBe(false);
  });

  it("rewrites only the weight numbers", () => {
    const plan = planWeights(report, SOURCES);
    const { text, changes } = applyWeights(sourcesText, plan);

    expect(changes).toHaveLength(2);
    expect(JSON.parse(text)[0].weight).toBe(1.2);
    expect(JSON.parse(text)[1].weight).toBe(0.6);
    expect(JSON.parse(text)[2].weight).toBe(0.9);
    // Everything else survives byte for byte.
    expect(text).toContain('"url": "http://rss.arxiv.org/rss/cs.RO"');
    expect(text.endsWith("]\n")).toBe(true);
  });

  it("is idempotent: a second apply changes no byte", () => {
    const plan = planWeights(report, SOURCES);
    const first = applyWeights(sourcesText, plan);
    const applied = JSON.parse(first.text);
    const second = applyWeights(first.text, planWeights(report, applied));

    expect(second.text).toBe(first.text);
    expect(second.changes).toHaveLength(0);
  });
});
