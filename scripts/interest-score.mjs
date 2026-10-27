// Interest gate for a news shortlist: which of these stories would a reader
// actually want to read?
//
// Triage answers "is this a story and is it new". It does not answer "is it
// interesting", and a batch of four funding rounds proves the difference:
// every one of them is a real story, and none of them is about a robot.
//
// Two layers, cheap first:
//   1. deterministic flags — a headline that moves money, appoints a person or
//      repeats an analyst note, with nothing said about what the robot does, is
//      down-weighted before any model is called;
//   2. Jev `score`s — five dimensions, composited with weights, normalized by
//      their top level, exactly as write-article's triage does. Confidence is a
//      routing factor: a low-confidence verdict goes to `review`, never dropped.
//
// Advisory, like every Jev gate here: it reorders a shortlist, it does not
// delete a story. Without RUNWARE_API_KEY it prints the deterministic layer and
// says so, instead of inventing a score.
//
//   node scripts/interest-score.mjs --file docs/research/shortlist-<date>.json \
//     [--limit 30] [--no-jev] [--json] [--out docs/research/interest-<date>.json]

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Composite weights; the one place to tune the ranking. */
export const WEIGHTS = { robot: 0.35, change: 0.25, evidence: 0.2, reader: 0.15, hype: 0.05 };

/**
 * Below this a verdict is routed to a human instead of trusted. A headline-only
 * read sits near 0.4 even on a clean story, so the bar is set to catch a broken
 * read (empty or garbled title), not to second-guess a genuine 0.45.
 */
export const REVIEW_CONFIDENCE = 0.35;

/**
 * The rubric. Levels run low to high and are normalized by their top index, so a
 * dimension can gain a level without rescaling the composite.
 */
export const DIMENSIONS = {
  robot: {
    question: "Is `document` about what a robot does, or about money and corporate moves?",
    levels: [
      "No robot in it: funding, personnel, stock, forecasts.",
      "A robot is named, but the story is about the deal or the market.",
      "A specific robot is the subject: what it does, how, and where it stops.",
    ],
  },
  change: {
    question: "Does `document` change what robots can do, cost, or where they work?",
    levels: [
      "Restates a known capability or announces an intention.",
      "A small step: more units, another site, a new price point.",
      "A measurable shift: new capability, an order of magnitude in cost, a new domain.",
    ],
  },
  evidence: {
    question: "How checkable is `document`?",
    levels: [
      "Only adjectives and promises.",
      "One number or one named party.",
      "Several concrete numbers, a named customer and a date.",
    ],
  },
  reader: {
    question: "Would an engineer or a buyer retell `document` to a colleague?",
    levels: [
      "No: a press release summary.",
      "Maybe: a useful detail inside routine news.",
      "Yes: it changes how they think about a robot or a purchase.",
    ],
  },
  hype: {
    question: "How concrete is `document` rather than promotional?",
    levels: [
      "Promotional language throughout.",
      "Mixed: facts wrapped in marketing.",
      "Concrete claims with sources.",
    ],
  },
};

// Money moving: funding, deals, valuations, stock.
const MONEY =
  /(раунд|инвест|привлек|привлеч|финансир|оценк|капитализац|ipo|spac|сделк|покупа|приобрел|слияни|акци|выручк|funding|raises|raised|series [a-d]|investment|valuate|valuation|acquires|acquired|acquisition|merger|stake|buyout|融资|轮融资|收购|并购|上市|估值|株式|買収|資金調達|投資)/i;

// A sum alone is not a money story: «робот за $20 000» is a price, not a round.
// It takes an amount and a verb that moves it.
const MONEY_AMOUNT = /(\$|€|¥|₽|\d\s*(?:млн|млрд|миллион|миллиард|million|billion|万|亿|억))/i;
const MONEY_VERB =
  /(привлек|привлеч|закрыл|собрал|раунд|инвест|финансир|raised|raises|closed|funding|series)/i;

