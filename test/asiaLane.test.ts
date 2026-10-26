import { describe, expect, it } from "vitest";
import { asiaSources, capCandidates } from "../scripts/asia-lane.mjs";

const item = (source: string, index: number, date: string | null) => ({
  source,
  title: `${source} ${index}`,
  url: `https://example.test/${source}/${index}`,
  date,
});

describe("asiaSources", () => {
  it("keeps only the ja and zh sources and leaves the list order alone", () => {
    const sources = [
      { name: "The Robot Report", url: "https://a.test", lang: "en" },
      { name: "MONOist", url: "https://b.test", lang: "ja" },
      { name: "中国机器人网", url: "https://c.test", lang: "zh" },
      { name: "KUKA", url: "https://d.test", lang: "en" },
    ];

    expect(asiaSources(sources).map((source) => source.name)).toEqual(["MONOist", "中国机器人网"]);
  });
});

describe("capCandidates", () => {
  it("takes the freshest dated items first inside a source", () => {
    const capped = capCandidates(
      [
        item("MONOist", 1, "2026-10-20"),
        item("MONOist", 2, "2026-10-26"),
        item("MONOist", 3, "2026-10-23"),
      ],
      { cap: 2 },
    );

    expect(capped.items.map((entry) => entry.url)).toEqual([
      "https://example.test/MONOist/2",
      "https://example.test/MONOist/3",
    ]);
    expect(capped.dropped).toBe(1);
  });

  it("caps undated listing items positionally per source", () => {
    const items = Array.from({ length: 25 }, (_, index) => item("中国机器人网", index, null));
    const capped = capCandidates(items, { cap: 100, undatedCap: 20 });

    expect(capped.perSource[0].available).toBe(20);
    expect(capped.items).toHaveLength(20);
    expect(capped.dropped).toBe(5);
    // Positional: the top of the listing survives, the tail does not.
    expect(capped.items[0].url).toBe("https://example.test/中国机器人网/0");
  });

  it("shares the cap between publishers instead of one dated feed taking it all", () => {
    const items = [
      ...Array.from({ length: 40 }, (_, index) => item("Google News (ja)", index, "2026-10-26")),
      ...Array.from({ length: 40 }, (_, index) => item("Google News (zh)", index, "2026-10-26")),
      item("MONOist", 1, "2026-10-26"),
      item("ロボスタ", 1, "2026-10-25"),
    ];
    const capped = capCandidates(items, { cap: 8 });
    const kept = (source: string) =>
      capped.perSource.find((row) => row.source === source)?.kept ?? 0;

    expect(capped.items).toHaveLength(8);
    expect(kept("MONOist")).toBe(1);
    expect(kept("ロボスタ")).toBe(1);
    expect(kept("Google News (ja)")).toBe(3);
    expect(kept("Google News (zh)")).toBe(3);
  });

  it("never returns more than the cap, even when every source has one item", () => {
    const items = Array.from({ length: 9 }, (_, index) => item(`src-${index}`, 1, "2026-10-26"));
    const capped = capCandidates(items, { cap: 4 });

    expect(capped.items).toHaveLength(4);
    expect(capped.dropped).toBe(5);
  });
});
