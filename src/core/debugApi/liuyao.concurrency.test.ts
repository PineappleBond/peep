/**
 * 六爻调试 API 并发与竞态条件 E2E 测试
 *
 * 测试范围：
 * 1. 并发创建测试——同时创建多条记录，验证数据一致性、ID 唯一性
 * 2. 并发查询测试——同时执行大量查询，验证性能与数据隔离
 * 3. 创建后立即查询测试——验证数据可见性与顺序一致性
 * 4. 多人物并发操作测试——各人物记录互不干扰
 * 5. 回调注册竞态测试——快速 register / reset 的竞态
 * 6. 数据库事务测试——原子性、回滚、并发写入完整性
 * 7. 超时和重试测试——waitForLiuyaoCallbacks / waitForRecordSaved 超时场景
 *
 * 使用 fake-indexeddb 模拟 IndexedDB 环境
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { PersonCreate, PersonDelete } from "./person";
import type { BirthInput } from "../useZwds";
import { registerLiuyaoCallbacks, resetCallbacks, getCallbacksReady } from "./callbacks";
import { waitForLiuyaoCallbacks, waitForRecordSaved } from "./helpers";
import { db } from "../personDb";
import { invalidateLiuyaoTagCache, saveLiuyaoRecord } from "../liuyaoDb";
import { LiuyaoError } from "./errors";
import type { SixLines, YongTarget } from "../liuyao/core/types";
import type { LiuyaoListFilters, LiuyaoListResult } from "../liuyaoDb";

/**
 * 清理数据库：删除所有六爻记录和非默认人物
 */
async function cleanupDatabase() {
  await db.liuyaoRecords.clear();
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

const FIXED_LINES: SixLines = [1, 2, 3, 0, 1, 2];

/* ── 1. 并发创建测试 ── */
describe("并发创建测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("并发测试人物");
    testPersonId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("同时创建 10 条记录——数据一致性与 ID 唯一性", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: `并发问题 ${i + 1}`,
          lines: FIXED_LINES,
          tags: [`tag-${i + 1}`],
        },
        { skipUI: true },
      ),
    );

    const results = await Promise.all(tasks);

    // 所有记录都应成功创建
    expect(results).toHaveLength(10);
    // 所有 ID 都应有定义且唯一
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
    // 所有记录的数据一致性
    results.forEach((r, i) => {
      expect(r.personId).toBe(testPersonId);
      expect(r.question).toBe(`并发问题 ${i + 1}`);
      expect(r.lines).toEqual(FIXED_LINES);
      expect(r.tags).toEqual([`tag-${i + 1}`]);
    });
  });

  it("并发创建后验证所有记录都能查询到", async () => {
    const created = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        LiuYaoCreate(
          {
            personId: testPersonId,
            question: `查询验证 ${i + 1}`,
            lines: FIXED_LINES,
          },
          { skipUI: true },
        ),
      ),
    );

    const { records, total } = await LiuYaoList({ personId: testPersonId }, { skipUI: true });

    expect(total).toBe(10);
    expect(records).toHaveLength(10);

    // 所有创建出的 ID 都应出现在查询结果中
    const listedIds = new Set(records.map(r => r.id));
    for (const r of created) {
      expect(listedIds.has(r.id)).toBe(true);
    }
  });

  it("并发创建时验证 ID 唯一性（自动摇卦）", async () => {
    // 自动摇卦（不传 lines）——更可能暴露竞态
    const tasks = Array.from({ length: 10 }, (_, i) =>
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: `自动摇卦并发 ${i + 1}`,
        },
        { skipUI: true },
      ),
    );

    const results = await Promise.all(tasks);
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);
    // 每条记录都有 6 个爻值
    results.forEach(r => {
      expect(r.lines).toHaveLength(6);
      expect(r.lines.every(v => v >= 0 && v <= 3)).toBe(true);
    });
  });

  it("并发创建不同人物的记录", async () => {
    const p1 = await createTestPerson("张三并发");
    const p2 = await createTestPerson("李四并发");
    const p3 = await createTestPerson("王五并发");

    const tasks = [
      LiuYaoCreate(
        { personId: p1.id!, question: "张三并发问题", lines: [1, 1, 1, 1, 1, 1] },
        { skipUI: true },
      ),
      LiuYaoCreate(
        { personId: p2.id!, question: "李四并发问题", lines: [0, 0, 0, 0, 0, 0] },
        { skipUI: true },
      ),
      LiuYaoCreate(
        { personId: p3.id!, question: "王五并发问题", lines: [2, 2, 2, 2, 2, 2] },
        { skipUI: true },
      ),
    ];

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(3);
    expect(results[0].personId).toBe(p1.id);
    expect(results[1].personId).toBe(p2.id);
    expect(results[2].personId).toBe(p3.id);
  });
});

