import { describe, expect, it } from "vitest";
import { splitBuyRobotMarkers } from "../src/shared/lib/buyRobotMarkers";

describe("splitBuyRobotMarkers", () => {
  it("без маркеров отдаёт один html-сегмент", () => {
    expect(splitBuyRobotMarkers("<p>Просто текст</p>")).toEqual([
      { type: "html", value: "<p>Просто текст</p>" },
    ]);
  });

  it("пустой html не даёт сегментов", () => {
    expect(splitBuyRobotMarkers("")).toEqual([]);
  });

  it("маркер без тегов просит теги статьи", () => {
    expect(splitBuyRobotMarkers("<!-- buy-robot -->")).toEqual([{ type: "products", tags: null }]);
  });

  it("маркер с тегами возвращает список", () => {
    expect(splitBuyRobotMarkers("<!-- buy-robot: гуманоиды, коботы -->")).toEqual([
      { type: "products", tags: ["гуманоиды", "коботы"] },
    ]);
  });

  it("лишние пробелы вокруг тегов и запятых не попадают в значения", () => {
    expect(splitBuyRobotMarkers("<!--buy-robot:   гуманоиды ,   коботы  -->")).toEqual([
      { type: "products", tags: ["гуманоиды", "коботы"] },
    ]);
  });

  it("регистр и пробелы внутри имени маркера не важны", () => {
    expect(splitBuyRobotMarkers("<!-- BUY - ROBOT -->")).toEqual([
      { type: "products", tags: null },
    ]);
    expect(splitBuyRobotMarkers("<!-- Buy-Robot: Cobots -->")).toEqual([
      { type: "products", tags: ["Cobots"] },
    ]);
  });

  it("несколько маркеров делят текст на html-сегменты по порядку", () => {
    const html = "<p>Начало</p><!-- buy-robot --><p>Середина</p><!-- buy-robot: коботы -->";
    expect(splitBuyRobotMarkers(html)).toEqual([
      { type: "html", value: "<p>Начало</p>" },
      { type: "products", tags: null },
      { type: "html", value: "<p>Середина</p>" },
      { type: "products", tags: ["коботы"] },
    ]);
  });

  it("маркер с пустым списком тегов работает как маркер без тегов", () => {
    expect(splitBuyRobotMarkers("<!-- buy-robot:  -->")).toEqual([
      { type: "products", tags: null },
    ]);
    expect(splitBuyRobotMarkers("<!-- buy-robot: , , -->")).toEqual([
      { type: "products", tags: null },
    ]);
  });

  it("html вокруг и между маркерами сохраняется целиком", () => {
    const html = "<h2>Заголовок</h2><!-- buy-robot: гуманоиды --><p>Хвост</p>";
    const segments = splitBuyRobotMarkers(html);
    const htmlValues = segments
      .filter((segment) => segment.type === "html")
      .map((segment) => (segment.type === "html" ? segment.value : ""));

    expect(htmlValues).toEqual(["<h2>Заголовок</h2>", "<p>Хвост</p>"]);
    expect(segments.map((segment) => segment.type)).toEqual(["html", "products", "html"]);
  });

  it("маркер в начале и в конце не создаёт пустых сегментов", () => {
    expect(splitBuyRobotMarkers("<!-- buy-robot --><p>Текст</p><!-- buy-robot -->")).toEqual([
      { type: "products", tags: null },
      { type: "html", value: "<p>Текст</p>" },
      { type: "products", tags: null },
    ]);
  });
});
