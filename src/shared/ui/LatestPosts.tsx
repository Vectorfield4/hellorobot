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

export default function LatestPosts({ first = 5 }: { first?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    wpQuery<{ posts: { nodes: Post[] } }>(QUERY, { first })
      .then((d) => setPosts(d.posts.nodes))
      .catch((e) => setError(String(e)));
  }, [first]);

  if (error) return <p>Не удалось загрузить свежие статьи.</p>;
  if (!posts.length) return <p>Загрузка…</p>;

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
