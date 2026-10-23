#!/usr/bin/env node
// Daily log of collected sources, with a TTL.
//
// One file per day: docs/collected/<YYYY-MM-DD>.yaml
// It answers "what did we already take today" and disappears on its own:
// every file carries `expires`, and `prune` deletes the files whose TTL is over.
// The permanent record stays in articles/<slug>.ru.md frontmatter (status,
// wp_id, wp_url, source_url); this log only closes the window between runs.
//
//   node scripts/collected.mjs add --slug <slug> --url <source> [--wp-id 83] [--date 2026-10-24] [--ttl 7]
//   node scripts/collected.mjs export [--out docs/research/collected.json]
//   node scripts/collected.mjs prune [--dry-run]
//   node scripts/collected.mjs list

import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as toYaml } from "yaml";

const DIR = "docs/collected";
const DEFAULT_TTL = 7;

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayFile(dir, date) {
  return join(dir, `${date}.yaml`);
}

export function readLog(dir, date) {
  try {
    return parseYaml(readFileSync(dayFile(dir, date), "utf8")) ?? null;
  } catch {
    return null;
  }
}

export function writeLog(dir, log) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(dayFile(dir, log.date), toYaml(log), "utf8");
}

/** Idempotent: the same slug on the same day keeps its collected_at, only wp_id may fill in. */
export function addEntry(dir, { slug, sourceUrl, wpId, date = today(), ttl = DEFAULT_TTL }) {
  if (!slug) throw new Error("add needs --slug");
  if (!sourceUrl) throw new Error("add needs --url");

  const log = readLog(dir, date) ?? {
    date,
    ttl_days: ttl,
    expires: addDays(date, ttl),
    items: [],
  };

  const entry = log.items.find((item) => item.slug === slug);
  if (entry) {
    entry.source_url = sourceUrl;
    if (wpId) entry.wp_id = Number(wpId);
  } else {
    log.items.push({
      slug,
      source_url: sourceUrl,
      ...(wpId ? { wp_id: Number(wpId) } : {}),
      collected_at: new Date().toISOString(),
    });
  }

  writeLog(dir, log);
  return log;
}

export function listLogs(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.yaml$/.test(name))
      .sort()
      .map((name) => readLog(dir, name.slice(0, 10)))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Shape published-check accepts through `--wp`: link is the source URL. */
export function exportEntries(dir) {
  return listLogs(dir).flatMap((log) =>
    log.items.map((item) => ({
      slug: item.slug,
      link: item.source_url,
      source_url: item.source_url,
      status: "collected",
      ...(item.wp_id ? { id: item.wp_id } : {}),
    })),
  );
}

export function prune(dir, todayDate = today(), dryRun = false) {
  const removed = [];
  for (const log of listLogs(dir)) {
    if (!log.expires || log.expires >= todayDate) continue;
    removed.push(log);
    if (!dryRun) rmSync(dayFile(dir, log.date), { force: true });
  }
  return removed;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (name === "dry-run") {
      flags.dryRun = true;
      continue;
    }
    flags[name] = rest[++i];
  }
  return { command, flags };
}

export function run(argv = process.argv.slice(2), dir = DIR) {
  const { command, flags } = parseArgs(argv);
  switch (command) {
    case "add": {
      const log = addEntry(dir, {
        slug: flags.slug,
        sourceUrl: flags.url,
        wpId: flags["wp-id"],
        date: flags.date,
        ttl: flags.ttl ? Number(flags.ttl) : DEFAULT_TTL,
      });
      console.log(`${log.date}: ${log.items.length} collected, expires ${log.expires}`);
      return log;
    }
    case "export": {
      const items = exportEntries(dir);
      const json = `${JSON.stringify(items, null, 2)}\n`;
      if (flags.out) {
        mkdirSync(dirname(resolve(flags.out)), { recursive: true });
        writeFileSync(resolve(flags.out), json, "utf8");
        console.error(`Exported ${items.length} collected sources to ${flags.out}`);
      } else {
        console.log(json);
      }
      return items;
    }
    case "prune": {
      const removed = prune(dir, today(), Boolean(flags.dryRun));
      for (const log of removed) {
        console.log(
          `${flags.dryRun ? "would delete" : "deleted"} ${log.date}.yaml (expired ${log.expires})`,
        );
      }
      if (removed.length === 0) console.log("nothing to prune");
      return removed;
    }
    case "list": {
      const logs = listLogs(dir);
      for (const log of logs) {
        console.log(
          `${log.date} (expires ${log.expires}): ${log.items.map((i) => i.slug).join(", ")}`,
        );
      }
      if (logs.length === 0) console.log("empty");
      return logs;
    }
    default:
      console.error("Usage: node scripts/collected.mjs add|export|prune|list [flags]");
      process.exitCode = 1;
      return null;
  }
}

if (isEntryPoint()) {
  run();
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
