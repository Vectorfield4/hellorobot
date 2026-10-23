/**
 * Валидация формы заказа. Чистые функции без DOM: их же использует серверный
 * эндпоинт как ориентир по формату, поэтому здесь нет ни ссылок на window,
 * ни форматирования под конкретный input.
 */

export interface OrderFormValues {
  name: string;
  phone: string;
  email: string;
  comment: string;
  consent: boolean;
}

export type OrderField = keyof OrderFormValues;

export type OrderFormErrors = Partial<Record<OrderField, string>>;

/** Порядок полей в форме: по нему ищем первое невалидное поле для фокуса. */
export const ORDER_FIELDS: readonly OrderField[] = ["name", "phone", "email", "comment", "consent"];

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const COMMENT_MAX_LENGTH = 2000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Только цифры, пробелы и обычные разделители записи номера. */
const PHONE_ALLOWED_PATTERN = /^\+?[\d\s()-]+$/;
const RU_DIGITS_LENGTH = 11;

/**
 * Приводит российский номер к виду `+7XXXXXXXXXX`.
 * Понимает `+7`, `7` и `8` плюс десять цифр; пробелы, скобки и дефисы
 * игнорируются. Всё остальное (буквы, добавочные, короткие номера) — `null`.
 */
export function normalizeRuPhone(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!PHONE_ALLOWED_PATTERN.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== RU_DIGITS_LENGTH) return null;

  const national = digits.slice(1);
  const prefix = digits[0];
  if (prefix !== "7" && prefix !== "8") return null;
  // `+` допустим только с семёркой: `+8 999…` — не российская запись.
  if (trimmed.startsWith("+") && prefix !== "7") return null;

  return `+7${national}`;
}

export function validateOrderForm(values: OrderFormValues): OrderFormErrors {
  const errors: OrderFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Укажите имя";
  } else if (name.length < NAME_MIN_LENGTH) {
    errors.name = "Имя слишком короткое";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Имя не длиннее ${NAME_MAX_LENGTH} символов`;
  }

  const phone = values.phone.trim();
  if (!phone) {
    errors.phone = "Укажите телефон";
  } else if (!normalizeRuPhone(phone)) {
    errors.phone = "Телефон в формате +7 999 123-45-67";
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = "Укажите почту";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Проверьте адрес почты";
  }

  if (values.comment.trim().length > COMMENT_MAX_LENGTH) {
    errors.comment = `Комментарий не длиннее ${COMMENT_MAX_LENGTH} символов`;
  }

  if (!values.consent) {
    errors.consent = "Без согласия нельзя отправить заказ";
  }

  return errors;
}

/** Первое невалидное поле в порядке формы — на него ставим фокус. */
export function firstInvalidField(errors: OrderFormErrors): OrderField | null {
  for (const field of ORDER_FIELDS) {
    if (errors[field]) return field;
  }
  return null;
}
