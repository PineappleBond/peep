/**
 * 六爻调试 API 极端边缘场景 E2E 测试
 *
 * 覆盖：
 * 1. 空字符串 / 特殊字符 question
 * 2. 无效日期格式
 * 3. 边界值 lines（全老阴/全老阳/混合动爻/无效值）
 * 4. 无效 personId
 * 5. 无效分页参数（page/pageSize）
 * 6. 无效 tags
 * 7. 64 卦完整覆盖（代表性组合）
 *
 * 数据库相关测试使用 fake-indexeddb polyfill；纯计算测试（computeLiuyaoData）
 * 不依赖 IndexedDB。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

import { computeLiuyaoData, LiuYao, LiuYaoCreate } from "./liuyao";
import { LiuyaoError } from "./errors";
import type { SixLines, LineValue } from "../liuyao/core/types";
import { validateNonEmptyString, validatePagination, validateTags } from "./validate";
import { db } from "../personDb";

/* ── 数据库清理辅助 ── */
async function clearDatabase() {
  await db.liuyaoRecords.clear();
  await db.persons.clear();
}

/** 创建测试人物（默认人物） */
async function createTestPerson() {
  const id = await db.persons.add({
    savedAt: Date.now(),
    isDefault: true,
    name: "测试人物",
    date: "1990-01-01",
    timeIndex: 0,
    gender: "男" as const,
    calendar: "solar" as const,
    isLeapMonth: false,
    exactTime: "",
    useTrueSolar: false,
    placeMode: "china" as const,
    province: "北京",
    city: "北京",
    district: "市区",
    timezone: "",
    algorithm: "zhongzhou" as const,
    yearDivide: "exact" as const,
    mutagenTable: "zhongzhou" as const,
    dayDivide: "forward" as const,
    astroType: "heaven" as const,
    residence: "",
  });
  return id;
}

/* ══════════════════════════════════════════════════════════════
 *  1. 空字符串和特殊字符测试（validateNonEmptyString）
 * ══════════════════════════════════════════════════════════════ */
