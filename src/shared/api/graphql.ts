import { WP_GRAPHQL_URL } from "@/shared/config/constants";
import { describeError } from "@/shared/lib/describeError";

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

function operationNameFromQuery(query: string): string {
  const match = query.match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match?.[1] ?? "anonymous";
}

/**
 * Один запрос без повторов. Повторы живут в `wpQuery`: сборка делает десятки
 * запросов подряд, и один случайный таймаут не должен ронять весь сайт.
 */
async function wpQueryOnce<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  op: string,
  timeoutMs: number,
): Promise<T> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  console.info(`[WPGraphQL] ${op}: POST ${WP_GRAPHQL_URL} (timeout ${timeoutMs}ms)`);

  try {
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 500);
      } catch {
        body = "";
      }
      const error = new Error(
        `WPGraphQL request failed for ${op} at ${WP_GRAPHQL_URL}: HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
      );
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }

    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      throw new Error(
        `WPGraphQL returned errors for ${op} at ${WP_GRAPHQL_URL}: ${JSON.stringify(json.errors)}`,
      );
    }

    const duration = Date.now() - startedAt;
    console.info(`[WPGraphQL] ${op}: ok in ${duration}ms`);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

/** Коды транспорта, которые проходят сами: DNS, обрыв, таймаут, 5xx. */
const RETRYABLE_CODES =
  /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH|EHOSTUNREACH|UND_ERR_|socket hang up|fetch failed/i;

/** Таймаут, обрыв и 5xx — повод повторить; ошибки GraphQL и 4xx — нет. */
function isRetryable(error: unknown): boolean {
  const err = error as (Error & { status?: number }) | undefined;
  if (!err) return false;
  if (typeof err.status === "number") return err.status >= 500 || err.status === 429;
  if (err.name === "AbortError" || /aborted|timeout/i.test(err.message)) return true;
  return RETRYABLE_CODES.test(describeError(err));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wpQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs?: number,
  operationName?: string,
): Promise<T> {
  const op = operationName ?? operationNameFromQuery(query);
  const resolvedTimeout = resolveTimeout(timeoutMs);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await wpQueryOnce<T>(query, variables, op, resolvedTimeout);
    } catch (error) {
      lastError = error;
      const err = error instanceof Error ? error : new Error(String(error));
      if (attempt === RETRY_ATTEMPTS || !isRetryable(error)) {
        const aborted = err.name === "AbortError" || /aborted/i.test(err.message);
        console.error(`[WPGraphQL] ${op} failed on attempt ${attempt}: ${describeError(err)}`, {
          endpoint: WP_GRAPHQL_URL,
          timeoutMs: resolvedTimeout,
          aborted,
          variables,
          stack: err.stack,
        });
        break;
      }
      const wait = RETRY_BASE_MS * attempt;
      console.warn(
        `[WPGraphQL] ${op}: попытка ${attempt} не удалась (${describeError(err)}), повтор через ${wait}ms`,
      );
      await sleep(wait);
    }
  }

  const err = lastError instanceof Error ? lastError : new Error(String(lastError));
  throw new Error(
    `WPGraphQL request failed for ${op} at ${WP_GRAPHQL_URL} after ${RETRY_ATTEMPTS} attempts: ${err.name}: ${describeError(err)}`,
  );
}
