import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkBody,
  checkDraft,
  countWords,
  looksMojibake,
  MIN_NEWS_WORDS,
  numberSignature,
  sourceTier,
  titleEntities,
  titleTokens,
  triage,
} from "../scripts/triage-candidates.mjs";

const item = (
  over: Partial<{ source: string; title: string; url: string; date: string | null }>,
) => ({
  source: "The Robot Report",
  title: "Robot story",
  url: "https://www.therobotreport.com/a",
  date: "2026-10-25",
  ...over,
});

describe("story clustering", () => {
  it("collapses one event retold by four outlets into one story", () => {
    const result = triage([
      item({
        source: "The Robot Report",
        title: "Gecko Robotics raises $300M to inspect Navy ships",
        url: "https://www.therobotreport.com/gecko",
      }),
      item({
        source: "Google News (en)",
        title: "Gecko Robotics raises $300M to inspect Navy ships",
        url: "https://news.google.com/rss/articles/abc",
      }),
      item({
        source: "irobotnews.com",
        title: "Gecko Robotics, 3억 달러 투자 유치... 해군 선박 점검",
        url: "https://www.irobotnews.com/news/articleView.html?idxno=49199",
      }),
      item({
        source: "中国机器人网",
        title: "Gecko Robotics 融资 3亿美元 用于海军舰艇检测",
        url: "https://www.robot-china.com/news/gecko.html",
        date: null,
      }),
    ]);

    expect(result.stats.clusters).toBe(1);
    expect(result.shortlist).toHaveLength(1);
    // The actor of the story wins over the trade press and both retellings.
    expect(result.shortlist[0].source).toBe("The Robot Report");
    expect(result.shortlist[0].retold).toHaveLength(3);
  });

  it("keeps two different facts about the same platform apart", () => {
    const result = triage([
      item({
        title: "Unitree unveils H2 humanoid with 31 degrees of freedom",
        url: "https://www.therobotreport.com/unitree-h2",
      }),
      item({
        title: "Unitree H2 humanoid falls during live demo in Shanghai",
        url: "https://www.therobotreport.com/unitree-fall",
      }),
    ]);

    expect(result.stats.clusters).toBe(2);
  });

  it("does not merge two different companies that raised the same amount", () => {
    const result = triage([
      item({
        title: "Maven Robotics raises $100M for mobile manipulators",
        url: "https://www.therobotreport.com/maven",
      }),
      item({
        title: "Figure raises $100M to scale humanoid production",
        url: "https://www.therobotreport.com/figure",
      }),
    ]);

    expect(result.stats.clusters).toBe(2);
  });

  it("merges a translated retelling that keeps the company and the amount", () => {
    const result = triage([
      item({
        title: "Yaskawa plans humanoid robot for 2027",
        url: "https://www.therobotreport.com/yaskawa",
      }),
      item({
        source: "irobotnews.com",
        title: "Yaskawa 2027 휴머노이드 로봇 계획 발표",
        url: "https://www.irobotnews.com/news/articleView.html?idxno=49187",
      }),
    ]);

    expect(result.stats.clusters).toBe(1);
    expect(result.shortlist[0].source).toBe("The Robot Report");
  });
  it("does not merge two topics that share a three-letter acronym", () => {
    const result = triage([
      item({
        title: "MIT professor bets on force-based reinforcement learning for robots",
        url: "https://example.test/mit",
      }),
      item({
        source: "中国机器人网",
        title: "MIT 教授押注机器人新路线：力觉与强化学习",
        url: "https://www.robot-china.com/news/mit.html",
        date: null,
      }),
    ]);

    expect(result.stats.clusters).toBe(2);
  });

  it("merges a transliterated retelling that keeps a short company mark", () => {
    const result = triage([
      item({
        title: "Promise Robotics partners with D.R. Horton on housing",
        url: "https://www.therobotreport.com/promise",
      }),
      item({
        source: "irobotnews.com",
        title: "프로미스로보틱스, 美 D.R.호튼과 주택건설용 피지컬AI 제휴",
        url: "https://www.irobotnews.com/news/articleView.html?idxno=49204",
      }),
    ]);

    expect(result.stats.clusters).toBe(1);
  });
});

