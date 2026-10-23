#!/usr/bin/env node
// Товары WooCommerce для hellorobot.ru: импорт каталога и проверка покрытия тегов статьи.
//
//   node scripts/products.mjs import --file products/catalog.json [--dry-run] [--publish]
//   node scripts/products.mjs ensure --slug <article-slug> [--file products/catalog.json] [--fix]
//   node scripts/products.mjs ensure --tags "гуманоиды,коботы" [--file products/catalog.json] [--fix]
//   node scripts/products.mjs list [--tag <tag>]
//
// Переменные окружения:
//   HELLOROBOT_WP_URL     — по умолчанию https://hello-robot.ru
//   HELLOROBOT_WC_KEY     — ключ WooCommerce REST v3 (basic auth)
//   HELLOROBOT_WC_SECRET  — секрет WooCommerce REST v3
//
// Только `import --dry-run` и `list` через публичный Store API живут без ключей.
// Любая пишущая команда без ключей печатает ошибку и выходит с кодом 2.

import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://hello-robot.ru";
const DEFAULT_CATALOG = "products/catalog.json";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const USAGE = `Usage:
  node scripts/products.mjs import --file products/catalog.json [--dry-run] [--publish]
  node scripts/products.mjs ensure --slug <article-slug> [--file products/catalog.json] [--fix]
  node scripts/products.mjs ensure --tags "гуманоиды,коботы" [--file products/catalog.json] [--fix]
  node scripts/products.mjs list [--tag <tag>]`;

/** Ошибка воркфлоу (а не баг): печатается без stack trace, код выхода 2. */
export class CliError extends Error {}

// --- Чистые функции: теги -------------------------------------------------

/**
 * Нормализация имени тега: lowercase, ё→е, пунктуация и лишние пробелы вон.
 * "  Промышленная,  РОБОТОТЕХНИКА! " → "промышленная робототехника"
 */
