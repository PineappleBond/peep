/**
 * 六爻调试 API 集成场景 E2E 测试
 *
 * 测试范围：
 * 1. 完整流程：创建 → 列表查询 → 查看详情
 * 2. 批量操作：批量创建后按标签/关键字搜索
 * 3. yongTarget：6 种用神目标
 * 4. 自定义时间：divinationTime 解析与存储
 * 5. 数据隔离：多人物记录互不干扰
 * 6. 性能：100 条记录查询 + 分页查询
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { PersonCreate } from "./person";
import { db } from "../personDb";
import { invalidateLiuyaoTagCache } from "../liuyaoDb";
import type { SixLines, YongTarget } from "../liuyao/core/types";

/**
 * 清理数据库：删除所有六爻记录和非默认人物
 */
async function cleanupDatabase() {
  await db.liuyaoRecords.clear();
  // 删除所有非默认人物
  const allPersons = await db.persons.toArray();
  const nonDefault = allPersons.filter(p => !p.isDefault);
  if (nonDefault.length > 0) {
    await db.persons.bulkDelete(nonDefault.map(p => p.id!));
  }
  invalidateLiuyaoTagCache();
}

/**
 * 创建测试人物
 */
async function createTestPerson(name: string) {
  return PersonCreate(
    {
      name,
      date: "1990-01-15",
      timeIndex: 3,
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
    },
    false,
  );
}

/* ── 1. 完整流程测试 ── */
describe("完整流程：创建 → 列表 → 详情", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("创建记录后能在列表中找到，且详情数据一致", async () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const question = "这笔生意能不能做？";
    const tags = ["财运", "投资"];

    // 1. 创建
    const created = await LiuYaoCreate(
      { question, lines, tags, yongTarget: "自占", background: "做生意背景", note: "备注一下" },
      { skipUI: true },
    );
    expect(created.id).toBeDefined();
    expect(created.question).toBe(question);
    expect(created.tags).toEqual(tags);
    expect(created.background).toBe("做生意背景");
    expect(created.note).toBe("备注一下");
    expect(created.chart.name).toBe("乾为天");
    expect(created.lines).toEqual(lines);
    expect(created.yongTarget).toBe("自占");
    expect(created.personId).toBeGreaterThan(0);

    // 2. 列表查询
    const listResult = await LiuYaoList({}, { skipUI: true });
    expect(listResult.total).toBe(1);
    expect(listResult.records).toHaveLength(1);
    expect(listResult.records[0].id).toBe(created.id);
    expect(listResult.records[0].question).toBe(question);

    // 3. 查看详情
    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(detail.id).toBe(created.id);
    expect(detail.question).toBe(question);
    expect(detail.tags).toEqual(tags);
    expect(detail.chart.name).toBe("乾为天");
    expect(detail.lines).toEqual(lines);
    expect(detail.yongTarget).toBe("自占");
    expect(detail.computed).toBeDefined();
    expect(detail.computed!.divinationTime).toBe(created.divinationTime);
    expect(detail.computed!.chart.name).toBe("乾为天");
    expect(detail.computed!.hbarData).toBeDefined();
    expect(detail.computed!.vigorColumns).toBeDefined();
  });

  it("创建数据与查询/查看的数据一致性校验", async () => {
    const lines: SixLines = [0, 1, 2, 3, 0, 1];
    const created = await LiuYaoCreate(
      { question: "一致性测试", lines, yongTarget: "子女", tags: ["测试"] },
      { skipUI: true },
    );

    // 列表中的记录应与创建返回一致
    const { records } = await LiuYaoList({ tags: ["测试"] }, { skipUI: true });
    expect(records).toHaveLength(1);
    const listRecord = records[0];
    expect(listRecord.question).toBe(created.question);
    expect(listRecord.yongTarget).toBe(created.yongTarget);
    expect(listRecord.lines).toEqual(created.lines);
    expect(listRecord.divinationTime).toBe(created.divinationTime);
    expect(listRecord.chart.name).toBe(created.chart.name);

    // 详情应与创建返回一致
    const viewResult = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(viewResult.question).toBe(created.question);
    expect(viewResult.yongTarget).toBe(created.yongTarget);
    expect(viewResult.lines).toEqual(created.lines);
    expect(viewResult.chart.name).toBe(created.chart.name);
    expect(viewResult.yong.rel).toBe(created.yong.rel);
  });
});

