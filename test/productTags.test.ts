import { describe, expect, it } from "vitest";
import {
  canonicalTag,
  normalizeTag,
  sharedTags,
  sharesTag,
} from "../src/shared/config/productTags";

describe("normalizeTag", () => {
  it("снимает регистр, ё и пунктуацию", () => {
    expect(normalizeTag("Гуманоиды!")).toBe("гуманоиды");
    expect(normalizeTag("  Ёжик  в  тумане ")).toBe("ежик в тумане");
    expect(normalizeTag("ROS 2")).toBe("ros 2");
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag(undefined)).toBe("");
  });
});

describe("canonicalTag", () => {
  it("сводит английские варианты к русскому канону", () => {
    expect(canonicalTag("Humanoid robots")).toBe("гуманоиды");
    expect(canonicalTag("humanoid")).toBe("гуманоиды");
    expect(canonicalTag("COBOTS")).toBe("коботы");
    expect(canonicalTag("soft robotics")).toBe("мягкая робототехника");
    expect(canonicalTag("robot dog")).toBe("роботы");
  });

  it("оставляет неизвестный тег как есть", () => {
    expect(canonicalTag("Boston Dynamics")).toBe("boston dynamics");
    expect(canonicalTag("гуманоиды")).toBe("гуманоиды");
  });

  it("сводит близкие русские теги блога к одному канону", () => {
    expect(canonicalTag("автономия")).toBe("автономность");
    expect(canonicalTag("манипуляция")).toBe("манипуляторы");
    expect(canonicalTag("манипуляции")).toBe("манипуляторы");
  });
});

describe("sharedTags", () => {
  it("находит пересечение по канону", () => {
    expect(sharedTags(["гуманоиды", "Boston Dynamics"], ["humanoid", "роботы"])).toEqual([
      "гуманоиды",
    ]);
  });

  it("не дублирует канон", () => {
    expect(sharedTags(["гуманоиды", "Humanoid"], ["humanoid robots"])).toEqual(["гуманоиды"]);
  });

  it("пустые списки не дают совпадений", () => {
    expect(sharedTags([], ["гуманоиды"])).toEqual([]);
    expect(sharesTag(["гуманоиды"], [])).toBe(false);
    expect(sharesTag(["коботы"], ["гуманоиды"])).toBe(false);
    expect(sharesTag(["коботы"], ["Cobot"])).toBe(true);
  });
});
