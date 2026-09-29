/**
 * rtcAgent 全部 Function 模块集成测试
 *
 * 验证 6 个业务域 Function 文件的结构一致性、handler 无自引用、
 * 以及工厂函数的正确使用。
 */
import { describe, expect, it, vi } from "vitest";

// Mock @rtc-agent/component
vi.mock("@rtc-agent/component", () => {
  const createMockSchema = () => ({
    describe: () => createMockSchema(),
    optional: () => createMockSchema(),
    default: () => createMockSchema(),
    int: () => createMockSchema(),
    positive: () => createMockSchema(),
    min: () => createMockSchema(),
    max: () => createMockSchema(),
    extend: () => createMockSchema(),
    nullable: () => createMockSchema(),
    parse: (input: unknown) => input,
  });

  return {
    createRtcAgent: vi.fn(),
    switchLocale: vi.fn(),
    withMeta: () => createMockSchema(),
    z: {
      object: () => createMockSchema(),
      string: () => createMockSchema(),
      number: () => createMockSchema(),
      enum: () => createMockSchema(),
      boolean: () => createMockSchema(),
      array: () => createMockSchema(),
      void: () => createMockSchema(),
      record: () => createMockSchema(),
      any: () => createMockSchema(),
      union: () => createMockSchema(),
    },
  };
});

// Mock debugApi —— 提供所有 API 方法的 mock
const mockApi: Record<string, ReturnType<typeof vi.fn>> = {};
const apiMethods = [
  // Person
  "PersonList",
  "PersonGet",
  "PersonCreate",
  "PersonUpdate",
  "PersonDelete",
  "PersonSetDefault",
  // ZiWei
  "ZiWei",
  "GetScopeData",
  "SetHoroscopeTime",
  // DaLiuRen
  "DaLiuRenCreate",
  "DaLiuRenList",
  "DaLiuRenView",
  "DaLiuRenDelete",
  "DaLiuRenUpdateTags",
  "DaLiuRenUpdateNote",
  // LiuYao
  "LiuYaoCreate",
  "LiuYaoList",
  "LiuYaoView",
  "LiuYaoDelete",
  "LiuYaoUpdateTags",
  "LiuYaoUpdateNote",
  // Wiki
  "WikiList",
  "WikiCreate",
  "WikiUpdate",
  "WikiView",
  "WikiReplaceContent",
  "WikiInsertContent",
  // Lunar
  "SolarToLunar",
  "LunarToSolar",
  "GetEightCharacters",
  "GetSolarTerms",
  "GetCurrentSolarTerm",
  "GetChineseCalendar",
  "GetDailyInfo",
  "GetZodiac",
  "GetConstellation",
];
for (const method of apiMethods) {
  mockApi[method] = vi.fn();
}

vi.mock("../debugApi", () => ({
  getInternalPeepApi: () => mockApi,
}));

// 导入所有 Function 模块
const person = await import("./personFunctions");
const ziwei = await import("./ziweiFunctions");
const daliuren = await import("./daliurenFunctions");
const liuyao = await import("./liuyaoFunctions");
const wiki = await import("./wikiFunctions");
const lunar = await import("./lunarFunctions");

/* ─────────────── 结构一致性验证 ─────────────── */

/** 所有导出的 Function 对象 */
const allFunctions = [
  // Person (6)
  { fn: person.personListFunction, group: "person" },
  { fn: person.personGetFunction, group: "person" },
  { fn: person.personCreateFunction, group: "person" },
  { fn: person.personUpdateFunction, group: "person" },
  { fn: person.personDeleteFunction, group: "person" },
  { fn: person.personSetDefaultFunction, group: "person" },
  // ZiWei (3)
  { fn: ziwei.ziweiFunction, group: "ziwei" },
  { fn: ziwei.getScopeDataFunction, group: "ziwei" },
  { fn: ziwei.setHoroscopeTimeFunction, group: "ziwei" },
  // DaLiuRen (7)
  { fn: daliuren.daliurenCreateFunction, group: "daliuren" },
  { fn: daliuren.daliurenListFunction, group: "daliuren" },
  { fn: daliuren.daliurenViewFunction, group: "daliuren" },
  { fn: daliuren.daliurenDeleteFunction, group: "daliuren" },
  { fn: daliuren.daliurenBatchViewFunction, group: "daliuren" },
  { fn: daliuren.daliurenUpdateTagsFunction, group: "daliuren" },
  { fn: daliuren.daliurenUpdateNoteFunction, group: "daliuren" },
  // LiuYao (7)
  { fn: liuyao.liuyaoCreateFunction, group: "liuyao" },
  { fn: liuyao.liuyaoListFunction, group: "liuyao" },
  { fn: liuyao.liuyaoViewFunction, group: "liuyao" },
  { fn: liuyao.liuyaoDeleteFunction, group: "liuyao" },
  { fn: liuyao.liuyaoBatchViewFunction, group: "liuyao" },
  { fn: liuyao.liuyaoUpdateTagsFunction, group: "liuyao" },
  { fn: liuyao.liuyaoUpdateNoteFunction, group: "liuyao" },
  // Wiki (7)
  { fn: wiki.wikiListFunction, group: "wiki" },
  { fn: wiki.wikiCreateFunction, group: "wiki" },
  { fn: wiki.wikiUpdateFunction, group: "wiki" },
  { fn: wiki.wikiViewFunction, group: "wiki" },
  { fn: wiki.wikiBatchViewFunction, group: "wiki" },
  { fn: wiki.wikiReplaceContentFunction, group: "wiki" },
  { fn: wiki.wikiInsertContentFunction, group: "wiki" },
  // Lunar (9)
  { fn: lunar.solarToLunarFunction, group: "lunar" },
  { fn: lunar.lunarToSolarFunction, group: "lunar" },
  { fn: lunar.getEightCharactersFunction, group: "lunar" },
  { fn: lunar.getSolarTermsFunction, group: "lunar" },
  { fn: lunar.getCurrentSolarTermFunction, group: "lunar" },
  { fn: lunar.getChineseCalendarFunction, group: "lunar" },
  { fn: lunar.getDailyInfoFunction, group: "lunar" },
  { fn: lunar.getZodiacFunction, group: "lunar" },
  { fn: lunar.getConstellationFunction, group: "lunar" },
];

