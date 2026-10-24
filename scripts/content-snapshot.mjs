#!/usr/bin/env node
// Снимок данных WordPress для сборки: статьи (WPGraphQL) и товары (Store API).
//
// Зачем: раннер GitHub Actions не всегда может открыть TCP до hello-robot.ru
// (UND_ERR_CONNECT_TIMEOUT). Тогда сборка брала пустой каталог и падала на
// статьях. Снимок в репозитории — это «последнее известное состояние»: пока
// сеть жива, данные свежие, а при обрыве сайт всё равно собирается из него.
//
//   node scripts/content-snapshot.mjs
//
// Запускайте после публикации статей или товаров, коммитьте результат.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GRAPHQL = process.env.PUBLIC_WP_GRAPHQL_URL ?? "https://hello-robot.ru/graphql";
const STORE = `${(process.env.PUBLIC_WP_URL ?? "https://hello-robot.ru").replace(/\/+$/, "")}/wp-json/wc/store/v1/products`;

const ALL_POSTS = `
  query AllPosts($first: Int!) {
    posts(first: $first) {
      nodes {
        id
        slug
        title
        date
        excerpt
        content
        tags { nodes { name } }
      }
    }
  }
`;

async function requestJson(url, options, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const posts = await requestJson(
    GRAPHQL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ALL_POSTS, variables: { first: 100 } }),
    },
    "WPGraphQL",
  );
  const nodes = posts?.data?.posts?.nodes ?? [];
  if (nodes.length === 0) throw new Error("WPGraphQL вернул пустой список статей");

  const products = await requestJson(`${STORE}?per_page=100`, {}, "Store API");
  if (!Array.isArray(products)) throw new Error("Store API вернул не массив");

  const postsFile = resolve("src/shared/data/posts.snapshot.json");
  const productsFile = resolve("src/shared/data/products.snapshot.json");
  writeFileSync(postsFile, `${JSON.stringify({ posts: { nodes } }, null, 2)}\n`, "utf8");
  writeFileSync(productsFile, `${JSON.stringify({ products }, null, 2)}\n`, "utf8");

  console.log(`${postsFile}: ${nodes.length} статей`);
  console.log(
    `${productsFile}: ${products.length} товаров (${products.filter((p) => p.status === "publish" || p.is_in_stock !== undefined).length} видимых)`,
  );
}

main().catch((error) => {
  console.error(`снимок не собран: ${error?.message ?? error}`);
  process.exitCode = 1;
});
