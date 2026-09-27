/**
 * 六爻边缘场景测试
 *
 * 覆盖计划文档"边界情况处理"章节中的关键场景：
 * - 子时跨日
 * - 未来时间校验
 * - chart 字段损坏校验
 * - 标签数量限制
 * - maxLength 一致性
 * - 闰月场景回归
 * - buildChart 失败后数据库干净性
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { adjustDateForZiHour } from "../calendar";
import { db, type Person } from "../../../personDb";
import { DEFAULT_BIRTH_INPUT } from "../../../useZwds";
import { LiuYaoCreate, LiuYaoView, computeLiuyaoData } from "../../../debugApi/liuyao";
import {
  validateTags,
  validateStringLength,
  validateNotFutureDate,
} from "../../../debugApi/validate";
import { LiuyaoError } from "../../../debugApi/errors";
import type { SixLines } from "../types";

/** 创建测试人物 */
async function createTestPerson(name = "测试人物"): Promise<number> {
  const id = await db.persons.add({
    ...DEFAULT_BIRTH_INPUT,
    name,
    savedAt: Date.now(),
    isDefault: false,
  } as Omit<Person, "id">);
  return id as number;
}

// ── 子时跨日 ─────────────────────────────────────────────

describe("adjustDateForZiHour", () => {
  it("23:00 后日柱取次日", () => {
    // 2024-03-15 23:30 → 应返回 2024-03-16
    const dt = new Date(2024, 2, 15, 23, 30, 0);
    expect(adjustDateForZiHour(dt)).toBe("2024-03-16");
  });

  it("23:59 日柱取次日", () => {
    const dt = new Date(2024, 2, 15, 23, 59, 59);
    expect(adjustDateForZiHour(dt)).toBe("2024-03-16");
  });

  it("22:59 不跨日", () => {
    const dt = new Date(2024, 2, 15, 22, 59, 59);
    expect(adjustDateForZiHour(dt)).toBe("2024-03-15");
  });

  it("00:00 不跨日（早子时属于当天）", () => {
    const dt = new Date(2024, 2, 15, 0, 0, 0);
    expect(adjustDateForZiHour(dt)).toBe("2024-03-15");
  });

  it("12:00 中午不跨日", () => {
    const dt = new Date(2024, 2, 15, 12, 0, 0);
    expect(adjustDateForZiHour(dt)).toBe("2024-03-15");
  });

  it("月末跨日（3月31日 23:00 → 4月1日）", () => {
    const dt = new Date(2024, 2, 31, 23, 0, 0);
    expect(adjustDateForZiHour(dt)).toBe("2024-04-01");
  });

  it("年末跨日（12月31日 23:00 → 次年1月1日）", () => {
    const dt = new Date(2024, 11, 31, 23, 0, 0);
    expect(adjustDateForZiHour(dt)).toBe("2025-01-01");
  });

  it("接受 ISO 字符串参数", () => {
    expect(adjustDateForZiHour("2024-03-15T23:30:00")).toBe("2024-03-16");
    expect(adjustDateForZiHour("2024-03-15T12:00:00")).toBe("2024-03-15");
  });
});

// ── LiuYaoCreate 子时跨日集成 ────────────────────────────

describe("LiuYaoCreate 子时跨日集成", () => {
  let testPersonId: number;

  beforeEach(async () => {
    testPersonId = await createTestPerson("子时测试");
  });

  afterEach(async () => {
    await db.persons.delete(testPersonId);
    await db.liuyaoRecords.where("personId").equals(testPersonId).delete();
  });

  it("23:30 起卦日柱取次日", async () => {
    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "子时测试",
        lines: [1, 1, 1, 1, 1, 1] as SixLines,
        yongTarget: "自占",
        divinationTime: "2024-03-15T23:30:00",
      },
      { skipUI: true },
    );

    // 日柱应该是 3月16日的干支，而非 3月15日
    // 3月15日是甲子日（已知校准点附近），3月16日应该是乙丑日
    expect(record.chart.day.stem).toBeDefined();
    // 验证 dateStr 已调整为次日（通过日柱不同来验证）
    const expectedDateChart = computeLiuyaoData(
      [1, 1, 1, 1, 1, 1] as SixLines,
      "2024-03-16",
      "自占",
    );
    expect(record.chart.day.stem).toBe(expectedDateChart.chart.day.stem);
    expect(record.chart.day.branch).toBe(expectedDateChart.chart.day.branch);
  });
});

// ── 未来时间校验 ─────────────────────────────────────────

describe("validateNotFutureDate", () => {
  it("过去时间不抛错", () => {
    expect(() =>
      validateNotFutureDate("2020-01-01T00:00:00", "test", "test", LiuyaoError),
    ).not.toThrow();
  });

  it("当前时间不抛错", () => {
    const now = new Date().toISOString();
    expect(() => validateNotFutureDate(now, "test", "test", LiuyaoError)).not.toThrow();
  });

  it("未来时间抛错", () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // +1天
    expect(() => validateNotFutureDate(future, "divinationTime", "test", LiuyaoError)).toThrow(
      "不能是未来时间",
    );
  });

  it("1 分钟内未来时间不抛错（容差）", () => {
    const nearFuture = new Date(Date.now() + 30000).toISOString(); // +30秒
    expect(() => validateNotFutureDate(nearFuture, "test", "test", LiuyaoError)).not.toThrow();
  });

  it("无效日期字符串不抛错（交给其他验证处理）", () => {
    expect(() => validateNotFutureDate("not-a-date", "test", "test", LiuyaoError)).not.toThrow();
  });
});

