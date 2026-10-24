import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalTag, TAG_ALIASES } from "../src/shared/config/productTags";

const CATALOG = JSON.parse(readFileSync(join(process.cwd(), "products/catalog.json"), "utf8")) as {
  currency: string;
  products: Array<Record<string, unknown>>;
};

const ALL_NAMES = new Set<string>(
  Object.entries(TAG_ALIASES).flatMap(([canon, aliases]) => [canon, ...aliases]),
);

const PRICE_FIELDS = ["price", "regular_price", "sale_price", "prices", "cost"];

describe("products/catalog.json", () => {
  it("не содержит цен: цену называем по телефону", () => {
    for (const product of CATALOG.products) {
      for (const field of PRICE_FIELDS) {
        expect(product).not.toHaveProperty(field);
      }
    }
  });

  it("sku уникальны и непустые", () => {
    const skus = CATALOG.products.map((product) => String(product.sku ?? ""));
    expect(skus.every(Boolean)).toBe(true);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("каждый тег товара существует в словаре блога", () => {
    for (const product of CATALOG.products) {
      const tags = Array.isArray(product.tags) ? product.tags.map(String) : [];
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(ALL_NAMES.has(tag) || canonicalTag(tag) === tag).toBe(true);
      }
    }
  });

  it("review_note не обещает цену", () => {
    for (const product of CATALOG.products) {
      const note = String(product.review_note ?? "").toLowerCase();
      expect(note).not.toContain("цен");
      expect(note).not.toContain("price");
    }
  });
});
