import { describe, expect, it } from "vitest";

// Скрипт — обычный .mjs без .d.mts: типы описываем здесь, чтобы tsc не падал на разрешении модуля.
// @ts-expect-error -- у scripts/products.mjs нет декларации, контракт описан интерфейсом ниже
import * as productsModule from "../scripts/products.mjs";

type TagInput = string | { name?: string; [key: string]: unknown };

interface RawProduct {
  sku?: string;
  name?: string;
  tags?: TagInput[];
  [key: string]: unknown;
}

interface CoverageRow {
  tag: string;
  key: string;
  count: number;
  covered: boolean;
}

interface Coverage {
  rows: CoverageRow[];
  covered: boolean;
  uncovered: string[];
}

interface ProductPayload {
  name?: string;
  sku?: string;
  slug?: string;
  type?: string;
  status?: string;
  regular_price?: string;
  stock_status?: string;
  manage_stock?: boolean;
  description?: string;
  short_description?: string;
  tags?: Array<{ name: string }>;
  categories?: Array<{ name: string }>;
  images?: Array<{ src: string }>;
  sale_price?: string;
  [key: string]: unknown;
}

interface Flags {
  file: string;
  dryRun: boolean;
  publish: boolean;
  fix: boolean;
  slug?: string;
  tags?: string;
  tag?: string;
}

interface ProductsModule {
  TAG_ALIASES: Record<string, string[]>;
  normalizeTag(raw: unknown): string;
  canonicalTag(raw: unknown): string;
  tagNames(tags: unknown): string[];
  splitTags(value: unknown): string[];
  productsWithTag<T extends RawProduct>(products: T[], tag: string): T[];
  coverageFor(articleTags: string[], products: RawProduct[]): Coverage;
  exitCodeForCoverage(coverage: Coverage): number;
  resolveStatus(
    fileStatus?: string,
    options?: { publish?: boolean; existingStatus?: string },
  ): string;
  missingProductFields(product?: { sku?: string; name?: string }): string[];
  buildProductPayload(
    product: RawProduct,
    options?: { publish?: boolean; existingStatus?: string },
  ): ProductPayload;
  minorToDecimal(value: unknown, minorUnit?: number): string;
  parseArgs(argv: string[]): { command: string; flags: Flags; unknown: string[] };
}

const {
  buildProductPayload,
  canonicalTag,
  coverageFor,
  exitCodeForCoverage,
  minorToDecimal,
  missingProductFields,
  normalizeTag,
  parseArgs,
  productsWithTag,
  resolveStatus,
  splitTags,
  TAG_ALIASES,
  tagNames,
} = productsModule as unknown as ProductsModule;

const catalogProducts: RawProduct[] = [
  {
    id: 1,
    sku: "HR-UNITREE-G1",
    name: "Unitree G1",
    tags: [
      { id: 11, name: "Гуманоиды" },
      { id: 12, name: "роботы" },
    ],
  },
  { id: 2, sku: "HR-UR5E", name: "UR5e", tags: ["коботы", "манипуляторы"] },
];

describe("normalizeTag", () => {
  it("lowercases, folds ё and trims", () => {
    expect(normalizeTag("  Ёжики  ")).toBe("ежики");
    expect(normalizeTag("ГУМАНОИДЫ")).toBe("гуманоиды");
  });

  it("drops punctuation and collapses spaces", () => {
    expect(normalizeTag("Промышленная,  робототехника.")).toBe("промышленная робототехника");
    expect(normalizeTag("Мягкая   робототехника!")).toBe("мягкая робототехника");
    expect(normalizeTag("Soft-Robotics")).toBe("soft robotics");
  });

  it("survives empty input", () => {
    expect(normalizeTag(undefined)).toBe("");
    expect(normalizeTag("   ")).toBe("");
  });
});

