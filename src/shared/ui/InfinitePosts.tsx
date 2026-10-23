import { CalendarDays, Clock, Tag } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatDateRange } from "@/shared/lib/formatDateRange";
import { revealCards } from "@/shared/lib/reveal";
import ArticleCard from "./ArticleCard";
import ArticleDivider, { type ArticleStat } from "./ArticleDivider";

const STAT_ICON_SIZE = 13;

interface Post {
  id: string;
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
}

interface PageBlock {
  page: number;
  posts: Post[];
}

// useLayoutEffect warns during SSR, so fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function isPaginatedProp(props: {
  paginated?: boolean;
  isPaginated?: boolean;
  showPageEnd?: boolean;
}) {
  return Boolean(props.paginated || props.isPaginated || props.showPageEnd);
}

function computeStats(posts: Post[]): ArticleStat[] {
  // Top tag
  const tagCounts = new Map<string, number>();
  for (const p of posts)
    for (const t of p.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  let topTag = "—";
  let topCount = 0;
  for (const [tag, count] of tagCounts)
    if (count > topCount) {
      topTag = tag;
      topCount = count;
    }

  // Average reading time (~200 words/min) from title + excerpt
  const words = posts.reduce(
    (acc, p) => acc + `${p.title} ${p.excerpt ?? ""}`.split(/\s+/).filter(Boolean).length,
    0,
  );
  const avgMinutes = posts.length ? words / posts.length / 200 : 0;
  const reading = avgMinutes < 1 ? "<1 мин" : `${avgMinutes.toFixed(1)} мин`;

  return [
    { label: "топ-тег", value: topTag, icon: <Tag size={STAT_ICON_SIZE} aria-hidden /> },
    { label: "ср. чтение", value: reading, icon: <Clock size={STAT_ICON_SIZE} aria-hidden /> },
    {
      label: "период",
      value: formatDateRange(posts.map((p) => p.date)),
      icon: <CalendarDays size={STAT_ICON_SIZE} aria-hidden />,
    },
  ];
}

export default function InfinitePosts({
  initialPosts,
  totalPages,
  initialPage = 1,
  apiBase = "/news/page",
  paginated,
  isPaginated,
  showPageEnd,
}: {
  initialPosts: Post[];
  totalPages: number;
  initialPage?: number;
  apiBase?: string;
  paginated?: boolean;
  isPaginated?: boolean;
  showPageEnd?: boolean;
}) {
  const showPageEndMarker =
    isPaginatedProp({ paginated, isPaginated, showPageEnd }) || initialPage > 1;

  const [pages, setPages] = useState<PageBlock[]>([{ page: initialPage, posts: initialPosts }]);
  const [lastLoadedPage, setLastLoadedPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const revealedIds = useRef(new Set<string>());
  const loadMoreRef = useRef<() => void>(() => {});

  const loadMore = useCallback(async () => {
    if (loading || lastLoadedPage >= totalPages) return;
    setLoading(true);
    const nextPage = lastLoadedPage + 1;
    try {
      const res = await fetch(`${apiBase}/${nextPage}.json`);
      if (!res.ok) throw new Error("fetch failed");
      const newPosts: Post[] = await res.json();
      setPages((prev) => [...prev, { page: nextPage, posts: newPosts }]);
      setLastLoadedPage(nextPage);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loading, lastLoadedPage, totalPages, apiBase]);

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
  }, [pages]);

  return (
    <div ref={containerRef}>
      {pages.map(({ page: pageNum, posts: pagePosts }, pi) => (
        <div key={pageNum}>
          {pagePosts.map((p, i) => {
            const isFirstOverall = pi === 0 && i === 0;
            const isFirstOfLaterPage = i === 0 && pi > 0;
            const showCardDivider = !isFirstOverall && !(showPageEndMarker && isFirstOfLaterPage);
            return (
              <div key={p.id}>
                {showCardDivider && <ArticleDivider />}
                <div data-id={p.id} data-reveal data-reveal-pending>
                  <ArticleCard
                    title={p.title}
                    date={p.date}
                    slug={p.slug}
                    excerpt={p.excerpt}
                    tags={p.tags}
                  />
                </div>
              </div>
            );
          })}
          {showPageEndMarker && pageNum < totalPages && (
            <ArticleDivider label={`конец ${pageNum} страницы`} stats={computeStats(pagePosts)} />
          )}
        </div>
      ))}
      {showPageEndMarker && lastLoadedPage >= totalPages && (
        <ArticleDivider
          label="Вы на последней странице"
          stats={computeStats(pages.flatMap((pg) => pg.posts))}
        />
      )}
      {lastLoadedPage < totalPages && (
        <div ref={loaderRef} style={{ padding: "1rem", textAlign: "center" }}>
          {loading ? "Загрузка..." : "Загрузить ещё"}
        </div>
      )}
    </div>
  );
}