export function normalizeTag(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Синонимы тегов: канонический русский тег блога → как тот же тег пишут иначе.
 * Достаточно добавить строку сюда, чтобы EN-тег совпал с RU-тегом статьи.
 * Зеркало карты для фронтенда — src/shared/config/productTags.ts: набор канонов
 * должен совпадать, иначе ensure скажет «покрыто», а блок «Купить робота» не отрисуется.
 */
export const TAG_ALIASES = {
  гуманоиды: ["humanoid", "humanoids", "humanoid robot", "humanoid robots", "гуманоид"],
  коботы: ["cobot", "cobots", "collaborative robot", "collaborative robots", "кобот"],
  манипуляторы: ["manipulator", "manipulators", "robotic arm", "robot arm", "манипулятор"],
  манипуляция: ["manipulation", "grasping", "grasp", "захват"],
  "мягкая робототехника": ["soft robotics", "soft robot", "soft robots"],
  "складская логистика": [
    "warehouse",
    "warehouse logistics",
    "intralogistics",
    "склад",
    "логистика",
  ],
  автономность: ["autonomy", "autonomous", "autonomous navigation"],
  навигация: ["navigation", "slam", "path planning"],
  тактильность: ["tactile", "tactility", "haptics", "tactile sensing"],
  "промышленная робототехника": ["industrial robotics", "industrial robots", "industrial robot"],
  "промышленная автоматизация": ["industrial automation", "factory automation"],
  "биоинспирированная робототехника": ["bio-inspired robotics", "bioinspired robotics"],
  "открытое железо": ["open hardware", "open source hardware", "open-source hardware"],
  "оборонная робототехника": ["defense robotics", "defence robotics", "military robotics"],
  электромобили: ["electric vehicles", "electric vehicle", "ev"],
  роботы: ["robot", "robots", "quadruped", "quadruped robot", "mobile robot"],
  робототехника: ["robotics"],
  исследования: ["research"],
  индустрия: ["industry"],
};

const ALIAS_INDEX = new Map();
for (const [canonical, aliases] of Object.entries(TAG_ALIASES)) {
  const key = normalizeTag(canonical);
  if (!ALIAS_INDEX.has(key)) ALIAS_INDEX.set(key, key);
  for (const alias of aliases) {
    const aliasKey = normalizeTag(alias);
    if (!ALIAS_INDEX.has(aliasKey)) ALIAS_INDEX.set(aliasKey, key);
  }
}

/** Канонический вид тега: нормализация + разворот алиасов в обе стороны. */
export function canonicalTag(raw) {
  const key = normalizeTag(raw);
  return ALIAS_INDEX.get(key) ?? key;
}

/** Теги бывают строками (каталог) и объектами {id,name,slug} (Store API / WC REST). */
export function tagNames(tags) {
  return (Array.isArray(tags) ? tags : [])
    .map((tag) => (typeof tag === "string" ? tag : tag?.name))
    .filter((name) => typeof name === "string" && name.trim() !== "");
}

export function splitTags(value) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Все товары, у которых есть тег (с учётом алиасов). */
export function productsWithTag(products, tag) {
  const key = canonicalTag(tag);
  return (products ?? []).filter((product) =>
    tagNames(product?.tags).some((name) => canonicalTag(name) === key),
  );
}

/**
 * «тег статьи → сколько товаров с этим тегом».
 * rows: [{ tag, key, count, covered }], uncovered — теги без товаров.
 */
export function coverageFor(articleTags, products) {
  const productTags = (products ?? []).map((product) =>
    tagNames(product?.tags).map((name) => canonicalTag(name)),
  );
  const rows = (articleTags ?? []).map((tag) => {
    const key = canonicalTag(tag);
    const count = productTags.filter((tags) => tags.includes(key)).length;
    return { tag, key, count, covered: count > 0 };
  });
  return {
    rows,
    covered: rows.some((row) => row.covered),
    uncovered: rows.filter((row) => !row.covered).map((row) => row.tag),
  };
}

/** Есть покрытие → 0, нет → 1. Пустой список тегов разбирает вызывающий код (код 2). */
export function exitCodeForCoverage(coverage) {
  return coverage?.covered ? 0 : 1;
}

// --- Чистые функции: payload WooCommerce ----------------------------------

/**
 * Статус товара.
 * Без --publish ничего не публикуем. С --publish публикуем только то, что помечено
 * `status: "publish"` в файле, и никогда не переводим чужой draft в publish.
 * Живой товар в publish не понижаем: import не должен случайно снять товар с витрины.
 */
export function resolveStatus(fileStatus, { publish = false, existingStatus } = {}) {
  if (existingStatus === "publish") return "publish";
  return publish && fileStatus === "publish" ? "publish" : "draft";
}

/** Что import не сможет отправить: без sku нет upsert, без name нет товара. */
export function missingProductFields(product) {
  const missing = [];
  if (!product?.sku) missing.push("sku");
  if (!product?.name) missing.push("name");
  return missing;
}

/**
 * Payload для WC REST v3 (POST/PUT /products).
 * Теги и категории идут как [{name}] — WooCommerce создаёт термины сам.
 * `price` не отправляем: в WC REST это read-only поле, цену задаёт regular_price.
 */
export function buildProductPayload(product, { publish = false, existingStatus } = {}) {
  const regularPrice = String(product?.regular_price ?? product?.price ?? "0");
  const payload = {
    name: product?.name,
    type: product?.type ?? "simple",
    sku: product?.sku,
    status: resolveStatus(product?.status, { publish, existingStatus }),
    regular_price: regularPrice,
    stock_status: product?.stock_status ?? "onbackorder",
    manage_stock: Boolean(product?.manage_stock),
    short_description: product?.short_description ?? "",
    description: product?.description ?? "",
    categories: tagNames(product?.categories).map((name) => ({ name })),
    tags: tagNames(product?.tags).map((name) => ({ name })),
    images: (Array.isArray(product?.images) ? product.images : [])
      .filter((image) => image?.src)
      .map((image) => ({ src: image.src })),
  };
  if (product?.sale_price) payload.sale_price = String(product.sale_price);
  if (product?.slug) payload.slug = product.slug;
  return payload;
}

/** Store API отдаёт цену в минорных единицах: 1999900 + 2 → "19999.00". */
export function minorToDecimal(value, minorUnit = 2) {
  const digits = Number(minorUnit ?? 2);
  const number = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(number)) return "";
  return (number / 10 ** digits).toFixed(digits);
}

