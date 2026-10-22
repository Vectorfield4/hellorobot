import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import ArticleCard from "./ArticleCard";

interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
}

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
  const animatedIds = useRef(new Set<string>());
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

  // Animate newly added cards
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when posts change
  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll(".article-card");
    const newCards = Array.from(cards).filter((el) => {
      const id = el.getAttribute("data-id") || "";
      if (animatedIds.current.has(id)) return false;
      animatedIds.current.add(id);
      return true;
    });
    if (newCards.length === 0) return;
    gsap.fromTo(
      newCards,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" },
    );
  }, [posts]);

  return (
    <div ref={containerRef}>
      {posts.map((p) => (
        <div key={p.id} data-id={p.id}>
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