/* ── 2. 批量操作测试 ── */
describe("批量操作：创建后搜索", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("批量创建 10 条记录后按标签搜索", async () => {
    // 创建 10 条记录，5 条带标签 "财运"，5 条带标签 "感情"
    for (let i = 0; i < 10; i++) {
      const tags = i < 5 ? ["财运"] : ["感情"];
      await LiuYaoCreate(
        { question: `批量测试问题 ${i + 1}`, tags, lines: [1, 2, 3, 0, 1, 2] },
        { skipUI: true },
      );
    }

    // 按标签搜索 "财运"
    const caiyunResult = await LiuYaoList({ tags: ["财运"] }, { skipUI: true });
    expect(caiyunResult.total).toBe(5);
    expect(caiyunResult.records).toHaveLength(5);
    caiyunResult.records.forEach(r => {
      expect(r.tags).toContain("财运");
    });

    // 按标签搜索 "感情"
    const ganqingResult = await LiuYaoList({ tags: ["感情"] }, { skipUI: true });
    expect(ganqingResult.total).toBe(5);
    expect(ganqingResult.records).toHaveLength(5);
    ganqingResult.records.forEach(r => {
      expect(r.tags).toContain("感情");
    });
  });

  it("批量创建后按关键字搜索", async () => {
    // 创建带不同问题的记录
    await LiuYaoCreate({ question: "考试能不能通过", lines: [1, 1, 1, 1, 1, 1] }, { skipUI: true });
    await LiuYaoCreate({ question: "考试复习方法", lines: [1, 2, 3, 0, 1, 2] }, { skipUI: true });
    await LiuYaoCreate({ question: "今天天气怎么样", lines: [0, 0, 0, 0, 0, 0] }, { skipUI: true });
    await LiuYaoCreate({ question: "工作能不能顺利", lines: [2, 2, 2, 2, 2, 2] }, { skipUI: true });

    // 搜索关键字 "考试"
    const examResult = await LiuYaoList({ searchText: "考试" }, { skipUI: true });
    expect(examResult.total).toBe(2);
    expect(examResult.records).toHaveLength(2);
    examResult.records.forEach(r => {
      expect(r.question).toContain("考试");
    });

    // 搜索关键字 "天气"
    const weatherResult = await LiuYaoList({ searchText: "天气" }, { skipUI: true });
    expect(weatherResult.total).toBe(1);
    expect(weatherResult.records[0].question).toContain("天气");

    // 搜索不存在的关键字
    const noResult = await LiuYaoList({ searchText: "不存在的关键词xyz" }, { skipUI: true });
    expect(noResult.total).toBe(0);
    expect(noResult.records).toHaveLength(0);
  });
});

/* ── 3. yongTarget 测试 ── */
describe("yongTarget：6 种用神目标", () => {
  const allTargets: YongTarget[] = ["自占", "父母", "子女", "配偶", "兄弟", "医药"];
  const fixedLines: SixLines = [1, 2, 3, 0, 1, 2];

  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("所有 6 种 yongTarget 都能成功创建记录", async () => {
    for (const target of allTargets) {
      const record = await LiuYaoCreate(
        { question: `测试用神：${target}`, lines: fixedLines, yongTarget: target },
        { skipUI: true },
      );
      expect(record.yongTarget).toBe(target);
      expect(record.yong).toBeDefined();
      expect(record.yong.rel).toBeDefined();
    }

    // 验证 6 条记录全部可查
    const { total } = await LiuYaoList({}, { skipUI: true });
    expect(total).toBe(6);
  });

  it("不同 yongTarget 返回不同的用神六亲", async () => {
    const results: { target: YongTarget; rel: string }[] = [];
    for (const target of allTargets) {
      const record = await LiuYaoCreate(
        { question: `用神对比：${target}`, lines: fixedLines, yongTarget: target },
        { skipUI: true },
      );
      results.push({ target, rel: record.yong.rel });
    }

    // 至少部分 yongTarget 应返回不同的六亲关系
    const uniqueRels = new Set(results.map(r => r.rel));
    expect(uniqueRels.size).toBeGreaterThan(1);
  });

  it("yongTarget 默认值为 '自占'", async () => {
    const record = await LiuYaoCreate(
      { question: "不传 yongTarget", lines: fixedLines },
      { skipUI: true },
    );
    expect(record.yongTarget).toBe("自占");
  });
});

