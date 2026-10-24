import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProducts, resetProductsCache } from "../src/shared/data/products";
import productsSnapshot from "../src/shared/data/products.snapshot.json";

const SNAPSHOT_PRODUCTS = (productsSnapshot as { products: unknown[] }).products.length;

const rawProduct = {
  id: 7,
  name: "Unitree G1",
  slug: "unitree-g1",
  sku: "HR-G1",
  type: "simple",
  short_description: "<p>Гуманоид</p>",
  description: "<p>Описание</p>",
  tags: [{ id: 1, name: "гуманоиды", slug: "gumanoidy" }],
  categories: [],
  images: [],
  is_in_stock: true,
  is_purchasable: true,
  prices: {
    price: "189000000",
    regular_price: "189000000",
    sale_price: "",
    currency_code: "RUB",
    currency_symbol: "₽",
    currency_minor_unit: 2,
    currency_decimal_separator: ",",
    currency_thousand_separator: " ",
    currency_prefix: "",
    currency_suffix: " ₽",
  },
};

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("getProducts", () => {
  beforeEach(() => {
    resetProductsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetProductsCache();
  });

  it("маппит ответ Store API", async () => {
    vi.stubEnv("DEV", false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([rawProduct], { "x-wp-total": "1", "x-wp-totalpages": "1" })),
    );

    const products = await getProducts();
    expect(products).toHaveLength(1);
    expect(products[0]?.prices?.price).toBe("189000000");
    expect(products[0]?.tags[0]?.name).toBe("гуманоиды");
  });

  it("в dev отдаёт демо-каталог, если магазин недоступен", async () => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.sku.startsWith("DEMO-"))).toBe(true);
  });

  it("в production без сети отдаёт снимок каталога", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PUBLIC_PRODUCTS_FALLBACK", "off");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const products = await getProducts();
    expect(products.length).toBe(SNAPSHOT_PRODUCTS);
    expect(products.every((product) => !product.sku.startsWith("DEMO-"))).toBe(true);
  });

  it("пустой ответ магазина не считается каталогом и уходит в снимок", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PUBLIC_PRODUCTS_FALLBACK", "off");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([], { "x-wp-total": "0", "x-wp-totalpages": "1" })),
    );

    const products = await getProducts();
    expect(products.length).toBe(SNAPSHOT_PRODUCTS);
  });
});
