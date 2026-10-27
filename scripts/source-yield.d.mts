export interface YieldWindow {
  from: string | null;
  to: string | null;
  origin: "flags" | "shortlist" | "none";
}

export interface AttributionVia {
  /** Articles whose own `source_url` was one of this run's candidates. */
  url: number;
  /** Articles matched to a shortlisted cluster by a retold URL or by title. */
  story: number;
  /** Articles only the host rule could attribute. */
  host: number;
  /** Articles nothing could attribute at all. */
  none: number;
}

export interface PublishedArticle {
  title?: string | null;
  url: string;
  slug?: string | null;
}

export interface YieldRow {
  source: string;
  hosts: string[];
  aggregator: boolean;
  items: number;
  fresh: number;
  stories: number | null;
  /** Articles attributed to it by any rule, host fallback included. */
  published: number | null;
  /** Articles whose story this feed surfaced (URL or story evidence). */
  surfaced: number | null;
  /** Articles quoting this feed's own host in `source_url`. */
  cited: number;
  /** Of `published`, the ones attributed by host alone. */
  hostAttributed: number | null;
  yield: number | null;
  publishedRate: number | null;
  weight: number | null;
  reason: string;
}

export interface YieldReport {
  inputs: {
    candidates: string;
    shortlist: string | null;
    articles: string | null;
    collected: string | null;
  };
  window: YieldWindow;
  totals: {
    sources: number;
    items: number;
    fresh: number;
    stories: number | null;
    published: number | null;
    surfaced: number | null;
    cited: number;
    hostAttributed: number | null;
    articles: number;
    unattributed: number;
    via: AttributionVia;
  };
  sources: YieldRow[];
  attributions: ArticleAttribution[];
}

export interface WeightPlanEntry {
  source: string;
  from: number | null;
  to: number;
  reason: string;
  changed: boolean;
}

export interface SourceEntry {
  name: string;
  url: string;
  type?: string;
  weight?: number;
  [key: string]: unknown;
}

export interface AttributionResult {
  via: "url" | "story" | "host";
  /** Empty means only the host fallback is left. */
  sources: string[];
}

/** One published article and the feeds credited for it. */
export interface ArticleAttribution {
  url: string;
  title: string | null;
  via: "url" | "story" | "host" | "none";
  sources: string[];
}

export const WEIGHT_BASE: number;
export const WEIGHT_SLOPE: number;
export const WEIGHT_MIN: number;
export const WEIGHT_MAX: number;

export function weightFor(publishedRate: number | null | undefined): number | null;
export function readPublishedArticles(options?: {
  articles?: string | null;
  collected?: string | null;
}): PublishedArticle[];
export function measureYield(options: {
  candidates: { source?: string; title?: string; url?: string; date?: string | null }[];
  shortlist?: unknown;
  articles?: PublishedArticle[];
  publishedUrls?: string[];
  from?: string | null;
  to?: string | null;
  undatedCap?: number;
}): Omit<YieldReport, "inputs">;
export function attributeArticle(
  article: PublishedArticle,
  context: {
    byUrl: Map<string, string>;
    clusters: unknown[] | null;
  },
): AttributionResult;
export function planWeights(report: YieldReport, sourceFile: SourceEntry[]): WeightPlanEntry[];
export function applyWeights(
  rawText: string,
  plan: WeightPlanEntry[],
): { text: string; changes: { source: string; from: number; to: number }[] };
export function run(argv?: string[]): unknown;
