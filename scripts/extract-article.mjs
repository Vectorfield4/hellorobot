#!/usr/bin/env node
// Thin launcher: the extractor lives in the skills repo, mounted as
// .opencode/skills/data/article-extractor.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const relative = join("data", "article-extractor", "scripts", "extract-article.mjs");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const engine = [
  join(repoRoot, ".opencode", "skills", relative),
  join(homedir(), ".config", "opencode", "skills", relative),
].find(existsSync);

if (!engine) {
  console.error("article-extractor not found. Mount .opencode/skills/data");
  process.exitCode = 1;
} else {
  const { run } = await import(pathToFileURL(engine).href);
  await run(process.argv.slice(2));
}
