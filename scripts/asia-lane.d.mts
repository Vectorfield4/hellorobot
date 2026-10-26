export interface SourceLike {
  name: string;
  url: string;
  lang?: string | null;
  [key: string]: unknown;
}

export interface CappedItem {
  source: string;
  title: string;
  url: string;
  date?: string | null;
  [key: string]: unknown;
}

export interface LaneSourceStat {
  source: string;
  available: number;
  kept: number;
}

export interface CapResult {
  items: CappedItem[];
  dropped: number;
  perSource: LaneSourceStat[];
}

export interface LaneRun extends CapResult {
  date: string;
}

export const ASIA_LANGS: Set<string>;
export const FETCHER: string;
export const DEFAULT_CAP: number;

export function asiaSources(sources: SourceLike[]): SourceLike[];
export function capCandidates(
  items: CappedItem[],
  options?: { cap?: number; undatedCap?: number },
): CapResult;
export function run(argv?: string[]): LaneRun;
