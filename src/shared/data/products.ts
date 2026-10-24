import type { StoreProduct } from "@/shared/api/store";
import { fetchAllStoreProducts } from "@/shared/api/store";
import { canonicalTag, normalizeTag } from "@/shared/config/productTags";
import {
  mapStoreProduct,
  type Product,
  type ProductTag,
  type ProductTerm,
} from "@/shared/data/product";
import { productFixtures } from "@/shared/mocks/fixtures/products";
import productsSnapshot from "./products.snapshot.json";

let productsPromise: Promise<Product[]> | null = null;

export function resetProductsCache(): void {
  productsPromise = null;
}

/**
 * Демо-товары нужны только для локальной разработки, пока WooCommerce не
 * наполнен. В продакшене пустой каталог честнее выдуманных цен.
 */
function fixturesAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  return import.meta.env.PUBLIC_PRODUCTS_FALLBACK === "demo";
}

async function loadProducts(): Promise<Product[]> {
  try {
    const raw = await fetchAllStoreProducts();
    if (!raw.length) throw new Error("Store API вернул пустой каталог");
    return raw.map(mapStoreProduct);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fixturesAllowed()) {
      console.warn(`[store] каталог недоступен, показываю демо-товары: ${message}`);
      return productFixtures;
    }
    // Сборка не должна терять витрину, если раннер не достал Store API:
    // снимок — последний известный каталог (scripts/content-snapshot.mjs).
    const snapshot = (productsSnapshot as { products?: StoreProduct[] })?.products ?? [];
    if (snapshot.length > 0) {
      console.warn(
        `[store] каталог недоступен, беру снимок: ${snapshot.length} товаров (${message})`,
      );
      return snapshot.map(mapStoreProduct);
    }
    console.error(`[store] каталог недоступен, каталог пуст: ${message}`);
    return [];
  }
}

export async function getProducts(): Promise<Product[]> {
  if (!productsPromise) productsPromise = loadProducts();
  return productsPromise;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.id === id);
}

export async function getProductsByTag(tag: string): Promise<Product[]> {
  const canon = canonicalTag(tag);
  if (!canon) return [];
  const products = await getProducts();
  return products.filter((product) =>
    product.tags.some((productTag) => canonicalTag(productTag.name) === canon),
  );
}

export async function getProductsByCategory(name: string): Promise<Product[]> {
  const canon = canonicalTag(name);
  if (!canon) return [];
  const products = await getProducts();
  return products.filter((product) =>
    product.categories.some((category) => canonicalTag(category.name) === canon),
  );
}

function countTerms(terms: ProductTerm[]): ProductTag[] {
  const counter = new Map<string, ProductTag>();
  for (const term of terms) {
    const canon = canonicalTag(term.name);
    if (!canon) continue;
    const existing = counter.get(canon);
    if (!existing) {
      counter.set(canon, { name: term.name, count: 1 });
      continue;
    }
    existing.count += 1;
    // Показываем каноническое написание: «манипуляторы», а не «манипуляция».
    if (normalizeTag(term.name) === canon && normalizeTag(existing.name) !== canon) {
      existing.name = term.name;
    }
  }
  return [...counter.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"),
  );
}

/** Теги, по которым реально есть товары — из них строятся `/products/tag/*`. */
export async function getAllProductTags(): Promise<ProductTag[]> {
  const products = await getProducts();
  return countTerms(products.flatMap((product) => product.tags));
}

export async function getAllProductCategories(): Promise<ProductTag[]> {
  const products = await getProducts();
  return countTerms(products.flatMap((product) => product.categories));
}

export interface RelatedProductsOptions {
  limit?: number;
  excludeId?: number;
}

/** Товары по общим тегам: больше совпадений — выше в списке. */
export function getRelatedProducts(
  products: Product[],
  tags: string[],
  options: RelatedProductsOptions = {},
): Product[] {
  const limit = options.limit ?? 3;
  const wanted = new Set(tags.map(canonicalTag).filter(Boolean));
  if (!wanted.size) return [];

  return products
    .filter((product) => product.id !== options.excludeId)
    .map((product) => ({
      product,
      score: product.tags.filter((tag) => wanted.has(canonicalTag(tag.name))).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "ru"))
    .slice(0, limit)
    .map((entry) => entry.product);
}

/** Блок «Купить робота»: минимум один товар для статьи. */
export async function getProductsForTags(tags: string[], limit = 3): Promise<Product[]> {
  const products = await getProducts();
  return getRelatedProducts(products, tags, { limit });
}
