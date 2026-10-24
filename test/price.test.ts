import { describe, expect, it } from "vitest";
import {
  formatMinorUnits,
  formatRegularPrice,
  formatStorePrice,
  type StorePrices,
} from "../src/shared/lib/price";

const rub: StorePrices = {
  price: "189000000",
  regular_price: "189000000",
  sale_price: "",
  currency_code: "RUB",
  currency_symbol: "₽",
  currency_minor_unit: 2,
  currency_decimal_separator: ",",
  currency_thousand_separator: " ",
  currency_prefix: "",
  currency_suffix: " ₽",
};

describe("formatMinorUnits", () => {
  it("делит по minor unit и группирует тысячи", () => {
    expect(formatMinorUnits("189000000", 2)).toBe("1 890 000,00");
    expect(formatMinorUnits("120", 2)).toBe("1,20");
    expect(formatMinorUnits("5", 0)).toBe("5");
  });

  it("не теряет точность на крупных суммах", () => {
    expect(formatMinorUnits("999999999999", 2)).toBe("9 999 999 999,99");
  });

  it("возвращает пустую строку, если цены нет", () => {
    expect(formatMinorUnits("", 2)).toBe("");
    expect(formatMinorUnits(undefined, 2)).toBe("");
  });

  it("уважает разделители магазина", () => {
    expect(formatMinorUnits("123456", 2, { decimalSeparator: ".", thousandSeparator: "," })).toBe(
      "1,234.56",
    );
  });
});

describe("formatStorePrice", () => {
  it("собирает цену с валютой магазина", () => {
    expect(formatStorePrice(rub)).toBe("1 890 000,00 ₽");
  });

  it("молчит про цену, если её нет: на странице показываем робота", () => {
    expect(formatStorePrice({ ...rub, price: "0", regular_price: "0" })).toBe("");
    expect(formatStorePrice({ ...rub, price: "" })).toBe("");
    expect(formatStorePrice(null)).toBe("");
  });
});

describe("formatRegularPrice", () => {
  it("молчит, когда скидки нет", () => {
    expect(formatRegularPrice(rub)).toBe("");
  });

  it("показывает старую цену при скидке", () => {
    const sale: StorePrices = {
      ...rub,
      price: "149000000",
      regular_price: "189000000",
      sale_price: "149000000",
    };
    expect(formatRegularPrice(sale)).toBe("1 890 000,00 ₽");
  });
});
