import { describe, expect, it } from "vitest";
import type { StoryInput } from "../scripts/interest-score.mjs";
import {
  ageFlags,
  compositeOf,
  DIMENSIONS,
  documentOf,
  flagsOf,
  scoreStories,
  storyDate,
  WEIGHTS,
} from "../scripts/interest-score.mjs";

const story = (over: Partial<StoryInput> = {}): StoryInput => ({
  title: "Robot sorts parcels in a warehouse",
  url: "https://example.test/story",
  source: "The Robot Report",
  retold: [],
  ...over,
});

const answersWith = (score: number, confidence = 0.9) => {
  const answers: Record<string, { score: number; confidence: number }> = {};
  for (const id of Object.keys(DIMENSIONS)) answers[id] = { score, confidence };
  return answers;
};

describe("deterministic flags", () => {
  it("down-weights a funding round that says nothing about what the robot does", () => {
    const result = flagsOf(story({ title: "Bedrock Robotics raises $600M in Series C funding" }));

    expect(result.flags).toContain("money-only");
    expect(result.factor).toBe(0.5);
  });

  it("reads a Russian round the same way, where the verb and the sum are split", () => {
    const result = flagsOf(
      story({ title: "Bedrock Robotics закрыла $600 млн: автономные экскаваторы уже работают" }),
    );

    expect(result.flags).toContain("money-only");
    expect(result.factor).toBe(0.5);
  });

  it("does not mistake a price for a funding round", () => {
    const result = flagsOf(story({ title: "Робот за $20 000 варит швы на верфи" }));

    expect(result.flags).not.toContain("money-only");
    expect(result.factor).toBe(1);
  });

  it("keeps a funding round that is actually about the robot", () => {
    const result = flagsOf(
      story({ title: "Maven Robotics raises $100M to build mobile manipulators for warehouses" }),
    );

    expect(result.flags).not.toContain("money-only");
    expect(result.factor).toBe(1);
  });

  it("down-weights an appointment twice as hard as a market note", () => {
    const exec = flagsOf(story({ title: "Boston Dynamics appoints new CEO to lead robotics" }));
    const analyst = flagsOf(story({ title: "Analyst upgrades robotics stock on robot outlook" }));

    expect(exec.flags).toContain("exec-appointment");
    expect(exec.factor).toBeLessThan(analyst.factor);
  });

  it("flags a story with no robot in the headline at all", () => {
    const result = flagsOf(
      story({ title: "Integrated Decapper Option Expands AutoSorter Functionality" }),
    );

    expect(result.flags).toContain("no-robot");
    expect(result.factor).toBe(0.7);
  });

  it("leaves a plain robot story untouched", () => {
    expect(flagsOf(story({ title: "GXO expands Digit humanoid fleet across warehouses" }))).toEqual(
      {
        flags: [],
        factor: 1,
      },
    );
  });
});

describe("composite", () => {
  it("reaches 1 when every dimension sits at its top level", () => {
    const { composite } = compositeOf(answersWith(2));

    expect(composite).toBe(1);
  });

  it("weights the robot dimension above the others", () => {
    const allLow = compositeOf(answersWith(0));
    const robotHigh = compositeOf({
      ...answersWith(0),
      robot: { score: 2, confidence: 0.9 },
    });

    expect(allLow.composite).toBe(0);
    expect(robotHigh.composite).toBeCloseTo(WEIGHTS.robot, 5);
  });

  it("treats a missing dimension as zero and drags confidence down", () => {
    const partial = compositeOf({ robot: { score: 2, confidence: 0.9 } });

    expect(partial.composite).toBeCloseTo(WEIGHTS.robot, 5);
    expect(partial.confidence).toBe(0);
  });
});

