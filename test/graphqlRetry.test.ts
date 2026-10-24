import { afterEach, describe, expect, it, vi } from "vitest";
import { wpQuery } from "../src/shared/api/graphql";

const DATA = { posts: { nodes: [{ slug: "unitree-g1" }] } };

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("wpQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("повторяет запрос после 5xx и возвращает данные", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("boom", { status: 503, statusText: "Service Unavailable" }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: DATA }));

    vi.stubGlobal("fetch", fetchMock);

    const data = await wpQuery<typeof DATA>("query Posts { posts { nodes { slug } } }");
    expect(data).toEqual(DATA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("не повторяет 4xx: это не сеть, а запрос", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad", { status: 400, statusText: "Bad Request" }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(wpQuery("query Posts { posts { nodes { slug } } }")).rejects.toThrow(
      /after 3 attempts/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("отдаёт ошибку GraphQL без повторов", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errors: [{ message: "field not found" }] }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(wpQuery("query Posts { posts { nodes { slug } } }")).rejects.toThrow(
      /after 3 attempts/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("показывает причину сетевого сбоя из error.cause, а не «fetch failed»", async () => {
    const networkError = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND hello-robot.ru"), {
        code: "ENOTFOUND",
      }),
    });
    const fetchMock = vi.fn(async () => {
      throw networkError;
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(wpQuery("query Posts { posts { nodes { slug } } }")).rejects.toThrow(/ENOTFOUND/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
