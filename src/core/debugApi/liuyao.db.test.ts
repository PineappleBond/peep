/**
 * 六爻调试 API 数据库操作 E2E 测试
 *
 * 测试范围：
 * 1. LiuYaoCreate skipUI=true - 数据库写入
 * 2. LiuYaoList skipUI=true - 数据库查询
 * 3. LiuYaoView skipUI=true - 单条记录查询
 *
 * 使用 fake-indexeddb 模拟 IndexedDB 环境
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { LiuyaoError } from "./errors";
import { db } from "../personDb";
import type { SixLines } from "../liuyao/core/types";

/**
 * 清理数据库：删除所有人物和六爻记录
 */
async function clearDatabase() {
  await db.liuyaoRecords.clear();
  await db.persons.clear();
}

/**
 * 创建测试人物
 */
async function createTestPerson() {
  const id = await db.persons.add({
    name: "测试人物",
    savedAt: Date.now(),
    isDefault: true,
    // BirthInput 默认值
    ...{
      name: "测试人物",
      date: "1990-01-01",
      timeIndex: 0,
      gender: "男",
      calendar: "公历",
      leapMonth: false,
    },
  });
  return id;
}

/* ── 1. LiuYaoCreate skipUI=true 测试 ── */
describe("LiuYaoCreate skipUI=true", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("自动摇卦（不传 lines）", async () => {
    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "测试问题：自动摇卦",
      },
      { skipUI: true },
    );

    expect(record).toBeDefined();
    expect(record.id).toBeDefined();
    expect(record.personId).toBe(testPersonId);
    expect(record.question).toBe("测试问题：自动摇卦");
    expect(record.lines).toHaveLength(6);
    expect(record.lines.every(v => v >= 0 && v <= 3)).toBe(true);
    expect(record.chart).toBeDefined();
    expect(record.yong).toBeDefined();
    expect(record.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("指定 lines + tags + yongTarget", async () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾卦
    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "测试问题：指定参数",
        lines,
        tags: ["测试", "重要"],
        yongTarget: "自占",
      },
      { skipUI: true },
    );

    expect(record.lines).toEqual(lines);
    expect(record.tags).toEqual(["测试", "重要"]);
    expect(record.yongTarget).toBe("自占");
    expect(record.chart.name).toBe("乾为天");
  });

  it("自定义起卦时间", async () => {
    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "测试问题：自定义时间",
        divinationTime: "2024-06-15 14:30:00",
      },
      { skipUI: true },
    );

    expect(record.divinationTime).toMatch(/^2024-06-15T14:30:00/);
  });

  it("空 question 抛出错误", async () => {
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(LiuyaoError);

    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "   ",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(LiuyaoError);
  });

  it("不存在的 personId 抛出错误", async () => {
    await expect(
      LiuYaoCreate(
        {
          personId: 99999,
          question: "测试问题：不存在的人物",
        },
        { skipUI: true },
      ),
    ).rejects.toThrow(LiuyaoError);
  });
});

/* ── 2. LiuYaoList skipUI=true 测试 ── */
describe("LiuYaoList skipUI=true", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();

    // 创建测试记录
    for (let i = 0; i < 5; i++) {
      await LiuYaoCreate(
        {
          personId: testPersonId,
          question: `测试问题 ${i + 1}`,
          tags: i % 2 === 0 ? ["标签A"] : ["标签B"],
          note: i === 0 ? "特殊备注" : "",
        },
        { skipUI: true },
      );
    }
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("基本查询（返回所有记录）", async () => {
    const result = await LiuYaoList({ personId: testPersonId }, { skipUI: true });

    expect(result.records).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it("按标签过滤", async () => {
    const result = await LiuYaoList({ personId: testPersonId, tags: ["标签A"] }, { skipUI: true });

    expect(result.records.length).toBe(3); // i=0,2,4
    expect(result.records.every(r => r.tags.includes("标签A"))).toBe(true);
  });

  it("分页查询（page、pageSize）", async () => {
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
    expect(page2.total).toBe(5);
    // 确保分页不重复
    expect(page1.records[0].id).not.toBe(page2.records[0].id);
  });

  it("搜索关键字（searchText）", async () => {
    const result = await LiuYaoList(
      { personId: testPersonId, searchText: "特殊备注" },
      { skipUI: true },
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].note).toBe("特殊备注");
  });

  it("空结果查询", async () => {
    const result = await LiuYaoList(
      { personId: testPersonId, tags: ["不存在的标签"] },
      { skipUI: true },
    );

    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

/* ── 3. LiuYaoView skipUI=true 测试 ── */
describe("LiuYaoView skipUI=true", () => {
  let testPersonId: number;
  let testRecordId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();

    const record = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "测试查看详情",
        lines: [1, 1, 1, 1, 1, 1],
        tags: ["测试"],
      },
      { skipUI: true },
    );
    testRecordId = record.id!;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("查看存在的记录", async () => {
    const result = await LiuYaoView({ recordId: testRecordId }, { skipUI: true });

    expect(result).toBeDefined();
    expect(result.id).toBe(testRecordId);
    expect(result.personId).toBe(testPersonId);
    expect(result.question).toBe("测试查看详情");
    expect(result.chart).toBeDefined();
    expect(result.yong).toBeDefined();
  });

  it("查看不存在的记录抛出错误", async () => {
    await expect(LiuYaoView({ recordId: 99999 }, { skipUI: true })).rejects.toThrow(LiuyaoError);
  });

  it("验证返回数据包含 computed 字段", async () => {
    const result = await LiuYaoView({ recordId: testRecordId }, { skipUI: true });

    expect(result.computed).toBeDefined();
    expect(result.computed.divinationTime).toBeDefined();
    expect(result.computed.chart).toBeDefined();
    expect(result.computed.yong).toBeDefined();
    expect(result.computed.hbarData).toBeDefined();
    expect(result.computed.vigorColumns).toBeDefined();
    // person 在 skipUI 模式下为 null
    expect(result.computed.person).toBeNull();
  });
});
