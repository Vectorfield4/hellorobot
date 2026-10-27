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

/** What a runner is asked for: one list of sources, on pass 1 or pass 2. */
export interface LaneRunnerInput {
  sources: SourceLike[];
  pass: number;
}

/** Sources in, candidates out. The default runner shells out; a test injects its own. */
export type LaneRunner = (input: LaneRunnerInput) => CappedItem[];

export interface LaneRetry {
  /** Publishers that answered with nothing on the first pass, in lane order. */
  retried: string[];
  /** Of those, the ones that returned at least one item on the retry. */
  recovered: string[];
  /** Of those, the ones still empty after the one retry. */
  stillEmpty: string[];
}

export interface FetchedLane extends LaneRetry {
  items: CappedItem[];
}

export interface LaneRun extends CapResult, LaneRetry {
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
export function emptySources(sources: SourceLike[], items: CappedItem[]): SourceLike[];
export function dedupeByUrl(items: CappedItem[]): CappedItem[];
export function fetchLane(sources: SourceLike[], runner: LaneRunner): FetchedLane;
export function defaultRunner(options: { researchDir: string; date: string }): LaneRunner;
export function run(argv?: string[], deps?: { runner?: LaneRunner | null }): LaneRun;
