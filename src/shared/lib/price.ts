/**
 * Цены WooCommerce Store API приходят в минорных единицах строкой
 * (`"189000000"` при `currency_minor_unit: 2`) вместе с настройками формата
 * магазина. Считаем через строки, а не через float: 0.1 + 0.2 в деньгах
 * недопустимы, а суммы бывают крупные.
 */

export interface StorePrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
}

export interface FormatPriceOptions {
  decimalSeparator?: string;
  thousandSeparator?: string;
  prefix?: string;
  suffix?: string;
}

function onlyDigits(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/[^\d-]/g, "");
}

function groupThousands(digits: string, separator: string): string {
  if (!separator) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Минорные единицы → строка с разделителями магазина. Пусто, если цены нет. */
export function formatMinorUnits(
  amount: string | number | undefined | null,
  minorUnit: number,
  options: FormatPriceOptions = {},
): string {
  const digits = onlyDigits(amount);
  if (!digits) return "";
  const negative = digits.startsWith("-");
  const absolute = digits.replace(/-/g, "");
  const unit = Number.isFinite(minorUnit) && minorUnit > 0 ? Math.floor(minorUnit) : 0;
  const padded = absolute.padStart(unit + 1, "0");
  const integerPart = unit > 0 ? padded.slice(0, -unit) : padded;
  const fractionPart = unit > 0 ? padded.slice(-unit) : "";
  const decimal = options.decimalSeparator ?? ",";
  const thousand = options.thousandSeparator ?? " ";
  const number = `${groupThousands(integerPart, thousand)}${
    fractionPart ? `${decimal}${fractionPart}` : ""
  }`;
  return `${negative ? "-" : ""}${options.prefix ?? ""}${number}${options.suffix ?? ""}`;
}

/**
 * Форматирует цену магазина. Нулевая или пустая цена — пустая строка:
 * страница показывает робота, цену называем по телефону, поэтому «цена по
 * запросу» на витрине не появляется вовсе.
 */
export function formatStorePrice(prices: StorePrices | undefined | null): string {
  if (!prices) return "";
  const significant = onlyDigits(prices.price).replace(/^0+/, "");
  if (!significant) return "";
  return formatMinorUnits(prices.price, prices.currency_minor_unit, {
    decimalSeparator: prices.currency_decimal_separator,
    thousandSeparator: prices.currency_thousand_separator,
    prefix: prices.currency_prefix,
    suffix: prices.currency_suffix,
  });
}

/** Цена «до скидки» — только когда скидка реально есть. */
export function formatRegularPrice(prices: StorePrices | undefined | null): string {
  if (!prices) return "";
  const regular = onlyDigits(prices.regular_price).replace(/^0+/, "");
  const current = onlyDigits(prices.price).replace(/^0+/, "");
  if (!regular || regular === current) return "";
  return formatMinorUnits(prices.regular_price, prices.currency_minor_unit, {
    decimalSeparator: prices.currency_decimal_separator,
    thousandSeparator: prices.currency_thousand_separator,
    prefix: prices.currency_prefix,
    suffix: prices.currency_suffix,
  });
}
