import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addEntry, dayFile, exportEntries, prune, readLog } from "../scripts/collected.mjs";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "collected-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("collected log", () => {
  it("writes a dated file with a ttl and an expiry", () => {
    const log = addEntry(dir, {
      slug: "tesla-optimus",
      sourceUrl: "https://example.com/tesla",
      wpId: 84,
      date: "2026-10-24",
      ttl: 7,
    });

    expect(log.date).toBe("2026-10-24");
    expect(log.expires).toBe("2026-10-31");
    expect(log.items).toHaveLength(1);
    expect(log.items[0]).toMatchObject({
      slug: "tesla-optimus",
      source_url: "https://example.com/tesla",
      wp_id: 84,
    });
    expect(readFileSync(dayFile(dir, "2026-10-24"), "utf8")).toContain("ttl_days: 7");
  });

  it("keeps one entry per slug and only fills a late wp_id", () => {
    addEntry(dir, { slug: "a", sourceUrl: "https://example.com/a", date: "2026-10-24" });
    const log = addEntry(dir, {
      slug: "a",
      sourceUrl: "https://example.com/a",
      wpId: 90,
      date: "2026-10-24",
    });

    expect(log.items).toHaveLength(1);
    expect(log.items[0].wp_id).toBe(90);
  });

  it("exports entries in the shape published-check reads through --wp", () => {
    addEntry(dir, { slug: "a", sourceUrl: "https://example.com/a", wpId: 7, date: "2026-10-24" });

    expect(exportEntries(dir)).toEqual([
      {
        slug: "a",
        link: "https://example.com/a",
        source_url: "https://example.com/a",
        status: "collected",
        id: 7,
      },
    ]);
  });

  it("prunes only the files whose ttl is over", () => {
    addEntry(dir, {
      slug: "old",
      sourceUrl: "https://example.com/old",
      date: "2026-01-01",
      ttl: 1,
    });
    addEntry(dir, {
      slug: "fresh",
      sourceUrl: "https://example.com/new",
      date: "2026-10-24",
      ttl: 7,
    });

    const removed = prune(dir, "2026-10-25");

    expect(removed.map((log) => log.date)).toEqual(["2026-01-01"]);
    expect(readLog(dir, "2026-01-01")).toBeNull();
    expect(readLog(dir, "2026-10-24")).not.toBeNull();
  });

  it("keeps a file that expires today", () => {
    addEntry(dir, {
      slug: "edge",
      sourceUrl: "https://example.com/edge",
      date: "2026-10-24",
      ttl: 1,
    });

    expect(prune(dir, "2026-10-25")).toHaveLength(0);
    expect(readLog(dir, "2026-10-24")).not.toBeNull();
  });
});