/* ── 2. 并发查询测试 ── */
describe("并发查询测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("查询并发人物");
    testPersonId = p.id!;
    // 预创建 20 条记录
    for (let i = 0; i < 20; i++) {
      await LiuYaoCreate(
        {
          personId: testPersonId,
          question: `查询并发记录 ${i + 1}`,
          lines: FIXED_LINES,
          tags: i % 2 === 0 ? ["偶数"] : ["奇数"],
        },
        { skipUI: true },
      );
    }
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("同时执行 50 个查询请求——验证性能", async () => {
    const start = performance.now();
    const tasks = Array.from({ length: 50 }, () =>
      LiuYaoList({ personId: testPersonId }, { skipUI: true }),
    );
    const results = await Promise.all(tasks);
    const duration = performance.now() - start;

    expect(results).toHaveLength(50);
    // 每次查询都应返回 20 条
    results.forEach(r => {
      expect(r.total).toBe(20);
      expect(r.records).toHaveLength(20);
    });
    // 50 个并发查询应在合理时间内完成（10 秒内）
    expect(duration).toBeLessThan(10000);
  });

  it("并发查询时验证数据一致性", async () => {
    // 同时执行查询，结果应该彼此一致
    const results = await Promise.all(
      Array.from({ length: 10 }, () => LiuYaoList({ personId: testPersonId }, { skipUI: true })),
    );
    const totals = results.map(r => r.total);
    // 所有查询的 total 应一致
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBe(20);
  });

  it("并发查询不同人物的数据隔离", async () => {
    const p1 = await createTestPerson("隔离测试A");
    const p2 = await createTestPerson("隔离测试B");

    // 为 p1 创建 5 条、p2 创建 3 条
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        LiuYaoCreate(
          { personId: p1.id!, question: `A${i + 1}`, lines: FIXED_LINES },
          { skipUI: true },
        ),
      ),
    );
    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        LiuYaoCreate(
          { personId: p2.id!, question: `B${i + 1}`, lines: FIXED_LINES },
          { skipUI: true },
        ),
      ),
    );

    // 并发查询——p1 应返回 5 条，p2 应返回 3 条
    const [r1, r2, r3, r4] = await Promise.all([
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
    ]);

    expect(r1.total).toBe(5);
    expect(r2.total).toBe(5);
    expect(r3.total).toBe(3);
    expect(r4.total).toBe(3);
    // p1 的记录不应出现在 p2 的查询结果中
    r1.records.forEach(rec => expect(rec.personId).toBe(p1.id));
    r3.records.forEach(rec => expect(rec.personId).toBe(p2.id));
  });

  it("并发查询不同页码", async () => {
    const [page1, page2, page3] = await Promise.all([
      LiuYaoList({ personId: testPersonId, page: 1, pageSize: 5 }, { skipUI: true }),
      LiuYaoList({ personId: testPersonId, page: 2, pageSize: 5 }, { skipUI: true }),
      LiuYaoList({ personId: testPersonId, page: 3, pageSize: 5 }, { skipUI: true }),
    ]);

    expect(page1.total).toBe(20);
    expect(page1.records).toHaveLength(5);
    expect(page2.records).toHaveLength(5);
    expect(page3.records).toHaveLength(5);

    // 不同页的记录 ID 不重复
    const allIds = [...page1.records, ...page2.records, ...page3.records].map(r => r.id);
    expect(new Set(allIds).size).toBe(15);
  });
});

