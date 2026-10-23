import { describe, expect, it } from "vitest";
import { formatDate } from "../src/shared/lib/formatDate";

describe("formatDate", () => {
  it("localizes a plain ISO date", () => {
    expect(formatDate("2026-10-23")).toBe("23 октября 2026");
  });

  it("drops the meaningless time part", () => {
    expect(formatDate("2026-10-23T12:00:00")).toBe("23 октября 2026");
    expect(formatDate("2026-10-23T12:00:00+03:00")).toBe("23 октября 2026");
  });

  it("covers every month", () => {
    expect(formatDate("2026-01-01")).toBe("1 января 2026");
    expect(formatDate("2026-05-09")).toBe("9 мая 2026");
    expect(formatDate("2026-12-31")).toBe("31 декабря 2026");
  });

  it("returns an empty string for missing values", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate("   ")).toBe("");
  });

  it("keeps unparseable values untouched", () => {
    expect(formatDate("вчера")).toBe("вчера");
    expect(formatDate("2026-02-31")).toBe("2026-02-31");
  });
});