describe("source tiers", () => {
  it("ranks the actor above trade press above a reprint", () => {
    expect(sourceTier(item({ source: "KUKA", url: "https://www.kuka.com/en-us/news/1" }))).toBe(0);
    expect(
      sourceTier(item({ source: "The Robot Report", url: "https://www.therobotreport.com/1" })),
    ).toBe(1);
    expect(
      sourceTier(item({ source: "Google News (ja)", url: "https://news.google.com/rss/1" })),
    ).toBe(2);
    expect(
      sourceTier(
        item({ source: "irobotnews.com", url: "https://www.irobotnews.com/news/articleView.html" }),
      ),
    ).toBe(2);
  });
});

describe("window and drop rules", () => {
  it("drops stale and out-of-window candidates with a reason", () => {
    const result = triage(
      [
        item({ title: "Old robot funding round closes", date: "2026-10-20" }),
        item({
          title: "Fresh robot funding round closes",
          date: "2026-10-25",
          url: "https://x.test/2",
        }),
        item({
          title: "Future robot funding round closes",
          date: "2026-11-05",
          url: "https://x.test/3",
        }),
      ],
      { from: "2026-10-25", to: "2026-10-26" },
    );

    expect(result.stats.kept).toBe(1);
    const reasons = result.dropped.map((entry) => entry.reason).sort();
    expect(reasons).toEqual(["outside window", "stale"]);
  });

  it("caps undated listing items positionally per source", () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      item({
        source: "中国机器人网",
        title: `机器人新闻 ${index}`,
        url: `https://www.robot-china.com/news/${index}.html`,
        date: null,
      }),
    );

    const result = triage(items, { undatedCap: 2 });

    expect(result.stats.kept).toBe(2);
    expect(result.dropped.filter((entry) => entry.reason === "undated past cap 2")).toHaveLength(3);
  });

  it("drops expo invitations but keeps a report about a robot shown at an expo", () => {
    const result = triage([
      item({
        title: "Приглашаем на CeMAT Asia 2026: стенд A12",
        url: "https://example.test/invite",
        date: "2026-10-25",
      }),
      item({
        title: "中国AGV网: выставка CeMAT Asia, складской робот отгрузил 500 единиц",
        url: "https://example.test/report",
        date: "2026-10-25",
      }),
    ]);

    expect(result.dropped.map((entry) => entry.reason)).toContain("expo-invitation");
    expect(result.stats.clusters).toBe(1);
  });

  it("drops a webinar announcement and an award list", () => {
    const result = triage([
      item({ title: "Вебинар: как выбрать коллаборативного робота", url: "https://a.test/1" }),
      item({ title: "Лучшие роботы года: рейтинг и награды", url: "https://a.test/2" }),
    ]);

    expect(result.stats.shortlist).toBe(0);
    expect(result.dropped.map((entry) => entry.reason).sort()).toEqual(["award-list", "webinar"]);
  });
});

describe("title signatures", () => {
  it("reads money in three languages as the same amount", () => {
    const english = numberSignature("Gecko raises $300M");
    const russian = numberSignature("Gecko привлекла 300 млн долларов");
    const korean = numberSignature("Gecko 3억 달러 투자 유치");

    expect([...english]).toContain("300000000");
    expect([...russian]).toContain("300000000");
    expect([...korean]).toContain("300000000");
  });

  it("ignores years, which would merge every story of one year", () => {
    expect([...numberSignature("Итоги 2026 года в робототехнике")]).not.toContain("2026");
  });

  it("keeps latin company names out of the stopword noise", () => {
    expect([...titleEntities("Gecko Robotics raises $300M")]).toContain("gecko");
    expect([...titleEntities("Gecko Robotics raises $300M")]).not.toContain("robotics");
  });

  it("splits Japanese titles into bigrams", () => {
    expect(titleTokens("ヒューマノイドロボット発表")).toContain("ロボ");
  });
});