/* ── 4. 自定义时间测试 ── */
describe("自定义起卦时间", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("自定义 ISO 格式起卦时间的解析和存储", async () => {
    const customTime = "2025-06-15T14:30:00";
    const record = await LiuYaoCreate(
      {
        question: "自定义时间测试",
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: customTime,
      },
      { skipUI: true },
    );

    expect(record.divinationTime).toContain("2025-06-15");
    // 验证时间部分被正确解析
    expect(record.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("自定义 YYYY-MM-DD HH:mm:ss 格式时间的解析和存储", async () => {
    const customTime = "2025-06-15 14:30:00";
    const record = await LiuYaoCreate(
      {
        question: "自定义时间格式2",
        lines: [1, 2, 3, 0, 1, 2],
        divinationTime: customTime,
      },
      { skipUI: true },
    );

    expect(record.divinationTime).toContain("2025-06-15");
    expect(record.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("不传 divinationTime 时使用当前时间", async () => {
    const before = Date.now();
    const record = await LiuYaoCreate(
      { question: "默认时间测试", lines: [1, 1, 1, 1, 1, 1] },
      { skipUI: true },
    );
    const after = Date.now();

    // divinationTime 应接近当前时间（在测试执行时间范围内）
    const recordTime = new Date(record.divinationTime).getTime();
    expect(recordTime).toBeGreaterThanOrEqual(before - 1000);
    expect(recordTime).toBeLessThanOrEqual(after + 1000);
  });

  it("divinationTime 字段在详情中保持一致", async () => {
    const customTime = "2024-12-25T10:00:00";
    const created = await LiuYaoCreate(
      {
        question: "时间一致性测试",
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: customTime,
      },
      { skipUI: true },
    );

    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(detail.divinationTime).toBe(created.divinationTime);
    expect(detail.computed!.divinationTime).toBe(created.divinationTime);
  });
});

/* ── 5. 数据隔离测试 ── */
describe("数据隔离：多人物记录互不干扰", () => {
  let person1Id: number;
  let person2Id: number;
  let person3Id: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p1 = await createTestPerson("张三");
    const p2 = await createTestPerson("李四");
    const p3 = await createTestPerson("王五");
    person1Id = p1.id!;
    person2Id = p2.id!;
    person3Id = p3.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("不同人物的记录互相隔离", async () => {
    // 张三 3 条记录
    for (let i = 0; i < 3; i++) {
      await LiuYaoCreate(
        { personId: person1Id, question: `张三的问题${i + 1}`, lines: [1, 1, 1, 1, 1, 1] },
        { skipUI: true },
      );
    }

    // 李四 2 条记录
    for (let i = 0; i < 2; i++) {
      await LiuYaoCreate(
        { personId: person2Id, question: `李四的问题${i + 1}`, lines: [0, 0, 0, 0, 0, 0] },
        { skipUI: true },
      );
    }

    // 王五 1 条记录
    await LiuYaoCreate(
      { personId: person3Id, question: "王五的问题", lines: [1, 2, 3, 0, 1, 2] },
      { skipUI: true },
    );

    // 查询各人物的记录
    const zhangsan = await LiuYaoList({ personId: person1Id }, { skipUI: true });
    expect(zhangsan.total).toBe(3);
    zhangsan.records.forEach(r => expect(r.personId).toBe(person1Id));

    const lisi = await LiuYaoList({ personId: person2Id }, { skipUI: true });
    expect(lisi.total).toBe(2);
    lisi.records.forEach(r => expect(r.personId).toBe(person2Id));

    const wangwu = await LiuYaoList({ personId: person3Id }, { skipUI: true });
    expect(wangwu.total).toBe(1);
    wangwu.records.forEach(r => expect(r.personId).toBe(person3Id));
  });

  it("跨人物查询时数据隔离", async () => {
    // 张三有带 "财运" 标签的记录
    await LiuYaoCreate(
      { personId: person1Id, question: "张三财运", tags: ["财运"], lines: [1, 1, 1, 1, 1, 1] },
      { skipUI: true },
    );

    // 李四也有带 "财运" 标签的记录
    await LiuYaoCreate(
      { personId: person2Id, question: "李四财运", tags: ["财运"], lines: [0, 0, 0, 0, 0, 0] },
      { skipUI: true },
    );

    // 查询张三的 "财运" 标签记录——不应包含李四的
    const zhangsanCaiyun = await LiuYaoList(
      { personId: person1Id, tags: ["财运"] },
      { skipUI: true },
    );
    expect(zhangsanCaiyun.total).toBe(1);
    expect(zhangsanCaiyun.records[0].personId).toBe(person1Id);
    expect(zhangsanCaiyun.records[0].question).toBe("张三财运");

    // 查询李四的 "财运" 标签记录——不应包含张三的
    const lisiCaiyun = await LiuYaoList({ personId: person2Id, tags: ["财运"] }, { skipUI: true });
    expect(lisiCaiyun.total).toBe(1);
    expect(lisiCaiyun.records[0].personId).toBe(person2Id);
    expect(lisiCaiyun.records[0].question).toBe("李四财运");
  });

  it("查看其他人物的记录仍可查看（ID 全局唯一）", async () => {
    const created = await LiuYaoCreate(
      { personId: person1Id, question: "张三专属", lines: [1, 1, 1, 1, 1, 1] },
      { skipUI: true },
    );

    // 通过 recordId 直接查看——数据库层面 ID 全局唯一
    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(detail.question).toBe("张三专属");
    expect(detail.personId).toBe(person1Id);
  });
});

/* ── 6. 性能测试 ── */
describe("性能测试", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("创建 100 条记录后查询性能", async () => {
    const startTime = performance.now();

    // 批量创建 100 条
    for (let i = 0; i < 100; i++) {
      await LiuYaoCreate(
        {
          question: `性能测试问题 ${i + 1}`,
          lines: [1, 2, 3, 0, 1, 2],
          tags: i % 3 === 0 ? ["标签A"] : i % 3 === 1 ? ["标签B"] : ["标签C"],
        },
        { skipUI: true },
      );
    }

    const createEndTime = performance.now();
    const createDuration = createEndTime - startTime;

    // 查询全部记录
    const queryStart = performance.now();
    const result = await LiuYaoList({}, { skipUI: true });
    const queryDuration = performance.now() - queryStart;

    expect(result.total).toBe(100);
    // 100 条记录的查询应在合理时间内完成（5 秒内）
    expect(queryDuration).toBeLessThan(5000);
    // 100 条创建也应在合理时间内完成（30 秒内）
    expect(createDuration).toBeLessThan(30000);
  });

  it("分页查询性能：pageSize=10", async () => {
    // 先创建 50 条记录
    for (let i = 0; i < 50; i++) {
      await LiuYaoCreate(
        { question: `分页测试 ${i + 1}`, lines: [1, 2, 3, 0, 1, 2] },
        { skipUI: true },
      );
    }

    const start = performance.now();
    const result = await LiuYaoList({ page: 1, pageSize: 10 }, { skipUI: true });
    const duration = performance.now() - start;

    expect(result.total).toBe(50);
    expect(result.records).toHaveLength(10);
    expect(duration).toBeLessThan(5000);
  });

  it("分页查询性能：pageSize=20", async () => {
    for (let i = 0; i < 50; i++) {
      await LiuYaoCreate(
        { question: `分页测试 ${i + 1}`, lines: [1, 2, 3, 0, 1, 2] },
        { skipUI: true },
      );
    }

    const start = performance.now();
    const result = await LiuYaoList({ page: 1, pageSize: 20 }, { skipUI: true });
    const duration = performance.now() - start;

    expect(result.total).toBe(50);
    expect(result.records).toHaveLength(20);
    expect(duration).toBeLessThan(5000);
  });

  it("分页查询性能：pageSize=50", async () => {
    for (let i = 0; i < 50; i++) {
      await LiuYaoCreate(
        { question: `分页测试 ${i + 1}`, lines: [1, 2, 3, 0, 1, 2] },
        { skipUI: true },
      );
    }

    const start = performance.now();
    const result = await LiuYaoList({ page: 1, pageSize: 50 }, { skipUI: true });
    const duration = performance.now() - start;

    expect(result.total).toBe(50);
    expect(result.records).toHaveLength(50);
    expect(duration).toBeLessThan(5000);
  });

  it("分页查询正确性：多页遍历", async () => {
    for (let i = 0; i < 25; i++) {
      await LiuYaoCreate(
        { question: `分页遍历 ${i + 1}`, lines: [1, 2, 3, 0, 1, 2] },
        { skipUI: true },
      );
    }

    // 第 1 页（10 条）
    const page1 = await LiuYaoList({ page: 1, pageSize: 10 }, { skipUI: true });
    expect(page1.total).toBe(25);
    expect(page1.records).toHaveLength(10);

    // 第 2 页（10 条）
    const page2 = await LiuYaoList({ page: 2, pageSize: 10 }, { skipUI: true });
    expect(page2.total).toBe(25);
    expect(page2.records).toHaveLength(10);

    // 第 3 页（5 条）
    const page3 = await LiuYaoList({ page: 3, pageSize: 10 }, { skipUI: true });
    expect(page3.total).toBe(25);
    expect(page3.records).toHaveLength(5);

    // 确保不同页的记录 ID 不重复
    const allIds = [...page1.records, ...page2.records, ...page3.records].map(r => r.id);
    expect(new Set(allIds).size).toBe(25);
  });
});