describe("tag aliases", () => {
  it("maps the EN spellings to the RU blog tags", () => {
    expect(canonicalTag("humanoids")).toBe("гуманоиды");
    expect(canonicalTag("Humanoid")).toBe("гуманоиды");
    expect(canonicalTag("cobot")).toBe("коботы");
    expect(canonicalTag("manipulators")).toBe("манипуляторы");
    expect(canonicalTag("soft robotics")).toBe("мягкая робототехника");
    expect(canonicalTag("warehouse")).toBe("складская логистика");
    expect(canonicalTag("autonomy")).toBe("автономность");
  });

  it("works in both directions: RU tag and its alias land on the same key", () => {
    expect(canonicalTag("Гуманоиды")).toBe(canonicalTag("humanoid robots"));
    expect(canonicalTag("КОБОТЫ")).toBe(canonicalTag("Collaborative robots"));
    expect(canonicalTag("манипуляция")).not.toBe(canonicalTag("манипуляторы"));
  });

  it("keeps an unknown tag as is and exposes the alias map", () => {
    expect(canonicalTag("Boston Dynamics")).toBe("boston dynamics");
    expect(TAG_ALIASES.гуманоиды).toContain("humanoid");
    expect(TAG_ALIASES["мягкая робототехника"]).toContain("soft robotics");
  });
});

describe("tagNames and productsWithTag", () => {
  it("reads tags from strings and from Store API objects", () => {
    expect(tagNames(["коботы", { name: "Гуманоиды" }, { slug: "no-name" }, ""])).toEqual([
      "коботы",
      "Гуманоиды",
    ]);
    expect(tagNames(undefined)).toEqual([]);
  });

  it("filters products by tag through the alias map", () => {
    expect(productsWithTag(catalogProducts, "humanoids").map((product) => product.sku)).toEqual([
      "HR-UNITREE-G1",
    ]);
    expect(productsWithTag(catalogProducts, "манипуляторы").map((product) => product.sku)).toEqual([
      "HR-UR5E",
    ]);
    expect(productsWithTag(catalogProducts, "электромобили")).toEqual([]);
  });
});

describe("coverageFor", () => {
  it("counts products per article tag", () => {
    const coverage = coverageFor(["гуманоиды", "cobot", "электромобили"], catalogProducts);

    expect(coverage.rows.map((row) => row.count)).toEqual([1, 1, 0]);
    expect(coverage.rows[1]).toMatchObject({ tag: "cobot", key: "коботы", covered: true });
    expect(coverage.uncovered).toEqual(["электромобили"]);
    expect(coverage.covered).toBe(true);
  });

  it("asks for exit 0 when at least one tag is covered", () => {
    const coverage = coverageFor(["электромобили", "гуманоиды"], catalogProducts);
    expect(exitCodeForCoverage(coverage)).toBe(0);
  });

  it("asks for exit 1 when nothing is covered", () => {
    const coverage = coverageFor(["тактильность", "мягкая робототехника"], catalogProducts);

    expect(coverage.covered).toBe(false);
    expect(coverage.uncovered).toEqual(["тактильность", "мягкая робототехника"]);
    expect(exitCodeForCoverage(coverage)).toBe(1);
  });

  it("treats an empty product list as no coverage", () => {
    expect(exitCodeForCoverage(coverageFor(["гуманоиды"], []))).toBe(1);
  });
});

