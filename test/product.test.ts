import { describe, expect, it } from "vitest";
import catalog from "../products/catalog.json";
import type { StoreProduct } from "../src/shared/api/store";
import {
  filterProducts,
  mapStoreProduct,
  productCategoryPath,
  productPath,
  productTagPath,
} from "../src/shared/data/product";
import { getRelatedProducts } from "../src/shared/data/products";
import { productFixtures } from "../src/shared/mocks/fixtures/products";

const raw: StoreProduct = {
  id: 42,
  name: "Unitree G1",
  slug: "unitree-g1",
  sku: "HR-G1",
  type: "simple",
  permalink: "https://hello-robot.ru/product/unitree-g1",
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
  on_sale: false,
  short_description: "<p>Человекоподобный&nbsp;робот&nbsp;&mdash; для&nbsp;исследований</p>",
  description: "<p>Основной текст.</p><p>Второй абзац.</p>",
  tags: [{ id: 1, name: "гуманоиды", slug: "gumanoidy" }],
  categories: [{ id: 2, name: "Гуманоиды", slug: "gumanoidy" }],
  images: [
    { src: "https://example.com/g1-full.jpg", thumbnail: "https://example.com/g1-thumb.jpg" },
  ],
  is_in_stock: false,
  is_purchasable: true,
  is_on_backorder: true,
  average_rating: "4.5",
  review_count: 3,
};

describe("mapStoreProduct", () => {
  it("переносит наличие и картинки, цену не форматирует", () => {
    const product = mapStoreProduct(raw);
    expect(product.id).toBe(42);
    expect(product).not.toHaveProperty("priceLabel");
    expect(product.inStock).toBe(false);
    expect(product.onBackorder).toBe(true);
    expect(product.cover?.thumbnail).toBe("https://example.com/g1-thumb.jpg");
    expect(product.cover?.alt).toBe("Unitree G1");
    expect(product.averageRating).toBe(4.5);
    expect(product.reviewCount).toBe(3);
  });

  it("разбирает HTML в текст для анонса", () => {
    const product = mapStoreProduct(raw);
    expect(product.shortDescription).toBe("Человекоподобный робот — для исследований");
    expect(product.excerpt).toBe("Человекоподобный робот — для исследований");
    expect(product.description).toContain("<p>");
  });

  it("выживает без цен, картинок и тегов", () => {
    const bare = mapStoreProduct({ id: 1, name: "Без цены", slug: "bez-ceny" });
    expect(bare.cover).toBeNull();
    expect(bare.tags).toEqual([]);
    expect(bare.inStock).toBe(true);
    expect(bare.purchasable).toBe(true);
  });

  it("декодирует HTML-сущности в имени, тегах и описании", () => {
    const product = mapStoreProduct({
      ...raw,
      name: "ADAPTIVE GRIPPER &#8212; TWO FINGERS",
      sku: "HR-SOME-UNKNOWN-SKU",
      tags: [{ id: 5, name: "манипуляторы &#8212; адаптивные", slug: "manipulyatory" }],
      description: "<p>Текст &#8212; ещё текст &#8230;</p>",
    });
    expect(product.name).toBe("ADAPTIVE GRIPPER — TWO FINGERS");
    expect(product.tags[0]?.name).toBe("манипуляторы — адаптивные");
    expect(product.description).toBe("<p>Текст — ещё текст …</p>");
  });

  it("читает год выпуска из атрибута WooCommerce и молчит без него", () => {
    const withYear = mapStoreProduct({
      ...raw,
      attributes: [{ name: "Год выпуска", terms: [{ name: "2024" }] }],
    });
    expect(withYear.year).toBe(2024);
    expect(mapStoreProduct(raw).year).toBeNull();
  });
});

describe("русский текст каталога", () => {
  it("описания опубликованных товаров без HTML-сущностей и на русском", () => {
    for (const product of catalog.products.filter((entry) => entry.status === "publish")) {
      for (const field of ["name", "short_description", "description"] as const) {
        expect(product[field], `${product.sku} ${field}`).not.toMatch(/&#\d+;|&[a-z]+;|[<>]/i);
      }
      expect(product.short_description, product.sku).toMatch(/[а-яА-Я]/);
      expect(product.description, product.sku).toMatch(/[а-яА-Я]/);
    }
  });
});

describe("пути каталога", () => {
  it("строит адреса товара, тега и категории", () => {
    expect(productPath("unitree-g1")).toBe("/robots/unitree-g1");
    expect(productTagPath("гуманоиды")).toBe(
      "/products/tag/%D0%B3%D1%83%D0%BC%D0%B0%D0%BD%D0%BE%D0%B8%D0%B4%D1%8B",
    );
    expect(productCategoryPath("Коботы")).toBe(
      "/products/category/%D0%9A%D0%BE%D0%B1%D0%BE%D1%82%D1%8B",
    );
  });
});

describe("filterProducts", () => {
  it("ищет по имени, SKU и тегам", () => {
    expect(filterProducts(productFixtures, "unitree").length).toBeGreaterThan(0);
    expect(filterProducts(productFixtures, "UR5E")[0]?.slug).toBe("ur5e");
    expect(filterProducts(productFixtures, "гуманоид").map((p) => p.slug)).toContain("unitree-g1");
  });

  it("требует все слова и игнорирует регистр/ё", () => {
    expect(filterProducts(productFixtures, "КОБОТ UR5E")).toHaveLength(1);
    expect(filterProducts(productFixtures, "кобот ёжик")).toHaveLength(0);
  });

  it("пустой запрос возвращает весь каталог", () => {
    expect(filterProducts(productFixtures, "  ")).toHaveLength(productFixtures.length);
  });
});

describe("getRelatedProducts", () => {
  it("поднимает товары с большим числом общих тегов", () => {
    const related = getRelatedProducts(productFixtures, ["гуманоиды", "исследования"], {
      limit: 3,
    });
    expect(related.length).toBeGreaterThan(0);
    expect(related[0]?.slug).toBe("reachy-2");
  });

  it("исключает сам товар и не подставляет чужие теги", () => {
    const related = getRelatedProducts(productFixtures, ["гуманоиды"], { excludeId: 1 });
    expect(related.map((p) => p.id)).not.toContain(1);
    expect(getRelatedProducts(productFixtures, ["лесозаготовка"])).toEqual([]);
  });
});