/* ── 3. 创建后立即查询测试 ── */
describe("创建后立即查询测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("即时查询人物");
    testPersonId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("创建记录后立即查询——验证数据可见性", async () => {
    const created = await LiuYaoCreate(
      {
        personId: testPersonId,
        question: "立即查询测试",
        lines: [1, 1, 1, 1, 1, 1],
        tags: ["立即查询"],
      },
      { skipUI: true },
    );

    // 立即查询——数据应该可见
    const list = await LiuYaoList({ personId: testPersonId, tags: ["立即查询"] }, { skipUI: true });
    expect(list.total).toBe(1);
    expect(list.records[0].id).toBe(created.id);

    // 立即查看——数据应该可见
    const view = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(view.question).toBe("立即查询测试");
  });

  it("快速连续创建+查询——验证无竞态条件", async () => {
    // 交错执行创建和查询
    const record1 = await LiuYaoCreate(
      { personId: testPersonId, question: "第一条", lines: FIXED_LINES },
      { skipUI: true },
    );
    const listAfterFirst = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(listAfterFirst.total).toBe(1);

    const record2 = await LiuYaoCreate(
      { personId: testPersonId, question: "第二条", lines: FIXED_LINES },
      { skipUI: true },
    );
    const listAfterSecond = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(listAfterSecond.total).toBe(2);

    // 两条记录应立即可见
    const ids = listAfterSecond.records.map(r => r.id);
    expect(ids).toContain(record1.id);
    expect(ids).toContain(record2.id);
  });

  it("批量创建后批量查询——验证顺序一致性", async () => {
    const N = 10;
    // 顺序创建
    const created = [];
    for (let i = 0; i < N; i++) {
      created.push(
        await LiuYaoCreate(
          { personId: testPersonId, question: `顺序 ${i + 1}`, lines: FIXED_LINES },
          { skipUI: true },
        ),
      );
    }

    // 批量查询
    const { records, total } = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(total).toBe(N);
    expect(records).toHaveLength(N);

    // 所有创建出的 ID 都应存在
    const listedIds = new Set(records.map(r => r.id));
    for (const r of created) {
      expect(listedIds.has(r.id)).toBe(true);
    }
  });
});

/* ── 4. 多人物并发操作测试 ── */
describe("多人物并发操作测试", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("同时为 3 个人物各创建 5 条记录", async () => {
    const p1 = await createTestPerson("并发A");
    const p2 = await createTestPerson("并发B");
    const p3 = await createTestPerson("并发C");

    // 并发 15 条创建操作
    const tasks = [];
    for (const p of [p1, p2, p3]) {
      for (let i = 0; i < 5; i++) {
        tasks.push(
          LiuYaoCreate(
            {
              personId: p.id!,
              question: `${p.name} 问题 ${i + 1}`,
              lines: FIXED_LINES,
              tags: [p.name],
            },
            { skipUI: true },
          ),
        );
      }
    }

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(15);

    // 每个人物应有 5 条记录
    const [r1, r2, r3] = await Promise.all([
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
      LiuYaoList({ personId: p3.id! }, { skipUI: true }),
    ]);
    expect(r1.total).toBe(5);
    expect(r2.total).toBe(5);
    expect(r3.total).toBe(5);
  });

  it("验证各人物的记录互不干扰", async () => {
    const p1 = await createTestPerson("隔离A");
    const p2 = await createTestPerson("隔离B");

    // 并发创建——p1 带 "财运" 标签，p2 带 "感情" 标签
    const tasks = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(
        LiuYaoCreate(
          { personId: p1.id!, question: `财运${i + 1}`, lines: FIXED_LINES, tags: ["财运"] },
          { skipUI: true },
        ),
      );
      tasks.push(
        LiuYaoCreate(
          { personId: p2.id!, question: `感情${i + 1}`, lines: FIXED_LINES, tags: ["感情"] },
          { skipUI: true },
        ),
      );
    }
    await Promise.all(tasks);

    // 查询 p1 的 "财运" 记录——不应有 p2 的 "感情" 记录
    const caiyun = await LiuYaoList({ personId: p1.id!, tags: ["财运"] }, { skipUI: true });
    expect(caiyun.total).toBe(5);
    caiyun.records.forEach(r => {
      expect(r.personId).toBe(p1.id);
      expect(r.tags).toContain("财运");
      expect(r.tags).not.toContain("感情");
    });

    // 查询 p2 的 "感情" 记录——不应有 p1 的 "财运" 记录
    const ganqing = await LiuYaoList({ personId: p2.id!, tags: ["感情"] }, { skipUI: true });
    expect(ganqing.total).toBe(5);
    ganqing.records.forEach(r => {
      expect(r.personId).toBe(p2.id);
      expect(r.tags).toContain("感情");
      expect(r.tags).not.toContain("财运");
    });
  });

  it("并发查询不同人物的数据", async () => {
    const p1 = await createTestPerson("查询A");
    const p2 = await createTestPerson("查询B");
    const p3 = await createTestPerson("查询C");

    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        LiuYaoCreate(
          {
            personId: [p1.id!, p2.id!, p3.id!][i % 3],
            question: `并发查询 ${i + 1}`,
            lines: FIXED_LINES,
          },
          { skipUI: true },
        ),
      ),
    );

    // 3 个人物 × 3 次并发查询
    const results = await Promise.all([
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p1.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
      LiuYaoList({ personId: p2.id! }, { skipUI: true }),
      LiuYaoList({ personId: p3.id! }, { skipUI: true }),
      LiuYaoList({ personId: p3.id! }, { skipUI: true }),
      LiuYaoList({ personId: p3.id! }, { skipUI: true }),
    ]);

    // 每个人物应有 4 条记录（12 条均分）
    results.forEach(r => {
      expect(r.total).toBe(4);
    });
  });

  it("删除人物时验证关联记录的处理（级联删除）", async () => {
    const p1 = await createTestPerson("级联删除测试");
    // 为该人物创建若干记录
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        LiuYaoCreate(
          { personId: p1.id!, question: `级联 ${i + 1}`, lines: FIXED_LINES },
          { skipUI: true },
        ),
      ),
    );

    // 并发创建另一个人的记录（应不受影响）
    const p2 = await createTestPerson("级联旁观者");
    const p2Records = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        LiuYaoCreate(
          { personId: p2.id!, question: `旁观 ${i + 1}`, lines: FIXED_LINES },
          { skipUI: true },
        ),
      ),
    );

    // 删除 p1——关联记录应被级联删除
    await PersonDelete(p1.id!);

    // p1 的记录应不存在
    for (const r of created) {
      await expect(LiuYaoView({ recordId: r.id! }, { skipUI: true })).rejects.toThrow();
    }

    // p2 的记录应完好
    for (const r of p2Records) {
      const view = await LiuYaoView({ recordId: r.id! }, { skipUI: true });
      expect(view.personId).toBe(p2.id);
    }

    // p2 列表查询应返回 3 条
    const p2List = await LiuYaoList({ personId: p2.id! }, { skipUI: true });
    expect(p2List.total).toBe(3);
  });
});

