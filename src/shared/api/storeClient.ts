import type { StoreProduct } from "@/shared/api/store";
import { STORE_API_URL } from "@/shared/config/constants";
import { mapStoreProduct, type Product } from "@/shared/data/product";

/** Сколько товаров просим у Store API на один запрос поиска. */
export const SEARCH_RESULT_LIMIT = 12;

/** Минимальная длина запроса: одна буква даёт весь каталог. */
export const SEARCH_MIN_LENGTH = 2;

function buildSearchUrl(query: string): string {
  const url = new URL(`${STORE_API_URL}/products`);
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", String(SEARCH_RESULT_LIMIT));
  return url.toString();
}

/**
 * Поиск через Store API прямо из браузера. Отмена — задача вызывающего:
 * он передаёт `signal` и обрывает запрос при новом вводе или размонтировании.
 */
export async function searchProductsClient(
  query: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  const trimmed = query.trim();
  if (trimmed.length < SEARCH_MIN_LENGTH) return [];

  const response = await fetch(buildSearchUrl(trimmed), {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Store API search failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Store API search returned an unexpected payload");
  }

  return (data as StoreProduct[]).map(mapStoreProduct);
}
