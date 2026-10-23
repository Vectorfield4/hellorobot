import * as stylex from "@stylexjs/stylex";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createOrder, OrderError, storeCheckoutUrl } from "@/shared/data/orders";
import { tokens } from "@/shared/design/tokens.stylex";
import {
  COMMENT_MAX_LENGTH,
  firstInvalidField,
  normalizeRuPhone,
  type OrderField,
  type OrderFormErrors,
  type OrderFormValues,
  validateOrderForm,
} from "./orderValidation";

interface Props {
  productId: number;
  productName: string;
  priceLabel?: string;
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; orderNumber: string }
  | { kind: "error"; message: string; storeFallback: boolean };

const RATE_LIMITED_MESSAGE = "Слишком много заказов подряд. Попробуйте через 15 минут.";
const GENERAL_MESSAGE = "Не удалось отправить заказ.";
const PHONE_HINT = "Формат: +7 999 123-45-67";

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spaceMd,
    fontFamily: tokens.fontBody,
    color: tokens.colorFg,
    backgroundColor: tokens.colorBg,
  },
  title: { margin: 0, fontSize: "1.25rem", lineHeight: 1.3 },
  summary: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    border: "1px solid #ddd",
    borderRadius: tokens.radiusMd,
  },
  productName: { fontWeight: 700 },
  price: { fontSize: "1.1rem" },
  quantity: { opacity: 0.8 },
  note: { margin: 0, fontSize: "0.9rem", opacity: 0.8 },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spaceMd,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  label: { fontSize: "0.9rem", fontWeight: 600 },
  input: {
    fontFamily: tokens.fontBody,
    fontSize: "1rem",
    padding: "0.55rem 0.7rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ccc",
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorBg,
    color: tokens.colorFg,
  },
  inputInvalid: { borderColor: "#c62828" },
  textarea: {
    fontFamily: tokens.fontBody,
    fontSize: "1rem",
    minHeight: "5.5rem",
    padding: "0.55rem 0.7rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ccc",
    borderRadius: tokens.radiusMd,
    resize: "vertical",
  },
  hint: { fontSize: "0.8rem", opacity: 0.7 },
  fieldError: { margin: 0, fontSize: "0.85rem", color: "#c62828" },
  consentRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spaceSm,
  },
  checkbox: { marginTop: "0.2rem" },
  consentLabel: { fontSize: "0.9rem", lineHeight: 1.4 },
  submit: {
    alignSelf: "flex-start",
    fontSize: "1rem",
    padding: "0.6rem 1.4rem",
    borderWidth: 0,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.colorAccent,
    color: "#ffffff",
    cursor: "pointer",
  },
  submitDisabled: { opacity: 0.6, cursor: "default" },
  live: { display: "flex", flexDirection: "column", gap: tokens.spaceSm },
  formError: { margin: 0, color: "#c62828" },
  link: { color: tokens.colorAccent },
  success: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    border: "1px solid #ccc",
    borderRadius: tokens.radiusMd,
  },
  successTitle: { margin: 0, fontSize: "1.1rem", fontWeight: 700 },
  honeypot: {
    position: "absolute",
    left: "-9999px",
    width: "1px",
    height: "1px",
    overflow: "hidden",
  },
});

function errorToStatus(error: unknown): FormStatus {
  if (!(error instanceof OrderError)) {
    return { kind: "error", message: GENERAL_MESSAGE, storeFallback: true };
  }
  if (error.code === "rate_limited") {
    return { kind: "error", message: RATE_LIMITED_MESSAGE, storeFallback: false };
  }
  if (
    error.code === "network" ||
    error.code === "woocommerce_missing" ||
    error.code === "unknown"
  ) {
    return { kind: "error", message: GENERAL_MESSAGE, storeFallback: true };
  }
  return {
    kind: "error",
    message: error.message.trim() || GENERAL_MESSAGE,
    storeFallback: false,
  };
}

