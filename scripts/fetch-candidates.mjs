#!/usr/bin/env node
// Thin launcher: the fetcher lives in the skills repo, mounted as
// .opencode/skills/data/news-fetcher. Sources are local data: scripts/sources.json.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const relative = join("data", "news-fetcher", "scripts", "fetch-candidates.mjs");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Project mount first; the global skills dir keeps the command working before a
// project has mounted the `data` category.
const engine = [
  join(repoRoot, ".opencode", "skills", relative),
  join(homedir(), ".config", "opencode", "skills", relative),
].find(existsSync);

if (!engine) {
  console.error(`news-fetcher not found. Mount .opencode/skills/data or run: npm i`);
  process.exitCode = 1;
} else {
  const args = process.argv.slice(2);
  if (!args.includes("--sources")) {
    args.push("--sources", fileURLToPath(new URL("./sources.json", import.meta.url)));
  }
  const { run } = await import(pathToFileURL(engine).href);
  await run(args);
}
