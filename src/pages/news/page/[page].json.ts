import type { APIRoute } from "astro";
import { PAGE_SIZE } from "@/shared/config/pagination";
import { getPosts } from "@/shared/data/posts";

export const getStaticPaths = async () => {
  const posts = await getPosts();
  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  // Page 1 is the home page, so only the following pages get a JSON endpoint.
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    params: { page: String(i + 2) },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const posts = await getPosts();
  const page = Number(params.page) || 1;
  const start = (page - 1) * PAGE_SIZE;
  const pagePosts = posts.slice(start, start + PAGE_SIZE);
  return new Response(JSON.stringify(pagePosts), {
    headers: { "Content-Type": "application/json" },
  });
};