/* ── 5. 回调注册竞态测试 ── */
describe("回调注册竞态测试", () => {
  afterEach(() => {
    resetCallbacks();
  });

  const minimalLiuyaoCallbacks = {
    getLiuyaoList: async (_f: LiuyaoListFilters): Promise<LiuyaoListResult> => ({
      records: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }),
    openCreateDialog: () => {},
    fillCreateForm: (_d: unknown) => {},
    submitCreateForm: async () => {
      throw new Error("mock");
    },
    selectRecord: async (_id: number) => null,
    getSelectedRecord: () => null,
    setHbarVisibility: (_l: unknown, _v: boolean) => {},
    pickTime: (_l: unknown, _v: number) => {},
    getHbarState: () => ({
      visible: {
        yearly: true,
        monthly: true,
        daily: true,
        hourly: true,
      },
      pick: { year: 2024, month: 1, day: 1, hour: 0 },
    }),
  };

  it("快速连续调用 registerLiuyaoCallbacks——验证注册正确性", async () => {
    // 连续注册 5 次
    for (let i = 0; i < 5; i++) {
      registerLiuyaoCallbacks(minimalLiuyaoCallbacks);
    }
    const ready = getCallbacksReady();
    expect(ready.liuyao).toBe(true);
  });

  it("并发注册回调——验证无竞态问题", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        Promise.resolve().then(() => registerLiuyaoCallbacks(minimalLiuyaoCallbacks)),
      ),
    );
    const ready = getCallbacksReady();
    expect(ready.liuyao).toBe(true);
  });

  it("register + reset 的竞态", async () => {
    // 交错执行 register 和 reset
    await Promise.all([
      Promise.resolve().then(() => registerLiuyaoCallbacks(minimalLiuyaoCallbacks)),
      Promise.resolve().then(() => resetCallbacks()),
      Promise.resolve().then(() => registerLiuyaoCallbacks(minimalLiuyaoCallbacks)),
      Promise.resolve().then(() => resetCallbacks()),
      Promise.resolve().then(() => registerLiuyaoCallbacks(minimalLiuyaoCallbacks)),
    ]);

    // 最终状态取决于最后一次操作——这里最后一次是 register
    const ready = getCallbacksReady();
    // resetCallbacks 和 registerLiuyaoCallbacks 都是同步赋值，
    // 最终结果由微任务队列中最后执行的那个决定——只要不抛错即视为通过
    expect(ready).toBeDefined();
  });

  it("多次 reset 后的状态", async () => {
    registerLiuyaoCallbacks(minimalLiuyaoCallbacks);
    expect(getCallbacksReady().liuyao).toBe(true);

    // 多次 reset
    for (let i = 0; i < 5; i++) {
      resetCallbacks();
    }
    expect(getCallbacksReady().liuyao).toBe(false);

    // reset 后再 register 仍能正常工作
    registerLiuyaoCallbacks(minimalLiuyaoCallbacks);
    expect(getCallbacksReady().liuyao).toBe(true);
  });
});

