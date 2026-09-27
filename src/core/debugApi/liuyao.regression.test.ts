/**
 * 六爻调试 API 综合回归测试
 *
 * 作为快速回归测试套件，覆盖所有核心功能，运行时间 < 10 秒。
 * 使用 fake-indexeddb/auto polyfill IndexedDB。
 *
 * 测试范围：
 * 1. 核心功能回归（computeLiuyaoData / LiuYao / LiuYaoCreate / LiuYaoList / LiuYaoView）
 * 2. 数据结构完整性（LiuyaoRecord / ChartJSON / YongShen / computed）
 * 3. 参数验证回归（所有无效参数、边界值、类型检查）
 * 4. 业务流程回归（创建→查询→详情 / 多人物 / 标签搜索）
 * 5. 错误处理回归（错误类型 / 错误信息 / 错误代码）
 * 6. 性能基准回归（关键操作 < 基准阈值）
 * 7. 兼容性回归（API 版本 / 向后兼容 / 类型定义）
 * 8. 集成点回归（人物模块 / 数据库 / 回调系统）
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeLiuyaoData, LiuYao, LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { LiuyaoError, ApiErrorCode } from "./errors";
import { API_VERSION } from "./types";
import { db } from "../personDb";
import { invalidateLiuyaoTagCache } from "../liuyaoDb";
import { PersonCreate } from "./person";
import type { SixLines, ChartJSON, YongShen, YongTarget } from "../liuyao/core/types";
import type { LiuyaoRecord } from "../personDb";

/* ── 工具函数 ── */

/** 清理数据库 */
async function clearDatabase() {
  await db.liuyaoRecords.clear();
  await db.persons.clear();
  invalidateLiuyaoTagCache();
}

/** 创建测试人物（返回 ID） */
async function createTestPerson(name = "测试人物"): Promise<number> {
  const person = await PersonCreate(
    {
      name,
      date: "1990-01-15",
      timeIndex: 3,
      gender: "男" as const,
      calendar: "公历" as const,
    },
    false,
  );
  return person.id!;
}