// What a robot does. Deliberately excludes the generic word "robot": almost
// every headline here contains it, so it cannot separate the two kinds of story.
const CAPABILITY =
  /(захват|сортир|инспект|сварк|хирург|телеоперац|доставк|склад|погрузк|разгрузк|ходьб|бег|прыж|подъем|перемещ|сборк|уборк|обслужив|патрул|спасен|демонтаж|бурени|опрыск|полив|巡检|分拣|搬运|焊接|手术|配送|打磨|装配|清洗|巡逻|救援|抓取|导航|作业|行走|跳跃)|\b(grip|pick|sort|inspect|weld|surg|deliver|walk|run|jump|lift|assemble|clean|patrol|rescue|drill|spray|harvest|manipulat|warehouse|forklift|palletiz|packaging)/i;

const EXEC =
  /(назначен|возглавил|покин|ушел|ушёл|appoint|names .* as|steps down|resign|ceo|chief|board|совет директоров|аудит-комитет|audit committee|専務|社長|会長|任命|辞任)/i;

const ANALYST =
  /(целев|апгрейд|даунгрейд|upgrade|downgrade|price target|rating|рейтинг|аналитик|опрос|survey|прогноз|forecast|outlook|株式|目標株価|評級|预测|研报)/i;

const AWARD = /(award|наград|лауреат|преми|受賞|获奖|ranking|ランキング|排行榜|榜单|top \d+)/i;

const ROBOT =
  /(робот|robot|ロボット|机器人|人形|humanoid|ヒューマノイド|гуманоид|манипулятор|кобот|agv|amr|дрон|drone|экзоскелет|exoskeleton|具身|机械臂|灵巧手)/i;

/** Deterministic flags for one story. A flag lowers the composite, never hides it. */
export function flagsOf(story) {
  const title = String(story?.title ?? "");
  const flags = [];
  let factor = 1;
  const moneyMoved = MONEY.test(title) || (MONEY_AMOUNT.test(title) && MONEY_VERB.test(title));
  if (moneyMoved && !CAPABILITY.test(title)) {
    // Halved, not banned: a round that says what the robot does stays in reach,
    // it just stops outranking the robot doing it.
    flags.push("money-only");
    factor *= 0.5;
  }
  if (EXEC.test(title)) {
    flags.push("exec-appointment");
    factor *= 0.5;
  }
  if (ANALYST.test(title)) {
    flags.push("analyst-note");
    factor *= 0.6;
  }
  if (AWARD.test(title)) {
    flags.push("award-list");
    factor *= 0.6;
  }
  // "No robot" means the headline names neither a robot nor anything a robot
  // does: a bare capability verb ("прыжок через машину") still says "robot".
  if (!ROBOT.test(title) && !CAPABILITY.test(title)) {
    flags.push("no-robot");
    factor *= 0.7;
  }
  return { flags, factor: Math.round(factor * 100) / 100 };
}

/**
 * Composite from Jev answers. Each score is divided by its top level, so the
 * result is 0..1 whatever the number of levels; a missing answer counts as zero
 * and drags confidence down instead of being silently ignored.
 */
