import { STORE_API_URL } from "@/shared/config/constants";
import { describeError } from "@/shared/lib/describeError";
import type { StorePrices } from "@/shared/lib/price";

/** Сырой ответ WooCommerce Store API (`wc/store/v1/products`). */
export interface StoreTerm {
  id: number;
  name: string;
  slug: string;
}

export interface StoreImage {
  id?: number;
  src: string;
  thumbnail?: string;
  alt?: string;
  name?: string;
}

export interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  type?: string;
  permalink?: string;
  prices?: StorePrices;
  on_sale?: boolean;
  short_description?: string;
  description?: string;
  tags?: StoreTerm[];
  categories?: StoreTerm[];
  images?: StoreImage[];
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  is_on_backorder?: boolean;
  average_rating?: string;
  review_count?: number;
}

export interface StoreResponse<T> {
  data: T;
  total: number;
  totalPages: number;
}

export class StoreApiError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "StoreApiError";
    this.status = status;
  }
}

function resolveTimeout(timeoutMs?: number): number {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }
  const fromEnv =
    (typeof process !== "undefined" ? process.env.WP_GRAPHQL_TIMEOUT_MS : undefined) ??
    (typeof import.meta !== "undefined" ? import.meta.env?.WP_GRAPHQL_TIMEOUT_MS : undefined);
  const parsed = fromEnv ? Number(fromEnv) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
}

export function buildStoreUrl(path: string, params: Record<string, unknown> = {}): string {
  const base = `${STORE_API_URL}/${path.replace(/^\/+/, "")}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export interface StoreGetOptions {
  timeoutMs?: number;
  retries?: number;
  operation?: string;
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof StoreApiError)) return false;
  return error.status === undefined || error.status >= 500;
}

async function storeGetOnce<T>(
  url: string,
  timeoutMs: number,
  operation: string,
): Promise<StoreResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new StoreApiError(`HTTP ${res.status} ${res.statusText} at ${url}`, res.status);
    }
    const data = (await res.json()) as T;
    return {
      data,
      total: Number(res.headers.get("x-wp-total") ?? 0),
      totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1),
    };
  } catch (error) {
    if (error instanceof StoreApiError) throw error;
    throw new StoreApiError(
      `Store API request failed (${operation}) at ${url}: ${describeError(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET к Store API с таймаутом и одним повтором на сети/5xx. */
export async function storeGet<T>(
  path: string,
  params: Record<string, unknown> = {},
  options: StoreGetOptions = {},
): Promise<StoreResponse<T>> {
  const url = buildStoreUrl(path, params);
  const operation = options.operation ?? path;
  const timeoutMs = resolveTimeout(options.timeoutMs);
  const retries = Math.max(0, options.retries ?? 1);
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await storeGetOnce<T>(url, timeoutMs, operation);
      console.info(
        `[StoreAPI] ${operation}: ok in ${Date.now() - startedAt}ms (${result.total} items)`,
      );
      return result;
    } catch (error) {
      const lastAttempt = attempt === retries;
      if (lastAttempt || !isRetryable(error)) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[StoreAPI] ${operation} failed after ${Date.now() - startedAt}ms: ${message}`,
        );
        throw error instanceof StoreApiError ? error : new StoreApiError(message);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  throw new StoreApiError(`Store API request failed (${operation})`);
}

export interface FetchProductsOptions {
  perPage?: number;
  maxPages?: number;
  timeoutMs?: number;
}

/** Все опубликованные товары каталога. Постранично: Store API режет выдачу. */
export async function fetchAllStoreProducts(
  options: FetchProductsOptions = {},
): Promise<StoreProduct[]> {
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 20;
  const first = await storeGet<StoreProduct[]>(
    "products",
    { per_page: perPage, page: 1, orderby: "menu_order", order: "asc" },
    { operation: "Products", timeoutMs: options.timeoutMs },
  );
  const pages = Math.min(Math.max(first.totalPages || 1, 1), maxPages);
  const products = Array.isArray(first.data) ? [...first.data] : [];

  for (let page = 2; page <= pages; page++) {
    const next = await storeGet<StoreProduct[]>(
      "products",
      { per_page: perPage, page, orderby: "menu_order", order: "asc" },
      { operation: `Products page ${page}`, timeoutMs: options.timeoutMs },
    );
    if (!Array.isArray(next.data) || next.data.length === 0) break;
    products.push(...next.data);
  }

  return products;
}
