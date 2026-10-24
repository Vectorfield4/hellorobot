import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useRef, useState } from "react";
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
  link: { color: tokens.colorAccent },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "1.5rem",
    overflowY: "auto",
    backgroundColor: "rgba(17, 17, 17, 0.55)",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    cursor: "default",
  },
  dialog: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "34rem",
    margin: "auto",
    padding: "1.75rem",
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorBg,
    color: tokens.colorFg,
    boxShadow: "0 1rem 3rem rgba(17, 17, 17, 0.25)",
  },
  close: {
    position: "absolute",
    top: "0.6rem",
    right: "0.6rem",
    width: "2.25rem",
    height: "2.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderWidth: 0,
    borderRadius: "999px",
    backgroundColor: "transparent",
    color: tokens.colorFg,
    fontSize: "1.5rem",
    lineHeight: 1,
    cursor: "pointer",
  },
});

export default function OrderPanel({ productId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Переход по `#order` с карточки или из статьи должен сразу открыть модалку:
  // иначе анкор приводит к странице, где формы ещё нет.
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === ANCHOR_HASH) setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  // Пока модалка открыта: Escape закрывает, Tab не уходит на страницу под ней,
  // а фон не прокручивается. Фокус возвращается на кнопку «Заказать».
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    <div {...stylex.props(styles.root)}>
      <button
        {...stylex.props(styles.trigger)}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Заказать
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

      {open && (
        <div {...stylex.props(styles.overlay)}>
          <button
            {...stylex.props(styles.backdrop)}
            type="button"
            tabIndex={-1}
            aria-label="Закрыть окно заказа"
            onClick={close}
          />
          <div
            {...stylex.props(styles.dialog)}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Оформление заказа"
          >
            <button
              {...stylex.props(styles.close)}
              ref={closeRef}
              type="button"
              aria-label="Закрыть"
              onClick={close}
            >
              ×
            </button>
            <OrderForm productId={productId} productName={productName} />
          </div>
        </div>
      )}
    </div>
  );
}
