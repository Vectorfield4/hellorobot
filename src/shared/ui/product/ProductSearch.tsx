import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchProductsClient } from "@/shared/api/storeClient";
import { filterProducts, type Product } from "@/shared/data/product";
import { tokens } from "@/shared/design/tokens.stylex";
import ProductGrid from "@/shared/ui/product/ProductGrid";

interface Props {
  /** Урезанный индекс, собранный на билде: поиск работает и без сети. */
  products: Product[];
  /** База Store API. Пустая строка оставляет только поиск по индексу. */
  storeUrl: string;
}

type Status = "idle" | "loading" | "ready" | "local" | "error";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const styles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: tokens.spaceSm },
  label: { fontSize: "0.9rem", fontWeight: 600 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.6rem 0.75rem",
    fontSize: "1rem",
    fontFamily: tokens.fontBody,
    color: tokens.colorFg,
    backgroundColor: tokens.colorBg,
    border: "1px solid #ccc",
    borderRadius: tokens.radiusMd,
  },
  hint: { margin: 0, fontSize: "0.85rem", opacity: 0.7 },
  status: { margin: 0, fontSize: "0.9rem", minHeight: "1.2em" },
  error: { margin: 0, fontSize: "0.9rem", color: "#8a2b0f" },
  retry: {
    padding: "0.2rem 0.6rem",
    fontSize: "0.85rem",
    fontFamily: tokens.fontBody,
    color: tokens.colorAccent,
    backgroundColor: "transparent",
    border: "1px solid currentColor",
    borderRadius: tokens.radiusMd,
    cursor: "pointer",
  },
});

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
}

export default function ProductSearch({ products, storeUrl }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const trimmed = query.trim();
  const longEnough = trimmed.length >= MIN_QUERY_LENGTH;
  const networkAvailable = storeUrl.trim().length > 0;

  const runNetworkSearch = useCallback(
    (value: string) => {
      // Новый запрос отменяет предыдущий, а id отсекает запоздавшие ответы.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setStatus("loading");
      searchProductsClient(value, controller.signal)
        .then((found) => {
          if (requestId !== requestIdRef.current) return;
          setResults(found);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current || isAbortError(error)) return;
          // Сеть отвалилась — отвечаем по индексу, собранному на билде.
          setResults(filterProducts(products, value));
          setStatus("error");
        });
    },
    [products],
  );

  useEffect(() => {
    if (!longEnough) {
      controllerRef.current?.abort();
      setResults(null);
      setStatus("idle");
      return;
    }

    if (!networkAvailable) {
      setResults(filterProducts(products, trimmed));
      setStatus("local");
      return;
    }

    const timer = setTimeout(() => runNetworkSearch(trimmed), DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [trimmed, longEnough, networkAvailable, products, runNetworkSearch]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const loading = status === "loading";
  const summary = loading
    ? "Ищем в каталоге…"
    : results === null
      ? ""
      : results.length === 0
        ? "Ничего не нашлось"
        : `Найдено товаров: ${results.length}`;

  return (
    // biome-ignore lint/a11y/useSemanticElements: форма поиска без отправки на сервер
    <div role="search" {...stylex.props(styles.root)}>
      <label htmlFor="product-search" {...stylex.props(styles.label)}>
        Поиск по каталогу
      </label>
      <input
        id="product-search"
        type="search"
        value={query}
        placeholder="Название, тег или артикул"
        autoComplete="off"
        aria-describedby="product-search-status"
        onChange={(event) => setQuery(event.target.value)}
        {...stylex.props(styles.input)}
      />
      {!longEnough && (
        <p {...stylex.props(styles.hint)}>
          Введите не меньше двух символов — название, тег или артикул.
        </p>
      )}
      <p id="product-search-status" aria-live="polite" {...stylex.props(styles.status)}>
        {summary}
      </p>
      {status === "error" && (
        <p {...stylex.props(styles.error)}>
          Сервер каталога не ответил, показываем совпадения по сайту.{" "}
          <button
            type="button"
            onClick={() => runNetworkSearch(trimmed)}
            {...stylex.props(styles.retry)}
          >
            Повторить
          </button>
        </p>
      )}
      {!loading && results !== null && results.length > 0 && <ProductGrid products={results} />}
    </div>
  );
}
