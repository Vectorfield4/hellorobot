import type { APIRoute } from "astro";
import { PAGE_SIZE } from "@/shared/config/pagination";
import { getPosts } from "@/shared/data/posts";

export const getStaticPaths = async () => {
  const posts = await getPosts();
  const tags = [...new Set(posts.flatMap((p) => p.tags ?? []))];
  const paths: { params: { tag: string; page: string } }[] = [];
  for (const tag of tags) {
    const tagPosts = posts.filter((p) => (p.tags ?? []).includes(tag));
    const totalPages = Math.max(1, Math.ceil(tagPosts.length / PAGE_SIZE));
    // Page 1 lives at /tags/<tag>, so only the following pages get a JSON endpoint.
    for (let i = 2; i <= totalPages; i++) {
      paths.push({ params: { tag, page: String(i) } });
    }
  }
  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  const posts = await getPosts();
  const tag = params.tag as string;
  const page = Number(params.page) || 1;
  const tagPosts = posts.filter((p) => (p.tags ?? []).includes(tag));
  const start = (page - 1) * PAGE_SIZE;
  const pagePosts = tagPosts.slice(start, start + PAGE_SIZE);
  return new Response(JSON.stringify(pagePosts), {
    headers: { "Content-Type": "application/json" },
  });
};
