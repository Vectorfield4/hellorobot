import { useEffect, useState } from "react";
import { wpQuery } from "@/shared/api/graphql";
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

export default function LatestPosts({
  first = 5,
  knownSlugs = [],
}: {
  first?: number;
  knownSlugs?: string[];
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);

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

  if (posts === null) {
    return (
      <div aria-hidden="true">
        {Array.from({ length: first }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={i} style={{ opacity: 0.3, marginBottom: "1rem" }}>
            -
          </div>
        ))}
      </div>
    );
  }
  if (!posts.length) return null;

  return (
    <>
      {posts.map((p) => (
        <ArticleCard
          key={p.id}
          title={p.title}
          date={p.date}
          slug={p.slug}
          excerpt={p.excerpt}
          tags={p.tags}
        />
      ))}
    </>
  );
}
