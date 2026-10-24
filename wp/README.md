# wp

Серверная часть для статического фронта: заказ на сайте создаётся не в браузере, а в
WordPress, потому что у `dist/` нет рантайма. Здесь лежит mu-plugin с REST-эндпоинтами
и CORS для WooCommerce Store API.

```
wp/
  mu-plugins/hellorobot-commerce.php   # заказ, health, CORS
  hellorobot-commerce.zip              # тот же плагин, установка через админку
  README.md
```

## Что делает плагин

`POST /wp-json/hellorobot/v1/order` принимает заявку с формы, валидирует её, отсекает
спам и создаёт настоящий заказ WooCommerce в статусе `on-hold` с позицией, billing-полями
и заметками. `GET /wp-json/hellorobot/v1/health` показывает, активен ли WooCommerce и
какая валюта. Плюс белый список origin'ов для Store API, которым фронт ищет товары
из браузера.

## Установка

Два способа, выбирайте любой.

**Через админку (проще).** `Плагины → Добавить новый → Загрузить плагин`, выбрать
`wp/hellorobot-commerce.zip`, установить и активировать. Это обычный плагин, а не
mu-plugin: заголовок у файла есть, активация нужна.

**Через файлы (FTP/SFTP или файловый менеджер хостинга).** Скопировать
`mu-plugins/hellorobot-commerce.php` в `wp-content/mu-plugins/`. mu-plugins
подхватываются автоматически, активировать не нужно; если папки нет — создать.

При ошибке PHP плагин отключается удалением файла (или деактивацией в админке),
больше ничего править не нужно. Требуется PHP 8.2+.

## Предусловия в WooCommerce

- Товары — **simple** (вариативные и групповые плагин отклоняет с `unsupported_product_type`).
- Включён шлюз «Оплата при получении» (`cod`). Если он выключен, заказ всё равно
  создаётся, но с методом `cheque` — включите и «Оплату по чеку», иначе в админке
  будет пустой способ оплаты.
- Валюта магазина — RUB (`WooCommerce → Настройки → Общие`).
- Письма WooCommerce включены, иначе `WC_Email_New_Order` не уйдёт: плагин вызывает
  его вручную после сохранения заказа, штатных переходов статуса при создании нет.
  Клиенту письмо по умолчанию не отправляется (текст «ожидает оплаты» вводил бы в
  заблуждение, оплаты на сайте нет); включить можно фильтром
  `hellorobot_send_customer_email`.
- Товары «под заказ» (нет в наличии, backorder выключен) заказ не блокируют:
  позиция добавляется, в заметках появляется «Товар под заказ».

## Если плагин не подключается

На этом сайте WordPress числит плагин активным, но не подключает его файл: маршрутов нет,
заголовков нет, ошибок тоже. При этом файл на диске целый (18849 байт / 564 строки).
Обход — WPCode-сниппет `HR plugin loader` (PHP, Run Everywhere):

```php
$hr_file = WP_PLUGIN_DIR . '/hr-commerce/hellorobot-commerce.php';

add_action( 'wp_loaded', function () use ( $hr_file ) {
	$before = class_exists( 'HelloRobot_Commerce_Plugin' ) ? 'yes' : 'no';

	if ( 'no' === $before && file_exists( $hr_file ) ) {
		require_once $hr_file;
	}

	if ( class_exists( 'HelloRobot_Commerce_Plugin' ) && method_exists( 'HelloRobot_Commerce_Plugin', 'init' ) ) {
		HelloRobot_Commerce_Plugin::init();
	}

	if ( ! headers_sent() ) {
		$where = class_exists( 'HelloRobot_Commerce_Plugin' )
			? ( new ReflectionClass( 'HelloRobot_Commerce_Plugin' ) )->getFileName()
			: 'none';
		header( 'X-HR-Diag: before=' . $before . ';file=' . ( $where && 'none' !== $where ? basename( dirname( $where ) ) . '/' . basename( $where ) : 'none' ) );
	}
}, 1 );
```

Сниппет идемпотентен: если WordPress однажды начнёт грузить плагин сам, повторного
подключения и повторной регистрации маршрутов не будет (проверка класса + флаг в плагине).
Заголовки `X-HR-Diag` и `X-Hellorobot-Plugin` диагностические, их можно убрать, когда
причина будет найдена.

Проверка после включения:

```bash
curl -s https://hello-robot.ru/wp-json/hellorobot/v1/health
# {"ok":true,"plugin":"hellorobot-commerce","version":"1.0.3","loaded_from":"hr-commerce/hellorobot-commerce.php",...}
```

## Проверка

Health, WooCommerce ещё не стоит:

```bash
curl -s https://hello-robot.ru/wp-json/hellorobot/v1/health
# {"ok":true,"woocommerce":null,"currency":null}
```

Health после установки WooCommerce:

