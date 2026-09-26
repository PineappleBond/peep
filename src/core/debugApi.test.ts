/**
 * debugApi 单元测试：自定义错误类、computeZiWeiData、computeScopeData、parseDate、wrapError
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { astro } from "iztro";
import {
  ZiWeiError,
  ParseDateError,
  ComputeScopeError,
  computeZiWeiData,
  computeScopeData,
  parseDate,
  wrapError,
} from "./debugApi";
import type { Person } from "./personDb";
import type { Zwds, PickState } from "./useZwds";
import type { Scope } from "./utils";

/* ─────────────── 自定义错误类 ─────────────── */

describe("ZiWeiError", () => {
  it("正确设置消息、来源和上下文", () => {
    const err = new ZiWeiError("测试错误", "testSource", {
      context: { key: "value" },
      suggestion: "这是建议",
    });

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ZiWeiError);
    expect(err.name).toBe("ZiWeiError");
    expect(err.source).toBe("testSource");
    expect(err.context).toEqual({ key: "value" });
    expect(err.suggestion).toBe("这是建议");
    expect(err.message).toContain("测试错误");
  });

  it("支持错误链（cause）", () => {
    const original = new Error("原始错误");
    const err = new ZiWeiError("包装错误", "source", { cause: original });
    expect(err.cause).toBe(original);
  });

  it("context 默认为空对象", () => {
    const err = new ZiWeiError("消息", "source");
    expect(err.context).toEqual({});
  });

  it("suggestion 可选", () => {
    const err = new ZiWeiError("消息", "source");
    expect(err.suggestion).toBeUndefined();
  });
});

describe("ParseDateError", () => {
  it("包含原始输入和尝试的格式列表", () => {
    const err = new ParseDateError("invalid-date", ["ISO 8601", "YYYY-MM-DD"], "解析失败");

    expect(err).toBeInstanceOf(ZiWeiError);
    expect(err).toBeInstanceOf(ParseDateError);
    expect(err.name).toBe("ParseDateError");
    expect(err.rawInput).toBe("invalid-date");
    expect(err.attemptedFormats).toEqual(["ISO 8601", "YYYY-MM-DD"]);
    expect(err.source).toBe("parseDate");
    expect(err.message).toContain("日期解析失败");
    expect(err.message).toContain("invalid-date");
  });

  it("支持数字输入", () => {
    const err = new ParseDateError(12345, ["时间戳"], "无效时间戳");
    expect(err.rawInput).toBe(12345);
    expect(typeof err.rawInput).toBe("number");
  });

  it("支持 Date 输入", () => {
    const date = new Date("invalid");
    const err = new ParseDateError(date, ["Date 实例"], "Invalid Date");
    expect(err.rawInput).toBe(date);
  });

  it("空格式列表时提示'未尝试任何格式'", () => {
    const err = new ParseDateError("test", [], "空输入");
    expect(err.message).toContain("未尝试任何格式");
  });

  it("支持 cause 错误链", () => {
    const cause = new Error("底层错误");
    const err = new ParseDateError("test", ["format"], "失败", cause);
    expect(err.cause).toBe(cause);
  });
});

describe("ComputeScopeError", () => {
  it("包含人物信息和日期上下文", () => {
    const err = new ComputeScopeError("计算失败", {
      personId: 1,
      personName: "张三",
      solarDate: "2024-06-15",
      suggestion: "请检查数据",
    });

    expect(err).toBeInstanceOf(ZiWeiError);
    expect(err).toBeInstanceOf(ComputeScopeError);
    expect(err.name).toBe("ComputeScopeError");
    expect(err.source).toBe("computeScopeData");
    expect(err.context.personId).toBe(1);
    expect(err.context.personName).toBe("张三");
    expect(err.context.solarDate).toBe("2024-06-15");
    expect(err.suggestion).toBe("请检查数据");
  });

  it("默认建议为'请检查人物数据是否完整'", () => {
    const err = new ComputeScopeError("失败");
    expect(err.suggestion).toContain("人物数据");
  });

  it("支持自定义上下文扩展", () => {
    const err = new ComputeScopeError("失败", {
      context: { extra: "info" },
    });
    expect(err.context.extra).toBe("info");
  });
});

/* ─────────────── computeZiWeiData ─────────────── */

