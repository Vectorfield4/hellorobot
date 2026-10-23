import { wpQuery } from "@/shared/api/graphql";
import { type Post as FixturePost, postsFixture } from "@/shared/mocks/fixtures/posts";

export type Post = FixturePost;

function wpDisabled(): boolean {
  const processEnv =
    typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
      : undefined;
  if (processEnv?.WP_GRAPHQL_DISABLED === "1" || processEnv?.USE_FIXTURES === "1") return true;
  const publicUrl = processEnv?.PUBLIC_WP_GRAPHQL_URL ?? import.meta.env?.PUBLIC_WP_GRAPHQL_URL;
  if (publicUrl === "") return true;
  if (import.meta.env?.PUBLIC_USE_FIXTURES === "true") return true;
  return false;
}

let wpAvailable = !wpDisabled();
let postsPromise: Promise<Post[]> | null = null;
const postBySlugCache = new Map<string, Promise<Post | undefined>>();

export function resetPostsCache(): void {
  postsPromise = null;
  postBySlugCache.clear();
  wpAvailable = !wpDisabled();
}

interface WpTagNode {
  name: string;
}

interface WpPostNode {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt?: string | null;
  content?: string | null;
  tags?: { nodes?: WpTagNode[] | null } | null;
}

function mapPost(node: WpPostNode): Post {
  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    excerpt: node.excerpt ?? "",
    content: node.content ?? "",
    date: (node.date ?? "").slice(0, 10),
    tags: node.tags?.nodes?.map((t) => t.name) ?? [],
  };
}

const ALL_POSTS_QUERY = `
  query AllPosts($first: Int!) {
    posts(first: $first) {
      nodes {
        id
        slug
        title
        date
        excerpt
        content
        tags { nodes { name } }
      }
    }
  }
`;

const POST_BY_SLUG_QUERY = `
  query PostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      id
      slug
      title
      date
      excerpt
      content
      tags { nodes { name } }
    }
  }
`;

export async function getPosts(): Promise<Post[]> {
  if (postsPromise) return postsPromise;
  if (!wpAvailable) return postsFixture;

  postsPromise = (async () => {
    try {
      const data = await wpQuery<{ posts: { nodes: WpPostNode[] } }>(ALL_POSTS_QUERY, {
        first: 100,
      });
      const nodes = data?.posts?.nodes ?? [];
      if (!nodes.length) {
        console.warn("WPGraphQL returned no posts; falling back to fixtures.");
        return postsFixture;
      }
      return nodes.map(mapPost);
    } catch (error) {
      wpAvailable = false;
      console.warn(
        "WPGraphQL unavailable, using fixture posts:",
        error instanceof Error ? error.message : error,
      );
      return postsFixture;
    }
  })();

  return postsPromise;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const cached = postBySlugCache.get(slug);
  if (cached) return cached;
  if (!wpAvailable) return postsFixture.find((p) => p.slug === slug);

  const promise = (async () => {
    try {
      const data = await wpQuery<{ post: WpPostNode | null }>(POST_BY_SLUG_QUERY, { slug });
      if (data?.post) return mapPost(data.post);
    } catch (error) {
      wpAvailable = false;
      console.warn(
        "WPGraphQL unavailable, using fixture posts:",
        error instanceof Error ? error.message : error,
      );
    }
    return postsFixture.find((p) => p.slug === slug);
  })();

  postBySlugCache.set(slug, promise);
  return promise;
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => (p.tags ?? []).includes(tag));
}

export function getAllTags(posts: Post[]): string[] {
  return [...new Set(posts.flatMap((p) => p.tags ?? []))];
}
