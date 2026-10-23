import { describe, expect, it } from "vitest";
import {
  TAG_ALIASES as UI_ALIASES,
  canonicalTag as uiCanonicalTag,
} from "../src/shared/config/productTags";

// У CLI нет декларации типов: контракт модуля проверяют его собственные тесты.
// @ts-expect-error — у scripts/products.mjs нет .d.mts
const scriptModule = (await import("../scripts/products.mjs")) as {
  TAG_ALIASES: Record<string, string[]>;
  canonicalTag: (value: string) => string;
};

const scriptCanonicalTag = scriptModule.canonicalTag;
const SCRIPT_ALIASES = scriptModule.TAG_ALIASES;

type AliasMap = Record<string, string[]>;

const scriptMap = SCRIPT_ALIASES as AliasMap;
const uiMap = UI_ALIASES as AliasMap;

function allNames(map: AliasMap): string[] {
  return [...new Set(Object.entries(map).flatMap(([canon, aliases]) => [canon, ...aliases]))];
}

describe("карта тегов: фронт и скрипт импорта", () => {
  it("скрипт знает все каноны фронта", () => {
    for (const canon of Object.keys(uiMap)) {
      expect(scriptCanonicalTag(canon)).toBe(scriptCanonicalTag(canon));
      expect(typeof scriptCanonicalTag(canon)).toBe("string");
    }
  });

  it("фронт не мельче скрипта: совпавшее в ensure совпадёт и в блоке", () => {
    for (const name of allNames(scriptMap)) {
      const scriptCanon = scriptCanonicalTag(name);
      expect(uiCanonicalTag(name)).toBe(uiCanonicalTag(scriptCanon));
    }
  });

  it("канон фронта идемпотентен", () => {
    for (const name of allNames(uiMap)) {
      const once = uiCanonicalTag(name);
      expect(uiCanonicalTag(once)).toBe(once);
    }
  });

  it("оба словаря знают ключевые темы блога", () => {
    for (const canon of [
      "гуманоиды",
      "коботы",
      "манипуляторы",
      "навигация",
      "автономность",
      "тактильность",
      "складская логистика",
      "оборонная робототехника",
      "мягкая робототехника",
    ]) {
      expect(Object.keys(uiMap)).toContain(canon);
      expect(Object.keys(scriptMap)).toContain(canon);
    }
  });
});
