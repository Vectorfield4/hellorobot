import { WP_GRAPHQL_URL } from "@/shared/config/constants";

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

export async function wpQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs?: number,
  operationName?: string,
): Promise<T> {
  const op = operationName ?? operationNameFromQuery(query);
  const resolvedTimeout = resolveTimeout(timeoutMs);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), resolvedTimeout);

  console.info(`[WPGraphQL] ${op}: POST ${WP_GRAPHQL_URL} (timeout ${resolvedTimeout}ms)`);

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
      throw new Error(
        `WPGraphQL request failed for ${op} at ${WP_GRAPHQL_URL}: HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
      );
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
  } catch (error) {
    const duration = Date.now() - startedAt;
    const err = error instanceof Error ? error : new Error(String(error));
    const aborted = err.name === "AbortError" || /aborted/i.test(err.message);
    const suffix = aborted ? ` (aborted after ${duration}ms; timeout ${resolvedTimeout}ms)` : "";
    const detail = `${err.name}: ${err.message}${suffix}`;

    console.error(`[WPGraphQL] ${op} failed after ${duration}ms: ${detail}`, {
      endpoint: WP_GRAPHQL_URL,
      timeoutMs: resolvedTimeout,
      variables,
      stack: err.stack,
    });

    throw new Error(
      `WPGraphQL request failed for ${op} at ${WP_GRAPHQL_URL} after ${duration}ms: ${detail}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
