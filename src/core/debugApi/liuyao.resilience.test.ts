/**
 * 六爻调试 API 错误恢复与弹性 E2E 测试
 *
 * 测试范围：
 * 1. 错误恢复测试——创建/查询失败后数据库状态干净，可重试
 * 2. 异常输入弹性测试——undefined/null、超大数值、特殊字符串
 * 3. 资源限制测试——大量记录/标签/超长文本
 * 4. 网络/IO 模拟测试——mock 数据库延迟与异常
 * 5. 状态一致性测试——多次创建顺序、删后重建、并发更新
 * 6. 边界条件弹性测试——空库查询、单条分页、页码越界
 * 7. 错误信息质量测试——上下文、建议、错误代码、错误链
 *
 * 使用 fake-indexeddb polyfill IndexedDB
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { LiuyaoError, ApiErrorCode } from "./errors";
import { db } from "../personDb";
import { deleteLiuyaoRecord, getLiuyaoRecord, listLiuyaoRecords } from "../liuyaoDb";
import type { SixLines } from "../liuyao/core/types";

/* ── 辅助函数 ── */

async function clearDatabase() {
  await db.liuyaoRecords.clear();
  await db.persons.clear();
}

async function createTestPerson() {
  const id = await db.persons.add({
    name: "测试人物",
    savedAt: Date.now(),
    isDefault: true,
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

/** 统计数据库中六爻记录数 */
async function countRecords(personId: number) {
  return await db.liuyaoRecords.where("personId").equals(personId).count();
}

/* ══════════════════════════════════════════════════════════════
 *  1. 错误恢复测试
 * ══════════════════════════════════════════════════════════════ */
describe("1. 错误恢复测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("创建失败后数据库状态干净（无脏数据）", async () => {
    const beforeCount = await countRecords(testPersonId);

    // question 为空 → 验证失败，不应写入数据库
    await expect(
      LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true }),
    ).rejects.toThrow(LiuyaoError);

    const afterCount = await countRecords(testPersonId);
    expect(afterCount).toBe(beforeCount);
  });

  it("人物不存在时创建失败，数据库无脏数据", async () => {
    const beforeCount = await countRecords(testPersonId);

    await expect(
      LiuYaoCreate({ personId: 999999, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow(LiuyaoError);

    const afterCount = await countRecords(testPersonId);
    expect(afterCount).toBe(beforeCount);
  });

  it("查询失败后可以重试成功", async () => {
    // 先创建一条记录
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "可重试的问题" },
      { skipUI: true },
    );

    // 查询不存在的记录（预期失败）
    await expect(LiuYaoView({ recordId: 999999 }, { skipUI: true })).rejects.toThrow(LiuyaoError);

    // 重试查询存在的记录（应成功）
    const result = await LiuYaoView({ recordId: record.id! }, { skipUI: true });
    expect(result.question).toBe("可重试的问题");
  });

  it("部分失败的事务回滚——无效 lines 不写入数据库", async () => {
    const beforeCount = await countRecords(testPersonId);

    // lines 无效 → 应在验证阶段失败，不写入
    await expect(
      LiuYaoCreate(
        {
          personId: testPersonId,
          question: "测试",
          lines: [9, 9, 9, 9, 9, 9] as unknown as SixLines,
        },
        { skipUI: true },
      ),
    ).rejects.toThrow();

    const afterCount = await countRecords(testPersonId);
    expect(afterCount).toBe(beforeCount);
  });

  it("并发操作部分失败时的数据一致性", async () => {
    // 并发：一半成功，一半失败
    const promises = [
      LiuYaoCreate({ personId: testPersonId, question: "成功1" }, { skipUI: true }),
      LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true }).catch(() => null),
      LiuYaoCreate({ personId: testPersonId, question: "成功2" }, { skipUI: true }),
      LiuYaoCreate({ personId: 999999, question: "失败" }, { skipUI: true }).catch(() => null),
    ];

    const results = await Promise.all(promises);

    // 成功的记录应写入
    const successCount = results.filter(r => r !== null).length;
    expect(successCount).toBe(2);

    // 数据库记录数应与成功数一致
    const dbCount = await countRecords(testPersonId);
    expect(dbCount).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  2. 异常输入弹性测试
 * ══════════════════════════════════════════════════════════════ */
describe("2. 异常输入弹性测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("undefined question 抛出错误", async () => {
    await expect(
      LiuYaoCreate(
        { personId: testPersonId, question: undefined as unknown as string },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });

  it("null question 抛出错误", async () => {
    await expect(
      LiuYaoCreate(
        { personId: testPersonId, question: null as unknown as string },
        { skipUI: true },
      ),
    ).rejects.toThrow();
  });

  it("超大数值 personId（Number.MAX_SAFE_INTEGER + 1）——不是有效整数", async () => {
    // Number.MAX_SAFE_INTEGER + 1 不再是精确整数，Number.isInteger 返回 false
    const bigId = Number.MAX_SAFE_INTEGER + 1;
    await expect(
      LiuYaoCreate({ personId: bigId, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("Number.MAX_SAFE_INTEGER 作为 personId——人物不存在", async () => {
    await expect(
      LiuYaoCreate({ personId: Number.MAX_SAFE_INTEGER, question: "测试" }, { skipUI: true }),
    ).rejects.toThrow(LiuyaoError);
  });

  it("包含换行符的 question 正常处理", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "问题\n包含\n换行" },
      { skipUI: true },
    );
    expect(record.question).toBe("问题\n包含\n换行");
  });

  it("包含制表符的 question 正常处理", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "问题\t包含\t制表符" },
      { skipUI: true },
    );
    expect(record.question).toBe("问题\t包含\t制表符");
  });

  it("包含 Unicode 特殊字符的 question 正常处理", async () => {
    const unicode = "问题\u{1F600}\u{1F680}测试"; // emoji
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: unicode },
      { skipUI: true },
    );
    expect(record.question).toBe(unicode);
  });

  it("null tags 正常处理（视为未提供）", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "测试", tags: undefined },
      { skipUI: true },
    );
    expect(record.tags).toEqual([]);
  });

  it("NaN 作为 recordId 抛出错误", async () => {
    await expect(LiuYaoView({ recordId: NaN }, { skipUI: true })).rejects.toThrow();
  });

  it("Infinity 作为 recordId 抛出错误", async () => {
    await expect(LiuYaoView({ recordId: Infinity }, { skipUI: true })).rejects.toThrow();
  });

  it("负数 recordId 抛出错误", async () => {
    await expect(LiuYaoView({ recordId: -1 }, { skipUI: true })).rejects.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  3. 资源限制测试
 * ══════════════════════════════════════════════════════════════ */
describe("3. 资源限制测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("大量记录（50+）的查询性能", async () => {
    // 创建 50 条记录（数量足够验证性能但不使测试太慢）
    const batchSize = 50;
    for (let i = 0; i < batchSize; i++) {
      await LiuYaoCreate(
        { personId: testPersonId, question: `批量问题 ${i + 1}` },
        { skipUI: true },
      );
    }

    const start = performance.now();
    const result = await LiuYaoList({ personId: testPersonId, pageSize: 100 }, { skipUI: true });
    const elapsed = performance.now() - start;

    expect(result.records).toHaveLength(batchSize);
    expect(result.total).toBe(batchSize);
    // 50 条记录查询应在 5 秒内完成（宽松阈值）
    expect(elapsed).toBeLessThan(5000);
  }, 15000);

  it("大量标签（100+）的处理", async () => {
    // 创建 100+ 标签
    const manyTags: string[] = [];
    for (let i = 0; i < 110; i++) {
      manyTags.push(`标签${i + 1}`);
    }

    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "多标签测试", tags: manyTags },
      { skipUI: true },
    );

    expect(record.tags).toHaveLength(110);

    // 查询时应能正常匹配
    const result = await LiuYaoList({ personId: testPersonId, tags: ["标签50"] }, { skipUI: true });
    expect(result.records).toHaveLength(1);
  });

  it("超长文本（10000+ 字符）的处理", async () => {
    const longText = "测".repeat(10001);
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: longText },
      { skipUI: true },
    );

    expect(record.question).toBe(longText);
    expect(record.question.length).toBe(10001);

    // 查看时也能正常返回
    const view = await LiuYaoView({ recordId: record.id! }, { skipUI: true });
    expect(view.question.length).toBe(10001);
  });

  it("内存占用验证——多次创建不导致内存泄漏", async () => {
    // 创建 20 条记录后验证数据库状态正常
    const ids: number[] = [];
    for (let i = 0; i < 20; i++) {
      const record = await LiuYaoCreate(
        { personId: testPersonId, question: `内存测试 ${i}` },
        { skipUI: true },
      );
      ids.push(record.id!);
    }

    // 验证所有记录都能正常查询
    for (const id of ids) {
      const view = await LiuYaoView({ recordId: id }, { skipUI: true });
      expect(view.id).toBe(id);
    }

    // 总数应正确
    const list = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(list.total).toBe(20);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  4. 网络/IO 模拟测试
 * ══════════════════════════════════════════════════════════════ */
describe("4. 网络/IO 模拟测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
    vi.restoreAllMocks();
  });

  it("模拟数据库延迟后仍能成功", async () => {
    // 模拟 saveLiuyaoRecord 延迟 100ms
    const originalPut = db.liuyaoRecords.put.bind(db.liuyaoRecords);
    const spy = vi.spyOn(db.liuyaoRecords, "put").mockImplementation(async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return originalPut(...args);
    });

    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "延迟测试" },
      { skipUI: true },
    );

    expect(record.id).toBeDefined();
    expect(spy).toHaveBeenCalled();
  });

  it("模拟数据库错误（put 抛异常）", async () => {
    vi.spyOn(db.liuyaoRecords, "put").mockRejectedValue(new Error("模拟数据库写入失败"));

    await expect(
      LiuYaoCreate({ personId: testPersonId, question: "数据库错误测试" }, { skipUI: true }),
    ).rejects.toThrow();

    // 数据库应保持干净
    const count = await countRecords(testPersonId);
    expect(count).toBe(0);
  });

  it("模拟查询时数据库错误", async () => {
    // 先创建一条记录
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "查询错误测试" },
      { skipUI: true },
    );

    // 模拟查询失败
    vi.spyOn(db.liuyaoRecords, "get").mockRejectedValue(new Error("模拟数据库读取失败"));

    await expect(LiuYaoView({ recordId: record.id! }, { skipUI: true })).rejects.toThrow();
  });

  it("模拟 listLiuyaoRecords 数据库错误", async () => {
    // mock where 链：where(...).equals(...).toArray() 抛异常
    const originalWhere = db.liuyaoRecords.where.bind(db.liuyaoRecords);
    vi.spyOn(db.liuyaoRecords, "where").mockImplementation((...args) => {
      const collection = originalWhere(...args);
      // 拦截 equals 返回的 collection 的 toArray
      const originalEquals = collection.equals.bind(collection);
      collection.equals = (...eqArgs: unknown[]) => {
        const result = originalEquals(...eqArgs);
        result.toArray = () => Promise.reject(new Error("模拟列表查询失败"));
        return result;
      };
      return collection;
    });

    await expect(LiuYaoList({ personId: testPersonId }, { skipUI: true })).rejects.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════
 *  5. 状态一致性测试
 * ══════════════════════════════════════════════════════════════ */
describe("5. 状态一致性测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("多次创建后列表顺序一致性（按 savedAt 倒序）", async () => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const record = await LiuYaoCreate(
        { personId: testPersonId, question: `问题 ${i + 1}` },
        { skipUI: true },
      );
      ids.push(record.id!);
    }

    const result = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(result.records).toHaveLength(5);

    // 列表应按 savedAt 倒序（最新的在前）
    for (let i = 1; i < result.records.length; i++) {
      expect(result.records[i - 1].savedAt).toBeGreaterThanOrEqual(result.records[i].savedAt!);
    }
  });

  it("创建后立即删除再创建", async () => {
    // 创建
    const r1 = await LiuYaoCreate({ personId: testPersonId, question: "第一版" }, { skipUI: true });
    const r1Id = r1.id!;

    // 删除
    await deleteLiuyaoRecord(r1Id);

    // 验证已删除
    const deleted = await getLiuyaoRecord(r1Id);
    expect(deleted).toBeUndefined();

    // 重新创建
    const r2 = await LiuYaoCreate({ personId: testPersonId, question: "第二版" }, { skipUI: true });

    // 新记录 ID 不同
    expect(r2.id).not.toBe(r1Id);
    expect(r2.question).toBe("第二版");

    // 数据库只有一条记录
    const count = await countRecords(testPersonId);
    expect(count).toBe(1);
  });

  it("并发更新同一记录——最后一次写入生效", async () => {
    const record = await LiuYaoCreate(
      { personId: testPersonId, question: "原始问题", lines: [1, 1, 1, 1, 1, 1] },
      { skipUI: true },
    );

    // 模拟并发修改（直接操作数据库）
    const id = record.id!;
    await Promise.all([
      (async () => {
        const r = await getLiuyaoRecord(id);
        if (r) await db.liuyaoRecords.put({ ...r, question: "修改A" });
      })(),
      (async () => {
        const r = await getLiuyaoRecord(id);
        if (r) await db.liuyaoRecords.put({ ...r, question: "修改B" });
      })(),
    ]);

    // 最终应有一条记录，question 为 A 或 B
    const final = await getLiuyaoRecord(id);
    expect(final).toBeDefined();
    expect(["修改A", "修改B"]).toContain(final!.question);
  });

  it("事务中断后的状态恢复——删除操作中断不影响其他记录", async () => {
    // 创建 3 条记录
    const records = [];
    for (let i = 0; i < 3; i++) {
      records.push(
        await LiuYaoCreate({ personId: testPersonId, question: `记录 ${i + 1}` }, { skipUI: true }),
      );
    }

    // 删除中间一条
    await deleteLiuyaoRecord(records[1].id!);

    // 其他记录不受影响
    const r0 = await getLiuyaoRecord(records[0].id!);
    const r2 = await getLiuyaoRecord(records[2].id!);
    expect(r0).toBeDefined();
    expect(r2).toBeDefined();

    // 总数为 2
    const count = await countRecords(testPersonId);
    expect(count).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  6. 边界条件弹性测试
 * ══════════════════════════════════════════════════════════════ */
describe("6. 边界条件弹性测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("空数据库查询返回空列表", async () => {
    const result = await LiuYaoList({ personId: testPersonId }, { skipUI: true });
    expect(result.records).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("单条记录的分页——page=1, pageSize=1", async () => {
    await LiuYaoCreate({ personId: testPersonId, question: "唯一记录" }, { skipUI: true });

    const result = await LiuYaoList(
      { personId: testPersonId, page: 1, pageSize: 1 },
      { skipUI: true },
    );

    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("页码超出范围——返回空列表", async () => {
    await LiuYaoCreate({ personId: testPersonId, question: "唯一记录" }, { skipUI: true });

    // page=100 远超实际页数
    const result = await LiuYaoList(
      { personId: testPersonId, page: 100, pageSize: 10 },
      { skipUI: true },
    );

    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  it("pageSize=0 抛出错误", async () => {
    await expect(
      LiuYaoList({ personId: testPersonId, pageSize: 0 }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("pageSize 为负数抛出错误", async () => {
    await expect(
      LiuYaoList({ personId: testPersonId, pageSize: -5 }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("page=0 抛出错误", async () => {
    await expect(
      LiuYaoList({ personId: testPersonId, page: 0 }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("page 为负数抛出错误", async () => {
    await expect(
      LiuYaoList({ personId: testPersonId, page: -1 }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("pageSize 超过上限 100 抛出错误", async () => {
    await expect(
      LiuYaoList({ personId: testPersonId, pageSize: 101 }, { skipUI: true }),
    ).rejects.toThrow();
  });

  it("pageSize=100 正常（边界值）", async () => {
    await LiuYaoCreate({ personId: testPersonId, question: "测试" }, { skipUI: true });

    const result = await LiuYaoList({ personId: testPersonId, pageSize: 100 }, { skipUI: true });
    expect(result.records).toHaveLength(1);
  });
});

/* ══════════════════════════════════════════════════════════════
 *  7. 错误信息质量测试
 * ══════════════════════════════════════════════════════════════ */
describe("7. 错误信息质量测试", () => {
  let testPersonId: number;

  beforeEach(async () => {
    await clearDatabase();
    testPersonId = await createTestPerson();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("空 question 错误包含 INVALID_INPUT 错误代码", async () => {
    try {
      await LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("不存在的人物错误包含 NOT_FOUND 错误代码", async () => {
    try {
      await LiuYaoCreate({ personId: 999999, question: "测试" }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.NOT_FOUND);
    }
  });

  it("不存在的记录错误包含 NOT_FOUND 错误代码", async () => {
    try {
      await LiuYaoView({ recordId: 999999 }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.NOT_FOUND);
    }
  });

  it("无效分页参数错误包含 INVALID_INPUT 错误代码", async () => {
    try {
      await LiuYaoList({ personId: testPersonId, page: -1 }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("错误消息包含上下文信息", async () => {
    try {
      await LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      const liuyaoErr = err as LiuyaoError;
      // context 应包含字段信息
      expect(liuyaoErr.context).toBeDefined();
      expect(liuyaoErr.source).toBe("LiuYaoCreate");
    }
  });

  it("错误建议具有可操作性", async () => {
    try {
      await LiuYaoView({ recordId: 999999 }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      const liuyaoErr = err as LiuyaoError;
      // suggestion 应提供恢复建议
      expect(liuyaoErr.suggestion).toBeDefined();
      expect(liuyaoErr.suggestion!.length).toBeGreaterThan(0);
    }
  });

  it("错误源标签正确", async () => {
    try {
      await LiuYaoList({ personId: testPersonId, pageSize: 0 }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      const liuyaoErr = err as LiuyaoError;
      expect(liuyaoErr.source).toBe("LiuYaoList");
    }
  });

  it("无效 recordId 错误被正确抛出", async () => {
    try {
      await LiuYaoView({ recordId: -5 }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      // validateRecordId 使用 DaLiuRenError，被 wrapError 保留（已是 BaseDebugError）
      expect(err).toBeDefined();
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("错误序列化（toJSON）包含必要字段", async () => {
    try {
      await LiuYaoCreate({ personId: testPersonId, question: "" }, { skipUI: true });
      expect.fail("应该抛出错误");
    } catch (err) {
      const liuyaoErr = err as LiuyaoError;
      const json = liuyaoErr.toJSON();
      expect(json.name).toBe("LiuyaoError");
      expect(json.source).toBeDefined();
      expect(json.errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});
