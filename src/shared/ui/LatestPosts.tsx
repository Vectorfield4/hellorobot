import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { wpQuery } from "@/shared/api/graphql";
import { revealCards } from "@/shared/lib/reveal";
import ArticleCard from "@/shared/ui/ArticleCard";

interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
}

const QUERY = `
  query LatestPosts($first: Int!) {
    posts(first: $first) {
      nodes { id slug title date excerpt tags { nodes { name } } }
    }
  }
`;

// useLayoutEffect warns during SSR, so fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function LatestPosts({
  first = 5,
  knownSlugs = [],
}: {
  first?: number;
  knownSlugs?: string[];
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: knownSlugs compared by value
  useEffect(() => {
    wpQuery<{
      posts: {
        nodes: Array<{
          id: string;
          slug: string;
          title: string;
          date: string;
          excerpt?: string;
          tags?: { nodes: { name: string }[] };
        }>;
      };
    }>(QUERY, { first })
      .then((d) => {
        const known = new Set(knownSlugs);
        setPosts(
          d.posts.nodes
            .filter((p) => !known.has(p.slug))
            .map((p) => ({ ...p, tags: p.tags?.nodes.map((t) => t.name) ?? [] })),
        );
      })
      .catch(() => setPosts([]));
  }, [first, knownSlugs.join(",")]);

  useIsomorphicLayoutEffect(() => {
    if (!containerRef.current) return;
    revealCards(Array.from(containerRef.current.querySelectorAll("[data-reveal]")));
  }, [posts]);

  // Render nothing until the posts arrive: a skeleton would reserve space and
  // then collapse when the request returns no posts, shifting the page.
  if (posts === null) return null;
  if (!posts.length) return null;

  return (
    <div ref={containerRef}>
      {posts.map((p) => (
        <div key={p.id} data-reveal data-reveal-pending>
          <ArticleCard
            title={p.title}
            date={p.date}
            slug={p.slug}
            excerpt={p.excerpt}
            tags={p.tags}
          />
        </div>
      ))}
    </div>
  );
}
