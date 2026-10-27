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

describe("attribution", () => {
  /** A run where the feed that found the story is not the site the article quotes. */
  const bedrock = {
    candidates: [
      {
        source: "Google News (en)",
        title: "Bedrock Robotics raises $600M at $4.1B valuation",
        url: "https://news.google.com/rss/articles/bedrock",
        date: "2026-10-26",
      },
      {
        source: "Agility Robotics",
        title: "GXO and Agility Robotics expand partnership",
        url: "https://www.agilityrobotics.com/press/gxo-expansion",
        date: "2026-10-26",
      },
    ],
    shortlist: {
      window: { from: "2026-10-26", to: "2026-10-27" },
      shortlist: [
        {
          title: "Bedrock Robotics raises $600M at $4.1B valuation",
          url: "https://techcrunch.com/2026/10/26/bedrock-robotics/",
          source: "Google News (en)",
          retold: [
            {
              source: "Google News (zh)",
              url: "https://news.google.com/rss/articles/bedrock-zh",
              title: "Bedrock Robotics 获得6亿美元融资",
            },
          ],
        },
      ],
    },
  };

  it("credits the feed that surfaced the story, not the host the article quotes", () => {
    const report = measureYield({
      ...bedrock,
      articles: [
        {
          title: "Bedrock Robotics закрыла $600 млн при оценке $4,1 млрд",
          url: "https://thenextweb.com/news/bedrock-robotics-600m-series-c",
        },
      ],
    });

    const google = report.sources.find((row) => row.source === "Google News (en)");
    expect(google?.stories).toBe(1);
    expect(google?.surfaced).toBe(1);
    // The aggregator's own host is never what we quote: cited stays zero.
    expect(google?.cited).toBe(0);
    expect(google?.publishedRate).toBe(1);
    expect(google?.weight).toBe(1.2);
    expect(report.totals.via.story).toBe(1);
    expect(report.totals.unattributed).toBe(0);
  });

  it("credits the retold feed whose URL the article quotes", () => {
    const report = measureYield({
      candidates: [
        bedrock.candidates[0],
        {
          source: "The Robot Report",
          title: "A welding cell buyer's guide",
          url: "https://www.therobotreport.com/welding-guide",
          date: "2026-10-26",
        },
      ],
      shortlist: {
        window: { from: "2026-10-26", to: "2026-10-27" },
        shortlist: [
          {
            title: "Bedrock Robotics raises $600M at $4.1B valuation",
            url: "https://techcrunch.com/2026/10/26/bedrock-robotics/",
            source: "Google News (en)",
            retold: [
              {
                source: "The Robot Report",
                url: "https://www.therobotreport.com/bedrock-robotics-600m/",
                title: "Bedrock Robotics raises a $600M Series C",
              },
            ],
          },
        ],
      },
      articles: [
        {
          title: "Нечто, чего кластер по заголовку не знает",
          url: "https://www.therobotreport.com/bedrock-robotics-600m/",
        },
      ],
    });

    const google = report.sources.find((row) => row.source === "Google News (en)");
    const trade = report.sources.find((row) => row.source === "The Robot Report");

    expect(report.totals.via.story).toBe(1);
    // Credit goes to the item that matched: the retold entry carried this URL,
    // the cluster's keeper did not, so only the retold feed is credited.
    expect(trade?.surfaced).toBe(1);
    expect(trade?.cited).toBe(1);
    expect(google?.surfaced).toBe(0);
    expect(google?.cited).toBe(0);
  });

  it("counts a host-only match, says so, and keeps it out of the rate", () => {
    const report = measureYield({
      candidates: [candidate("The Robot Report", "https://www.therobotreport.com/a")],
      shortlist: {
        window: { from: "2026-10-26", to: "2026-10-27" },
        shortlist: [
          {
            title: "Eka raises $150M",
            url: "https://www.therobotreport.com/a",
            source: "The Robot Report",
            retold: [],
          },
        ],
      },
      publishedUrls: ["https://www.therobotreport.com/omron-acquires-onlogic"],
    });

    const row = report.sources[0];
    expect(row.surfaced).toBe(0);
    expect(row.published).toBe(1);
    expect(row.hostAttributed).toBe(1);
    expect(row.cited).toBe(1);
    expect(row.publishedRate).toBe(0);
    expect(row.reason).toContain("by host only");
    // The arbitration is in the report, not only in the totals.
    expect(report.attributions).toEqual([
      {
        url: "https://www.therobotreport.com/omron-acquires-onlogic",
        title: null,
        via: "host",
        sources: ["The Robot Report"],
      },
    ]);
  });

  it("stops the five-publications-for-one-story artefact", () => {
    const report = measureYield({
      candidates: [
        candidate("The Robot Report", "https://www.therobotreport.com/a"),
        candidate("The Robot Report", "https://www.therobotreport.com/b"),
        candidate("The Robot Report", "https://www.therobotreport.com/c"),
      ],
      shortlist: {
        window: { from: "2026-10-26", to: "2026-10-27" },
        shortlist: [
          {
            title: "Eka raises $150M",
            url: "https://www.therobotreport.com/a",
            source: "The Robot Report",
            retold: [],
          },
        ],
      },
      articles: [
        { title: "Eka raises $150M", url: "https://www.therobotreport.com/a" },
        {
          title: "A welding cell buyer's guide",
          url: "https://www.therobotreport.com/welding-guide",
        },
        {
          title: "OMRON to acquire OnLogic",
          url: "https://www.therobotreport.com/omron-acquires-onlogic",
        },
      ],
    });

    const row = report.sources[0];
    expect(row.stories).toBe(1);
    expect(row.surfaced).toBe(1);
    expect(row.cited).toBe(3);
    expect(row.published).toBe(3);
    expect(row.hostAttributed).toBe(2);
    // The old rule gave 3 published / 1 story = 3.00 here.
    expect(row.publishedRate).toBe(1);
  });

  it("leaves an article quoted from a host outside the lane unattributed", () => {
    const report = measureYield({
      candidates: [candidate("The Robot Report", "https://www.therobotreport.com/a")],
      shortlist: { window: { from: "2026-10-26", to: "2026-10-27" }, shortlist: [] },
      articles: [{ title: "Anthropic counted the robots", url: "https://www.01net.com/x" }],
    });

    expect(report.totals.unattributed).toBe(1);
    expect(report.totals.via.none).toBe(1);
    expect(report.sources[0].published).toBe(0);
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