/** Единый вид товара для таблиц, независимо от источника (Store API / WC REST / каталог). */
export function productView(product) {
  const prices = product?.prices ?? {};
  const price =
    prices.price !== undefined ? minorToDecimal(prices.price, prices.currency_minor_unit) : "";
  return {
    id: product?.id,
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    status: product?.status ?? "publish",
    price: price || String(product?.price ?? ""),
    tags: tagNames(product?.tags),
  };
}

// --- Чистые функции: аргументы ---------------------------------------------

const BOOLEAN_FLAGS = new Set(["dry-run", "publish", "fix"]);
const VALUE_FLAGS = new Set(["file", "slug", "tags", "tag"]);

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function parseArgs(argv = []) {
  const [command = "", ...rest] = argv;
  const flags = { file: DEFAULT_CATALOG, dryRun: false, publish: false, fix: false };
  const unknown = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg?.startsWith("--")) continue;
    const name = arg.slice(2);

    if (BOOLEAN_FLAGS.has(name)) {
      flags[toCamel(name)] = true;
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const value = rest[i + 1];
      if (value !== undefined && !value.startsWith("--")) {
        flags[toCamel(name)] = value;
        i += 1;
      }
      continue;
    }
    unknown.push(name);
  }

  return { command, flags, unknown };
}

// --- Побочные функции: HTTP ------------------------------------------------

function siteConfig(env = process.env) {
  return {
    url: (env.HELLOROBOT_WP_URL || DEFAULT_URL).replace(/\/+$/, ""),
    key: env.HELLOROBOT_WC_KEY || "",
    secret: env.HELLOROBOT_WC_SECRET || "",
  };
}

function hasCredentials(site) {
  return Boolean(site.key && site.secret);
}

function credentialsHint() {
  return "нет ключей WooCommerce: задайте HELLOROBOT_WC_KEY и HELLOROBOT_WC_SECRET (WooCommerce → Настройки → Дополнительно → REST API, права read/write)";
}

async function request(url, { method = "GET", body, headers = {} } = {}) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {}

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new CliError(`нет связи с ${host}: ${error?.message ?? error}`);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const snippet = String(typeof data === "string" ? data : JSON.stringify(data ?? ""))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const error = new CliError(`${method} ${url} → HTTP ${response.status} ${snippet}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function wcUrl(site, path, query = {}) {
  const url = new URL(`${site.url}/wp-json/wc/v3${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function wcRequest(site, path, { method = "GET", query = {}, body } = {}) {
  if (!hasCredentials(site)) throw new CliError(credentialsHint());
  const auth = Buffer.from(`${site.key}:${site.secret}`).toString("base64");
  try {
    return await request(wcUrl(site, path, query), {
      method,
      body,
      headers: { Authorization: `Basic ${auth}` },
    });
  } catch (error) {
    // Часть хостингов срезает заголовок Authorization; WooCommerce принимает ключи и в query.
    if (error?.status !== 401) throw error;
    return await request(
      wcUrl(site, path, { ...query, consumer_key: site.key, consumer_secret: site.secret }),
      { method, body },
    );
  }
}

async function storeProducts(site) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${site.url}/wp-json/wc/store/v1/products`);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const batch = await request(url.toString());
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

/** Товары для чтения: публичный Store API, при его отсутствии — WC REST (если есть ключи). */
async function readProducts(site) {
  try {
    return (await storeProducts(site)).map(productView);
  } catch (error) {
    if (!hasCredentials(site)) throw error;
    const found = await wcRequest(site, "/products", { query: { per_page: PAGE_SIZE } });
    return (Array.isArray(found) ? found : []).map(productView);
  }
}

async function articleTags(site, slug) {
  const url = new URL(`${site.url}/wp-json/wp/v2/posts`);
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "id,slug,title,tags");
  url.searchParams.set("per_page", "1");

  const posts = await request(url.toString());
  const post = Array.isArray(posts) ? posts[0] : null;
  if (!post) {
    throw new CliError(`статья "${slug}" не найдена: ${url.toString()}`);
  }

  const ids = (Array.isArray(post.tags) ? post.tags : []).map(Number).filter(Boolean);
  if (ids.length === 0) return { title: post.title?.rendered ?? slug, tags: [] };

  const termsUrl = new URL(`${site.url}/wp-json/wp/v2/tags`);
  termsUrl.searchParams.set("include", ids.join(","));
  termsUrl.searchParams.set("per_page", "100");
  termsUrl.searchParams.set("_fields", "id,name");

  const terms = await request(termsUrl.toString());
  const names = (Array.isArray(terms) ? terms : []).map((term) => term?.name).filter(Boolean);
  return { title: post.title?.rendered ?? slug, tags: names };
}

// --- Побочные функции: файлы и печать --------------------------------------

function readCatalog(file = DEFAULT_CATALOG) {
  let raw;
  try {
    raw = readFileSync(resolve(file), "utf8");
  } catch {
    throw new CliError(`не читается каталог ${file}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new CliError(`${file}: невалидный JSON (${error?.message ?? error})`);
  }

  const products = Array.isArray(data) ? data : data?.products;
  if (!Array.isArray(products)) throw new CliError(`${file}: ожидался массив products`);

  return { currency: Array.isArray(data) ? "RUB" : (data.currency ?? "RUB"), products };
}

