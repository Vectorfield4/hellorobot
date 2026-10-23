<?php
/**
 * Plugin Name: Hello Robot Commerce
 * Description: REST-эндпоинты заказа и проверки для статического фронта hellorobot.ru, плюс CORS для WooCommerce Store API.
 * Version: 1.0.0
 * Requires PHP: 8.2
 * Author: Hello Robot
 * Text Domain: hellorobot-commerce
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'HelloRobot_Commerce' ) ) {
	return;
}

final class HelloRobot_Commerce {

	private const REST_NAMESPACE = 'hellorobot/v1';

	private const RATE_KEY_PREFIX = 'hellorobot_order_';

	/** Не больше 5 заказов с одного IP в час. */
	private const RATE_MAX_ORDERS = 5;

	/** И не чаще одного заказа в 15 секунд. */
	private const RATE_MIN_INTERVAL = 15;

	/** TTL транзиента и окно подсчёта — час. */
	private const RATE_TTL = 3600;

	/** Меньше этого времени от открытия формы до отправки — почти наверняка бот. */
	private const MIN_ELAPSED_MS = 1200;

	private const NAME_MIN = 2;
	private const NAME_MAX = 100;
	private const COMMENT_MAX = 2000;
	private const QTY_MIN = 1;
	private const QTY_MAX = 99;

	public static function init(): void {
		// origins нужны и нашим маршрутам, и Store API, который фронт дёргает из браузера.
		add_filter( 'allowed_http_origins', array( __CLASS__, 'filter_allowed_origins' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'send_cors_headers' ), 15, 4 );
	}

	/**
	 * Белый список origin'ов фронта.
	 *
	 * @return string[]
	 */
	private static function allowed_origins(): array {
		return array(
			'https://hellorobot.ru',
			'https://www.hellorobot.ru',
			'http://localhost:4321',
			'http://localhost:4322',
		);
	}

	/**
	 * @param mixed $origins
	 * @return mixed
	 */
	public static function filter_allowed_origins( $origins ) {
		if ( ! is_array( $origins ) ) {
			$origins = array();
		}

		return array_values( array_unique( array_merge( $origins, self::allowed_origins() ) ) );
	}

	/**
	 * CORS только для своих маршрутов: origin эхом, без звёздочки.
	 *
	 * @param mixed $served
	 * @param mixed $result
	 * @param mixed $request
	 * @param mixed $server
	 * @return mixed
	 */
	public static function send_cors_headers( $served, $result, $request, $server ) {
		unset( $result, $server );

		if ( ! $request instanceof WP_REST_Request ) {
			return $served;
		}

		$route = ltrim( $request->get_route(), '/' );
		if ( 0 !== strpos( $route, self::REST_NAMESPACE . '/' ) ) {
			return $served;
		}

		$origin = get_http_origin();
		if ( '' === $origin || ! in_array( $origin, self::allowed_origins(), true ) ) {
			return $served;
		}

		if ( ! headers_sent() ) {
			header( 'Access-Control-Allow-Origin: ' . $origin, true );
			header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS', true );
			header( 'Access-Control-Allow-Headers: Content-Type', true );
			header( 'Vary: Origin', true );
		}

		return $served;
	}

	public static function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/order',
			array(
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'handle_order' ),
					'permission_callback' => '__return_true',
				),
				array(
					'methods'             => 'OPTIONS',
					'callback'            => array( __CLASS__, 'handle_preflight' ),
					'permission_callback' => '__return_true',
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/health',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'handle_health' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Preflight отвечает 204: тело не нужно, важны только CORS-заголовки.
	 */
	public static function handle_preflight( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );

		return new WP_REST_Response( null, 204 );
	}

	public static function handle_health(): WP_REST_Response {
		$active = self::woocommerce_active();

		return new WP_REST_Response(
			array(
				'ok'          => true,
				'woocommerce' => $active && defined( 'WC_VERSION' ) ? WC_VERSION : null,
				'currency'    => $active && function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : null,
			),
			200
		);
	}

	/**
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_order( WP_REST_Request $request ) {
		$body = $request->get_json_params();

		if ( ! is_array( $body ) || array() === $body ) {
			return self::error( 'invalid_request', 'Тело запроса должно быть JSON-объектом.', 400 );
		}

		// Honeypot и тайм-трап срабатывают тихо: бот не должен понять, что его отсеяли.
		if ( isset( $body['website'] ) && is_scalar( $body['website'] ) && '' !== trim( (string) $body['website'] ) ) {
			return self::error( 'spam_detected', 'Запрос отклонён.', 403 );
		}

		$elapsed = isset( $body['elapsed_ms'] ) && is_numeric( $body['elapsed_ms'] ) ? (float) $body['elapsed_ms'] : 0.0;
		if ( $elapsed < self::MIN_ELAPSED_MS ) {
			return self::error( 'spam_detected', 'Запрос отклонён.', 403 );
		}

		if ( ! self::woocommerce_active() ) {
			return self::error( 'woocommerce_missing', 'WooCommerce не активирован.', 503 );
		}

		if ( ! self::rate_limit_allows() ) {
			return self::error( 'rate_limited', 'Слишком много заказов. Попробуйте позже.', 429 );
		}

		$data = self::validate_payload( $body );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$product = wc_get_product( $data['product_id'] );
		if ( ! $product instanceof WC_Product ) {
			return self::error( 'product_not_found', 'Товар не найден.', 404 );
		}

		if ( ! $product->is_type( 'simple' ) ) {
			return self::error( 'unsupported_product_type', 'Заказ возможен только для простого товара.', 422 );
		}

		// Товар под заказ: заказ всё равно принимаем, но клиенту и менеджеру это помечаем.
		$backorder = ! $product->is_in_stock() && ! $product->backorders_allowed();

		$order = wc_create_order(
			array(
				'status'      => 'on-hold',
				'created_via' => 'hellorobot-site',
				'customer_id' => 0,
			)
		);

		if ( is_wp_error( $order ) ) {
			return self::error( 'order_failed', 'Не удалось создать заказ.', 500 );
		}

		if ( ! $order instanceof WC_Order ) {
			return self::error( 'order_failed', 'Не удалось создать заказ.', 500 );
		}

		$order->add_product( $product, $data['quantity'] );
		$order->set_billing_first_name( $data['name'] );
		$order->set_billing_phone( $data['phone'] );
		$order->set_billing_email( $data['email'] );
		$order->set_status( 'on-hold' );

		if ( method_exists( $order, 'set_created_via' ) ) {
			$order->set_created_via( 'hellorobot-site' );
		}

		self::apply_payment_method( $order );

		$order->calculate_totals();

		if ( '' !== $data['source_url'] ) {
			$order->update_meta_data( '_hellorobot_source_url', $data['source_url'] );
		}

		$order->save();

		$site_note = 'Заказ с сайта hellorobot.ru';
		if ( '' !== $data['source_url'] ) {
			$site_note .= '. Статья: ' . $data['source_url'];
		}
		$order->add_order_note( $site_note );

		if ( $backorder ) {
			$order->add_order_note( 'Товар под заказ: на складе нет, backorder для товара не разрешён.' );
		}

		// Комментарий клиента держим внутренней заметкой, чтобы он не уехал клиенту в письме.
		if ( '' !== $data['comment'] ) {
			$order->add_order_note( 'Комментарий клиента: ' . $data['comment'] );
		}

		self::send_order_emails( $order );
		self::register_rate_hit();

		return new WP_REST_Response(
			array(
				'order_id'     => $order->get_id(),
				'order_number' => (string) $order->get_order_number(),
				'status'       => $order->get_status(),
			),
			200
		);
	}

	/**
	 * @param array<string, mixed> $body
	 * @return array{product_id:int,quantity:int,name:string,phone:string,email:string,comment:string,source_url:string}|WP_Error
	 */
	private static function validate_payload( array $body ) {
		$product_id = isset( $body['product_id'] ) && is_numeric( $body['product_id'] ) ? (int) $body['product_id'] : 0;
		if ( $product_id <= 0 ) {
			return self::error( 'product_not_found', 'Товар не найден.', 404 );
		}

		$quantity = self::QTY_MIN;
		if ( isset( $body['quantity'] ) && '' !== $body['quantity'] ) {
			if ( ! is_numeric( $body['quantity'] ) ) {
				return self::error( 'invalid_quantity', 'Количество должно быть целым числом от 1 до 99.', 422 );
			}
			$quantity = (int) $body['quantity'];
			if ( $quantity < self::QTY_MIN || $quantity > self::QTY_MAX ) {
				return self::error( 'invalid_quantity', 'Количество должно быть целым числом от 1 до 99.', 422 );
			}
		}

		$name = trim( sanitize_text_field( self::scalar_string( $body, 'name' ) ) );
		$name_length = function_exists( 'mb_strlen' ) ? mb_strlen( $name, 'UTF-8' ) : strlen( $name );
		if ( $name_length < self::NAME_MIN || $name_length > self::NAME_MAX ) {
			return self::error( 'invalid_name', 'Укажите имя от 2 до 100 символов.', 422 );
		}

		$phone = self::normalize_phone( self::scalar_string( $body, 'phone' ) );
		if ( null === $phone ) {
			return self::error( 'invalid_phone', 'Телефон в формате +7 999 123-45-67.', 422 );
		}

		$email = trim( self::scalar_string( $body, 'email' ) );
		if ( ! is_email( $email ) ) {
			return self::error( 'invalid_email', 'Укажите корректный email.', 422 );
		}

		$comment = trim( sanitize_textarea_field( self::scalar_string( $body, 'comment' ) ) );
		$comment_length = function_exists( 'mb_strlen' ) ? mb_strlen( $comment, 'UTF-8' ) : strlen( $comment );
		if ( $comment_length > self::COMMENT_MAX ) {
			return self::error( 'invalid_comment', 'Комментарий длиннее 2000 символов.', 422 );
		}

		$consent = isset( $body['consent'] ) ? rest_sanitize_boolean( $body['consent'] ) : false;
		if ( ! $consent ) {
			return self::error( 'consent_required', 'Нужно согласие на обработку персональных данных.', 422 );
		}

		$source_url = '';
		$raw_source = self::scalar_string( $body, 'source_url' );
		if ( '' !== $raw_source ) {
			$source_url = esc_url_raw( trim( $raw_source ) );
		}

		return array(
			'product_id' => $product_id,
			'quantity'   => $quantity,
			'name'       => $name,
			'phone'      => $phone,
			'email'      => sanitize_email( $email ),
			'comment'    => $comment,
			'source_url' => $source_url,
		);
	}

	/**
	 * Строковое поле из тела запроса; массивы и объекты считаются пустыми,
	 * чтобы приведение к строке не роняло запрос.
	 *
	 * @param array<string, mixed> $body
	 */
	private static function scalar_string( array $body, string $key ): string {
		if ( ! isset( $body[ $key ] ) || ! is_scalar( $body[ $key ] ) ) {
			return '';
		}

		return (string) $body[ $key ];
	}

	/**
	 * Приводит +7/8/7 с разделителями к +7XXXXXXXXXX.
	 */
	private static function normalize_phone( string $raw ): ?string {
		$raw = trim( $raw );
		if ( '' === $raw || ! preg_match( '/^\+?[0-9\s()\-]+$/', $raw ) ) {
			return null;
		}

		$digits = (string) preg_replace( '/\D+/', '', $raw );
		$length = strlen( $digits );

		if ( 11 === $length ) {
			if ( '7' !== $digits[0] && '8' !== $digits[0] ) {
				return null;
			}
			$digits = substr( $digits, 1 );
		} elseif ( 10 !== $length ) {
			return null;
		}

		return '+7' . $digits;
	}

	/**
	 * cod, если шлюз включён на сайте, иначе cheque.
	 */
	private static function apply_payment_method( WC_Order $order ): void {
		$gateways = self::available_gateways();

		$gateway_id = isset( $gateways['cod'] ) ? 'cod' : 'cheque';

		if ( isset( $gateways[ $gateway_id ] ) && is_object( $gateways[ $gateway_id ] ) ) {
			$order->set_payment_method( $gateways[ $gateway_id ] );
			return;
		}

		$order->set_payment_method( $gateway_id );
		$order->set_payment_method_title( 'cod' === $gateway_id ? 'Оплата при получении' : 'Оплата по чеку' );
	}

	/**
	 * @return array<string, mixed>
	 */
	private static function available_gateways(): array {
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return array();
		}

		$payment_gateways = WC()->payment_gateways();
		if ( ! is_object( $payment_gateways ) || ! method_exists( $payment_gateways, 'get_available_payment_gateways' ) ) {
			return array();
		}

		$gateways = $payment_gateways->get_available_payment_gateways();

		return is_array( $gateways ) ? $gateways : array();
	}

	/**
	 * Письма шлём вручную: заказ создаётся сразу в on-hold, переходов статуса нет,
	 * поэтому штатные хуки WooCommerce новых писем не дают.
	 */
	private static function send_order_emails( WC_Order $order ): void {
		if ( ! function_exists( 'WC' ) || ! WC() ) {
			return;
		}

		$mailer = WC()->mailer();
		if ( ! is_object( $mailer ) || ! method_exists( $mailer, 'get_emails' ) ) {
			return;
		}

		$emails = $mailer->get_emails();
		if ( ! is_array( $emails ) ) {
			return;
		}

		$order_id = $order->get_id();

		$admin_mail = isset( $emails['WC_Email_New_Order'] ) ? $emails['WC_Email_New_Order'] : null;
		if ( $admin_mail instanceof WC_Email && method_exists( $admin_mail, 'trigger' ) ) {
			$admin_mail->trigger( $order_id, $order );
		}

		$customer_mail = isset( $emails['WC_Email_Customer_On_Hold_Order'] ) ? $emails['WC_Email_Customer_On_Hold_Order'] : null;
		if ( $customer_mail instanceof WC_Email && method_exists( $customer_mail, 'trigger' ) ) {
			$customer_mail->trigger( $order_id, $order );
		}
	}

	private static function woocommerce_active(): bool {
		return class_exists( 'WooCommerce' ) && function_exists( 'wc_create_order' );
	}

	private static function client_ip(): string {
		$raw = isset( $_SERVER['REMOTE_ADDR'] ) ? wp_unslash( (string) $_SERVER['REMOTE_ADDR'] ) : '';
		$ip  = sanitize_text_field( $raw );

		return '' !== $ip ? $ip : 'unknown';
	}

	private static function rate_key(): string {
		return self::RATE_KEY_PREFIX . md5( self::client_ip() );
	}

	private static function rate_limit_allows(): bool {
		$state = get_transient( self::rate_key() );
		if ( ! is_array( $state ) ) {
			return true;
		}

		$now   = time();
		$count = isset( $state['count'] ) ? (int) $state['count'] : 0;
		$start = isset( $state['start'] ) ? (int) $state['start'] : $now;
		$last  = isset( $state['last'] ) ? (int) $state['last'] : 0;

		if ( $count >= self::RATE_MAX_ORDERS && ( $now - $start ) < self::RATE_TTL ) {
			return false;
		}

		if ( $last > 0 && ( $now - $last ) < self::RATE_MIN_INTERVAL ) {
			return false;
		}

		return true;
	}

	private static function register_rate_hit(): void {
		$key   = self::rate_key();
		$now   = time();
		$state = get_transient( $key );

		if ( ! is_array( $state ) || ! isset( $state['start'] ) || ( $now - (int) $state['start'] ) >= self::RATE_TTL ) {
			$state = array(
				'count' => 0,
				'start' => $now,
				'last'  => 0,
			);
		}

		$state['count'] = (int) $state['count'] + 1;
		$state['last']  = $now;

		set_transient( $key, $state, self::RATE_TTL );
	}

	private static function error( string $code, string $message, int $status ): WP_Error {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}

HelloRobot_Commerce::init();
