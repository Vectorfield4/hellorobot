export interface StoryInput {
  title: string;
  url: string;
  source: string;
  retold?: { source: string; url: string; title: string }[];
}

export interface InterestRow {
  title: string;
  url: string;
  source: string;
  flags: string[];
  factor: number;
  composite: number | null;
  confidence: number | null;
  route: "ok" | "review" | "deterministic";
}

export type JevAnswer = { score?: number; confidence?: number };

export const WEIGHTS: Record<string, number>;
export const REVIEW_CONFIDENCE: number;
export const DIMENSIONS: Record<string, { question: string; levels: string[] }>;

export function flagsOf(story: { title?: string }): { flags: string[]; factor: number };
export function compositeOf(answers: Record<string, JevAnswer> | undefined): {
  composite: number;
  confidence: number;
};
export function documentOf(story: StoryInput): string;
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
    limit?: number;
  },
): Promise<InterestRow[]>;
export function run(argv?: string[]): Promise<InterestRow[]>;
