import { describe, expect, it } from "vitest";
import type { Product } from "../src/shared/data/product";
import { getRelatedProducts } from "../src/shared/data/products";

function product(id: number, name: string, tags: string[]): Product {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    sku: `HR-TEST-${id}`,
    tags: tags.map((tag, index) => ({ id: index + 1, name: tag, slug: tag })),
  } as Product;
}

const names = (products: Product[]) => products.map((item) => item.name);

describe("getRelatedProducts", () => {
  it("редкий общий тег весит больше частого", () => {
    const catalog = [
      product(1, "Кобот", ["манипуляторы"]),
      product(2, "Второй кобот", ["манипуляторы"]),
      product(3, "Инспекционный ровер", ["инспекция"]),
    ];

    const related = getRelatedProducts(catalog, ["манипуляторы", "инспекция"], {
      limit: 3,
      seed: "x",
    });

    expect(names(related)[0]).toBe("Инспекционный ровер");
  });

  it("одинаковое зерно даёт одинаковый срез, разные зёрна — разные", () => {
    const catalog = [
      product(1, "Mercury", ["гуманоиды"]),
      product(2, "Microduck", ["гуманоиды"]),
      product(3, "Reachy 2", ["гуманоиды"]),
      product(4, "Reachy Mini", ["гуманоиды"]),
      product(5, "Unitree G1", ["гуманоиды"]),
      product(6, "Loona", ["гуманоиды"]),
    ];

    const same = getRelatedProducts(catalog, ["гуманоиды"], { limit: 5, seed: "tesla-optimus" });
    const sameAgain = getRelatedProducts(catalog, ["гуманоиды"], {
      limit: 5,
      seed: "tesla-optimus",
    });
    expect(names(same)).toEqual(names(sameAgain));

    const slices = new Set(
      ["tesla-optimus", "figure-helix", "audi-agile", "gemini-robotics", "idc-humanoid"].map(
        (seed) => names(getRelatedProducts(catalog, ["гуманоиды"], { limit: 3, seed })).join("|"),
      ),
    );
    expect(slices.size).toBeGreaterThan(1);
  });

  it("без общего тега список пуст", () => {
    const catalog = [product(1, "Кобот", ["коботы"])];
    expect(getRelatedProducts(catalog, ["гуманоиды"], { limit: 3, seed: "x" })).toEqual([]);
  });

  it("исключает сам товар", () => {
    const catalog = [product(1, "A", ["гуманоиды"]), product(2, "B", ["гуманоиды"])];
    const related = getRelatedProducts(catalog, ["гуманоиды"], { excludeId: 1, seed: "x" });
    expect(names(related)).toEqual(["B"]);
  });

  it("английский алиас статьи совпадает с русским тегом товара", () => {
    const catalog = [product(1, "Unitree G1", ["гуманоиды"])];
    const related = getRelatedProducts(catalog, ["Humanoid robots"], { seed: "x" });
    expect(names(related)).toEqual(["Unitree G1"]);
  });
});