```bash
curl -s https://hello-robot.ru/wp-json/hellorobot/v1/health
# {"ok":true,"plugin":"hellorobot-commerce","version":"1.0.1","woocommerce":"11.2.1","currency":"RUB","stray_class_file":null}
```

`stray_class_file` — имя файла, который определил старый класс `HelloRobot_Commerce`.
Если поле не `null`, на сайте осталась лишняя копия плагина: удалите этот файл,
иначе копии будут спорить за маршруты.

Тестовый заказ. `product_id` — id реального simple-товара
(в админке: `Товары → навести на товар`, в URL `post=<id>`):

```bash
curl -s -X POST https://hello-robot.ru/wp-json/hellorobot/v1/order \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hellorobot.ru' \
  -d '{
    "product_id": 123,
    "quantity": 1,
    "name": "Иван",
    "phone": "+7 999 123-45-67",
    "email": "ivan@example.com",
    "comment": "Перезвоните после 18:00",
    "consent": true,
    "elapsed_ms": 5400,
    "source_url": "https://hellorobot.ru/news/unitree-g1",
    "website": ""
  }'
# {"order_id":456,"order_number":"456","status":"on-hold"}
```

Ожидаемое: заказ `on-hold` в `WooCommerce → Заказы`, billing — имя, телефон
`+79991234567`, почта; заметки «Заказ с сайта hellorobot.ru. Статья: …» и
«Комментарий клиента: …»; письмо админу (клиенту — только если включён фильтр).

Preflight (не должен падать, ответ 204):

```bash
curl -s -i -X OPTIONS https://hello-robot.ru/wp-json/hellorobot/v1/order \
  -H 'Origin: https://hellorobot.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Коды ошибок приходят как `{"code":"...","message":"...","data":{"status":N}}`.

## Контракт

`POST /wp-json/hellorobot/v1/order`, JSON-тело:

| Поле | Тип | Правило |
|---|---|---|
| `product_id` | int | id simple-товара, иначе 404 `product_not_found` |
| `quantity` | int | 1..99, по умолчанию 1 |
| `name` | string | 2..100 символов |
| `phone` | string | `+7…`, `8…` или `7…`; 10 или 11 цифр; пробелы, скобки, дефисы; хранится как `+7XXXXXXXXXX` |
| `email` | string | `is_email` |
| `comment` | string | до 2000 символов, необязательно |
| `consent` | bool | обязателен `true` |
| `elapsed_ms` | int | мс от открытия формы; меньше 1200 — спам |
| `source_url` | string | необязательно, ссылка на статью |
| `website` | string | honeypot, всегда пустое |

Ошибки: 400 `invalid_request`, 403 `spam_detected`, 404 `product_not_found`,
422 `invalid_name` `invalid_phone` `invalid_email` `invalid_comment`
`consent_required` `invalid_quantity` `unsupported_product_type`,
429 `rate_limited`, 503 `woocommerce_missing`.

`GET /wp-json/hellorobot/v1/health` → `{"ok":true,"woocommerce":"9.x"|null,"currency":"RUB"|null}`.

## 429 и 403 spam

Лимит: не больше 5 заказов с одного IP в час и не чаще одного в 15 секунд. IP берётся
из `$_SERVER['REMOTE_ADDR']`, счётчик живёт в транзиенте `hellorobot_order_<md5(ip)>`
с TTL 3600 секунд — в базе это строки `_transient_hellorobot_order_*`.

Что делать:

- Проверяете форму — дождитесь 16 секунд между заказами, иначе 429 `rate_limited`.
- Заказ не создался, в ответе 403 `spam_detected` — либо заполнен `website`,
  либо `elapsed_ms` меньше 1200. Из браузера отправляйте реальное время с формы;
  из curl ставьте `"elapsed_ms": 3000`.
- Нужно снять лимит вручную: `wp transient delete hellorobot_order_<md5(ip)>`
  или удалить строку `_transient_hellorobot_order_*` из `wp_options`.
- Если сайт за прокси/CDN, `REMOTE_ADDR` — это адрес прокси, и все клиенты попадут
  в один счётчик. Тогда правится `client_ip()` в плагине.

## Разрешённые origin

Список в одном месте — `HelloRobot_Commerce::allowed_origins()`:

```php
return array(
    'https://hellorobot.ru',
    'https://www.hellorobot.ru',
    'http://localhost:4321',
    'http://localhost:4322',
);
```

Он уходит в фильтр `allowed_http_origins` (нужен Store API, чтобы браузер мог читать
товары) и в заголовки своих маршрутов (`Access-Control-Allow-Origin` эхом конкретного
origin, `Vary: Origin`). Добавили домен — добавьте строку в массив. `*` не используется.

## Ограничения

- Заказ создаётся только для `simple`-товаров.
- Оплата на сайте не проводится: статус `on-hold`, оплата при получении или по чеку.
- Rate limit считается по IP и не переживает сброс объектного кеша.
