/**
 * 六爻数据库边界测试
 *
 * 覆盖调试 API 测试矩阵中的数据库缺口：
 * - searchText 对 question / background / note 各字段搜索
 * - 极端分页：pageSize=1、最后一页不足 pageSize
 * - total 与 records.length 一致性
 * - deleteLiuyaoRecord 删除操作
 * - 删除后标签缓存失效
 * - 多标签交集/并集筛选
 * - 空数据库查询
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList } from "../debugApi/liuyao";
import { deleteLiuyaoRecord, getAllLiuyaoTags } from "../liuyaoDb";
import { db, type Person } from "../personDb";
import { DEFAULT_BIRTH_INPUT } from "../useZwds";
import type { SixLines } from "../liuyao/core/types";

async function createTestPerson(name = "DB边界测试人物"): Promise<number> {
  const id = await db.persons.add({
    ...DEFAULT_BIRTH_INPUT,
    name,
    savedAt: Date.now(),
    isDefault: false,
  } as Omit<Person, "id">);
  return id as number;
}

describe("searchText 各字段搜索", () => {
  let pid: number;

  beforeEach(async () => {
    pid = await createTestPerson();
    // 创建3条记录：question/note/background各不同
    await LiuYaoCreate(
      {
        personId: pid,
        question: "独特的問題ABC",
        note: "普通备注",
        background: "普通背景",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        personId: pid,
        question: "普通问题",
        note: "独特的备注XYZ",
        background: "普通背景",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        personId: pid,
        question: "普通问题",
        note: "普通备注",
        background: "独特的背景DEF",
      },
      { skipUI: true },
    );
  });

  afterEach(async () => {
    await db.liuyaoRecords.where("personId").equals(pid).delete();
    await db.persons.delete(pid);
  });

  it("搜索 question 字段", async () => {
    const result = await LiuYaoList(
      { personId: pid, searchText: "独特的問題ABC" },
      { skipUI: true },
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].question).toContain("ABC");
  });

  it("搜索 note 字段", async () => {
    const result = await LiuYaoList(
      { personId: pid, searchText: "独特的备注XYZ" },
      { skipUI: true },
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].note).toBe("独特的备注XYZ");
  });

  it("搜索 background 字段", async () => {
    const result = await LiuYaoList(
      { personId: pid, searchText: "独特的背景DEF" },
      { skipUI: true },
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].background).toBe("独特的背景DEF");
  });

  it("搜索公共字段'普通'匹配全部3条", async () => {
    const result = await LiuYaoList({ personId: pid, searchText: "普通" }, { skipUI: true });
    expect(result.records).toHaveLength(3);
  });

  it("搜索无匹配返回空", async () => {
    const result = await LiuYaoList(
      { personId: pid, searchText: "不存在的文本" },
      { skipUI: true },
    );
    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("极端分页边界", () => {
  let pid: number;

  beforeEach(async () => {
    pid = await createTestPerson("分页测试人物");
    // 创建7条记录
    for (let i = 0; i < 7; i++) {
      await LiuYaoCreate(
        {
          personId: pid,
          question: `分页测试${i + 1}`,
        },
        { skipUI: true },
      );
    }
  });

  afterEach(async () => {
    await db.liuyaoRecords.where("personId").equals(pid).delete();
    await db.persons.delete(pid);
  });

  it("pageSize=1 极端分页", async () => {
    const page1 = await LiuYaoList({ personId: pid, page: 1, pageSize: 1 }, { skipUI: true });
    expect(page1.records).toHaveLength(1);
    expect(page1.total).toBe(7);
  });

  it("最后一页不足 pageSize", async () => {
    const lastPage = await LiuYaoList({ personId: pid, page: 4, pageSize: 2 }, { skipUI: true });
    // 7条记录，pageSize=2，第4页只有1条
    expect(lastPage.records).toHaveLength(1);
    expect(lastPage.total).toBe(7);
  });

  it("页码超出范围返回空", async () => {
    const result = await LiuYaoList({ personId: pid, page: 100, pageSize: 10 }, { skipUI: true });
    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(7); // total 仍为总数
  });

  it("total 与 records.length 一致性（首页满页）", async () => {
    const result = await LiuYaoList({ personId: pid, page: 1, pageSize: 5 }, { skipUI: true });
    expect(result.records).toHaveLength(5);
    expect(result.total).toBe(7);
    // total >= records.length
    expect(result.total).toBeGreaterThanOrEqual(result.records.length);
  });

  it("所有页的总记录数等于 total", async () => {
    const allRecords: number[] = [];
    const pageSize = 3;
    let page = 1;
    while (true) {
      const result = await LiuYaoList({ personId: pid, page, pageSize }, { skipUI: true });
      for (const r of result.records) {
        allRecords.push(r.id!);
      }
      if (result.records.length < pageSize) break;
      page++;
    }
    // 不重复
    expect(new Set(allRecords).size).toBe(allRecords.length);
    expect(allRecords.length).toBe(7);
  });

  it("pageSize=100 超过记录总数", async () => {
    const result = await LiuYaoList({ personId: pid, page: 1, pageSize: 100 }, { skipUI: true });
    expect(result.records).toHaveLength(7);
    expect(result.total).toBe(7);
  });
});

describe("deleteLiuyaoRecord 删除操作", () => {
  let pid: number;
  let recordId: number;

  beforeEach(async () => {
    pid = await createTestPerson("删除测试人物");
    const record = await LiuYaoCreate(
      {
        personId: pid,
        question: "待删除记录",
        tags: ["待删除"],
      },
      { skipUI: true },
    );
    recordId = record.id!;
  });

  afterEach(async () => {
    await db.liuyaoRecords.where("personId").equals(pid).delete();
    await db.persons.delete(pid);
  });

  it("删除后查询不到", async () => {
    // 确认存在
    const before = await LiuYaoList({ personId: pid }, { skipUI: true });
    expect(before.records).toHaveLength(1);

    // 删除
    await deleteLiuyaoRecord(recordId);

    // 确认不存在
    const after = await LiuYaoList({ personId: pid }, { skipUI: true });
    expect(after.records).toHaveLength(0);
    expect(after.total).toBe(0);
  });

  it("删除不影响其他记录", async () => {
    // 再创建一条
    await LiuYaoCreate(
      {
        personId: pid,
        question: "保留记录",
      },
      { skipUI: true },
    );

    await deleteLiuyaoRecord(recordId);

    const result = await LiuYaoList({ personId: pid }, { skipUI: true });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].question).toBe("保留记录");
  });

  it("删除后标签缓存失效", async () => {
    // 确认标签存在
    const tagsBefore = await getAllLiuyaoTags(pid);
    expect(tagsBefore).toContain("待删除");

    // 删除
    await deleteLiuyaoRecord(recordId);

    // 标签缓存应失效，不再包含"待删除"
    const tagsAfter = await getAllLiuyaoTags(pid);
    expect(tagsAfter).not.toContain("待删除");
  });

  it("删除不存在的记录不抛错", async () => {
    // IndexedDB delete 对不存在的 key 不抛错
    await expect(deleteLiuyaoRecord(999999)).resolves.toBeUndefined();
  });
});

describe("多标签筛选", () => {
  let pid: number;

  beforeEach(async () => {
    pid = await createTestPerson("标签测试人物");
    await LiuYaoCreate({ personId: pid, question: "记录1", tags: ["A", "B"] }, { skipUI: true });
    await LiuYaoCreate({ personId: pid, question: "记录2", tags: ["B", "C"] }, { skipUI: true });
    await LiuYaoCreate({ personId: pid, question: "记录3", tags: ["A", "C"] }, { skipUI: true });
    await LiuYaoCreate({ personId: pid, question: "记录4", tags: ["D"] }, { skipUI: true });
  });

  afterEach(async () => {
    await db.liuyaoRecords.where("personId").equals(pid).delete();
    await db.persons.delete(pid);
  });

  it("单标签筛选", async () => {
    const result = await LiuYaoList({ personId: pid, tags: ["A"] }, { skipUI: true });
    expect(result.records).toHaveLength(2); // 记录1,3
  });

  it("多标签并集筛选（包含任一即可）", async () => {
    const result = await LiuYaoList({ personId: pid, tags: ["A", "D"] }, { skipUI: true });
    // 包含A或D：记录1(A,B), 记录3(A,C), 记录4(D)
    expect(result.records).toHaveLength(3);
  });

  it("无匹配标签返回空", async () => {
    const result = await LiuYaoList({ personId: pid, tags: ["Z"] }, { skipUI: true });
    expect(result.records).toHaveLength(0);
  });

  it("getAllLiuyaoTags 返回所有已用标签", async () => {
    const tags = await getAllLiuyaoTags(pid);
    expect(tags.sort()).toEqual(["A", "B", "C", "D"]);
  });
});

describe("空数据库查询", () => {
  let pid: number;

  beforeEach(async () => {
    pid = await createTestPerson("空库测试人物");
  });

  afterEach(async () => {
    await db.persons.delete(pid);
  });

  it("空数据库查询返回空列表", async () => {
    const result = await LiuYaoList({ personId: pid }, { skipUI: true });
    expect(result.records).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("空数据库标签列表为空", async () => {
    const tags = await getAllLiuyaoTags(pid);
    expect(tags).toEqual([]);
  });
});
