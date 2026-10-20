import { describe, expect, it } from "vitest";
import { createT } from "../src/shared/i18n/t";

describe("createT", () => {
  it("resolves nested keys", () => {
    const t = createT({ home: { title: "hi" } });
    expect(t("home.title")).toBe("hi");
  });
  it("returns key when missing", () => {
    const t = createT({});
    expect(t("missing")).toBe("missing");
  });
});
