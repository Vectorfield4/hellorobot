import { describe, expect, it } from "vitest";
import { formatDateRange } from "../src/shared/lib/formatDateRange";

describe("formatDateRange", () => {
  it("collapses a single month to `day–day mon`", () => {
    expect(formatDateRange(["2026-10-18", "2026-10-23", "2026-10-20"])).toBe("18–23 окт");
  });

  it("ignores the time part of a timestamp", () => {
    expect(formatDateRange(["2026-10-23T12:00:00+03:00", "2026-10-18T23:59:59"])).toBe("18–23 окт");
  });

  it("names both months when the page spans two", () => {
    expect(formatDateRange(["2026-09-28", "2026-10-03"])).toBe("28 сен – 3 окт");
  });

  it("adds years only when they differ", () => {
    expect(formatDateRange(["2025-12-28", "2026-01-03"])).toBe("28 дек 2025 – 3 янв 2026");
  });

  it("collapses a repeated day", () => {
    expect(formatDateRange(["2026-10-23", "2026-10-23T08:00:00"])).toBe("23 окт");
  });

  it("returns an em dash when no date parses", () => {
    expect(formatDateRange([])).toBe("—");
    expect(formatDateRange(["вчера", "", "2026-02-31"])).toBe("—");
  });

  it("skips unparseable values instead of dropping the range", () => {
    expect(formatDateRange(["вчера", "2026-10-18", "2026-10-23"])).toBe("18–23 окт");
  });
});
