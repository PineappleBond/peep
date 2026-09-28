/**
 * 六爻调试 API 性能与负载 E2E 测试
 *
 * 测试范围：
 * 1. 创建性能：单条 / 批量 / 并发
 * 2. 查询性能：空库 / 列表 / 分页 / 搜索 / 标签
 * 3. 详情查询性能
 * 4. 内存占用测试
 * 5. 大数据量测试
 * 6. 缓存性能测试
 * 7. 并发负载测试
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { PersonCreate } from "./person";
import { db } from "../personDb";
import { invalidateLiuyaoTagCache } from "../liuyaoDb";
import type { SixLines } from "../liuyao/core/types";

const FIXED_LINES: SixLines = [1, 2, 3, 0, 1, 2];

/** 性能阈值（CI 环境宽松） */
const T = {
  singleCreate: 500,
  batch10: 3000,
  batch50: 10000,
  batch100: 20000,
  concurrent10: 5000,
  emptyList: 200,
  list100: 1000,
  list1000: 3000,
  search: 1000,
  tagFilter: 1000,
  pagination: 1500,
  singleView: 200,
  view100: 5000,
  computed: 200,
  memoryGrow100: 50_000_000, // 50MB 上限
  memoryPeak100: 50_000_000,
  large500Create: 30000,
  large500List: 3000,
  large1000Pagination: 10000,
  largeTags50: 3000,
  longText: 2000,
  cacheHit: 500,
  concurrent50: 15000,
  concurrent100: 30000,
  mixedLoad: 20000,
};

async function cleanupDatabase() {
  await db.liuyaoRecords.clear();
  const allPersons = await db.persons.toArray();
  const nonDefault = allPersons.filter(p => !p.isDefault);
  if (nonDefault.length > 0) {
    await db.persons.bulkDelete(nonDefault.map(p => p.id!));
  }
  invalidateLiuyaoTagCache();
}

async function createTestPerson(name = "性能测试人物") {
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

async function bulkCreate(count: number, tagPrefix = "tag") {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = await LiuYaoCreate(
      {
        question: `性能测试问题 ${i + 1}`,
        lines: FIXED_LINES,
        tags: [`${tagPrefix}-${i % 10}`],
        yongTarget: "自占",
      },
      { skipUI: true },
    );
    ids.push(r.id!);
  }
  return ids;
}

let testPersonId: number;

beforeEach(async () => {
  await cleanupDatabase();
  const p = await createTestPerson();
  testPersonId = p.id!;
});

afterEach(async () => {
  await cleanupDatabase();
});

/* ── 1. 创建性能测试 ── */
describe("创建性能测试", () => {
  it("单条创建 < 500ms", async () => {
    const t0 = performance.now();
    await LiuYaoCreate({ question: "单条性能测试", lines: FIXED_LINES }, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.singleCreate);
  });

  it("批量创建 10 / 50 / 100 条", async () => {
    const t0 = performance.now();
    await bulkCreate(10);
    const dt10 = performance.now() - t0;
    expect(dt10).toBeLessThan(T.batch10);

    const t1 = performance.now();
    await bulkCreate(50);
    const dt50 = performance.now() - t1;
    expect(dt50).toBeLessThan(T.batch50);

    const t2 = performance.now();
    await bulkCreate(100);
    const dt100 = performance.now() - t2;
    expect(dt100).toBeLessThan(T.batch100);
  });

  it("并发创建 10 条", async () => {
    const t0 = performance.now();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        LiuYaoCreate(
          { question: `并发创建 ${i + 1}`, lines: FIXED_LINES, tags: [`并发-${i}`] },
          { skipUI: true },
        ),
      ),
    );
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.concurrent10);
  });

  it("自动摇卦 vs 指定 lines 的性能对比", async () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      await LiuYaoCreate({ question: `自动摇卦 ${i}`, lines: FIXED_LINES }, { skipUI: true });
    }
    const dtFixed = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 10; i++) {
      await LiuYaoCreate({ question: `自动摇卦 ${i}` }, { skipUI: true });
    }
    const dtAuto = performance.now() - t1;

    // 自动摇卦应不比指定 lines 慢太多（允许 5 倍差距）
    expect(dtAuto).toBeLessThan(dtFixed * 5 + 500);
  });
});

