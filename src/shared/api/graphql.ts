export async function wpQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(import.meta.env.PUBLIC_WP_GRAPHQL_URL ?? "https://example.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`WPGraphQL request failed: ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}
