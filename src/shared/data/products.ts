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
  /**
   * Стабильное зерно подборки: слаг статьи, тега или товара. Одинаковое зерно
   * даёт одинаковый порядок (SSG обязан быть детерминированным), разное зерно
   * разводит срез, чтобы у двух материалов с похожими тегами не было одного и
   * того же списка роботов.
   */
  seed?: string;
}

/** FNV-1a: дешёвый детерминированный хеш, без Math.random и без времени. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Товары по общим тегам.
 *
 * Вес тега обратен его распространённости: «инспекция» или «складская
 * логистика» различают товар, а «манипуляторы» стоят почти на всём каталоге и
 * сами по себе ничего не говорят. Поэтому редкий общий тег весит больше
 * частого, и материал про склад получает AMR, а не первый по алфавиту кобот.
 */
export function getRelatedProducts(
  products: Product[],
  tags: string[],
  options: RelatedProductsOptions = {},
): Product[] {
  const limit = options.limit ?? 3;
  const wanted = new Set(tags.map(canonicalTag).filter(Boolean));
  if (!wanted.size) return [];

  const canons = new Map<number, Set<string>>();
  const documentFrequency = new Map<string, number>();
  for (const product of products) {
    const productCanons = new Set(
      product.tags.map((tag) => canonicalTag(tag.name)).filter(Boolean),
    );
    canons.set(product.id, productCanons);
    for (const canon of productCanons) {
      documentFrequency.set(canon, (documentFrequency.get(canon) ?? 0) + 1);
    }
  }

  const total = products.length;
  const weightOf = (canon: string) =>
    Math.log(1 + total / Math.max(1, documentFrequency.get(canon) ?? 1));

  const seed = options.seed ?? "";
  const rankOf = (product: Product) =>
    stableHash(`${seed}|${product.sku || product.slug || product.id}`);

  return products
    .filter((product) => product.id !== options.excludeId)
    .map((product) => {
      let score = 0;
      for (const canon of canons.get(product.id) ?? []) {
        if (wanted.has(canon)) score += weightOf(canon);
      }
      return { product, score, rank: rankOf(product) };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.rank - right.rank ||
        left.product.name.localeCompare(right.product.name, "ru"),
    )
    .slice(0, limit)
    .map((entry) => entry.product);
}

/** Блок «Купить робота»: минимум один товар для статьи. */
export async function getProductsForTags(
  tags: string[],
  limit = 3,
  seed?: string,
): Promise<Product[]> {
  const products = await getProducts();
  return getRelatedProducts(products, tags, { limit, seed });
}