describe("LiuYaoCreate 未来时间拒绝", () => {
  let testPersonId: number;

  beforeEach(async () => {
    testPersonId = await createTestPerson("未来时间测试");
  });

  afterEach(async () => {
    await db.persons.delete(testPersonId);
    await db.liuyaoRecords.where("personId").equals(testPersonId).delete();
  });

  it("传入未来时间抛错", async () => {
    const futureTime = new Date(Date.now() + 86400000).toISOString();
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "未来测试",
          divinationTime: futureTime,
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("不能是未来时间");
  });
});

// ── chart 字段损坏校验 ───────────────────────────────────

describe("LiuYaoView chart 损坏校验", () => {
  let testPersonId: number;
  let corruptRecordId: number;

  beforeEach(async () => {
    testPersonId = await createTestPerson("损坏测试");

    // 直接写入一条 chart 损坏的记录
    const id = await db.liuyaoRecords.add({
      personId: testPersonId,
      divinationTime: "2024-03-15T10:00:00",
      question: "损坏测试",
      background: "",
      note: "",
      tags: [],
      lines: [1, 1, 1] as unknown as SixLines, // 长度不对
      chart: {
        name: "测试",
        palace: "乾",
        palaceElem: "金",
        type: "本宫",
        shi: 6,
        ying: 3,
        lines: [] as unknown as never[], // 空数组
        changed: null,
        month: { stem: "甲", branch: "子", elem: "水" },
        day: { stem: "甲", branch: "子", elem: "水", kong: ["戌", "亥"] },
      } as unknown as never,
      yongTarget: "自占",
      yong: { rel: "兄弟", pos: 5, pickedBy: "持世", hidden: null },
      savedAt: Date.now(),
    } as unknown as never);
    corruptRecordId = id as number;
  });

  afterEach(async () => {
    await db.liuyaoRecords.delete(corruptRecordId);
    await db.persons.delete(testPersonId);
  });

  it("查看 chart 损坏记录抛错", async () => {
    await expect(
      LiuYaoView({ recordId: corruptRecordId, personId: testPersonId }, { skipUI: true }),
    ).rejects.toThrow("卦象数据损坏");
  });
});

// ── 标签数量限制 ─────────────────────────────────────────

describe("validateTags 数量限制", () => {
  it("20 个标签不抛错", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(() => validateTags(tags, "test", LiuyaoError)).not.toThrow();
  });

  it("21 个标签抛错", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(() => validateTags(tags, "test", LiuyaoError)).toThrow("超过上限");
  });

  it("自定义 maxTags 生效", () => {
    const tags = ["a", "b", "c"];
    expect(() => validateTags(tags, "test", LiuyaoError, 2)).toThrow("超过上限 2");
  });
});

// ── maxLength 一致性 ─────────────────────────────────────

describe("validateStringLength", () => {
  it("长度内不抛错", () => {
    expect(() => validateStringLength("abc", "question", 200, "test", LiuyaoError)).not.toThrow();
  });

  it("超出长度抛错", () => {
    const long = "a".repeat(201);
    expect(() => validateStringLength(long, "question", 200, "test", LiuyaoError)).toThrow(
      "超过上限 200",
    );
  });

  it("恰好等于 maxLength 不抛错", () => {
    const exact = "a".repeat(200);
    expect(() => validateStringLength(exact, "question", 200, "test", LiuyaoError)).not.toThrow();
  });
});

describe("LiuYaoCreate maxLength 验证", () => {
  let testPersonId: number;

  beforeEach(async () => {
    testPersonId = await createTestPerson("长度测试");
  });

  afterEach(async () => {
    await db.persons.delete(testPersonId);
    await db.liuyaoRecords.where("personId").equals(testPersonId).delete();
  });

  it("question 超过 200 字符抛错", async () => {
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "a".repeat(201),
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("超过上限 200");
  });

  it("note 超过 500 字符抛错", async () => {
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "测试",
          note: "a".repeat(501),
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("超过上限 500");
  });

  it("background 超过 2000 字符抛错", async () => {
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "测试",
          background: "a".repeat(2001),
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow("超过上限 2000");
  });
});

// ── 闰月场景回归 ─────────────────────────────────────────

describe("闰月场景回归", () => {
  it("闰年（2024）六爻 hbar 仍为 12 个阳历月", async () => {
    // 六爻以节气为月界，不使用农历闰月
    // 验证 2024 年（有农历闰年）的 hbar 月列表仍为 12 个阳历月
    const { buildLiuyaoHbarData } = await import("../../../liuyao/hbar");
    const data = buildLiuyaoHbarData("2024-06-15T10:00:00", {
      year: 2024,
      month: 6,
      day: 15,
      hour: 0,
    });
    // 月列表应为 12 个
    expect(data.months).toHaveLength(12);
  });
});

// ── buildChart 失败后数据库干净性 ─────────────────────────

describe("buildChart 失败后数据库干净性", () => {
  let testPersonId: number;

  beforeEach(async () => {
    testPersonId = await createTestPerson("干净性测试");
  });

  afterEach(async () => {
    await db.persons.delete(testPersonId);
    await db.liuyaoRecords.where("personId").equals(testPersonId).delete();
  });

  it("lines 无效时不写入数据库", async () => {
    const beforeCount = await db.liuyaoRecords.where("personId").equals(testPersonId).count();

    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "测试",
          lines: [0, 0, 0, 0, 0, 99] as unknown as SixLines, // 值无效
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow();

    const afterCount = await db.liuyaoRecords.where("personId").equals(testPersonId).count();
    expect(afterCount).toBe(beforeCount);
  });

  it("question 为空时不写入数据库", async () => {
    const beforeCount = await db.liuyaoRecords.where("personId").equals(testPersonId).count();

    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "",
          yongTarget: "自占",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow();

    const afterCount = await db.liuyaoRecords.where("personId").equals(testPersonId).count();
    expect(afterCount).toBe(beforeCount);
  });
});
