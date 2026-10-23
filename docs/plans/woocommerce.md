# WooCommerce: каталог, заказ, связка с новостями

Статус: реализовано на фронте, ждёт WooCommerce на бэкенде.
Ветка: `feat/woocommerce`.

## Цель

1. Каталог роботов на своём домене: список, карточка, теги, категории, поиск.
2. Заказ без оплаты на сайте: имя, телефон, почта, комментарий → настоящий заказ в WooCommerce.
3. Блок «Купить робота» в статьях и на тег-страницах, связка статья ↔ товар по тегам.
4. Повторяемое добавление товаров в WooCommerce из JSON + проверка покрытия тегов
   после перевода статьи.

## Принятые решения (интервью 2026-10-24)

| Вопрос | Решение |
|---|---|
| Чтение каталога | WooCommerce Store API, без ключей, на этапе билда |
| Поиск | живой Store API из браузера + фолбэк на индекс, собранный на билде |
| Заказ | свой REST-эндпоинт на WP (`mu-plugin`) → `wc_create_order()` |
| URL | `/products/<slug>`, `/products/tag/<tag>`, `/products/category/<slug>` |
| Товары в контенте | блок «Купить робота»: авто по тегам + маркер в тексте поста |
| Поля заказа | имя, телефон, почта, комментарий, согласие на обработку ПД |
| Нет в наличии | показывать «под заказ», кнопка заказа работает |
| Импорт | скрипт + JSON-прайс (WC REST v3), после перевода статьи — проверка покрытия тегов |

## Ограничения среды

- Деплой — статический FTP (`dist/`), серверного рантайма нет.
- WooCommerce на `hello-robot.ru` ставит пользователь; до этого каталог работает на фикстурах.
- Store API кросс-доменно режет CORS на запись и на PII: нужен фильтр
  `allowed_http_origins` для `https://hellorobot.ru` (входит в mu-plugin).
- Слаги русских тегов в WP закодированы в проценты → связка товар ↔ статья по
  нормализованному имени тега, карта алиасов EN↔RU в `src/shared/config/productTags.ts`.

## Потоки

### A. WP: заказ и CORS (`wp/`)

- `wp/mu-plugins/hellorobot-commerce.php`: `POST /wp-json/hellorobot/v1/order`,
  `wc_create_order()`, billing (имя, телефон, почта), позиция, комментарий,
  статус `on-hold`, письма, note со ссылкой на статью, honeypot + тайм-трап + лимит по IP.
- Разрешение origin `https://hellorobot.ru` (+ `localhost:4321`) для эндпоинта и Store API.
- Гард `class_exists( 'WooCommerce' )`: без WooCommerce сайт не падает.
- `wp/README.md`: установка, проверка curl-ом.

### B. Импорт товаров и покрытие тегов (`scripts/`, `products/`)

- `scripts/products.mjs`: `import --file`, `ensure --slug|--tags`, `list`, `--dry-run`,
  upsert по SKU через WC REST v3 (basic auth из `HELLOROBOT_WC_KEY` / `HELLOROBOT_WC_SECRET`),
  теги товара = имена тегов WP, статус `draft` по умолчанию.
- `products/catalog.json`: стартовый каталог роботов с тегами словаря.
- `docs/products.md`: как завести товар и как прогонять проверку после перевода.

### C. Данные и типы (`src/shared/`)

- `api/store.ts` (билд, Node), `api/storeClient.ts` (браузер, поиск), `lib/price.ts`,
  `lib/wooProduct.ts`, `data/products.ts`, `config/productTags.ts`.

### D. Страницы каталога (`src/pages/products/`, `src/shared/ui/product/`)

- `/products`, `/products/[slug]`, `/products/tag/[tag]`, `/products/category/[slug]`,
  `/products/page/[n]` + JSON-эндпоинт для подгрузки.
- `ProductCard`, `ProductGrid`, `ProductPrice`, `StockBadge`, `ProductGallery`, `ProductSearch`.

### E. Форма заказа (`src/shared/ui/order/`, `src/shared/data/orders.ts`)

- Остров `OrderForm`: валидация, маска телефона, согласие, состояния, a11y.
- Фолбэк: если эндпоинт недоступен — редирект на `/checkout/?add-to-cart=<id>`.

### F. Статьи и теги (`src/shared/ui/BuyRobotBlock.astro`)

- Блок «Купить робота» в `/news/<slug>` (товары по пересечению тегов) и на `/tags/<tag>`.
- Маркер `<!-- buy-robot: <tag> -->` в HTML поста подставляет блок явно.
- Перекрёстные ссылки: товар → статьи с тем же тегом, товар → похожие товары.

## Проверка

`npm run lint`, `npm run test`, `npm run build`; после установки WooCommerce —
`curl` заказа в тестовом режиме и проверка, что заказ виден в WooCommerce.

## Предусловия на стороне пользователя

1. Установить WooCommerce, включить оплату «Оплата при получении» (или «Ожидание оплаты»).
2. Загрузить `wp/mu-plugins/hellorobot-commerce.php`.
3. Создать WC REST-ключи (read/write) → `HELLOROBOT_WC_KEY` / `HELLOROBOT_WC_SECRET`.
