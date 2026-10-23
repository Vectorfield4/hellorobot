import { afterEach, describe, expect, it, vi } from "vitest";
import { ORDER_API_URL } from "../src/shared/config/constants";
import {
  createOrder,
  type OrderError,
  OrderError as OrderErrorClass,
  type OrderPayload,
} from "../src/shared/data/orders";
import {
  normalizeRuPhone,
  type OrderFormValues,
  validateOrderForm,
} from "../src/shared/ui/order/orderValidation";

const payload: OrderPayload = {
  productId: 42,
  quantity: 1,
  name: "Иван",
  phone: "+79991234567",
  email: "ivan@example.com",
  comment: "",
  consent: true,
  elapsedMs: 5400,
  sourceUrl: "https://hellorobot.ru/products/unitree-g1",
  website: "",
};

const validValues: OrderFormValues = {
  name: "Иван",
  phone: "+7 999 123-45-67",
  email: "ivan@example.com",
  comment: "Позвоните после 18:00",
  consent: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeRuPhone", () => {
  it("приводит восьмёрку со скобками и дефисами", () => {
    expect(normalizeRuPhone("8 (999) 123-45-67")).toBe("+79991234567");
  });

  it("принимает +7 с пробелами", () => {
    expect(normalizeRuPhone("+7 999 123 45 67")).toBe("+79991234567");
  });

  it("принимает слитную запись с семёркой", () => {
    expect(normalizeRuPhone("79991234567")).toBe("+79991234567");
  });

  it("возвращает null на мусор, короткий номер и буквы", () => {
    expect(normalizeRuPhone("")).toBeNull();
    expect(normalizeRuPhone("позвоните мне")).toBeNull();
    expect(normalizeRuPhone("8 999 123-45-6")).toBeNull();
    expect(normalizeRuPhone("123456789")).toBeNull();
    expect(normalizeRuPhone("+7 999 123-45-67 доб. 12")).toBeNull();
    expect(normalizeRuPhone("899912345678")).toBeNull();
  });
});

describe("validateOrderForm", () => {
  it("ругается на пустые поля и отсутствие согласия", () => {
    const errors = validateOrderForm({
      name: "",
      phone: "",
      email: "",
      comment: "",
      consent: false,
    });
    expect(errors.name).toBe("Укажите имя");
    expect(errors.phone).toBe("Укажите телефон");
    expect(errors.email).toBe("Укажите почту");
    expect(errors.consent).toBe("Без согласия нельзя отправить заказ");
    expect(errors.comment).toBeUndefined();
  });

  it("ловит короткое имя, плохую почту и отсутствие согласия", () => {
    const errors = validateOrderForm({
      ...validValues,
      name: "Я",
      email: "ivan@example",
      consent: false,
    });
    expect(errors.name).toBe("Имя слишком короткое");
    expect(errors.email).toBe("Проверьте адрес почты");
    expect(errors.consent).toBeDefined();
    expect(errors.phone).toBeUndefined();
  });

  it("ограничивает комментарий 2000 символами", () => {
    const errors = validateOrderForm({ ...validValues, comment: "а".repeat(2001) });
    expect(errors.comment).toBe("Комментарий не длиннее 2000 символов");
  });

  it("на валидном наборе отдаёт пустой объект", () => {
    expect(validateOrderForm(validValues)).toEqual({});
  });
});

describe("createOrder", () => {
  it("возвращает номер заказа и отправляет snake_case тело", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        jsonResponse({ order_id: 456, order_number: "456", status: "on-hold" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOrder(payload);

    expect(result).toEqual({ orderId: 456, orderNumber: "456", status: "on-hold" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call ?? [];
    expect(url).toBe(ORDER_API_URL);
    expect(init?.method).toBe("POST");

    const body = JSON.parse(String(init?.body));
    expect(body.product_id).toBe(42);
    expect(body.quantity).toBe(1);
    expect(body.phone).toBe("+79991234567");
    expect(body.elapsed_ms).toBe(5400);
    expect(body.source_url).toBe("https://hellorobot.ru/products/unitree-g1");
    expect(body.website).toBe("");
  });

  it("пробрасывает код ошибки сервера", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          jsonResponse(
            { code: "rate_limited", message: "Слишком часто", data: { status: 429 } },
            429,
          ),
      ),
    );

    await expect(createOrder(payload)).rejects.toMatchObject({
      name: "OrderError",
      code: "rate_limited",
      status: 429,
      message: "Слишком часто",
    });
  });

  it("неизвестный код сервера превращает в unknown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          jsonResponse({ code: "teapot", message: "?", data: { status: 418 } }, 418),
      ),
    );

    const error = (await createOrder(payload).catch((caught) => caught)) as OrderError;
    expect(error).toBeInstanceOf(OrderErrorClass);
    expect(error.code).toBe("unknown");
    expect(error.status).toBe(418);
  });

  it("сетевой сбой и не-JSON ответ отдаёт как network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const failed = (await createOrder(payload).catch((caught) => caught)) as OrderError;
    expect(failed).toBeInstanceOf(OrderErrorClass);
    expect(failed.code).toBe("network");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          ({
            ok: true,
            status: 200,
            text: async () => "<html>oops</html>",
          }) as unknown as Response,
      ),
    );

    const broken = (await createOrder(payload).catch((caught) => caught)) as OrderError;
    expect(broken).toBeInstanceOf(OrderErrorClass);
    expect(broken.code).toBe("network");
  });
});