describe("archive gate", () => {
  it("marks a candidate whose story is already published", () => {
    const title =
      "Gecko Robotics: ВМС США вчетверо подняли потолок контракта на роботов-инспекторов";
    const result = triage(
      [
        item({
          source: "The Robot Report",
          title,
          url: "https://www.therobotreport.com/gecko-2",
        }),
      ],
      { known: [{ title, slug: "gecko-robotics-navy-300m-contract", url: null }] },
    );

    expect(result.stats.covered).toBe(1);
    expect(result.covered[0].covered_by).toBe("gecko-robotics-navy-300m-contract");
    expect(result.stats.shortlist).toBe(0);
    expect(result.dropped.map((entry) => entry.reason)).toContain(
      "already-published: gecko-robotics-navy-300m-contract",
    );
  });

  it("does not hide a new fact about a company that is already covered", () => {
    const result = triage(
      [
        item({
          title: "Unitree unveils H2 humanoid with 31 degrees of freedom",
          url: "https://www.therobotreport.com/unitree-h2",
        }),
      ],
      {
        known: [
          {
            title: "Unitree оштрафована за демонстрацию робота без разрешения",
            slug: "unitree-fine",
            url: null,
          },
        ],
      },
    );

    expect(result.stats.covered).toBe(0);
    expect(result.stats.shortlist).toBe(1);
  });

  it("flags a Russian draft that repeats a published story", () => {
    const dir = mkdtempSync(join(tmpdir(), "drafts-"));
    try {
      writeFileSync(
        join(dir, "gecko-robotics-navy-300m-contract.ru.md"),
        [
          "---",
          'title: "Gecko Robotics: ВМС США вчетверо подняли потолок контракта на роботов-инспекторов"',
          "slug: gecko-robotics-navy-300m-contract",
          "source_url: https://www.therobotreport.com/gecko",
          "---",
          "",
          "Текст.",
        ].join("\n"),
        "utf8",
      );
      const draft = join(dir, "new-story.ru.md");
      writeFileSync(
        draft,
        [
          "---",
          'title: "Gecko Robotics: ВМС США подняли потолок контракта на роботов-инспекторов"',
          "slug: new-story",
          "---",
          "",
          "Текст.",
        ].join("\n"),
        "utf8",
      );

      const verdict = checkDraft(draft, dir);

      expect(verdict.verdict).toBe("duplicate");
      expect(verdict.matches[0].slug).toBe("gecko-robotics-navy-300m-contract");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes a draft that covers a different story", () => {
    const dir = mkdtempSync(join(tmpdir(), "drafts-"));
    try {
      const draft = join(dir, "new-story.ru.md");
      writeFileSync(
        draft,
        [
          "---",
          'title: "Yaskawa обещает гуманоида к 2027 году"',
          "slug: new-story",
          "---",
          "",
          "Текст.",
        ].join("\n"),
        "utf8",
      );

      expect(checkDraft(draft, dir).verdict).toBe("ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("body gate", () => {
  it("fails a truncated extraction instead of accepting a short story", () => {
    const body = "Robot firm raised money. ".repeat(20);
    const result = checkBody(body);

    expect(result.words).toBeLessThan(MIN_NEWS_WORDS);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("too-short");
  });

  it("passes a full news body", () => {
    const body = "Компания показала робота на складе. ".repeat(80);
    const result = checkBody(body);

    expect(result.words).toBeGreaterThan(MIN_NEWS_WORDS);
    expect(result.ok).toBe(true);
  });

  it("fails mojibake, which turns a Chinese listing into unreadable text", () => {
    const broken = "æœºå™¨äººæ–°é—» ".repeat(100);

    expect(looksMojibake(broken)).toBe(true);
    expect(checkBody(broken).reason).toBe("mojibake");
  });

  it("counts CJK characters as words rather than as one token", () => {
    expect(countWords("机器人".repeat(50))).toBe(100);
  });
});
