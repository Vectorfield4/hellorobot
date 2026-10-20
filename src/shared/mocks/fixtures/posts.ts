export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
}

export const postsFixture: Post[] = [
  {
    id: "1",
    slug: "hello-robots",
    title: "Hello, robots",
    excerpt: "First post about robots.",
    content: "<p>Welcome to hellorobot.</p>",
    date: "2026-10-19",
  },
];

export function getPosts(): Post[] {
  return postsFixture;
}

export function getPostBySlug(slug: string): Post | undefined {
  return postsFixture.find((p) => p.slug === slug);
}
