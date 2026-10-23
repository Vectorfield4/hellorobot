import { ORDER_API_URL, WP_BASE_URL } from "@/shared/config/constants";

/** Тело запроса к `POST /wp-json/hellorobot/v1/order`. */
export interface OrderPayload {
  productId: number;
  quantity: number;
  name: string;
  phone: string;
  email: string;
  comment: string;
  consent: boolean;
  elapsedMs: number;
  sourceUrl: string;
  website: string;
}

export interface OrderResult {
  orderId: number;
  orderNumber: string;
  status: string;
}

export type OrderErrorCode =
  | "invalid_phone"
  | "invalid_email"
  | "invalid_name"
  | "invalid_comment"
  | "invalid_quantity"
  | "consent_required"
  | "product_not_found"
  | "unsupported_product_type"
  | "rate_limited"
  | "spam_detected"
  | "woocommerce_missing"
  | "network"
  | "unknown";

const SERVER_ERROR_CODES: readonly OrderErrorCode[] = [
  "invalid_phone",
  "invalid_email",
  "invalid_name",
  "invalid_comment",
  "invalid_quantity",
  "consent_required",
  "product_not_found",
  "unsupported_product_type",
  "rate_limited",
  "spam_detected",
  "woocommerce_missing",
];

export const ORDER_TIMEOUT_MS = 15_000;

export const ORDER_NETWORK_MESSAGE = "Не удалось отправить заказ.";

export class OrderError extends Error {
  readonly code: OrderErrorCode;
  readonly status: number | undefined;

  constructor(code: OrderErrorCode, message: string, status?: number) {
    super(message);
    this.name = "OrderError";
    this.code = code;
    this.status = status;
  }
}

/** Ссылка на оформление того же товара в магазине — фолбэк, если форма не сработала. */
export function storeCheckoutUrl(productId: number): string {
  return `${WP_BASE_URL}/checkout/?add-to-cart=${productId}`;
}

function toServerCode(value: unknown): OrderErrorCode | null {
  if (typeof value !== "string") return null;
  return SERVER_ERROR_CODES.find((code) => code === value) ?? null;
}

function toRequestBody(payload: OrderPayload): Record<string, unknown> {
  return {
    product_id: payload.productId,
    quantity: payload.quantity,
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    email: payload.email.trim(),
    comment: payload.comment.trim(),
    consent: payload.consent,
    elapsed_ms: payload.elapsedMs,
    source_url: payload.sourceUrl,
    website: payload.website,
  };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    if (typeof response.text === "function") {
      const raw = await response.text();
      if (!raw.trim()) return null;
      return JSON.parse(raw);
    }
    if (typeof response.json === "function") return await response.json();
  } catch {
    // Не-JSON ответ трактуем как сетевую ошибку ниже.
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorFromResponse(body: unknown, status: number): OrderError {
  const data = isRecord(body) ? body : {};
  const code = toServerCode(data.code) ?? "unknown";
  const message =
    typeof data.message === "string" && data.message.trim()
      ? data.message.trim()
      : ORDER_NETWORK_MESSAGE;
  const meta = isRecord(data.data) ? data.data : {};
  const reported = typeof meta.status === "number" ? meta.status : status;
  return new OrderError(code, message, reported);
}

function resultFromResponse(body: unknown): OrderResult {
  if (!isRecord(body)) throw new OrderError("unknown", ORDER_NETWORK_MESSAGE);
  const orderId = typeof body.order_id === "number" ? body.order_id : null;
  if (orderId === null) throw new OrderError("unknown", ORDER_NETWORK_MESSAGE);
  return {
    orderId,
    orderNumber:
      typeof body.order_number === "string"
        ? body.order_number
        : String(body.order_number ?? orderId),
    status: typeof body.status === "string" ? body.status : "",
  };
}

/**
 * `POST` заказа на WordPress. Таймаут по умолчанию 15 с.
 * Все сбои — `OrderError`: клиенту не нужно разбирать `TypeError` от fetch.
 * Персональные данные в консоль не пишем.
 */
export async function createOrder(
  payload: OrderPayload,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<OrderResult> {
  const { timeoutMs = ORDER_TIMEOUT_MS, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(toRequestBody(payload)),
      signal: controller.signal,
    });
    const body = await readBody(response);
    if (!response.ok) throw errorFromResponse(body, response.status);
    // Пустое или не-JSON тело на 2xx — это не ответ эндпоинта, а сбой связи.
    if (body === null) throw new OrderError("network", ORDER_NETWORK_MESSAGE);
    return resultFromResponse(body);
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError("network", ORDER_NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
