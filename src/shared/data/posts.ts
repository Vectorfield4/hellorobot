import { wpQuery } from "@/shared/api/graphql";

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  tags: string[];
  sourceUrl?: string;
  sourceName?: string;
}

let wpAvailable = true;
let postsPromise: Promise<Post[]> | null = null;
const postBySlugCache = new Map<string, Promise<Post | undefined>>();

export function resetPostsCache(): void {
  postsPromise = null;
  postBySlugCache.clear();
  wpAvailable = true;
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
  if (!wpAvailable) throw new Error("WPGraphQL unavailable");

  postsPromise = (async () => {
    try {
      const data = await wpQuery<{ posts: { nodes: WpPostNode[] } }>(ALL_POSTS_QUERY, {
        first: 100,
      });
      const nodes = data?.posts?.nodes ?? [];
      if (!nodes.length) throw new Error("WPGraphQL returned no posts");
      return nodes.map(mapPost);
    } catch (error) {
      wpAvailable = false;
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("WPGraphQL request failed:", err.message);
      throw err;
    }
  })();

  return postsPromise;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const cached = postBySlugCache.get(slug);
  if (cached) return cached;
  if (!wpAvailable) throw new Error("WPGraphQL unavailable");

  const promise = (async () => {
    try {
      const data = await wpQuery<{ post: WpPostNode | null }>(POST_BY_SLUG_QUERY, { slug });
      if (data?.post) return mapPost(data.post);
    } catch (error) {
      wpAvailable = false;
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("WPGraphQL request failed:", err.message);
      throw err;
    }
    return undefined;
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
