export interface Candidate {
  source: string;
  title: string;
  url: string;
  date?: string | null;
}

export interface RetoldSource {
  source: string;
  url: string;
  tier: number;
  title: string;
}

export interface StoryCluster {
  key: string;
  title: string;
  url: string;
  source: string;
  tier: number;
  date: string | null;
  score: number;
  why: string[];
  retold: RetoldSource[];
}

export interface DroppedCandidate extends Candidate {
  reason: string;
}

export interface TriageResult {
  window: { from: string | null; to: string | null; days: number };
  stats: {
    input: number;
    kept: number;
    clusters: number;
    shortlist: number;
    covered: number;
    dropped: number;
  };
  shortlist: StoryCluster[];
  covered: (StoryCluster & { covered_by: string; match: "url" | "story" })[];
  dropped: DroppedCandidate[];
}

export interface KnownArticle {
  title: string;
  slug: string;
  url: string | null;
}

export interface DraftVerdict {
  verdict: "ok" | "duplicate";
  title: string;
  slug: string | null;
  matches: { slug: string; title: string }[];
}

export interface BodyCheck {
  ok: boolean;
  words: number;
  mojibake: boolean;
  reason: string;
}

export const STORY_WINDOW_DAYS: number;
export const MIN_NEWS_WORDS: number;
export const DEFAULT_UNDATED_CAP: number;

export function titleTokens(title: string): Set<string>;
export function titleEntities(title: string): Set<string>;
export function numberSignature(title: string): Set<string>;
export function sourceTier(item: Candidate): number;
export function countWords(text: string): number;
export function looksMojibake(text: string): boolean;
export function checkBody(text: string): BodyCheck;
export function sameStory(
  left: { tokens: Set<string>; entities: Set<string>; numbers: Set<string>; day: number | null },
  right: { tokens: Set<string>; entities: Set<string>; numbers: Set<string>; day: number | null },
  windowDays?: number,
): boolean;
export function triage(
  items: Candidate[],
  options?: {
    from?: string | null;
    to?: string | null;
    undatedCap?: number;
    top?: number;
    windowDays?: number;
    known?: KnownArticle[];
  },
): TriageResult;
export function knownFromArticles(dir: string): KnownArticle[];
export function checkDraft(file: string, articlesDir?: string): DraftVerdict;
export function run(argv?: string[]): unknown;
