import type { StoreProduct } from "@/shared/api/store";
import { mapStoreProduct, type Product } from "@/shared/data/product";
import type { StorePrices } from "@/shared/lib/price";

/**
 * Демо-каталог для локальной разработки, пока WooCommerce не наполнен.
 * В продакшене не используется (см. `fixturesAllowed` в data/products.ts).
 */

function demoPrices(price: string): StorePrices {
  return {
    price,
    regular_price: price,
    sale_price: "",
    currency_code: "RUB",
    currency_symbol: "₽",
    currency_minor_unit: 2,
    currency_decimal_separator: ",",
    currency_thousand_separator: " ",
    currency_prefix: "",
    currency_suffix: " ₽",
  };
}

function demoProduct(
  id: number,
  slug: string,
  name: string,
  price: string,
  tags: string[],
  category: string,
  shortDescription: string,
): StoreProduct {
  return {
    id,
    slug,
    name,
    sku: `DEMO-${slug.toUpperCase()}`,
    type: "simple",
    permalink: `https://hello-robot.ru/product/${slug}`,
    prices: demoPrices(price),
    on_sale: false,
    short_description: `<p>${shortDescription}</p>`,
    description: `<p>${shortDescription}</p><p>Демо-позиция: цена и наличие не подтверждены.</p>`,
    tags: tags.map((tag, index) => ({ id: 1000 + index, name: tag, slug: tag })),
    categories: [{ id: 2000 + id, name: category, slug: category }],
    images: [],
    is_in_stock: true,
    is_purchasable: true,
    is_on_backorder: false,
    average_rating: "0",
    review_count: 0,
  };
}

const demoStoreProducts: StoreProduct[] = [
  demoProduct(
    1,
    "unitree-g1",
    "Unitree G1",
    "189000000",
    ["гуманоиды", "роботы"],
    "Гуманоиды",
    "Человекоподобный робот для исследований и обучения: ходьба, захват предметов, программируемые сценарии.",
  ),
  demoProduct(
    2,
    "unitree-go2",
    "Unitree Go2",
    "28900000",
    ["роботы", "автономность", "навигация"],
    "Роботы",
    "Четырёхногий робот с лидаром и камерой: автономные маршруты, инспекция помещений, учебные проекты.",
  ),
  demoProduct(
    3,
    "ur5e",
    "Universal Robots UR5e",
    "345000000",
    ["коботы", "манипуляторы", "промышленная робототехника"],
    "Коботы",
    "Коллаборативный манипулятор на 5 кг: сборка, паллетирование, работа рядом с человеком без ограждения.",
  ),
  demoProduct(
    4,
    "franka-panda",
    "Franka Emika Panda",
    "420000000",
    ["манипуляторы", "исследования", "тактильность"],
    "Манипуляторы",
    "Лабораторный манипулятор с силомоментным управлением: обучение с подкреплением, тактильные задачи, сборка.",
  ),
  demoProduct(
    5,
    "reachy-2",
    "Reachy 2",
    "89000000",
    ["гуманоиды", "исследования"],
    "Гуманоиды",
    "Настольный гуманоид для HRI-исследований: руки, голова на подвижной шее, открытый SDK.",
  ),
];

export const productFixtures: Product[] = demoStoreProducts.map(mapStoreProduct);

export function getProducts(): Product[] {
  return productFixtures;
}
