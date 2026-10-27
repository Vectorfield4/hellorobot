import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { LaneRunner } from "../scripts/asia-lane.mjs";
import {
  asiaSources,
  capCandidates,
  dedupeByUrl,
  emptySources,
  fetchLane,
  run,
} from "../scripts/asia-lane.mjs";

const item = (source: string, index: number, date: string | null) => ({
  source,
  title: `${source} ${index}`,
  url: `https://example.test/${source}/${index}`,
  date,
});

/** The three publishers of a small lane: two of them are the slow Chinese ones. */
const LANE = [
  { name: "MONOist", url: "https://a.test", lang: "ja" },
  { name: "中国机器人网", url: "https://b.test", lang: "zh" },
  { name: "雷锋网 Leiphone", url: "https://c.test", lang: "zh" },
];

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

describe("emptySources", () => {
  it("names the publishers that returned nothing, in lane order", () => {
    const missing = emptySources(LANE, [item("雷锋网 Leiphone", 1, "2026-10-26")]);

    expect(missing.map((source) => source.name)).toEqual(["MONOist", "中国机器人网"]);
  });
});

describe("dedupeByUrl", () => {
  it("collapses the same article under two spellings of its URL", () => {
    const merged = dedupeByUrl([
      { ...item("MONOist", 1, "2026-10-26"), url: "https://www.robot-china.com/news/1?utm=x" },
      { ...item("中国机器人网", 1, "2026-10-26"), url: "https://robot-china.com/news/1/" },
      { ...item("中国机器人网", 2, "2026-10-26"), url: "https://robot-china.com/news/2" },
    ]);

    expect(merged.map((entry) => entry.url)).toEqual([
      "https://www.robot-china.com/news/1?utm=x",
      "https://robot-china.com/news/2",
    ]);
  });
});

describe("fetchLane", () => {
  it("retries the empty publishers once and merges what came back", () => {
    const calls: { pass: number; names: string[] }[] = [];
    const runner: LaneRunner = ({ sources, pass }) => {
      calls.push({ pass, names: sources.map((source) => source.name) });
      if (pass === 1) return [item("MONOist", 1, "2026-10-26")];
      return [item("中国机器人网", 1, null), item("雷锋网 Leiphone", 1, "2026-10-26")];
    };

    const lane = fetchLane(LANE, runner);

    expect(calls).toHaveLength(2);
    // The second pass asks only for the publishers that were silent.
    expect(calls[1]).toEqual({ pass: 2, names: ["中国机器人网", "雷锋网 Leiphone"] });
    expect(lane.items).toHaveLength(3);
    expect(lane.retried).toEqual(["中国机器人网", "雷锋网 Leiphone"]);
    expect(lane.recovered).toEqual(["中国机器人网", "雷锋网 Leiphone"]);
    expect(lane.stillEmpty).toEqual([]);
  });

  it("makes one pass when every publisher answered", () => {
    const runner = vi.fn<LaneRunner>(({ sources }) =>
      sources.map((source, index) => item(source.name, index, "2026-10-26")),
    );

    const lane = fetchLane(LANE, runner);

    expect(runner).toHaveBeenCalledTimes(1);
    expect(lane.retried).toEqual([]);
    expect(lane.items).toHaveLength(3);
  });

  it("does not call a third time when the retry is empty too", () => {
    const runner = vi.fn<LaneRunner>(() => [item("MONOist", 1, "2026-10-26")]);

    const lane = fetchLane(LANE, runner);

    expect(runner).toHaveBeenCalledTimes(2);
    expect(lane.retried).toEqual(["中国机器人网", "雷锋网 Leiphone"]);
    expect(lane.recovered).toEqual([]);
    // A second empty answer is an answer, and it is said out loud.
    expect(lane.stillEmpty).toEqual(["中国机器人网", "雷锋网 Leiphone"]);
  });

  it("splits a partly recovered retry into recovered and still empty", () => {
    const runner: LaneRunner = ({ sources, pass }) =>
      pass === 1
        ? [item("MONOist", 1, "2026-10-26")]
        : sources
            .filter((source) => source.name === "中国机器人网")
            .map((source, index) => item(source.name, index, "2026-10-26"));

    const lane = fetchLane(LANE, runner);

    expect(lane.recovered).toEqual(["中国机器人网"]);
    expect(lane.stillEmpty).toEqual(["雷锋网 Leiphone"]);
  });
});

describe("run", () => {
  it("keeps the pool a bare array and records the retry in the metadata file", () => {
    const dir = mkdtempSync(join(tmpdir(), "asia-lane-"));
    const sourcesPath = join(dir, "sources.json");
    writeFileSync(
      sourcesPath,
      `${JSON.stringify([
        { name: "MONOist", url: "https://a.test", lang: "ja" },
        { name: "中国机器人网", url: "https://b.test", lang: "zh" },
        { name: "The Robot Report", url: "https://c.test", lang: "en" },
      ])}\n`,
      "utf8",
    );
    const runner: LaneRunner = ({ sources, pass }) =>
      pass === 1
        ? [item("MONOist", 1, "2026-10-26")]
        : sources
            .filter((source) => source.name === "中国机器人网")
            .map((source, index) => item(source.name, index, null));

    try {
      const result = run(
        ["--date", "2026-10-27", "--cap", "5", "--sources", sourcesPath, "--research-dir", dir],
        {
          runner,
        },
      );

      const pool = JSON.parse(readFileSync(join(dir, "candidates-asia-2026-10-27.json"), "utf8"));
      const meta = JSON.parse(
        readFileSync(join(dir, "candidates-asia-2026-10-27.meta.json"), "utf8"),
      );

      expect(Array.isArray(pool)).toBe(true);
      expect(pool).toHaveLength(2);
      expect(meta.retried).toEqual(["中国机器人网"]);
      expect(meta.recovered).toEqual(["中国机器人网"]);
      expect(meta.stillEmpty).toEqual([]);
      expect(meta.lane).toEqual(["MONOist", "中国机器人网"]);
      expect(result.recovered).toEqual(["中国机器人网"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
