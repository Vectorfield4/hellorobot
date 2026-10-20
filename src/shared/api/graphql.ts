import { WP_GRAPHQL_URL } from "@/shared/config/constants";

export async function wpQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`WPGraphQL request failed: ${res.status}`);
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}