describe("全部 Function 结构一致性", () => {
  it("总共导出 39 个 Function", () => {
    expect(allFunctions.length).toBe(39);
  });

  for (const { fn, group } of allFunctions) {
    describe(`${fn.name} (${group})`, () => {
      it("有 name 属性且为非空字符串", () => {
        expect(typeof fn.name).toBe("string");
        expect(fn.name.length).toBeGreaterThan(0);
      });

      it("有 description 属性且为非空字符串", () => {
        expect(typeof fn.description).toBe("string");
        expect(fn.description.length).toBeGreaterThan(0);
      });

      it("有 zodSchema 属性", () => {
        expect(fn.zodSchema).toBeDefined();
      });

      it("handler 为函数", () => {
        expect(typeof fn.handler).toBe("function");
      });

      it("有 returns.zodSchema", () => {
        expect(fn.returns).toBeDefined();
        expect(fn.returns.zodSchema).toBeDefined();
      });
    });
  }
});

/* ─────────────── handler 无自引用验证 ─────────────── */

describe("handler 无自引用模式（全部消除 xxxFunction.zodSchema.parse）", () => {
  // 检查所有 handler 的 toString 不包含自引用
  for (const { fn } of allFunctions) {
    it(`${fn.name} handler 不引用自身 zodSchema`, () => {
      const handlerStr = fn.handler.toString();
      // 排除所有 "xxxFunction.zodSchema" 形式的自引用
      expect(handlerStr).not.toMatch(new RegExp(`${fn.name}\\.zodSchema`));
    });
  }
});

/* ─────────────── Function 分组统计 ─────────────── */

describe("Function 分组统计", () => {
  it("person 组有 6 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "person").length;
    expect(count).toBe(6);
  });

  it("ziwei 组有 3 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "ziwei").length;
    expect(count).toBe(3);
  });

  it("daliuren 组有 7 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "daliuren").length;
    expect(count).toBe(7);
  });

  it("liuyao 组有 7 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "liuyao").length;
    expect(count).toBe(7);
  });

  it("wiki 组有 7 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "wiki").length;
    expect(count).toBe(7);
  });

  it("lunar 组有 9 个 Function", () => {
    const count = allFunctions.filter(f => f.group === "lunar").length;
    expect(count).toBe(9);
  });
});

/* ─────────────── 写操作 Function 安全确认验证 ─────────────── */

describe("写操作 Function 描述包含安全确认机制", () => {
  const writeFunctions = [
    person.personCreateFunction,
    person.personUpdateFunction,
    person.personDeleteFunction,
    daliuren.daliurenCreateFunction,
    daliuren.daliurenDeleteFunction,
    liuyao.liuyaoCreateFunction,
    liuyao.liuyaoDeleteFunction,
    wiki.wikiCreateFunction,
    wiki.wikiUpdateFunction,
  ];

  for (const fn of writeFunctions) {
    it(`${fn.name} 描述提及 confirmed 安全确认`, () => {
      expect(fn.description).toContain("confirmed");
    });
  }
});

/* ─────────────── 不可逆操作警告验证 ─────────────── */

describe("不可逆操作 Function 描述包含不可逆警告", () => {
  const irreversibleFunctions = [
    person.personDeleteFunction,
    daliuren.daliurenDeleteFunction,
    liuyao.liuyaoDeleteFunction,
  ];

  for (const fn of irreversibleFunctions) {
    it(`${fn.name} 描述包含不可逆操作警告`, () => {
      expect(fn.description).toContain("不可逆");
    });
  }
});

/* ─────────────── BatchView Function 性能提示验证 ─────────────── */

describe("View Function 描述包含 BatchView 性能提示", () => {
  const viewFunctions = [
    daliuren.daliurenViewFunction,
    liuyao.liuyaoViewFunction,
    wiki.wikiViewFunction,
  ];

  for (const fn of viewFunctions) {
    it(`${fn.name} 描述推荐使用 BatchView`, () => {
      expect(fn.description).toContain("BatchView");
    });
  }
});

/* ─────────────── 元数据更新 Function 描述验证 ─────────────── */

describe("元数据更新 Function 描述说明不修改卦象数据", () => {
  const metadataFunctions = [
    daliuren.daliurenUpdateTagsFunction,
    daliuren.daliurenUpdateNoteFunction,
    liuyao.liuyaoUpdateTagsFunction,
    liuyao.liuyaoUpdateNoteFunction,
  ];

  for (const fn of metadataFunctions) {
    it(`${fn.name} 描述明确说明仅修改元数据`, () => {
      expect(fn.description).toContain("元数据");
      expect(fn.description).toContain("不修改卦象数据");
    });
  }
});
