import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useState } from "react";
import { storeCheckoutUrl } from "@/shared/data/orders";
import { tokens } from "@/shared/design/tokens.stylex";
import OrderForm from "./OrderForm";

interface Props {
  productId: number;
  productName: string;
}

/** Анкор `#order` с карточек и статей — на обёртке в `[slug].astro`. */
const ANCHOR_HASH = "#order";

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spaceMd,
    fontFamily: tokens.fontBody,
    color: tokens.colorFg,
  },
  trigger: {
    width: "100%",
    fontFamily: tokens.fontBody,
    fontSize: "1.05rem",
    fontWeight: 600,
    padding: "0.95rem 1.5rem",
    borderWidth: 0,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorAccent,
    color: "#ffffff",
    cursor: "pointer",
  },
  hint: { margin: 0, fontSize: "0.85rem", opacity: 0.7 },
  panel: { display: "flex", flexDirection: "column", gap: tokens.spaceMd },
  link: { color: tokens.colorAccent },
});

export default function OrderPanel({ productId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = `order-panel-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Переход по `#order` с карточки или из статьи должен сразу показать форму:
  // иначе анкор приводит к странице, где формы ещё нет.
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === ANCHOR_HASH) setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div {...stylex.props(styles.root)}>
      <button
        {...stylex.props(styles.trigger)}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Свернуть форму заказа" : "Заказать"}
      </button>

      <noscript>
        <p {...stylex.props(styles.hint)}>
          Без JavaScript форма не откроется. Заказ можно оформить на сайте магазина:{" "}
          <a {...stylex.props(styles.link)} href={storeCheckoutUrl(productId)}>
            оформить на сайте магазина
          </a>
          .
        </p>
      </noscript>

      {/* Контейнер есть всегда, чтобы `aria-controls` указывал на существующий
          элемент; сама форма до клика в DOM не попадает. */}
      <div {...stylex.props(styles.panel)} id={panelId}>
        {open && <OrderForm productId={productId} productName={productName} />}
      </div>
    </div>
  );
}