async function findBySku(site, sku) {
  const found = await wcRequest(site, "/products", { query: { sku, per_page: 1 } });
  return Array.isArray(found) ? (found[0] ?? null) : null;
}

/** upsert по sku: GET по sku, затем POST (новый) или PUT (существующий). */
async function syncProducts(site, products, { publish = false, dryRun = false } = {}) {
  const results = [];

  for (const product of products) {
    const missing = missingProductFields(product);
    if (missing.length > 0) {
      console.log(`skip ${product?.sku || "(без sku)"}: нет ${missing.join(", ")}`);
      results.push({ sku: product?.sku ?? "", action: "skip", reason: missing.join(", ") });
      continue;
    }

    const existing = dryRun ? null : await findBySku(site, product.sku);
    const payload = buildProductPayload(product, { publish, existingStatus: existing?.status });

    if (dryRun) {
      console.log(`\n[dry-run] ${existing ? "update" : "create"} ${product.sku}`);
      console.log(JSON.stringify(payload, null, 2));
      results.push({ sku: product.sku, action: "dry-run", status: payload.status });
      continue;
    }

    const saved = existing
      ? await wcRequest(site, `/products/${existing.id}`, { method: "PUT", body: payload })
      : await wcRequest(site, "/products", { method: "POST", body: payload });

    console.log(
      `${existing ? "updated" : "created"} #${saved?.id ?? "?"} ${saved?.sku ?? product.sku} (${saved?.status ?? payload.status})`,
    );
    results.push({
      sku: product.sku,
      action: existing ? "update" : "create",
      id: saved?.id,
      status: saved?.status ?? payload.status,
    });
  }

  return results;
}

function printCoverage(coverage, source) {
  console.log(`теги статьи → товары в WooCommerce (${source})`);
  const width = Math.max(4, ...coverage.rows.map((row) => [...row.tag].length));
  for (const row of coverage.rows) {
    console.log(`${row.covered ? "ok  " : "нет "} ${row.tag.padEnd(width)}  ${row.count}`);
  }
}

// --- Команды ---------------------------------------------------------------

async function commandImport(flags) {
  const site = siteConfig();
  if (!flags.dryRun && !hasCredentials(site)) throw new CliError(credentialsHint());

  const catalog = readCatalog(flags.file);
  console.log(
    `${flags.file}: ${catalog.products.length} товар(ов), валюта ${catalog.currency}${
      flags.dryRun ? ", режим dry-run (ничего не отправляется)" : ""
    }`,
  );

  const results = await syncProducts(site, catalog.products, {
    publish: flags.publish,
    dryRun: flags.dryRun,
  });

  const created = results.filter((item) => item.action === "create").length;
  const updated = results.filter((item) => item.action === "update").length;
  const skipped = results.filter((item) => item.action === "skip").length;
  console.log(
    `${flags.dryRun ? "dry-run" : "готово"}: create ${created}, update ${updated}, skip ${skipped}`,
  );

  return skipped > 0 ? 1 : 0;
}

