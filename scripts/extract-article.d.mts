export interface PublisherEntry {
  host: string;
  name: string;
  selector: string;
  dateSelector?: string;
}

export interface ArticleBody {
  url: string;
  title: string | null;
  date: string | null;
  text: string;
  words: number;
  mojibake: boolean;
  extractor: string;
  ok: boolean;
  reason: string;
  charset?: string | null;
}

export interface JsonLdFields {
  title: string | null;
  date: string | null;
  body: string | null;
}

export interface MetaFields {
  title: string | null;
  date: string | null;
  siteName: string | null;
}

export interface FetchPageResult {
  ok: boolean;
  status: number;
  charset?: string;
  html?: string;
  error?: string;
}

export const BROWSER_UA: string;
export const FETCH_TIMEOUT_MS: number;
export const PUBLISHERS: PublisherEntry[];

export function pickPublisher(url: string): PublisherEntry | null;
export function normalizeDate(value: string | null | undefined): string | null;
export function charsetOf(bytes: Uint8Array, contentType?: string): string;
export function decodeHtml(bytes: Uint8Array, contentType?: string): string;
export function extractJsonLd(dom: unknown): JsonLdFields;
export function extractMeta(dom: unknown): MetaFields;
export function genericContainer(dom: unknown): Element | null;
export function extract(html: string, url: string): ArticleBody;
export function fetchPage(url: string): Promise<FetchPageResult>;
export function extractFromUrl(url: string): Promise<ArticleBody>;
export function run(argv?: string[]): Promise<ArticleBody>;