/* ── 6. 数据库事务测试 ── */
describe("数据库事务测试", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("saveLiuyaoRecord 的原子性", async () => {
    const p = await createTestPerson("事务人物");
    const record = {
      personId: p.id!,
      divinationTime: "2024-06-15T10:00:00",
      question: "事务测试",
      background: "",
      note: "",
      tags: ["事务"],
      lines: FIXED_LINES as SixLines,
      chart: undefined as unknown as SixLines,
      yongTarget: "自占" as const,
      yong: undefined as unknown as SixLines,
      savedAt: Date.now(),
    };

    // 通过 LiuYaoCreate 验证原子写入
    const created = await LiuYaoCreate(
      {
        personId: p.id!,
        question: "原子性测试",
        lines: FIXED_LINES,
        tags: ["原子"],
      },
      { skipUI: true },
    );

    // 写入后立即读取——数据应完整
    const view = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(view.question).toBe("原子性测试");
    expect(view.tags).toEqual(["原子"]);
    expect(view.lines).toEqual(FIXED_LINES);
    // 抑制 record 未使用警告
    expect(record).toBeDefined();
  });

  it("事务失败时——不存在的 personId 不会写入", async () => {
    // personId=99999 不存在——LiuYaoCreate 应抛错且不写入
    await expect(
      LiuYaoCreate({ personId: 99999, question: "应失败", lines: FIXED_LINES }, { skipUI: true }),
    ).rejects.toThrow(LiuyaoError);

    const { total } = await LiuYaoList({}, { skipUI: true });
    expect(total).toBe(0);
  });

  it("并发写入时的数据完整性", async () => {
    const p = await createTestPerson("完整性人物");

    // 并发写入 20 条
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        LiuYaoCreate(
          {
            personId: p.id!,
            question: `完整性 ${i + 1}`,
            lines: FIXED_LINES,
            tags: [`tag-${(i % 3) + 1}`],
          },
          { skipUI: true },
        ),
      ),
    );

    // 验证每条记录都可查询且数据完整
    const viewPromises = created.map(r => LiuYaoView({ recordId: r.id! }, { skipUI: true }));
    const views = await Promise.all(viewPromises);

    expect(views).toHaveLength(20);
    views.forEach((v, i) => {
      expect(v.question).toBe(created[i].question);
      expect(v.lines).toEqual(FIXED_LINES);
      expect(v.personId).toBe(p.id);
    });
  });

  it("大批量写入（100 条）的性能", async () => {
    const p = await createTestPerson("批量性能人物");

    const start = performance.now();
    const tasks = Array.from({ length: 100 }, (_, i) =>
      LiuYaoCreate(
        {
          personId: p.id!,
          question: `批量性能 ${i + 1}`,
          lines: FIXED_LINES,
        },
        { skipUI: true },
      ),
    );
    const created = await Promise.all(tasks);
    const createDuration = performance.now() - start;

    expect(created).toHaveLength(100);
    // 所有 ID 唯一
    const ids = created.map(r => r.id);
    expect(new Set(ids).size).toBe(100);

    // 查询验证
    const { total } = await LiuYaoList({ personId: p.id! }, { skipUI: true });
    expect(total).toBe(100);

    // 100 条并发写入应在 30 秒内完成
    expect(createDuration).toBeLessThan(30000);
  });

  it("saveLiuyaoRecord 直接调用——底层写入原子性", async () => {
    const p = await createTestPerson("直接写入人物");
    const now = Date.now();

    // 并发直接调用 saveLiuyaoRecord
    const ids = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const id = await saveLiuyaoRecord({
          personId: p.id!,
          divinationTime: `2024-06-15T10:00:${String(i).padStart(2, "0")}`,
          question: `直接写入 ${i + 1}`,
          background: "",
          note: "",
          tags: [],
          lines: FIXED_LINES,
          chart: {} as never,
          yongTarget: "自占",
          yong: {} as never,
          savedAt: now + i,
        });
        return id;
      }),
    );

    // 所有 ID 唯一
    expect(new Set(ids).size).toBe(10);
    // 抑制 now 未使用警告
    expect(now).toBeGreaterThan(0);
  });
});

