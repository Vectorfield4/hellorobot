export const WP_GRAPHQL_URL =
  import.meta.env.PUBLIC_WP_GRAPHQL_URL ?? "https://hello-robot.ru/graphql";

function resolveWpBaseUrl(): string {
  const explicit = import.meta.env.PUBLIC_WP_URL as string | undefined;
  if (explicit) return explicit.replace(/\/+$/, "");
  return WP_GRAPHQL_URL.replace(/\/graphql\/?$/, "");
}

/** База WordPress: из неё собраны Store API и эндпоинт заказа. */
export const WP_BASE_URL = resolveWpBaseUrl();
export const STORE_API_URL = `${WP_BASE_URL}/wp-json/wc/store/v1`;
export const ORDER_API_URL = `${WP_BASE_URL}/wp-json/hellorobot/v1/order`;
export const SITE_NAME = "hellorobot";