export function compositeOf(answers) {
  let composite = 0;
  let confidence = 1;
  for (const [id, dimension] of Object.entries(DIMENSIONS)) {
    const answer = answers?.[id];
    const top = dimension.levels.length - 1;
    composite += ((WEIGHTS[id] ?? 0) * (answer?.score ?? 0)) / top;
    confidence = Math.min(confidence, answer?.confidence ?? 0);
  }
  return {
    composite: Math.round(composite * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Ranks stories. `ask` is injected so tests never reach the network; without it
 * (and without a key) only the deterministic layer runs and composite stays null.
 */
export async function scoreStories(stories, options = {}) {
  const { ask = null, limit = 0 } = options;
  const picked = limit > 0 ? stories.slice(0, limit) : stories;
  const rows = [];

  for (const story of picked) {
    const { flags, factor } = flagsOf(story);
    if (!ask) {
      rows.push({
        title: story.title,
        url: story.url,
        source: story.source,
        flags,
        factor,
        composite: null,
        confidence: null,
        route: "deterministic",
      });
      continue;
    }
    const { answers } = await ask({
      state: { document: documentOf(story) },
      questions: questionsFor(),
    });
    const { composite, confidence } = compositeOf(answers);
    rows.push({
      title: story.title,
      url: story.url,
      source: story.source,
      flags,
      factor,
      composite: Math.round(composite * factor * 1000) / 1000,
      confidence,
      route: confidence < REVIEW_CONFIDENCE ? "review" : "ok",
    });
  }

  // Stories without a model verdict rank by the deterministic factor alone and
  // never jump above a story whose content was actually read.
  rows.sort((left, right) => {
    if (left.composite === null && right.composite === null) return right.factor - left.factor;
    if (left.composite === null) return 1;
    if (right.composite === null) return -1;
    return right.composite - left.composite || right.factor - left.factor;
  });
  return rows;
}

/** What the model sees: title, plus every retelling's title for context. */
export function documentOf(story) {
  const retold = (story.retold ?? []).map((entry) => `- ${entry.title}`).join("\n");
  return retold ? `${story.title}\n\n${retold}` : String(story.title ?? "");
}

export function questionsFor() {
  const questions = {};
  for (const [id, dimension] of Object.entries(DIMENSIONS)) {
    questions[id] = { type: "score", instructions: dimension.question, criteria: dimension.levels };
  }
  return questions;
}

/**
 * Loads the Jev client from the global mount; null when it is absent.
 * The mount points at `<repo>/skills`, while `lib/jev` sits at the repo root, so
 * the real mount path is resolved and its parent tried first.
 */
async function loadJev() {
  const mount = resolve(homedir(), ".config/opencode/skills");
  const candidates = [];
  try {
    candidates.push(resolve(realpathSync(mount), "..", "lib/jev/client.mjs"));
  } catch {
    // A missing mount is normal on a machine without the skills repo.
  }
  candidates.push(resolve(mount, "lib/jev/client.mjs"));
  for (const path of candidates) {
    try {
      return await import(pathToFileURL(path).href);
    } catch {
      // Try the next location.
    }
  }
  return null;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (name === "json" || name === "no-jev") {
      flags[name] = true;
      continue;
    }
    flags[name] = argv[++i];
  }
  return flags;
}

export async function run(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  if (!flags.file) throw new Error("interest-score needs --file <shortlist.json>");
  const input = JSON.parse(readFileSync(resolve(flags.file), "utf8"));
  const stories = Array.isArray(input) ? input : (input.shortlist ?? []);

  let ask = null;
  if (!flags["no-jev"]) {
    const jev = await loadJev();
    if (jev?.hasKey?.()) ask = jev.askDecisions;
    else
      console.error(
        "interest-score: Jev недоступен (нет ключа или клиента) — только детерминированный слой",
      );
  }

  const rows = await scoreStories(stories, {
    ask,
    limit: flags.limit ? Number(flags.limit) : 30,
  });

  if (flags.out) writeFileSync(resolve(flags.out), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  if (flags.json) {
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  }

  console.log(`interest: ${rows.length} stories${ask ? "" : " (deterministic only)"}`);
  for (const row of rows) {
    const score = row.composite === null ? "  n/a" : row.composite.toFixed(2);
    const flags = row.flags.length > 0 ? `  [${row.flags.join(", ")}]` : "";
    console.log(
      `  ${score}  x${row.factor}  ${row.route.padEnd(13)} ${row.title.slice(0, 90)}${flags}`,
    );
  }
  if (flags.out) console.log(`Wrote ${flags.out}`);
  return rows;
}

const invokedDirectly = isEntryPoint();

if (invokedDirectly) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