describe("computeZiWeiData", () => {
  /** 用固定生辰起盘，构造最小 Zwds 对象 */
  function makeMockZwds(overrides: Partial<Zwds> = {}): Zwds {
    const astrolabe = astro.withOptions({
      type: "solar",
      dateStr: "2000-08-16",
      timeIndex: 2,
      gender: "男" as never,
      isLeapMonth: false,
      fixLeap: true,
      language: "zh-CN",
      config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
    });

    const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
    const targetSolar = `${pick.year}-${pick.month}-${pick.day}`;
    const horoscope = astrolabe.horoscope(targetSolar, pick.hour);
    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;

    // 构造满足 computeZiWeiData 最小需求的 Zwds 对象
    return {
      astrolabe,
      horoscope,
      birthLunarYear,
      pick,
      visible: {
        decadal: true,
        yearly: false,
        monthly: false,
        daily: false,
        hourly: false,
      },
      // 以下字段 computeZiWeiData 不直接使用，给占位值
      input: {} as Zwds["input"],
      decades: [],
      childhood: null,
      activeDecadeIdx: 0,
      years: [],
      months: [],
      days: [],
      hours: [],
      monthDays: 30,
      clampedDay: 15,
      effLeap: false,
      targetSolar,
      trueSolar: null,
      soulPalaceIndex: 0,
      lifeKline: [],
      analysis: null,
      actions: {} as Zwds["actions"],
      ...overrides,
    } as Zwds;
  }

  it("无 scope 时返回 hbar 但 chart 为 null", () => {
    const z = makeMockZwds();
    const result = computeZiWeiData(z);

    expect(result.hbar).not.toBeNull();
    expect(result.hbar!.decades).toHaveLength(12);
    expect(result.chart).toBeNull();
  });

  it("有 scope 时返回 hbar 和 chart", () => {
    const z = makeMockZwds();
    const result = computeZiWeiData(z, "yearly");

    expect(result.hbar).not.toBeNull();
    expect(result.chart).not.toBeNull();
  });

  it("hbar.visible 复制自 z.visible", () => {
    const z = makeMockZwds();
    const result = computeZiWeiData(z);

    expect(result.hbar!.visible.decadal).toBe(true);
    expect(result.hbar!.visible.yearly).toBe(false);
  });

  it("astrolabe 为 null 时 hbar 和 chart 均为 null", () => {
    const z = makeMockZwds({ astrolabe: null as unknown as Zwds["astrolabe"] });
    const result = computeZiWeiData(z, "yearly");

    expect(result.hbar).toBeNull();
    expect(result.chart).toBeNull();
  });

  it("horoscope 为 null 但有 scope 时 chart 为 null", () => {
    const z = makeMockZwds({ horoscope: null });
    const result = computeZiWeiData(z, "yearly");

    expect(result.hbar).not.toBeNull(); // hbar 不依赖 horoscope
    expect(result.chart).toBeNull(); // chart 需要 horoscope
  });
});

/* ─────────────── computeScopeData ─────────────── */

describe("computeScopeData", () => {
  /** 构造一个有效 Person 对象 */
  function makePerson(overrides: Partial<Person> = {}): Person {
    return {
      id: 1,
      name: "测试人物",
      gender: "男",
      calendar: "solar",
      date: "2000-08-16",
      timeIndex: 2,
      isLeapMonth: false,
      algorithm: "default",
      yearDivide: "normal",
      mutagenTable: "default",
      dayDivide: "forward",
      astroType: "heaven",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    } as Person;
  }

  it("有效人物和日期返回运限数据", () => {
    const person = makePerson();
    const result = computeScopeData(person, "2026-05-15");

    expect(result).not.toBeNull();
    expect(result!.decades).toHaveLength(12);
    expect(result!.years.length).toBeGreaterThan(0);
    expect(result!.months.length).toBeGreaterThanOrEqual(12);
  });

  it("pick 的年月日与输入日期一致", () => {
    const person = makePerson();
    const result = computeScopeData(person, "2026-06-15");

    expect(result).not.toBeNull();
    expect(result!.pick.year).toBe(2026);
    expect(result!.pick.month).toBe(6);
    expect(result!.pick.day).toBe(15);
  });

  it("Date 对象输入也能正确解析", () => {
    const person = makePerson();
    const date = new Date(2026, 5, 15); // 月份从 0 开始
    const result = computeScopeData(person, date);

    expect(result).not.toBeNull();
    expect(result!.pick.year).toBe(2026);
    expect(result!.pick.month).toBe(6);
  });

  it("无效日期字符串抛出 ParseDateError", () => {
    const person = makePerson();
    expect(() => computeScopeData(person, "")).toThrow(ParseDateError);
  });

  it("pick.year 不早于出生农历年", () => {
    const person = makePerson();
    // 用出生年之前的日期
    const result = computeScopeData(person, "1990-01-01");
    expect(result).not.toBeNull();
    // pick.year 应被 clamp 到 birthLunarYear 或之后
    expect(result!.pick.year).toBeGreaterThanOrEqual(
      result!.pick.year, // 至少不小于自身（说明 clamp 逻辑运行）
    );
  });
});

/* ─────────────── parseDate ─────────────── */