/* ── 2. 查询性能测试 ── */
describe("查询性能测试", () => {
  it("空数据库查询 < 200ms", async () => {
    const t0 = performance.now();
    const result = await LiuYaoList({}, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.emptyList);
    expect(result.total).toBe(0);
  });

  it("100 条记录的列表查询 < 1000ms", async () => {
    await bulkCreate(100);
    const t0 = performance.now();
    const result = await LiuYaoList({}, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.list100);
    expect(result.total).toBe(100);
  });

  it("1000 条记录的列表查询 < 3000ms", async () => {
    await bulkCreate(1000);
    const t0 = performance.now();
    const result = await LiuYaoList({}, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.list1000);
    expect(result.total).toBe(1000);
  });

  it("带搜索条件的查询性能", async () => {
    await bulkCreate(100);
    const t0 = performance.now();
    const result = await LiuYaoList({ searchText: "性能测试问题 50" }, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.search);
    expect(result.total).toBeGreaterThan(0);
  });

  it("带标签过滤的查询性能", async () => {
    await bulkCreate(100);
    const t0 = performance.now();
    const result = await LiuYaoList({ tags: ["tag-5"] }, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.tagFilter);
    expect(result.total).toBe(10);
  });

  it("分页查询的性能（不同 pageSize）", async () => {
    await bulkCreate(200);
    const pageSizes = [10, 50, 100];
    for (const ps of pageSizes) {
      const t0 = performance.now();
      const result = await LiuYaoList({ page: 1, pageSize: ps }, { skipUI: true });
      const dt = performance.now() - t0;
      expect(dt).toBeLessThan(T.pagination);
      expect(result.records.length).toBeLessThanOrEqual(ps);
    }
  });
});

/* ── 3. 详情查询性能 ── */
describe("详情查询性能", () => {
  it("单条记录详情查询 < 200ms", async () => {
    const created = await LiuYaoCreate(
      { question: "详情性能测试", lines: FIXED_LINES },
      { skipUI: true },
    );
    const t0 = performance.now();
    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.singleView);
    expect(detail.id).toBe(created.id);
  });

  it("连续查询 100 条不同记录的性能", async () => {
    const ids = await bulkCreate(100);
    const t0 = performance.now();
    for (const id of ids) {
      await LiuYaoView({ recordId: id }, { skipUI: true });
    }
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.view100);
  });

  it("详情查询的 computed 字段构建性能", async () => {
    const created = await LiuYaoCreate(
      { question: "computed 性能", lines: FIXED_LINES },
      { skipUI: true },
    );
    const t0 = performance.now();
    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.computed);
    expect(detail.computed).toBeDefined();
    expect(detail.computed!.chart).toBeDefined();
    expect(detail.computed!.hbarData).toBeDefined();
    expect(detail.computed!.vigorColumns).toBeDefined();
  });
});

/* ── 4. 内存占用测试 ── */
describe("内存占用测试", () => {
  it("创建 100 条记录的内存增长在合理范围内", async () => {
    // 强制 GC 提示（即使不真正 GC，也可观察堆变化）
    const memBefore =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0;

    await bulkCreate(100);

    const memAfter =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0;

    // 若浏览器暴露了 memory API，则验证增长上限；否则仅通过功能测试
    if (memBefore > 0 && memAfter > 0) {
      const growth = memAfter - memBefore;
      expect(growth).toBeLessThan(T.memoryGrow100);
    }
    // 功能验证：100 条确已写入
    const list = await LiuYaoList({}, { skipUI: true });
    expect(list.total).toBe(100);
  });

  it("查询 100 条记录的内存峰值在合理范围内", async () => {
    await bulkCreate(100);
    const memBefore =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0;

    const result = await LiuYaoList({}, { skipUI: true });
    expect(result.total).toBe(100);

    const memAfter =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
      0;
    if (memBefore > 0 && memAfter > 0) {
      expect(memAfter - memBefore).toBeLessThan(T.memoryPeak100);
    }
  });

  it("清理数据库后功能正常（内存回收无法在 JS 层精确断言）", async () => {
    await bulkCreate(100);
    await cleanupDatabase();
    // 重建测试人物
    await createTestPerson();
    const list = await LiuYaoList({}, { skipUI: true });
    expect(list.total).toBe(0);
  });
});

