import { useEffect, useState } from "react";
import { wpQuery } from "@/shared/api/graphql";

interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
}

const QUERY = `
  query LatestPosts($first: Int!) {
    posts(first: $first) { nodes { id slug title date } }
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
    wpQuery<{ posts: { nodes: Post[] } }>(QUERY, { first })
      .then((d) => {
        const known = new Set(knownSlugs);
        setPosts(d.posts.nodes.filter((p) => !known.has(p.slug)));
      })
      .catch(() => setPosts([]));
  }, [first, knownSlugs.join(",")]);

  if (posts === null) {
    return (
      <ul aria-hidden="true">
        {Array.from({ length: first }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <li key={i} style={{ opacity: 0.3 }}>
            -
          </li>
        ))}
      </ul>
    );
  }
  if (!posts.length) return null;

  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>
          <a href={`/news/${p.slug}`}>{p.title}</a> <small>{p.date}</small>
        </li>
      ))}
    </ul>
  );
}
