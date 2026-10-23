export interface CollectedItem {
  slug: string;
  source_url: string;
  wp_id?: number;
  collected_at: string;
}

export interface CollectedLog {
  date: string;
  ttl_days: number;
  expires: string;
  items: CollectedItem[];
}

export interface ExportedItem {
  slug: string;
  link: string;
  source_url: string;
  status: "collected";
  id?: number;
}

export function dayFile(dir: string, date: string): string;
export function readLog(dir: string, date: string): CollectedLog | null;
export function writeLog(dir: string, log: CollectedLog): void;
export function addEntry(
  dir: string,
  input: { slug: string; sourceUrl: string; wpId?: string | number; date?: string; ttl?: number },
): CollectedLog;
export function listLogs(dir: string): CollectedLog[];
export function exportEntries(dir: string): ExportedItem[];
export function prune(dir: string, todayDate?: string, dryRun?: boolean): CollectedLog[];
export function run(argv?: string[], dir?: string): unknown;