/* ── 5. 大数据量测试 ── */
describe("大数据量测试", () => {
  it("500 条记录的创建和查询", async () => {
    const t0 = performance.now();
    const ids = await bulkCreate(500);
    const dtCreate = performance.now() - t0;
    expect(dtCreate).toBeLessThan(T.large500Create);
    expect(ids).toHaveLength(500);

    const t1 = performance.now();
    const result = await LiuYaoList({}, { skipUI: true });
    const dtList = performance.now() - t1;
    expect(dtList).toBeLessThan(T.large500List);
    expect(result.total).toBe(500);
  });

  it("1000 条记录的分页遍历", async () => {
    await bulkCreate(1000);
    const t0 = performance.now();
    let totalSeen = 0;
    let page = 1;
    const pageSize = 50;
    while (true) {
      const result = await LiuYaoList({ page, pageSize }, { skipUI: true });
      totalSeen += result.records.length;
      if (result.records.length < pageSize) break;
      page++;
      if (page > 30) break; // 安全阀
    }
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.large1000Pagination);
    expect(totalSeen).toBe(1000);
  }, 15000);

  it("大量标签（50+）的过滤性能", async () => {
    // 创建 60 条记录，每条带不同标签
    for (let i = 0; i < 60; i++) {
      await LiuYaoCreate(
        { question: `标签测试 ${i}`, lines: FIXED_LINES, tags: [`标签-${i}`] },
        { skipUI: true },
      );
    }
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      const result = await LiuYaoList({ tags: [`标签-${i}`] }, { skipUI: true });
      expect(result.total).toBe(1);
    }
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.largeTags50);
  });

  it("超长文本的处理性能（各字段按 maxLength 上限填充）", async () => {
    // 适配新增的 maxLength 验证：question≤200, background≤2000, note≤500
    const qText = "测".repeat(200);
    const bgText = "景".repeat(2000);
    const noteText = "注".repeat(500);
    const t0 = performance.now();
    const created = await LiuYaoCreate(
      { question: qText, lines: FIXED_LINES, background: bgText, note: noteText },
      { skipUI: true },
    );
    const dtCreate = performance.now() - t0;
    expect(dtCreate).toBeLessThan(T.longText);

    const t1 = performance.now();
    const detail = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    const dtView = performance.now() - t1;
    expect(dtView).toBeLessThan(T.longText);
    expect(detail.question).toBe(qText);
    expect(detail.background).toBe(bgText);
    expect(detail.note).toBe(noteText);
  });
});

/* ── 6. 缓存性能测试 ── */
describe("缓存性能测试", () => {
  it("首次查询 vs 重复查询的性能差异", async () => {
    await bulkCreate(50);
    invalidateLiuyaoTagCache();

    const t0 = performance.now();
    await LiuYaoList({ tags: ["tag-0"] }, { skipUI: true });
    const dtFirst = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 10; i++) {
      await LiuYaoList({ tags: ["tag-0"] }, { skipUI: true });
    }
    const dtRepeat = performance.now() - t1;

    // 重复查询应该更快或相当（允许 3 倍波动）
    expect(dtRepeat).toBeLessThan(dtFirst * 3 + 200);
  });

  it("标签缓存失效后的重新查询性能", async () => {
    await bulkCreate(50);

    const t0 = performance.now();
    await LiuYaoList({ tags: ["tag-0"] }, { skipUI: true });
    const dt1 = performance.now() - t0;

    invalidateLiuyaoTagCache();

    const t1 = performance.now();
    await LiuYaoList({ tags: ["tag-0"] }, { skipUI: true });
    const dt2 = performance.now() - t1;

    // 缓存失效后的查询仍在合理范围内
    expect(dt2).toBeLessThan(T.cacheHit * 2);
    expect(dt1).toBeLessThan(T.cacheHit * 2);
  });
});

/* ── 7. 并发负载测试 ── */
describe("并发负载测试", () => {
  it("50 个并发查询的响应时间", async () => {
    await bulkCreate(100);
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        LiuYaoList({ page: 1, pageSize: 10 + (i % 5) }, { skipUI: true }),
      ),
    );
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.concurrent50);
    expect(results).toHaveLength(50);
  });

  it("100 个并发查询的响应时间", async () => {
    await bulkCreate(100);
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        LiuYaoList({ page: 1, pageSize: 10 }, { skipUI: true }),
      ),
    );
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.concurrent100);
    expect(results).toHaveLength(100);
  });

  it("混合负载（创建+查询+详情）的性能", async () => {
    const t0 = performance.now();

    // 并发执行创建、查询、详情混合操作
    const tasks = [];
    for (let i = 0; i < 20; i++) {
      tasks.push(
        LiuYaoCreate(
          { question: `混合负载 ${i}`, lines: FIXED_LINES, tags: [`混合-${i % 5}`] },
          { skipUI: true },
        ),
      );
    }
    for (let i = 0; i < 20; i++) {
      tasks.push(LiuYaoList({ page: 1, pageSize: 10 }, { skipUI: true }));
    }
    // 先等待创建完成，再做详情（避免 recordId 不存在）
    const created = await Promise.all(tasks.slice(0, 20));
    const viewTasks = created.map(c =>
      LiuYaoView({ recordId: (c as { id: number }).id! }, { skipUI: true }),
    );
    const allResults = await Promise.all([...tasks.slice(20), ...viewTasks]);

    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(T.mixedLoad);
    expect(allResults.length).toBe(40);
  });
});
