import type { APIRoute } from "astro";
import { getPosts } from "@/shared/data/posts";

const PAGE_SIZE = 3;

export const getStaticPaths = async () => {
  const PAGE_SIZE = 3;
  const posts = await getPosts();
  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  return Array.from({ length: totalPages }, (_, i) => ({
    params: { page: String(i + 1) },
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