describe("ranking", () => {
  it("puts the story about a robot above the money-only story", async () => {
    const ask = async ({ state }: { state: { document: string } }) =>
      state.document.includes("raises")
        ? { answers: answersWith(0.6) }
        : { answers: answersWith(1.8) };

    const rows = await scoreStories(
      [
        story({
          title: "Qualcomm raises $5B to acquire robotics software",
          url: "https://a.test/1",
        }),
        story({
          title: "Robot hand sorts delicate fruit at 900 items an hour",
          url: "https://a.test/2",
        }),
      ],
      { ask },
    );

    expect(rows[0].url).toBe("https://a.test/2");
    expect(rows[1].flags).toContain("money-only");
  });

  it("never ranks an unread story above a scored one", async () => {
    const rows = await scoreStories(
      [
        story({ title: "Robot walks upstairs", url: "https://a.test/1" }),
        story({ title: "Robot drives forklift", url: "https://a.test/2" }),
      ],
      { ask: null },
    );

    expect(rows.every((row) => row.composite === null)).toBe(true);
    expect(rows.every((row) => row.route === "deterministic")).toBe(true);
  });

  it("routes a broken read to review instead of trusting it", async () => {
    const ask = async () => ({ answers: answersWith(1.5, 0.1) });

    const [row] = await scoreStories([story({})], { ask });

    expect(row.route).toBe("review");
  });

  it("respects the limit so a long shortlist is not scored whole", async () => {
    let calls = 0;
    const ask = async () => {
      calls += 1;
      return { answers: answersWith(1) };
    };

    await scoreStories([story({}), story({}), story({})], { ask, limit: 2 });

    expect(calls).toBe(2);
  });
});

describe("age", () => {
  const now = Date.parse("2026-10-27T06:00:00Z");

  it("flags a 2023 press page as stale even when the headline reads like news", () => {
    const row = ageFlags({ ms: Date.parse("2023-04-29T00:00:00Z"), source: "page", ageDays: 1277 });

    expect(row.flags).toContain("stale");
    expect(row.factor).toBe(0.4);
    expect(row.date).toBe("2023-04-29");
  });

  it("leaves a story from today alone", () => {
    const row = ageFlags({ ms: Date.parse("2026-10-27T00:00:00Z"), source: "feed", ageDays: 0 });

    expect(row.flags).toEqual([]);
    expect(row.factor).toBe(1);
  });

  it("prefers the page date over the feed date of an undated listing", () => {
    const bodies = new Map([
      ["example.test/old", { url: "https://example.test/old", date: "2024-08-01", text: "old" }],
    ]);

    const dates = storyDate({ url: "https://example.test/old", date: null }, bodies, now);

    expect(dates.source).toBe("page");
    expect(dates.ageDays).toBeGreaterThan(365);
  });

  it("marks an unknown date as undated rather than fresh", () => {
    const dates = storyDate({ url: "https://example.test/x", date: null }, null, now);
    const row = ageFlags(dates);

    expect(row.flags).toEqual(["undated"]);
    expect(row.factor).toBe(0.75);
  });

  it("ranks a stale story below a fresh one with identical content", async () => {
    const ask = async () => ({ answers: answersWith(1.5) });

    const rows = await scoreStories(
      [
        story({ title: "Robot sorts parcels", url: "https://a.test/fresh", date: "2026-10-27" }),
        story({ title: "Robot sorts parcels", url: "https://a.test/old", date: "2024-01-01" }),
      ],
      { ask, now },
    );

    expect(rows[0].url).toBe("https://a.test/fresh");
    expect(rows[1].flags).toContain("stale");
  });

  it("sends the lead paragraph to the model, not only the headline", async () => {
    let seen = "";
    const ask = async ({ state }: { state: { document: string } }) => {
      seen = state.document;
      return { answers: answersWith(1.5) };
    };
    const bodies = new Map([
      [
        "example.test/story",
        {
          url: "https://example.test/story",
          text: "Компания отгрузила 5000 манипуляторов за квартал. Приводы собственные.",
        },
      ],
    ]);

    await scoreStories([story({ date: "2026-10-27" })], { ask, bodies, now });

    expect(seen).toContain("отгрузила 5000 манипуляторов");
  });
});

describe("document", () => {
  it("gives the model the retellings as context", () => {
    const document = documentOf(
      story({
        title: "GXO expands Digit fleet",
        retold: [
          {
            title: "GXO и Agility расширяют парк",
            source: "irobotnews.com",
            url: "https://a.test/r",
          },
        ],
      }),
    );

    expect(document).toContain("GXO expands Digit fleet");
    expect(document).toContain("GXO и Agility расширяют парк");
  });
});
