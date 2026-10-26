export interface YieldWindow {
  from: string | null;
  to: string | null;
  origin: "flags" | "shortlist" | "none";
}

export interface YieldRow {
  source: string;
  hosts: string[];
  aggregator: boolean;
  items: number;
  fresh: number;
  stories: number | null;
  published: number | null;
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
  };
  sources: YieldRow[];
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

export const WEIGHT_BASE: number;
export const WEIGHT_SLOPE: number;
export const WEIGHT_MIN: number;
export const WEIGHT_MAX: number;

export function weightFor(publishedRate: number | null | undefined): number | null;
export function readPublishedUrls(options?: {
  articles?: string | null;
  collected?: string | null;
}): string[];
export function measureYield(options: {
  candidates: { source?: string; title?: string; url?: string; date?: string | null }[];
  shortlist?: unknown;
  publishedUrls?: string[];
  from?: string | null;
  to?: string | null;
  undatedCap?: number;
}): Omit<YieldReport, "inputs">;
export function planWeights(report: YieldReport, sourceFile: SourceEntry[]): WeightPlanEntry[];
export function applyWeights(
  rawText: string,
  plan: WeightPlanEntry[],
): { text: string; changes: { source: string; from: number; to: number }[] };
export function run(argv?: string[]): unknown;