async function commandEnsure(flags) {
  const site = siteConfig();

  if (!flags.slug && !flags.tags) {
    throw new CliError('ensure нужен --slug <article-slug> или --tags "тег,тег"');
  }

  const catalog = flags.fix || flags.dryRun ? readCatalog(flags.file) : null;

  const article = flags.tags
    ? { title: "", tags: splitTags(flags.tags) }
    : await articleTags(site, flags.slug);

  if (article.tags.length === 0) {
    throw new CliError(
      `у статьи "${article.title || flags.slug}" нет тегов в WordPress — проставьте их или передайте --tags`,
    );
  }

  const source = flags.dryRun ? `локальный ${flags.file}` : site.url;
  let products = flags.dryRun ? catalog.products : await readProducts(site);
  let coverage = coverageFor(article.tags, products);
  printCoverage(coverage, source);

  if (coverage.covered) return 0;

  if (!flags.fix) {
    console.log(`\nбез покрытия: ${coverage.uncovered.join(", ")}`);
    console.log(
      `проверьте products/catalog.json или запустите с --fix, чтобы создать товары из каталога`,
    );
    return 1;
  }

  if (!flags.dryRun && !hasCredentials(site)) throw new CliError(credentialsHint());

  const toSync = [];
  for (const tag of coverage.uncovered) {
    for (const product of productsWithTag(catalog.products, tag)) {
      if (!toSync.some((item) => item.sku === product.sku)) toSync.push(product);
    }
  }

  if (toSync.length === 0) {
    console.log(`\nв ${flags.file} нет товаров с тегами: ${coverage.uncovered.join(", ")}`);
    return 1;
  }

  console.log(`\n--fix: ${toSync.length} товар(ов) из ${flags.file}`);
  await syncProducts(site, toSync, { publish: flags.publish, dryRun: flags.dryRun });

  products = flags.dryRun ? toSync : await readProducts(site);
  coverage = coverageFor(article.tags, products);
  printCoverage(coverage, flags.dryRun ? `локальный ${flags.file} + payload` : site.url);

  if (coverage.covered) return 0;
  console.log(`\nвсё ещё без покрытия: ${coverage.uncovered.join(", ")}`);
  if (!flags.publish) {
    // Store API (и блок «Купить робота» на сайте) видят только опубликованные товары.
    console.log(
      "товары созданы в draft: проверьте цену, наличие и картинку, опубликуйте их в WooCommerce",
    );
  }
  return exitCodeForCoverage(coverage);
}

async function commandList(flags) {
  const site = siteConfig();
  let products = await readProducts(site);
  if (flags.tag) products = productsWithTag(products, flags.tag);

  if (products.length === 0) {
    console.log(flags.tag ? `нет товаров с тегом "${flags.tag}"` : "товаров нет");
    return 0;
  }

  for (const product of products) {
    const cells = [
      `#${product.id ?? "?"}`,
      product.sku || "-",
      product.name || "-",
      product.status || "-",
      product.price || "-",
      product.tags.join("/") || "-",
    ];
    console.log(cells.join(" | "));
  }
  return 0;
}

export async function run(argv = process.argv.slice(2)) {
  const { command, flags, unknown } = parseArgs(argv);

  if (unknown.length > 0) {
    console.error(`неизвестный флаг: --${unknown.join(", --")}`);
    console.error(USAGE);
    return 2;
  }

  try {
    switch (command) {
      case "import":
        return await commandImport(flags);
      case "ensure":
        return await commandEnsure(flags);
      case "list":
        return await commandList(flags);
      default:
        console.error(USAGE);
        return 2;
    }
  } catch (error) {
    console.error(`ошибка: ${error?.message ?? error}`);
    if (!(error instanceof CliError) && error?.cause) {
      console.error(`причина: ${error.cause?.message ?? error.cause}`);
    }
    return 2;
  }
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  run().then((code) => {
    process.exitCode = code;
  });
}
