import { afterEach, describe, expect, it, vi } from "vitest";
import { getPosts, resetPostsCache } from "../src/shared/data/posts";
import postsSnapshot from "../src/shared/data/posts.snapshot.json";
import { getProducts, resetProductsCache } from "../src/shared/data/products";
import productsSnapshot from "../src/shared/data/products.snapshot.json";

const POSTS = (postsSnapshot as { posts: { nodes: unknown[] } }).posts.nodes.length;
const PRODUCTS = (productsSnapshot as { products: unknown[] }).products.length;

function offline(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed");
    }),
  );
}

describe("снимок контента", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetPostsCache();
    resetProductsCache();
  });

  it("собирает статьи из снимка, когда WPGraphQL недоступен", async () => {
    offline();
    const posts = await getPosts();
    expect(posts.length).toBe(POSTS);
    expect(posts[0]?.slug).toBeTruthy();
    expect(Array.isArray(posts[0]?.tags)).toBe(true);
  });

  it("собирает витрину из снимка, когда Store API недоступен", async () => {
    vi.stubEnv("DEV", false);
    offline();
    const products = await getProducts();
    expect(products.length).toBe(PRODUCTS);
    expect(products.every((product) => Boolean(product.slug))).toBe(true);
  });
});