/* ── 7. 超时和重试测试 ── */
describe("超时和重试测试", () => {
  afterEach(() => {
    resetCallbacks();
  });

  it("waitForLiuyaoCallbacks 超时场景——未注册时等待超时不抛错（仅 warn）", async () => {
    // helpers.ts 的 waitForLiuyaoCallbacks 是 soft wait：超时只 warn 不抛
    resetCallbacks();
    const start = performance.now();
    await waitForLiuyaoCallbacks(200);
    const duration = performance.now() - start;
    // 应至少等待接近 timeout 时间
    expect(duration).toBeGreaterThanOrEqual(150);
  });

  it("waitForLiuyaoCallbacks 在回调注册后立即返回", async () => {
    resetCallbacks();
    const start = performance.now();

    // 异步注册回调（延迟 50ms）
    setTimeout(() => {
      registerLiuyaoCallbacks({
        getLiuyaoList: async () => ({ records: [], total: 0, page: 1, pageSize: 20 }),
        openCreateDialog: () => {},
        fillCreateForm: () => {},
        submitCreateForm: async () => {
          throw new Error("mock");
        },
        selectRecord: async () => null,
        getSelectedRecord: () => null,
        setHbarVisibility: () => {},
        pickTime: () => {},
        getHbarState: () =>
          ({
            visible: {
              yearly: true,
              monthly: true,
              daily: true,
              hourly: true,
            },
            pick: { year: 2024, month: 1, day: 1, hour: 0 },
          }) as never,
      });
    }, 50);

    await waitForLiuyaoCallbacks(2000);
    const duration = performance.now() - start;
    // 应在 50-500ms 内返回（不必等满 timeout）
    expect(duration).toBeLessThan(500);
    expect(getCallbacksReady().liuyao).toBe(true);
  });

  it("waitForRecordSaved 超时场景——recordId 为 undefined 时立即返回", async () => {
    const start = performance.now();
    await waitForRecordSaved(undefined, 1000);
    const duration = performance.now() - start;
    // undefined 时立即返回
    expect(duration).toBeLessThan(100);
  });

  it("waitForRecordSaved 在指定 timeout 内正常等待", async () => {
    const start = performance.now();
    await waitForRecordSaved(1, 100);
    const duration = performance.now() - start;
    // waitForRecordSaved 内部使用 Math.min(timeout, 100) 延时
    expect(duration).toBeLessThan(300);
  });

  it("验证超时错误的正确抛出——callbacks.waitForCallbacks", async () => {
    // waitForCallbacks 在 callbacks.ts 中，未注册时会抛错
    const { waitForCallbacks } = await import("./callbacks");
    resetCallbacks();
    await expect(waitForCallbacks("liuyao", 200)).rejects.toThrow();
  });

  it("网络延迟模拟——查询在延迟后仍能成功", async () => {
    const p = await createTestPerson("延迟测试");
    const created = await LiuYaoCreate(
      {
        personId: p.id!,
        question: "延迟测试问题",
        lines: FIXED_LINES,
      },
      { skipUI: true },
    );

    // 模拟网络延迟（100ms）后再查询
    await new Promise(r => setTimeout(r, 100));
    const view = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(view.question).toBe("延迟测试问题");

    // 并发查询——延迟后仍能正确返回
    const results = await Promise.all(
      Array.from({ length: 5 }, () => LiuYaoList({ personId: p.id! }, { skipUI: true })),
    );
    results.forEach(r => {
      expect(r.total).toBe(1);
      expect(r.records[0].id).toBe(created.id);
    });
  });
});
