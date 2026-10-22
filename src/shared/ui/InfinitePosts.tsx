import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { revealCards } from "@/shared/lib/reveal";
import ArticleCard from "./ArticleCard";

interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
}

// useLayoutEffect warns during SSR, so fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function InfinitePosts({
  initialPosts,
  totalPages,
}: {
  initialPosts: Post[];
  totalPages: number;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const revealedIds = useRef(new Set<string>());
  const loadMoreRef = useRef<() => void>(() => {});

  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return;
    setLoading(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/news/page/${nextPage}.json`);
      if (!res.ok) throw new Error("fetch failed");
      const newPosts: Post[] = await res.json();
      setPosts((prev) => [...prev, ...newPosts]);
      setPage(nextPage);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loading, page, totalPages]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { threshold: 1.0 },
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  // Reveal every card once: the server-rendered first page on hydration and
  // each appended page when it is fetched.
  useIsomorphicLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const fresh: Element[] = [];
    for (const el of root.querySelectorAll("[data-reveal]")) {
      const id = el.getAttribute("data-id") ?? "";
      if (revealedIds.current.has(id)) continue;
      revealedIds.current.add(id);
      fresh.push(el);
    }

    revealCards(fresh);
  }, [posts]);

  return (
    <div ref={containerRef}>
      {posts.map((p) => (
        <div key={p.id} data-id={p.id} data-reveal>
          <ArticleCard
            title={p.title}
            date={p.date}
            slug={p.slug}
            excerpt={p.excerpt}
            tags={p.tags}
          />
        </div>
      ))}
      {page < totalPages && (
        <div ref={loaderRef} style={{ padding: "1rem", textAlign: "center" }}>
          {loading ? "Загрузка..." : "Загрузить ещё"}
        </div>
      )}
    </div>
  );
}