export default function OrderForm({ productId, productName, priceLabel }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const inputId = (field: string) => `${uid}-${field}`;
  const errorId = (field: string) => `${uid}-${field}-error`;

  const [values, setValues] = useState<OrderFormValues>({
    name: "",
    phone: "",
    email: "",
    comment: "",
    consent: false,
  });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const submitting = status.kind === "submitting";

  function setField<K extends OrderField>(field: K, value: OrderFormValues[K]) {
    setValues((prev) => {
      const next: OrderFormValues = { ...prev };
      next[field] = value;
      return next;
    });
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next: OrderFormErrors = { ...prev };
      delete next[field];
      return next;
    });
  }

  function describedBy(field: OrderField, extra?: string): string | undefined {
    const ids = [errors[field] ? errorId(field) : null, extra ?? null].filter((id): id is string =>
      Boolean(id),
    );
    return ids.length > 0 ? ids.join(" ") : undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "submitting") return;
    const found = validateOrderForm(values);
    setErrors(found);
    const firstBad = firstInvalidField(found);
    if (firstBad) {
      document.getElementById(inputId(firstBad))?.focus();
      return;
    }

    const phone = normalizeRuPhone(values.phone);
    if (!phone) return;

    const startedAt = mountedAt.current ?? Date.now();
    setStatus({ kind: "submitting" });
    try {
      const result = await createOrder({
        productId,
        quantity: 1,
        name: values.name.trim(),
        phone,
        email: values.email.trim(),
        comment: values.comment.trim(),
        consent: values.consent,
        elapsedMs: Math.max(0, Date.now() - startedAt),
        sourceUrl: typeof window === "undefined" ? "" : window.location.href,
        website,
      });
      setStatus({ kind: "success", orderNumber: result.orderNumber });
    } catch (error) {
      setStatus(errorToStatus(error));
    }
  }

  const checkout = storeCheckoutUrl(productId);

  return (
    <section {...stylex.props(styles.root)} id="order" aria-labelledby={inputId("title")}>
      <h2 id={inputId("title")} {...stylex.props(styles.title)}>
        Оформить заказ
      </h2>

      <div {...stylex.props(styles.summary)}>
        <span {...stylex.props(styles.productName)}>{productName}</span>
        {priceLabel && <span {...stylex.props(styles.price)}>{priceLabel}</span>}
        <span {...stylex.props(styles.quantity)}>1 шт.</span>
        <p {...stylex.props(styles.note)}>
          Оплата не на сайте: менеджер подтвердит наличие и способ получения.
        </p>
      </div>

      <div {...stylex.props(styles.live)} aria-live="polite" role="status">
        {status.kind === "error" && <p {...stylex.props(styles.formError)}>{status.message}</p>}
        {status.kind === "error" && status.storeFallback && (
          <a {...stylex.props(styles.link)} href={checkout}>
            Оформить на сайте магазина
          </a>
        )}
        {status.kind === "success" && (
          <div {...stylex.props(styles.success)}>
            <p {...stylex.props(styles.successTitle)}>Заказ №{status.orderNumber} принят</p>
            <p {...stylex.props(styles.note)}>Менеджер свяжется по телефону.</p>
            <a {...stylex.props(styles.link)} href="/products">
              Вернуться в каталог
            </a>
          </div>
        )}
      </div>

      {status.kind !== "success" && (
        <form {...stylex.props(styles.form)} noValidate onSubmit={handleSubmit}>
          <div {...stylex.props(styles.field)}>
            <label {...stylex.props(styles.label)} htmlFor={inputId("name")}>
              Имя
            </label>
            <input
              {...stylex.props(styles.input, Boolean(errors.name) && styles.inputInvalid)}
              id={inputId("name")}
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              disabled={submitting}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy("name")}
              onChange={(event) => setField("name", event.target.value)}
            />
            {errors.name && (
              <p {...stylex.props(styles.fieldError)} id={errorId("name")}>
                {errors.name}
              </p>
            )}
          </div>

          <div {...stylex.props(styles.field)}>
            <label {...stylex.props(styles.label)} htmlFor={inputId("phone")}>
              Телефон
            </label>
            <input
              {...stylex.props(styles.input, Boolean(errors.phone) && styles.inputInvalid)}
              id={inputId("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
              value={values.phone}
              disabled={submitting}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy("phone", inputId("phone-hint"))}
              onChange={(event) => setField("phone", event.target.value)}
            />
            <span {...stylex.props(styles.hint)} id={inputId("phone-hint")}>
              {PHONE_HINT}
            </span>
            {errors.phone && (
              <p {...stylex.props(styles.fieldError)} id={errorId("phone")}>
                {errors.phone}
              </p>
            )}
          </div>

          <div {...stylex.props(styles.field)}>
            <label {...stylex.props(styles.label)} htmlFor={inputId("email")}>
              Почта
            </label>
            <input
              {...stylex.props(styles.input, Boolean(errors.email) && styles.inputInvalid)}
              id={inputId("email")}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              disabled={submitting}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy("email")}
              onChange={(event) => setField("email", event.target.value)}
            />
            {errors.email && (
              <p {...stylex.props(styles.fieldError)} id={errorId("email")}>
                {errors.email}
              </p>
            )}
          </div>

          <div {...stylex.props(styles.field)}>
            <label {...stylex.props(styles.label)} htmlFor={inputId("comment")}>
              Комментарий
            </label>
            <textarea
              {...stylex.props(styles.textarea, Boolean(errors.comment) && styles.inputInvalid)}
              id={inputId("comment")}
              name="comment"
              rows={4}
              value={values.comment}
              disabled={submitting}
              aria-invalid={Boolean(errors.comment)}
              aria-describedby={describedBy("comment", inputId("comment-hint"))}
              onChange={(event) => setField("comment", event.target.value)}
            />
            <span {...stylex.props(styles.hint)} id={inputId("comment-hint")}>
              Необязательно, до {COMMENT_MAX_LENGTH} символов
            </span>
            {errors.comment && (
              <p {...stylex.props(styles.fieldError)} id={errorId("comment")}>
                {errors.comment}
              </p>
            )}
          </div>

          <div {...stylex.props(styles.consentRow)}>
            <input
              {...stylex.props(styles.checkbox)}
              id={inputId("consent")}
              name="consent"
              type="checkbox"
              checked={values.consent}
              disabled={submitting}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={describedBy("consent")}
              onChange={(event) => setField("consent", event.target.checked)}
            />
            <label {...stylex.props(styles.consentLabel)} htmlFor={inputId("consent")}>
              Согласен на обработку персональных данных
            </label>
            <a {...stylex.props(styles.link)} href="/privacy">
              Политика конфиденциальности
            </a>
          </div>
          {errors.consent && (
            <p {...stylex.props(styles.fieldError)} id={errorId("consent")}>
              {errors.consent}
            </p>
          )}

          <div {...stylex.props(styles.honeypot)} aria-hidden="true">
            <label htmlFor={inputId("website")}>Сайт</label>
            <input
              id={inputId("website")}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <button
            {...stylex.props(styles.submit, submitting && styles.submitDisabled)}
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Отправляем…" : "Отправить заказ"}
          </button>
        </form>
      )}

      <noscript>
        <p {...stylex.props(styles.note)}>
          Без JavaScript форма не отправится. Заказ можно оформить на сайте магазина:{" "}
          <a {...stylex.props(styles.link)} href={checkout}>
            оформить на сайте магазина
          </a>
          .
        </p>
      </noscript>
    </section>
  );
}
