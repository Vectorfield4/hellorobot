import type { StoreAttribute, StoreProduct, StoreTerm } from "@/shared/api/store";
import {
  decodeEntities,
  decodeNumericEntities,
  toPlainText,
  truncate,
} from "@/shared/lib/plainText";
import type { StorePrices } from "@/shared/lib/price";

export interface ProductTerm {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  src: string;
  alt: string;
  thumbnail: string;
}

/** Товар в терминах сайта: цена уже отформатирована, HTML разобран. */
export interface Product {
  id: number;
  slug: string;
  name: string;
  sku: string;
  type: string;
  permalink: string;
  prices: StorePrices | null;
  inStock: boolean;
  onBackorder: boolean;
  purchasable: boolean;
  shortDescription: string;
  description: string;
  excerpt: string;
  /** Год выпуска модели из атрибута WooCommerce; `null`, если его нет. */
  year: number | null;
  tags: ProductTerm[];
  categories: ProductTerm[];
  images: ProductImage[];
  cover: ProductImage | null;
  averageRating: number;
  reviewCount: number;
}

export interface ProductTag {
  name: string;
  count: number;
}

const EXCERPT_LENGTH = 180;

function mapTerm(term: StoreTerm | undefined | null): ProductTerm | null {
  if (!term) return null;
  const rawName = term.name?.trim();
  if (!rawName) return null;
  return { id: term.id, name: decodeEntities(rawName), slug: term.slug ?? rawName };
}

function mapTerms(terms: StoreTerm[] | undefined | null): ProductTerm[] {
  return (terms ?? []).map(mapTerm).filter((term): term is ProductTerm => term !== null);
}

/**
 * Год выпуска модели. В WooCommerce это локальный атрибут «Год выпуска»,
 * Store API отдаёт его как `attributes[].terms[]`. Нет атрибута — нет строки
 * на карточке: выдумывать год нельзя.
 */
function readYear(attributes: StoreAttribute[] | undefined | null): number | null {
  for (const attribute of attributes ?? []) {
    if (!/год/i.test(attribute.name ?? "")) continue;
    for (const term of attribute.terms ?? []) {
      const match = String(term.name ?? "").match(/\b(19|20)\d{2}\b/);
      if (match) return Number(match[0]);
    }
  }
  return null;
}

function mapImage(
  image: { src: string; thumbnail?: string; alt?: string },
  fallbackAlt: string,
): ProductImage | null {
  const src = image?.src?.trim();
  if (!src) return null;
  const alt = image.alt?.trim();
  return {
    src,
    alt: alt ? decodeEntities(alt) : fallbackAlt,
    thumbnail: image.thumbnail?.trim() || src,
  };
}

export function mapStoreProduct(raw: StoreProduct): Product {
  const sku = raw.sku?.trim() ?? "";
  const fallbackName = raw.name?.trim() || raw.slug;
  const name = decodeEntities(fallbackName);
  const images = (raw.images ?? [])
    .map((image) => mapImage(image, name))
    .filter((image): image is ProductImage => image !== null);
  const shortDescription = toPlainText(raw.short_description);
  const description = decodeNumericEntities((raw.description ?? "").trim());
  const prices = raw.prices ?? null;

  return {
    id: raw.id,
    slug: raw.slug,
    name,
    sku,
    type: raw.type ?? "simple",
    permalink: raw.permalink ?? productPath(raw.slug),
    prices,
    inStock: raw.is_in_stock !== false,
    onBackorder: Boolean(raw.is_on_backorder),
    purchasable: raw.is_purchasable !== false,
    shortDescription,
    description,
    excerpt: shortDescription || truncate(toPlainText(description), EXCERPT_LENGTH),
    year: readYear(raw.attributes),
    tags: mapTerms(raw.tags),
    categories: mapTerms(raw.categories),
    images,
    cover: images[0] ?? null,
    averageRating: Number(raw.average_rating ?? 0) || 0,
    reviewCount: raw.review_count ?? 0,
  };
}

export function productPath(slug: string): string {
  return `/products/${slug}`;
}

export function productTagPath(name: string): string {
  return `/products/tag/${encodeURIComponent(name)}`;
}

export function productCategoryPath(name: string): string {
  return `/products/category/${encodeURIComponent(name)}`;
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function searchHaystack(product: Product): string {
  return normalizeSearchText(
    [
      product.name,
      product.sku,
      product.excerpt,
      product.tags.map((tag) => tag.name).join(" "),
      product.categories.map((category) => category.name).join(" "),
    ].join(" "),
  );
}

/** Фолбэк поиска: фильтр по индексу, собранному на билде. */
export function filterProducts(products: Product[], query: string): Product[] {
  const needle = normalizeSearchText(query);
  if (!needle) return products;
  const words = needle.split(" ").filter(Boolean);
  return products.filter((product) => {
    const haystack = searchHaystack(product);
    return words.every((word) => haystack.includes(word));
  });
}