describe("1. 空字符串和特殊字符 question", () => {
  it("空字符串 question 抛出错误", () => {
    expect(() => validateNonEmptyString("", "question", "LiuYaoCreate", LiuyaoError)).toThrow();
  });

  it("超长 question（1000+ 字符）不抛错（仅验证非空）", () => {
    const long = "测".repeat(1200);
    expect(() =>
      validateNonEmptyString(long, "question", "LiuYaoCreate", LiuyaoError),
    ).not.toThrow();
  });

  it("特殊字符：emoji 😊 不抛错（非空即可）", () => {
    expect(() =>
      validateNonEmptyString("😊 这个问题行不行", "question", "LiuYaoCreate", LiuyaoError),
    ).not.toThrow();
  });

  it("特殊字符：HTML 标签 <script> 不抛错（纯字符串，由前端渲染时转义）", () => {
    expect(() =>
      validateNonEmptyString("<script>alert(1)</script>", "question", "LiuYaoCreate", LiuyaoError),
    ).not.toThrow();
  });

  it("特殊字符：SQL 注入片段不抛错", () => {
    expect(() =>
      validateNonEmptyString("' OR 1=1 --", "question", "LiuYaoCreate", LiuyaoError),
    ).not.toThrow();
  });

  it('空白字符 question（"   "）抛出错误', () => {
    expect(() => validateNonEmptyString("   ", "question", "LiuYaoCreate", LiuyaoError)).toThrow();
  });

  it("非字符串类型（number）抛出错误", () => {
    expect(() =>
      validateNonEmptyString(123 as unknown as string, "question", "LiuYaoCreate", LiuyaoError),
    ).toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  2. 无效日期格式测试
 * ══════════════════════════════════════════════════════════════ */
describe("2. 无效日期格式", () => {
  // computeLiuyaoData 在 buildChart 内部使用 iztro，iztro 会对无效日期做校验。
  // 我们只关心 computeLiuyaoData 会不会把异常吞掉或崩溃。

  it("无效月份（2026-13-45）抛出错误", () => {
    expect(() => computeLiuyaoData([1, 1, 1, 1, 1, 1], "2026-13-45", "自占")).toThrow();
  });

  it("无效日期格式（2026/09/27，斜杠分隔）抛出错误", () => {
    // iztro 期望 YYYY-MM-DD 格式；斜杠会被 parseDate 透传给 Date 构造器，
    // 最终在排盘环节抛错。
    expect(() => computeLiuyaoData([1, 1, 1, 1, 1, 1], "2026/09/27", "自占")).toThrow();
  });

  it("无效时间格式（25:61:61）——由 parseDate 处理", async () => {
    await clearDatabase();
    const pid = await createTestPerson();
    // LiuYaoCreate 解析 divinationTime 时会调用 parseDate；无效时间应被拦截。
    await expect(
      LiuYaoCreate(
        { personId: pid, question: "测试", divinationTime: "2026-09-27 25:61:61" },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  3. 边界值 lines 测试
 * ══════════════════════════════════════════════════════════════ */
describe("3. 边界值 lines", () => {
  it("最小值 [0,0,0,0,0,0]（全老阴）= 坤卦", () => {
    const lines: SixLines = [0, 0, 0, 0, 0, 0];
    const r = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(r.chart.name).toBe("坤为地");
    expect(r.chart.palace).toBe("坤");
  });

  it("最大值 [3,3,3,3,3,3]（全老阳）= 乾卦 + 六爻皆动", () => {
    const lines: SixLines = [3, 3, 3, 3, 3, 3];
    const r = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(r.chart.name).toBe("乾为天");
    expect(r.chart.palace).toBe("乾");
    expect(r.chart.changed).not.toBeNull();
    expect(r.chart.changed?.name).toBe("坤为地");
  });

  it("混合值 [0,1,2,3,0,1] 正确计算", () => {
    const lines: SixLines = [0, 1, 2, 3, 0, 1];
    const r = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(r.lines).toEqual(lines);
    expect(r.chart).toBeDefined();
    expect(r.chart.name).toBeTruthy();
  });

  it("长度不足 6（[1,1,1,1,1]）通过 LiuYaoCreate 抛出错误", async () => {
    await clearDatabase();
    const pid = await createTestPerson();
    await expect(
      LiuYaoCreate(
        { personId: pid, question: "测试", lines: [1, 1, 1, 1, 1] as unknown as SixLines },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });

  it("值超出 0-3 范围（[4,1,1,1,1,1]）通过 LiuYaoCreate 抛出错误", async () => {
    await clearDatabase();
    const pid = await createTestPerson();
    await expect(
      LiuYaoCreate(
        { personId: pid, question: "测试", lines: [4, 1, 1, 1, 1, 1] as unknown as SixLines },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });

  it("负数（[-1,1,1,1,1,1]）通过 LiuYaoCreate 抛出错误", async () => {
    await clearDatabase();
    const pid = await createTestPerson();
    await expect(
      LiuYaoCreate(
        { personId: pid, question: "测试", lines: [-1, 1, 1, 1, 1, 1] as unknown as SixLines },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });

  it("小数（[1.5,1,1,1,1,1]）通过 LiuYaoCreate 抛出错误", async () => {
    await clearDatabase();
    const pid = await createTestPerson();
    await expect(
      LiuYaoCreate(
        { personId: pid, question: "测试", lines: [1.5, 1, 1, 1, 1, 1] as unknown as SixLines },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  4. 无效 personId 测试
 * ══════════════════════════════════════════════════════════════ */
describe("4. 无效 personId", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });
  afterEach(async () => {
    await clearDatabase();
  });

  it("负数 personId（-1）抛出 INVALID_INPUT", async () => {
    await expect(
      LiuYaoCreate({ personId: -1, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("personId = 0 抛出 INVALID_INPUT", async () => {
    await expect(
      LiuYaoCreate({ personId: 0, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("personId = Number.MAX_SAFE_INTEGER——人物不存在，抛出 NOT_FOUND", async () => {
    await expect(
      LiuYaoCreate({ personId: Number.MAX_SAFE_INTEGER, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("不存在的 personId（999999）抛出 NOT_FOUND", async () => {
    await expect(
      LiuYaoCreate({ personId: 999999, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("有效 personId 能正常创建记录", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "正常测试" },
      { skipUI: true },
    );
    expect(record.id).toBeDefined();
    expect(record.personId).toBe(testPersonId);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  5. 无效分页参数测试
 * ══════════════════════════════════════════════════════════════ */
describe("5. 无效分页参数", () => {
  it("page = 0 抛出错误", () => {
    expect(() => validatePagination({ page: 0 }, "LiuYaoList", LiuyaoError)).toThrow();
  });

  it("page = -1 抛出错误", () => {
    expect(() => validatePagination({ page: -1 }, "LiuYaoList", LiuyaoError)).toThrow();
  });

  it("pageSize = 0 抛出错误", () => {
    expect(() => validatePagination({ pageSize: 0 }, "LiuYaoList", LiuyaoError)).toThrow();
  });

  it("pageSize = 1000（超过上限 100）抛出错误", () => {
    expect(() => validatePagination({ pageSize: 1000 }, "LiuYaoList", LiuyaoError)).toThrow();
  });

  it("pageSize = -10 抛出错误", () => {
    expect(() => validatePagination({ pageSize: -10 }, "LiuYaoList", LiuyaoError)).toThrow();
  });

  it("有效分页（page=2, pageSize=50）通过", () => {
    expect(() =>
      validatePagination({ page: 2, pageSize: 50 }, "LiuYaoList", LiuyaoError),
    ).not.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  6. 无效 tags 测试
 * ══════════════════════════════════════════════════════════════ */
describe("6. 无效 tags", () => {
  it("空数组 [] 通过验证", () => {
    expect(() => validateTags([], "LiuYaoCreate", LiuyaoError)).not.toThrow();
  });

  it('包含空字符串的数组 [""] 抛出错误', () => {
    expect(() => validateTags([""], "LiuYaoCreate", LiuyaoError)).toThrow();
  });

  it('重复标签 ["测试", "测试"] 通过验证（不去重，由业务层处理）', () => {
    expect(() => validateTags(["测试", "测试"], "LiuYaoCreate", LiuyaoError)).not.toThrow();
  });

  it("超长标签（100+ 字符）通过验证（长度无硬上限）", () => {
    const long = "测".repeat(200);
    expect(() => validateTags([long], "LiuYaoCreate", LiuyaoError)).not.toThrow();
  });

  it("非数组类型（number）抛出错误", () => {
    expect(() => validateTags(123 as unknown as string[], "LiuYaoCreate", LiuyaoError)).toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  7. 64 卦完整覆盖测试
 * ══════════════════════════════════════════════════════════════ */
describe("7. 64 卦完整覆盖", () => {
  /**
   * 六爻编码规则（0=老阴,1=少阳,2=少阴,3=老阳）：
   * - 阴阳性由低位决定：偶数（0/2）为阴，奇数（1/3）为阳。
   * - 因此取 lines[i] 的奇偶性即可代表该爻的阴阳。
   *
   * 64 卦 = 2^6 种阴阳组合，每种对应唯一 lines 代表值：
   * 阴爻 → 0（老阴）；阳爻 → 1（少阳）。
   *
   * 我们生成 64 个代表性 lines，使每条 lines 的奇偶组合覆盖 64 卦。
   */
  const hex64Lines: SixLines[] = [];
  for (let i = 0; i < 64; i++) {
    const lines: SixLines = [0, 0, 0, 0, 0, 0];
    for (let j = 0; j < 6; j++) {
      // 第 j 爻的阴阳由 i 的第 j 位决定：1=阳（少阳=1），0=阴（老阴=0）
      lines[j] = ((i >> j) & 1) as LineValue;
    }
    hex64Lines.push(lines);
  }

  it("64 组 lines 全部能正确计算且不抛错", () => {
    const names = new Set<string>();
    for (const lines of hex64Lines) {
      const r = computeLiuyaoData(lines, "2026-09-27", "自占");
      expect(r.chart.name).toBeTruthy();
      expect(r.chart.palace).toBeTruthy();
      names.add(r.chart.name);
    }
    // 64 组应该得到 64 个不同卦名
    expect(names.size).toBe(64);
  });

  it("64 卦的宫位（palace）均非空", () => {
    for (const lines of hex64Lines) {
      const r = computeLiuyaoData(lines, "2026-09-27", "自占");
      expect(r.chart.palace.length).toBeGreaterThan(0);
    }
  });

  it("八卦纯卦（八纯卦）宫位与卦名一致", () => {
    // 八纯卦：每爻同性质。偶数爻=坤/阴卦；奇数爻=乾/阳卦。
    // 这里取 6 爻全阴 = 坤；6 爻全阳 = 乾。
    const qian = computeLiuyaoData([1, 1, 1, 1, 1, 1], "2026-09-27", "自占");
    expect(qian.chart.name).toBe("乾为天");
    expect(qian.chart.palace).toBe("乾");

    const kun = computeLiuyaoData([0, 0, 0, 0, 0, 0], "2026-09-27", "自占");
    expect(kun.chart.name).toBe("坤为地");
    expect(kun.chart.palace).toBe("坤");
  });

  it("任意 lines 的 lines 字段原样返回", () => {
    const lines: SixLines = [2, 3, 0, 1, 2, 3];
    const r = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(r.lines).toEqual(lines);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  8. LiuYao 兼容接口边缘场景
 * ══════════════════════════════════════════════════════════════ */
describe("8. LiuYao 兼容接口边缘场景", () => {
  it("LiuYao 边界值 lines 不崩溃", () => {
    const r1 = LiuYao([0, 0, 0, 0, 0, 0], "2026-09-27", "自占");
    expect(r1.chart.name).toBe("坤为地");

    const r2 = LiuYao([3, 3, 3, 3, 3, 3], "2026-09-27", "自占");
    expect(r2.chart.name).toBe("乾为天");
  });

  it("LiuYao hbar/vigorColumns 在边界值下正常返回", () => {
    const r = LiuYao([0, 0, 0, 0, 0, 0], "2026-09-27", "自占");
    expect(r.hbarData).not.toBeNull();
    expect(r.vigorColumns).not.toBeNull();
  });
});