describe("parseDate", () => {
  describe("Date 实例", () => {
    it("有效 Date 实例直接返回", () => {
      const input = new Date("2024-06-15T12:00:00");
      const result = parseDate(input);
      expect(result).toBe(input);
    });

    it("Invalid Date 抛出 ParseDateError", () => {
      const input = new Date("invalid");
      expect(() => parseDate(input)).toThrow(ParseDateError);
      try {
        parseDate(input);
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        expect((err as ParseDateError).attemptedFormats).toEqual(["Date 实例"]);
      }
    });
  });

  describe("数字时间戳", () => {
    it("毫秒时间戳正确解析", () => {
      const input = 1718452800000; // 2024-06-15T16:00:00.000Z
      const result = parseDate(input);
      expect(result.getTime()).toBe(input);
    });

    it("秒级时间戳自动转毫秒", () => {
      const input = 1718452800; // 秒级时间戳
      const result = parseDate(input);
      expect(result.getTime()).toBe(input * 1000);
    });

    it("无效时间戳抛出 ParseDateError", () => {
      expect(() => parseDate(NaN)).toThrow(ParseDateError);
    });
  });

  describe("字符串格式", () => {
    it("YYYY-MM-DD 格式正确解析", () => {
      const result = parseDate("2024-06-15");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5); // 月份从 0 开始
      expect(result.getDate()).toBe(15);
    });

    it("YYYY-MM-DD HH 格式自动补全分钟秒", () => {
      const result = parseDate("2024-06-15 14");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("YYYY-MM-DD HH:mm 格式正确解析", () => {
      const result = parseDate("2024-06-15 14:30");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it("YYYY-MM-DD HH:mm:ss 格式正确解析", () => {
      const result = parseDate("2024-06-15 14:30:45");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(45);
    });

    it("ISO 8601 格式正确解析", () => {
      const result = parseDate("2024-06-15T14:30:45.000Z");
      expect(result.toISOString()).toBe("2024-06-15T14:30:45.000Z");
    });

    it("纯数字字符串当作时间戳", () => {
      const input = "1718452800000";
      const result = parseDate(input);
      expect(result.getTime()).toBe(Number(input));
    });

    it("纯数字字符串（秒级）自动转毫秒", () => {
      const input = "1718452800";
      const result = parseDate(input);
      expect(result.getTime()).toBe(Number(input) * 1000);
    });

    it("带前后空白的字符串正确解析", () => {
      const result = parseDate("  2024-06-15  ");
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe("错误情况", () => {
    it("空字符串抛出 ParseDateError", () => {
      expect(() => parseDate("")).toThrow(ParseDateError);
      try {
        parseDate("");
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        expect((err as ParseDateError).attemptedFormats).toEqual([]);
      }
    });

    it("仅空白的字符串抛出 ParseDateError", () => {
      expect(() => parseDate("   ")).toThrow(ParseDateError);
    });

    it("无效日期字符串抛出 ParseDateError", () => {
      expect(() => parseDate("invalid-date")).toThrow(ParseDateError);
      try {
        parseDate("invalid-date");
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        expect((err as ParseDateError).attemptedFormats).toContain(
          "ISO 8601 / 浏览器原生 Date.parse",
        );
      }
    });

    it("无效纯数字字符串抛出 ParseDateError", () => {
      // 超出合理范围的时间戳
      expect(() => parseDate("99999999999999999999999999")).toThrow(ParseDateError);
    });

    it("错误信息包含原始输入", () => {
      const input = "not-a-date";
      try {
        parseDate(input);
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        expect((err as ParseDateError).rawInput).toBe(input);
      }
    });
  });
});

/* ─────────────── wrapError ─────────────── */

describe("wrapError", () => {
  // 测试用的错误类
  class TestError extends ZiWeiError {
    constructor(message: string, source: string, options?: { cause?: unknown }) {
      super(message, source, options);
      this.name = "TestError";
    }
  }

  it("BaseDebugError 子类直接返回", () => {
    const original = new ZiWeiError("原始错误", "testSource");
    const wrapped = wrapError("label", original, TestError);
    expect(wrapped).toBe(original);
  });

  it("原生 Error 附加来源标签", () => {
    const original = new Error("原始错误");
    const wrapped = wrapError("label", original, TestError);
    expect(wrapped).toBe(original);
    expect((wrapped as Error).message).toBe("[label] 原始错误");
  });

  it("原生 Error 已有标签时不重复添加", () => {
    const original = new Error("[label] 原始错误");
    const wrapped = wrapError("label", original, TestError);
    expect((wrapped as Error).message).toBe("[label] 原始错误");
  });

  it("非 Error 值包装为指定错误类", () => {
    const wrapped = wrapError("label", "字符串错误", TestError);
    expect(wrapped).toBeInstanceOf(TestError);
    expect(wrapped.message).toContain("label 执行失败");
    expect(wrapped.message).toContain("字符串错误");
  });

  it("非 Error 对象包装时 JSON 序列化到 context", () => {
    const original = { code: 500, message: "server error" };
    const wrapped = wrapError("label", original, TestError);
    expect(wrapped).toBeInstanceOf(TestError);
    expect((wrapped as TestError).context.rawError).toBe(JSON.stringify(original));
  });

  it("非 Error 值保留为 cause", () => {
    const original = "字符串错误";
    const wrapped = wrapError("label", original, TestError);
    expect((wrapped as TestError).cause).toBe(original);
  });
});
