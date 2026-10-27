export interface StoryInput {
  title: string;
  url: string;
  source: string;
  date?: string | null;
  lead?: string;
  retold?: { source: string; url: string; title: string }[];
}

export interface InterestRow {
  title: string;
  url: string;
  source: string;
  flags: string[];
  factor: number;
  date: string | null;
  dateSource: "page" | "feed" | null;
  composite: number | null;
  confidence: number | null;
  route: "ok" | "review" | "deterministic";
}

export type JevAnswer = { score?: number; confidence?: number };

export interface ExtractedBody {
  url: string;
  date?: string | null;
  text?: string;
}

export const WEIGHTS: Record<string, number>;
export const REVIEW_CONFIDENCE: number;
export const FRESH_DAYS: number;
export const DIMENSIONS: Record<string, { question: string; levels: string[] }>;

export function flagsOf(story: { title?: string }): { flags: string[]; factor: number };
export function ageFlags(
  dates: { ms: number | null; source: "page" | "feed" | null; ageDays: number | null },
  freshDays?: number,
): { flags: string[]; factor: number; date: string | null; dateSource: "page" | "feed" | null };
export function storyDate(
  story: { url?: string; date?: string | null },
  bodies?: Map<string, ExtractedBody> | null,
  now?: number,
): { ms: number | null; source: "page" | "feed" | null; ageDays: number | null };
export function canonicalUrl(url: string): string;
export function compositeOf(answers: Record<string, JevAnswer> | undefined): {
  composite: number;
  confidence: number;
};
export function documentOf(story: StoryInput, lead?: string): string;
export function leadOf(
  story: StoryInput & { lead?: string },
  bodies?: Map<string, ExtractedBody> | null,
  limit?: number,
): string;
export function loadBodies(dir: string): Map<string, ExtractedBody>;
export function questionsFor(): Record<string, unknown>;
export function scoreStories(
  stories: StoryInput[],
  options?: {
    ask?:
      | ((input: {
          state: { document: string };
          questions: Record<string, unknown>;
        }) => Promise<{ answers: Record<string, JevAnswer> }>)
      | null;
    bodies?: Map<string, ExtractedBody> | null;
    now?: number;
    freshDays?: number;
    limit?: number;
  },
): Promise<InterestRow[]>;
export function run(argv?: string[]): Promise<InterestRow[]>;