const DEFAULT_LINES: SixLines = [1, 1, 1, 1, 1, 1]; // 乾卦
const DEFAULT_DATE = "2026-09-27";
const DEFAULT_TARGET: YongTarget = "自占";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. 核心功能回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("1. 核心功能回归", () => {
  describe("computeLiuyaoData", () => {
    it("自动摇卦返回完整结果", () => {
      const result = computeLiuyaoData(undefined, DEFAULT_DATE, DEFAULT_TARGET);
      expect(result.chart).toBeDefined();
      expect(result.yong).toBeDefined();
      expect(result.lines).toHaveLength(6);
      expect(result.lines.every(v => v >= 0 && v <= 3)).toBe(true);
    });

    it("指定 lines 返回正确卦名", () => {
      const result = computeLiuyaoData(DEFAULT_LINES, DEFAULT_DATE, DEFAULT_TARGET);
      expect(result.chart.name).toBe("乾为天");
      expect(result.chart.palace).toBe("乾");
      expect(result.lines).toEqual(DEFAULT_LINES);
    });

    it("不同 yongTarget 返回不同用神", () => {
      const lines: SixLines = [1, 2, 3, 0, 1, 2];
      const r1 = computeLiuyaoData(lines, DEFAULT_DATE, "自占");
      const r2 = computeLiuyaoData(lines, DEFAULT_DATE, "父母");
      expect(r1.yong.rel).not.toBe(r2.yong.rel);
    });
  });

  describe("LiuYao 向后兼容", () => {
    it("返回完整计算数据", () => {
      const result = LiuYao(DEFAULT_LINES, DEFAULT_DATE, DEFAULT_TARGET, "12:00:00");
      expect(result.divinationTime).toBe("2026-09-27T12:00:00");
      expect(result.chart.name).toBe("乾为天");
      expect(result.hbarData).toBeDefined();
      expect(result.vigorColumns).toBeDefined();
      expect(result.person).toBeNull();
    });

    it("不传 time 默认 00:00:00", () => {
      const result = LiuYao(DEFAULT_LINES, DEFAULT_DATE, DEFAULT_TARGET);
      expect(result.divinationTime).toBe("2026-09-27T00:00:00");
    });
  });

  describe("LiuYaoCreate / List / View（skipUI=true）", () => {
    let testPersonId: number;

    beforeEach(async () => {
      await clearDatabase();
      testPersonId = await createTestPerson();
    });

    afterEach(async () => {
      await clearDatabase();
    });

    it("创建 → 列表 → 详情完整流程", async () => {
      // 创建
      const created = await LiuYaoCreate(
        {
          personId: testPersonId,
          question: "回归测试问题",
          lines: DEFAULT_LINES,
          tags: ["回归测试"],
          yongTarget: "自占",
        },
        { skipUI: true },
      );
      expect(created.id).toBeDefined();
      expect(created.question).toBe("回归测试问题");
      expect(created.chart.name).toBe("乾为天");

      // 列表
      const list = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
      expect(list.records).toHaveLength(1);
      expect(list.total).toBe(1);
      expect(list.records[0].id).toBe(created.id);

      // 详情
      const view = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
      expect(view.id).toBe(created.id);
      expect(view.question).toBe("回归测试问题");
      expect(view.computed).toBeDefined();
      expect(view.computed!.hbarData).toBeDefined();
      expect(view.computed!.vigorColumns).toBeDefined();
    });

    it("自动摇卦创建", async () => {
      const record = await LiuYaoCreate(
        { personId: testPersonId, question: "自动摇卦" },
        { skipUI: true },
      );
      expect(record.lines).toHaveLength(6);
      expect(record.chart).toBeDefined();
      expect(record.yong).toBeDefined();
    });

    it("列表分页", async () => {
      for (let i = 0; i < 5; i++) {
        await LiuYaoCreate(
          {
            personId: testPersonId,
            question: `问题${i}`,
            tags: i % 2 === 0 ? ["A"] : ["B"],
          },
          { skipUI: true },
        );
      }
      const page1 = await LiuYaoList(
        { personId: testPersonId, page: 1, pageSize: 2 },
        { skipUI: true },
      );
      const page2 = await LiuYaoList(
        { personId: testPersonId, page: 2, pageSize: 2 },
        { skipUI: true },
      );
      expect(page1.records).toHaveLength(2);
      expect(page2.records).toHaveLength(2);
      expect(page1.total).toBe(5);
    });

    it("列表按标签过滤", async () => {
      for (let i = 0; i < 3; i++) {
        await LiuYaoCreate(
          { personId: testPersonId, question: `Q${i}`, tags: ["T"] },
          { skipUI: true },
        );
      }
      const filtered = await LiuYaoList({ personId: testPersonId, tags: ["T"] }, { skipUI: true });
      expect(filtered.records).toHaveLength(3);
    });

    it("列表搜索关键字", async () => {
      await LiuYaoCreate(
        { personId: testPersonId, question: "特殊问题", note: "独特备注" },
        { skipUI: true },
      );
      await LiuYaoCreate({ personId: testPersonId, question: "普通问题" }, { skipUI: true });
      const result = await LiuYaoList(
        { personId: testPersonId, searchText: "独特" },
        { skipUI: true },
      );
      expect(result.records).toHaveLength(1);
      expect(result.records[0].question).toBe("特殊问题");
    });
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 2. 数据结构完整性
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("2. 数据结构完整性", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("LiuyaoRecord 包含所有必需字段", async () => {
    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "完整性测试",
        lines: DEFAULT_LINES,
        tags: ["tag1", "tag2"],
        background: "背景",
        note: "备注",
        yongTarget: "父母",
        divinationTime: "2024-06-15 14:30:00",
      },
      { skipUI: true },
    );

    // 所有 LiuyaoRecord 字段验证
    expect(record.id).toBeTypeOf("number");
    expect(record.personId).toBe(testPersonId);
    expect(record.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(record.question).toBe("完整性测试");
    expect(record.background).toBe("背景");
    expect(record.note).toBe("备注");
    expect(record.tags).toEqual(["tag1", "tag2"]);
    expect(record.lines).toEqual(DEFAULT_LINES);
    expect(record.yongTarget).toBe("父母");
    expect(record.savedAt).toBeTypeOf("number");
    expect(record.chart).toBeDefined();
    expect(record.yong).toBeDefined();
  });

  it("ChartJSON 结构完整", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "卦象结构", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    const chart: ChartJSON = record.chart;

    expect(chart.name).toBe("乾为天");
    expect(chart.palace).toBe("乾");
    expect(chart.palaceElem).toBeTypeOf("string");
    expect(chart.type).toBeTypeOf("string");
    expect(chart.shi).toBeTypeOf("number");
    expect(chart.ying).toBeTypeOf("number");
    expect(chart.lines).toHaveLength(6);
    expect(chart.month).toHaveProperty("branch");
    expect(chart.month).toHaveProperty("elem");
    expect(chart.day).toHaveProperty("stem");
    expect(chart.day).toHaveProperty("branch");
    expect(chart.day).toHaveProperty("elem");
    expect(chart.day.kong).toHaveLength(2);

    // 验证每一爻的结构
    for (const line of chart.lines) {
      expect(line.pos).toBeTypeOf("number");
      expect(line.yang).toBeTypeOf("boolean");
      expect(line.moving).toBeTypeOf("boolean");
      expect(line.stem).toBeTypeOf("string");
      expect(line.branch).toBeTypeOf("string");
      expect(line.elem).toBeTypeOf("string");
      expect(line.rel).toBeTypeOf("string");
      expect(line.god).toBeTypeOf("string");
      expect(line.kong).toBeTypeOf("boolean");
      expect(line.kongState === null || typeof line.kongState === "string").toBe(true);
    }
  });

  it("YongShen 结构完整", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "用神结构", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    const yong: YongShen = record.yong;

    expect(yong.rel).toBeTypeOf("string");
    expect(["父母", "兄弟", "子孙", "妻财", "官鬼"]).toContain(yong.rel);
    // pos 可以是数字或 null
    expect(yong.pos === null || typeof yong.pos === "number").toBe(true);
    // pickedBy 可以是特定字符串或 null
    expect(yong.pickedBy === null || typeof yong.pickedBy === "string").toBe(true);
    // hidden 可以为 null 或含特定字段对象
    if (yong.hidden) {
      expect(yong.hidden.under).toBeTypeOf("number");
      expect(yong.hidden.stem).toBeTypeOf("string");
      expect(yong.hidden.branch).toBeTypeOf("string");
      expect(yong.hidden.elem).toBeTypeOf("string");
    }
  });

  it("computed 字段完整（LiuYaoView skipUI）", async () => {
    const created = await LiuYaoCreate(
      { personId: testPersonId, question: "computed 测试", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    const view = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    const computed = view.computed!;

    expect(computed.divinationTime).toBeTypeOf("string");
    expect(computed.chart).toBeDefined();
    expect(computed.yong).toBeDefined();
    expect(computed.person).toBeNull(); // skipUI 模式
    expect(computed.hbarData).toBeDefined();
    expect(computed.vigorColumns).toBeDefined();
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 3. 参数验证回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("3. 参数验证回归", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe("LiuYaoCreate 参数验证", () => {
    it("question 为空字符串抛出 LiuyaoError", async () => {
      await expect(
        LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });

    it("question 为纯空格抛出 LiuyaoError", async () => {
      await expect(
        LiuYaoCreate({ personId: testPersonId, question: "   " }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });

    it("不存在的 personId 抛出 NOT_FOUND", async () => {
      try {
        await LiuYaoCreate({ personId: 99999, question: "不存在的人物" }, { skipUI: true });
        expect.fail("应该抛出错误");
      } catch (err) {
        expect(err).toBeInstanceOf(LiuyaoError);
        expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.NOT_FOUND);
      }
    });

    it("无效 lines（长度不足 6）抛出错误", async () => {
      await expect(
        LiuYaoCreate(
          { personId: testPersonId, question: "测试", lines: [1, 2, 3] as unknown as SixLines },
          { skipUI: true },
        ),
      ).rejects.toThrow();
    });

    it("无效 lines（值超出范围）抛出错误", async () => {
      await expect(
        LiuYaoCreate(
          {
            personId: testPersonId,
            question: "测试",
            lines: [0, 1, 2, 3, 4, 5] as unknown as SixLines,
          },
          { skipUI: true },
        ),
      ).rejects.toThrow();
    });

    it("无效 yongTarget 抛出错误", async () => {
      await expect(
        LiuYaoCreate(
          {
            personId: testPersonId,
            question: "测试",
            yongTarget: "无效目标" as unknown as YongTarget,
          },
          { skipUI: true },
        ),
      ).rejects.toThrow();
    });

    it("tags 包含空字符串抛出错误", async () => {
      await expect(
        LiuYaoCreate({ personId: testPersonId, question: "测试", tags: [""] }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });

    it("tags 为非数组抛出错误", async () => {
      await expect(
        LiuYaoCreate(
          { personId: testPersonId, question: "测试", tags: "不是数组" as unknown as string[] },
          { skipUI: true },
        ),
      ).rejects.toThrow(LiuyaoError);
    });
  });

  describe("LiuYaoList 参数验证", () => {
    it("page 为 0 抛出错误", async () => {
      await expect(
        LiuYaoList({ personId: testPersonId, page: 0 }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });

    it("pageSize 为负数抛出错误", async () => {
      await expect(
        LiuYaoList({ personId: testPersonId, pageSize: -1 }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });

    it("pageSize 超过 100 抛出错误", async () => {
      await expect(
        LiuYaoList({ personId: testPersonId, pageSize: 101 }, { skipUI: true }),
      ).rejects.toThrow(LiuyaoError);
    });
  });

  describe("LiuYaoView 参数验证", () => {
    it("recordId 为 0 抛出错误", async () => {
      await expect(LiuYaoView({ recordId: 0 }, { skipUI: true })).rejects.toThrow();
    });

    it("recordId 为负数抛出错误", async () => {
      await expect(LiuYaoView({ recordId: -1 }, { skipUI: true })).rejects.toThrow();
    });

    it("recordId 为浮点数抛出错误", async () => {
      await expect(LiuYaoView({ recordId: 1.5 }, { skipUI: true })).rejects.toThrow();
    });

    it("recordId 不存在的记录抛出 NOT_FOUND", async () => {
      try {
        await LiuYaoView({ recordId: 99999 }, { skipUI: true });
        expect.fail("应该抛出错误");
      } catch (err) {
        expect(err).toBeInstanceOf(LiuyaoError);
        expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.NOT_FOUND);
      }
    });
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 4. 业务流程回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("4. 业务流程回归", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("多人物场景：记录按人物隔离", async () => {
    const p1 = await createTestPerson("人物甲");
    const p2 = await createTestPerson("人物乙");

    await LiuYaoCreate({ personId: p1, question: "甲的问题1" }, { skipUI: true });
    await LiuYaoCreate({ personId: p1, question: "甲的问题2" }, { skipUI: true });
    await LiuYaoCreate({ personId: p2, question: "乙的问题" }, { skipUI: true });

    const list1 = await LiuYaoList({ personId: p1 }, { skipUI: true });
    const list2 = await LiuYaoList({ personId: p2 }, { skipUI: true });

    expect(list1.total).toBe(2);
    expect(list2.total).toBe(1);
    expect(list1.records.every(r => r.personId === p1)).toBe(true);
    expect(list2.records.every(r => r.personId === p2)).toBe(true);
  });

  it("标签搜索：多标签记录能精确过滤", async () => {
    const p = await createTestPerson();
    await LiuYaoCreate({ personId: p, question: "Q1", tags: ["财运", "投资"] }, { skipUI: true });
    await LiuYaoCreate({ personId: p, question: "Q2", tags: ["财运"] }, { skipUI: true });
    await LiuYaoCreate({ personId: p, question: "Q3", tags: ["健康"] }, { skipUI: true });

    const result = await LiuYaoList({ personId: p, tags: ["财运"] }, { skipUI: true });
    expect(result.total).toBe(2);
  });

  it("自定义起卦时间：正确解析并存储", async () => {
    const p = await createTestPerson();
    const record = await LiuYaoCreate(
      {
        personId: p,
        question: "自定义时间",
        divinationTime: "2024-06-15 14:30:00",
      },
      { skipUI: true },
    );
    expect(record.divinationTime).toMatch(/^2024-06-15T14:30:00/);
  });

  it("所有 yongTarget 类型都能创建和查询", async () => {
    const p = await createTestPerson();
    const targets: YongTarget[] = ["自占", "父母", "子女", "配偶", "兄弟", "医药"];
    const lines: SixLines = [1, 2, 3, 0, 1, 2];

    for (const target of targets) {
      const record = await LiuYaoCreate(
        { personId: p, question: `${target}测试`, lines, yongTarget: target },
        { skipUI: true },
      );
      expect(record.yongTarget).toBe(target);
      expect(record.yong.rel).toBeDefined();
    }
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 5. 错误处理回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("5. 错误处理回归", () => {
  it("LiuyaoError 包含完整信息", () => {
    const err = new LiuyaoError("测试错误", "TestSource", {
      context: { foo: "bar" },
      suggestion: "修复建议",
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
    expect(err.name).toBe("LiuyaoError");
    expect(err.source).toBe("TestSource");
    expect(err.errorCode).toBe("INVALID_INPUT");
    expect(err.suggestion).toBe("修复建议");
    expect(err instanceof Error).toBe(true);
  });

  it("LiuyaoError.toJSON() 序列化正确", () => {
    const err = new LiuyaoError("测试", "Src", {
      errorCode: ApiErrorCode.NOT_FOUND,
    });
    const json = err.toJSON();
    expect(json.name).toBe("LiuyaoError");
    expect(json.errorCode).toBe("NOT_FOUND");
    expect(json.source).toBe("Src");
  });

  it("所有 ApiErrorCode 都被定义", () => {
    const codes = [
      "INVALID_INPUT",
      "NOT_FOUND",
      "TIMEOUT",
      "INTERNAL",
      "NOT_INITIALIZED",
      "PERMISSION_DENIED",
      "CALLBACK_TIMEOUT",
      "NEEDS_CONFIRMATION",
    ];
    for (const code of codes) {
      expect(ApiErrorCode[code as keyof typeof ApiErrorCode]).toBe(code);
    }
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 6. 性能基准回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("6. 性能基准回归", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("computeLiuyaoData < 50ms", () => {
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      computeLiuyaoData(DEFAULT_LINES, DEFAULT_DATE, DEFAULT_TARGET);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500); // 10 次共 500ms
  });

  it("LiuYaoCreate skipUI < 100ms", async () => {
    const start = performance.now();
    await LiuYaoCreate(
      { personId: testPersonId, question: "性能测试", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("LiuYaoList skipUI < 50ms（10 条记录）", async () => {
    for (let i = 0; i < 10; i++) {
      await LiuYaoCreate(
        { personId: testPersonId, question: `性能${i}`, lines: DEFAULT_LINES },
        { skipUI: true },
      );
    }
    const start = performance.now();
    await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("LiuYaoView skipUI < 50ms", async () => {
    const created = await LiuYaoCreate(
      { personId: testPersonId, question: "性能", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    const start = performance.now();
    await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 7. 兼容性回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("7. 兼容性回归", () => {
  it("API_VERSION 为 1.0.0", () => {
    expect(API_VERSION).toBe("1.0.0");
  });

  it("computeLiuyaoData 函数签名兼容（省略可选参数）", () => {
    // 仅传 lines 和 date
    const r1 = computeLiuyaoData(DEFAULT_LINES, DEFAULT_DATE);
    expect(r1.chart).toBeDefined();
    // yongTarget 默认为 "自占"
    expect(r1.yong.rel).toBeDefined();
  });

  it("LiuYao 保留旧签名（lines, date, yongTarget, time?）", () => {
    const result = LiuYao(DEFAULT_LINES, DEFAULT_DATE, "自占", "10:00:00");
    expect(result.divinationTime).toBe("2026-09-27T10:00:00");
  });

  it("LiuYaoCreate 支持最小参数（仅 question）", async () => {
    await clearDatabase();
    const p = await createTestPerson();
    const record = await LiuYaoCreate({ personId: p, question: "最小参数" }, { skipUI: true });
    expect(record.question).toBe("最小参数");
    await clearDatabase();
  });

  it("LiuYaoList 支持最小参数查询", async () => {
    await clearDatabase();
    const p = await createTestPerson();
    await LiuYaoCreate({ personId: p, question: "测试" }, { skipUI: true });
    const result = await LiuYaoList({ personId: p }, { skipUI: true });
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    await clearDatabase();
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 8. 集成点回归
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("8. 集成点回归", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("与人物模块集成：PersonCreate 后 LiuYaoCreate", async () => {
    const person = await PersonCreate(
      {
        name: "集成测试人物",
        date: "1985-05-20",
        timeIndex: 5,
        gender: "女" as const,
        calendar: "公历" as const,
      },
      false,
    );
    expect(person.id).toBeDefined();

    const record = await LiuYaoCreate(
      { personId: person.id, question: "集成测试问题", lines: DEFAULT_LINES },
      { skipUI: true },
    );
    expect(record.personId).toBe(person.id);
  });

  it("与数据库集成：直接写入后通过 API 查询", async () => {
    const p = await createTestPerson();
    // 直接通过 DB 写入记录
    const now = Date.now();
    const result = computeLiuyaoData(DEFAULT_LINES, DEFAULT_DATE, DEFAULT_TARGET);
    await db.liuyaoRecords.add({
      personId: p,
      divinationTime: "2026-09-27T00:00:00",
      question: "DB 直接写入",
      background: "",
      note: "",
      tags: ["db-direct"],
      lines: DEFAULT_LINES,
      chart: result.chart,
      yongTarget: DEFAULT_TARGET,
      yong: result.yong,
      savedAt: now,
    });
    invalidateLiuyaoTagCache();

    const list = await LiuYaoList({ personId: p, tags: ["db-direct"] }, { skipUI: true });
    expect(list.records).toHaveLength(1);
    expect(list.records[0].question).toBe("DB 直接写入");
  });

  it("回调系统：tag 缓存失效后查询正确", async () => {
    const p = await createTestPerson();
    await LiuYaoCreate({ personId: p, question: "缓存测试", tags: ["新标签"] }, { skipUI: true });
    // 手动失效缓存
    invalidateLiuyaoTagCache();
    const list = await LiuYaoList({ personId: p, tags: ["新标签"] }, { skipUI: true });
    expect(list.records).toHaveLength(1);
  });
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 9. 极端场景（补充）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("9. 极端场景补充", () => {
  it("全老阴（0,0,0,0,0,0）= 坤卦 + 无动爻", () => {
    const lines: SixLines = [0, 0, 0, 0, 0, 0];
    const result = computeLiuyaoData(lines, DEFAULT_DATE, DEFAULT_TARGET);
    expect(result.chart.name).toBe("坤为地");
    expect(result.chart.palace).toBe("坤");
    expect(result.chart.changed).toBeNull();
  });

  it("全老阳（3,3,3,3,3,3）= 乾卦 + 六爻皆动 → 变坤", () => {
    const lines: SixLines = [3, 3, 3, 3, 3, 3];
    const result = computeLiuyaoData(lines, DEFAULT_DATE, DEFAULT_TARGET);
    expect(result.chart.name).toBe("乾为天");
    expect(result.chart.changed).not.toBeNull();
    expect(result.chart.changed!.name).toBe("坤为地");
  });

  it("全少阴（2,2,2,2,2,2）= 坤卦 + 六爻皆动 → 变乾", () => {
    const lines: SixLines = [2, 2, 2, 2, 2, 2];
    const result = computeLiuyaoData(lines, DEFAULT_DATE, DEFAULT_TARGET);
    expect(result.chart.name).toBe("坤为地");
    expect(result.chart.changed!.name).toBe("乾为天");
  });

  it("随机摇卦 10 次产生至少 2 种不同结果", () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const r = computeLiuyaoData(undefined, DEFAULT_DATE, DEFAULT_TARGET);
      results.add(JSON.stringify(r.lines));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