describe("buildProductPayload", () => {
  const product: RawProduct = {
    sku: "HR-UNITREE-G1",
    name: "Unitree G1",
    slug: "unitree-g1",
    type: "simple",
    status: "draft",
    price: "0",
    regular_price: "0",
    sale_price: "",
    stock_status: "onbackorder",
    manage_stock: false,
    short_description: "Коротко",
    description: "Подробно",
    categories: ["Гуманоиды"],
    tags: ["гуманоиды", "роботы"],
    images: [{ src: "https://example.com/g1.png" }, { src: "" }],
    review_note: "уточнить цену",
  };

  it("sends the required WC REST fields", () => {
    const payload = buildProductPayload(product);

    expect(payload).toMatchObject({
      name: "Unitree G1",
      sku: "HR-UNITREE-G1",
      slug: "unitree-g1",
      type: "simple",
      regular_price: "0",
      stock_status: "onbackorder",
      manage_stock: false,
      description: "Подробно",
    });
  });

  it("passes tags and categories as [{ name }] and images as [{ src }]", () => {
    const payload = buildProductPayload(product);

    expect(payload.tags).toEqual([{ name: "гуманоиды" }, { name: "роботы" }]);
    expect(payload.categories).toEqual([{ name: "Гуманоиды" }]);
    expect(payload.images).toEqual([{ src: "https://example.com/g1.png" }]);
  });

  it("never sends review_note or the read-only price field", () => {
    const payload = buildProductPayload(product);

    expect(payload).not.toHaveProperty("review_note");
    expect(payload).not.toHaveProperty("price");
    expect(payload).not.toHaveProperty("sale_price");
  });

  it("falls back to price when regular_price is missing", () => {
    expect(buildProductPayload({ sku: "S", name: "N", price: "250" }).regular_price).toBe("250");
    expect(buildProductPayload({ sku: "S", name: "N" }).regular_price).toBe("0");
  });

  it("defaults to draft", () => {
    expect(buildProductPayload(product).status).toBe("draft");
    expect(buildProductPayload({ ...product, status: "publish" }).status).toBe("draft");
  });

  it("publishes only an explicit publish status with --publish", () => {
    expect(buildProductPayload({ ...product, status: "publish" }, { publish: true }).status).toBe(
      "publish",
    );
  });

  it("--publish does not promote an existing draft", () => {
    const payload = buildProductPayload(product, { publish: true, existingStatus: "draft" });
    expect(payload.status).toBe("draft");
  });

  it("does not silently unpublish a live product", () => {
    expect(buildProductPayload(product, { existingStatus: "publish" }).status).toBe("publish");
  });

  it("reports the fields import cannot work without", () => {
    expect(missingProductFields({ name: "N" })).toEqual(["sku"]);
    expect(missingProductFields({ sku: "S" })).toEqual(["name"]);
    expect(missingProductFields(product)).toEqual([]);
  });
});

describe("resolveStatus", () => {
  it("keeps draft without --publish", () => {
    expect(resolveStatus("draft")).toBe("draft");
    expect(resolveStatus("publish")).toBe("draft");
  });

  it("publishes a file-marked publish with --publish", () => {
    expect(resolveStatus("publish", { publish: true })).toBe("publish");
    expect(resolveStatus("draft", { publish: true, existingStatus: "draft" })).toBe("draft");
  });

  it("keeps an existing published product published", () => {
    expect(resolveStatus("draft", { existingStatus: "publish" })).toBe("publish");
  });
});

describe("parseArgs", () => {
  it("reads import flags", () => {
    const { command, flags, unknown } = parseArgs([
      "import",
      "--file",
      "products/catalog.json",
      "--dry-run",
      "--publish",
    ]);

    expect(command).toBe("import");
    expect(flags).toMatchObject({
      file: "products/catalog.json",
      dryRun: true,
      publish: true,
      fix: false,
    });
    expect(unknown).toEqual([]);
  });

  it("reads ensure flags by slug and by tags", () => {
    expect(parseArgs(["ensure", "--slug", "tesla-optimus", "--fix"]).flags).toMatchObject({
      slug: "tesla-optimus",
      fix: true,
    });
    expect(parseArgs(["ensure", "--tags", "гуманоиды,коботы"]).flags).toMatchObject({
      tags: "гуманоиды,коботы",
      fix: false,
    });
  });

  it("reads list --tag and falls back to the default catalog", () => {
    expect(parseArgs(["list", "--tag", "коботы"]).flags.tag).toBe("коботы");
    expect(parseArgs(["import"]).flags.file).toBe("products/catalog.json");
  });

  it("does not swallow the next flag as a value", () => {
    const { flags } = parseArgs(["ensure", "--slug", "--fix"]);

    expect(flags.slug).toBeUndefined();
    expect(flags.fix).toBe(true);
  });

  it("collects unknown flags instead of guessing", () => {
    expect(parseArgs(["list", "--bogus"]).unknown).toEqual(["bogus"]);
  });

  it("splits a comma separated tag list", () => {
    expect(splitTags(" гуманоиды , ,коботы ")).toEqual(["гуманоиды", "коботы"]);
    expect(splitTags(undefined)).toEqual([]);
  });
});

describe("minorToDecimal", () => {
  it("converts Store API prices out of minor units", () => {
    expect(minorToDecimal("1999900", 2)).toBe("19999.00");
    expect(minorToDecimal(500, 0)).toBe("500");
    expect(minorToDecimal(undefined, 2)).toBe("");
  });
});
