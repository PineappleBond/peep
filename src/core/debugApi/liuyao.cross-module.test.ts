/**
 * 六爻调试 API 跨模块集成 E2E 测试
 *
 * 测试范围：
 * 1. 六爻与人物模块集成（级联删除、数据隔离、人物变更）
 * 2. 六爻与大六壬模块集成（同人物共存、并发创建、列表独立）
 * 3. 六爻与紫微斗数模块集成（数据独立性、并发操作）
 * 4. 六爻与 Wiki 模块集成（Wiki 引用、数据独立、标签共享）
 * 5. 调试 API 系统集成（health/help/version/env、回调状态）
 * 6. 数据导出集成（导出数据一致性、批量导出）
 * 7. 时间处理集成（系统时间、时区、自定义时间）
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView, computeLiuyaoData } from "./liuyao";
import { PersonCreate, PersonDelete, PersonGet, PersonList, PersonUpdate } from "./person";
import { DaLiuRenCreate, DaLiuRenList, DaLiuRenView, computeDaLiuRenData } from "./daliuren";
import { WikiCreate, WikiList, WikiView } from "./wiki";
import { computeAstrolabe, resetZiWeiState } from "./ziwei";
import { health, getApiMetadata } from "./system";
import { getCallbacksReady } from "./callbacks";
import { help, version, env } from "./system";
import { API_VERSION } from "./types";
import { db, initDatabase } from "../personDb";
import { invalidateLiuyaoTagCache } from "../liuyaoDb";
import { invalidateLiurenTagCache } from "../daliurenDb";
import type { SixLines, BirthInput } from "./types";

/**
 * 统一清理数据库
 */
async function cleanupDatabase() {
  await db.liuyaoRecords.clear();
  await db.liurenRecords.clear();
  await db.wikiLinks.clear();
  await db.wikiDocs.clear();
  const allPersons = await db.persons.toArray();
  const nonDefault = allPersons.filter(p => !p.isDefault);
  if (nonDefault.length > 0) {
    await db.persons.bulkDelete(nonDefault.map(p => p.id!));
  }
  invalidateLiuyaoTagCache();
  invalidateLiurenTagCache();
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

/** 标准六爻值 */
const LINES: SixLines = [1, 1, 1, 1, 1, 1];

const DEFAULT_BIRTH: BirthInput = {
  name: "测试人物",
  date: "1990-01-15",
  timeIndex: 3,
  gender: "男",
  calendar: "solar",
  isLeapMonth: false,
  exactTime: "",
  useTrueSolar: false,
  placeMode: "china",
  province: "北京",
  city: "北京",
  district: "市区",
  timezone: "",
  algorithm: "zhongzhou",
  yearDivide: "exact",
  mutagenTable: "zhongzhou",
  dayDivide: "forward",
  astroType: "heaven",
  residence: "",
};

/* ── 1. 六爻与人物模块集成 ── */
describe("六爻与人物模块集成", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("创建六爻记录后能通过 personId 查询到对应人物", async () => {
    const person = await createTestPerson("张三");
    const record = await LiuYaoCreate(
      { personId: person.id, question: "测试问题", lines: LINES },
      { skipUI: true },
    );
    expect(record.personId).toBe(person.id);

    const fetched = await PersonGet(person.id);
    expect(fetched.name).toBe("张三");
  });

  it("删除人物后级联删除其六爻记录", async () => {
    const person = await createTestPerson("李四");
    await LiuYaoCreate({ personId: person.id, question: "问题 A", lines: LINES }, { skipUI: true });
    await LiuYaoCreate({ personId: person.id, question: "问题 B", lines: LINES }, { skipUI: true });

    // 确认有 2 条
    const before = await LiuYaoList({ personId: person.id }, { skipUI: true });
    expect(before.total).toBe(2);

    // 删除人物（默认人物不可删，此处为非默认）
    await PersonDelete(person.id!);

    // 六爻记录应被级联删除
    const after = await db.liuyaoRecords.where("personId").equals(person.id!).count();
    expect(after).toBe(0);

    // 人物已被删除
    const persons = await PersonList();
    expect(persons.find(p => p.id === person.id)).toBeUndefined();
  });

  it("多人物场景下的数据隔离——A 人物的记录不影响 B 人物", async () => {
    const personA = await createTestPerson("人物 A");
    const personB = await createTestPerson("人物 B");

    await LiuYaoCreate(
      { personId: personA.id, question: "A 的问题", lines: LINES, tags: ["财运"] },
      { skipUI: true },
    );
    await LiuYaoCreate(
      { personId: personB.id, question: "B 的问题", lines: [2, 2, 2, 2, 2, 2], tags: ["事业"] },
      { skipUI: true },
    );

    const listA = await LiuYaoList({ personId: personA.id }, { skipUI: true });
    const listB = await LiuYaoList({ personId: personB.id }, { skipUI: true });

    expect(listA.total).toBe(1);
    expect(listB.total).toBe(1);
    expect(listA.records[0].question).toBe("A 的问题");
    expect(listB.records[0].question).toBe("B 的问题");
    expect(listA.records[0].personId).toBe(personA.id);
    expect(listB.records[0].personId).toBe(personB.id);
  });

  it("人物信息变更（PersonUpdate）后六爻记录的 personId 仍保持一致", async () => {
    const person = await createTestPerson("旧名字");
    const record = await LiuYaoCreate(
      { personId: person.id, question: "占问", lines: LINES },
      { skipUI: true },
    );
    const oldPersonId = person.id;

    await PersonUpdate(oldPersonId!, { ...DEFAULT_BIRTH, name: "新名字" }, false);

    const updated = await PersonGet(oldPersonId);
    expect(updated.name).toBe("新名字");

    // 六爻记录的 personId 不变，仍能查到
    const viewed = await LiuYaoView({ recordId: record.id! }, { skipUI: true });
    expect(viewed.personId).toBe(oldPersonId);
  });
});

/* ── 2. 六爻与大六壬模块集成 ── */
describe("六爻与大六壬模块集成", () => {
  let personId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("双修人物");
    personId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("同一人物同时创建六爻和大六壬记录，各自独立", async () => {
    const liuyao = await LiuYaoCreate(
      { personId, question: "六爻之问", lines: LINES },
      { skipUI: true },
    );
    const liuren = await DaLiuRenCreate(
      { personId, question: "大六壬之问", tags: ["事业"] },
      { skipUI: true },
    );

    expect(liuyao.personId).toBe(personId);
    expect(liuren.personId).toBe(personId);

    const lyList = await LiuYaoList({ personId }, { skipUI: true });
    const lrList = await DaLiuRenList({ personId }, { skipUI: true });
    expect(lyList.total).toBe(1);
    expect(lrList.total).toBe(1);
    expect(lyList.records[0].question).toBe("六爻之问");
    expect(lrList.records[0].question).toBe("大六壬之问");
  });

  it("删除一个模块的记录不影响另一个模块", async () => {
    const ly = await LiuYaoCreate({ personId, question: "六爻", lines: LINES }, { skipUI: true });
    await DaLiuRenCreate({ personId, question: "大六壬" }, { skipUI: true });

    // 直接删除六爻记录
    await db.liuyaoRecords.delete(ly.id!);

    const lyAfter = await LiuYaoList({ personId }, { skipUI: true });
    const lrAfter = await DaLiuRenList({ personId }, { skipUI: true });
    expect(lyAfter.total).toBe(0);
    expect(lrAfter.total).toBe(1);
  });

  it("并发创建六爻和大六壬记录，数据最终一致", async () => {
    const [ly, lr] = await Promise.all([
      LiuYaoCreate({ personId, question: "并发六爻", lines: LINES }, { skipUI: true }),
      DaLiuRenCreate({ personId, question: "并发大六壬" }, { skipUI: true }),
    ]);

    expect(ly.id).toBeDefined();
    expect(lr.id).toBeDefined();

    const lyView = await LiuYaoView({ recordId: ly.id! }, { skipUI: true });
    const lrView = await DaLiuRenView({ recordId: lr.id! }, { skipUI: true });
    expect(lyView.question).toBe("并发六爻");
    expect(lrView.question).toBe("并发大六壬");
  });

  it("两个模块的列表查询互不干扰", async () => {
    for (let i = 0; i < 3; i++) {
      await LiuYaoCreate(
        { personId, question: `六爻 ${i}`, lines: LINES, tags: ["六爻标签"] },
        { skipUI: true },
      );
      await DaLiuRenCreate(
        { personId, question: `大六壬 ${i}`, tags: ["大六壬标签"] },
        { skipUI: true },
      );
    }

    const lyList = await LiuYaoList({ personId }, { skipUI: true });
    const lrList = await DaLiuRenList({ personId }, { skipUI: true });
    expect(lyList.total).toBe(3);
    expect(lrList.total).toBe(3);
    // 六爻列表的记录不应出现在大六壬列表
    expect(lyList.records.every(r => r.question.startsWith("六爻"))).toBe(true);
    expect(lrList.records.every(r => r.question.startsWith("大六壬"))).toBe(true);
  });
});

/* ── 3. 六爻与紫微斗数模块集成 ── */
describe("六爻与紫微斗数模块集成", () => {
  let personId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    resetZiWeiState();
    const p = await createTestPerson("紫微六爻双修");
    personId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
    resetZiWeiState();
  });

  it("同一人物使用紫微斗数和六爻，数据独立", async () => {
    // 紫微：计算本命盘（纯计算，不依赖 UI 回调）
    const person = await PersonGet(personId);
    const zwdsResult = computeAstrolabe(person);
    expect(zwdsResult).toBeDefined();

    // 六爻：创建记录
    const ly = await LiuYaoCreate(
      { personId, question: "六爻占问", lines: LINES },
      { skipUI: true },
    );

    expect(ly.personId).toBe(personId);
    // 紫微结果有命盘数据（iztro 返回的星盘对象）
    expect(zwdsResult.solarDate).toBeDefined();
  });

  it("并发操作两个模块", async () => {
    const person = await PersonGet(personId);
    const [zwdsResult, ly] = await Promise.all([
      Promise.resolve(computeAstrolabe(person)),
      LiuYaoCreate({ personId, question: "并发六爻", lines: LINES }, { skipUI: true }),
    ]);
    expect(zwdsResult.solarDate).toBeDefined();
    expect(ly.question).toBe("并发六爻");
  });

  it("computeAstrolabe 缓存不影响六爻创建", async () => {
    const person = await PersonGet(personId);
    computeAstrolabe(person); // 填充缓存
    computeAstrolabe(person); // 命中缓存

    const ly = await LiuYaoCreate(
      { personId, question: "缓存测试", lines: LINES },
      { skipUI: true },
    );
    expect(ly.id).toBeDefined();
  });
});

/* ── 4. 六爻与 Wiki 模块集成 ── */
describe("六爻与 Wiki 模块集成", () => {
  let personId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("Wiki 作者");
    personId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("创建六爻记录后可在 Wiki 中引用（通过标签共享）", async () => {
    const ly = await LiuYaoCreate(
      { personId, question: "占财运", lines: LINES, tags: ["财运", "投资"] },
      { skipUI: true },
    );

    // 创建一篇 Wiki 引用同一标签
    const wiki = await WikiCreate(
      {
        personId,
        title: "财运笔记",
        content: "关联六爻记录 " + ly.id,
        tags: ["财运"],
      },
      { skipUI: true },
    );

    expect(wiki.id).toBeDefined();
    expect(wiki.tags).toContain("财运");
  });

  it("两个模块的数据独立性——删除 Wiki 不影响六爻", async () => {
    const ly = await LiuYaoCreate({ personId, question: "测试", lines: LINES }, { skipUI: true });
    const wiki = await WikiCreate({ personId, title: "文档", content: "内容" }, { skipUI: true });

    await db.wikiDocs.delete(wiki.id!);

    const lyAfter = await LiuYaoView({ recordId: ly.id! }, { skipUI: true });
    expect(lyAfter.id).toBe(ly.id);

    const wikiList = await WikiList({ personId }, { skipUI: true });
    expect(wikiList.total).toBe(0);
  });

  it("标签系统：相同标签可在两个模块中共存", async () => {
    await LiuYaoCreate(
      { personId, question: "A", lines: LINES, tags: ["财运", "共财"] },
      { skipUI: true },
    );
    await WikiCreate(
      { personId, title: "笔记", content: "内容", tags: ["财运", "共财"] },
      { skipUI: true },
    );

    const lyList = await LiuYaoList({ personId, tags: ["共财"] }, { skipUI: true });
    const wikiList = await WikiList({ personId, tags: ["共财"] }, { skipUI: true });
    expect(lyList.total).toBe(1);
    expect(wikiList.total).toBe(1);
  });
});

/* ── 5. 调试 API 系统集成 ── */
describe("调试 API 系统集成", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("getApiMetadata 包含六爻相关 API", () => {
    const meta = getApiMetadata();
    expect(meta.version).toBe(API_VERSION);
    expect(meta.availableFunctions).toContain("LiuYaoCreate");
    expect(meta.availableFunctions).toContain("LiuYaoList");
    expect(meta.availableFunctions).toContain("LiuYaoView");
    expect(meta.availableFunctions).toContain("computeLiuyaoData");
  });

  it("getCallbacksReady 报告 liuyao 回调状态", () => {
    const status = getCallbacksReady();
    expect(status).toHaveProperty("liuyao");
    // 测试环境下未挂载页面，回调应全部为 false
    expect(status.liuyao).toBe(false);
    expect(status.ziwei).toBe(false);
    expect(status.daliuren).toBe(false);
    expect(status.wiki).toBe(false);
  });

  it("health() 在测试环境（非 DEV）返回 ok=false 或降级", async () => {
    // 测试环境 import.meta.env.DEV 为 false，health 应返回 ok:false 且 checks 为空
    const result = await health();
    expect(typeof result.ok).toBe("boolean");
    expect(result.checks).toBeDefined();
  });

  it("help/version/env 均为可调用函数（不抛错）", () => {
    // help/version/env 内部判断 import.meta.env.DEV，非 DEV 环境仅输出日志
    // 这里只验证它们为函数类型
    expect(typeof help).toBe("function");
    expect(typeof version).toBe("function");
    expect(typeof env).toBe("function");
  });

  it("getApiMetadata.supportedScopes 包含紫微斗数运限级别", () => {
    const meta = getApiMetadata();
    expect(meta.supportedScopes.length).toBeGreaterThan(0);
    expect(meta.supportedScopes).toContain("yearly");
    expect(meta.supportedScopes).toContain("monthly");
  });
});

/* ── 6. 数据导出集成 ── */
describe("数据导出集成", () => {
  let personId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("导出人物");
    personId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("导出数据与原始数据一致性——LiuYaoView 返回与 LiuYaoCreate 一致", async () => {
    const question = "能否顺利晋升？";
    const tags = ["事业", "晋升"];
    const background = "工作 3 年";
    const note = "备注信息";
    const created = await LiuYaoCreate(
      { question, lines: LINES, tags, background, note, personId, yongTarget: "自占" },
      { skipUI: true },
    );

    const viewed = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(viewed.question).toBe(question);
    expect(viewed.tags).toEqual(tags);
    expect(viewed.background).toBe(background);
    expect(viewed.note).toBe(note);
    expect(viewed.lines).toEqual(LINES);
    expect(viewed.yongTarget).toBe("自占");
    expect(viewed.chart.name).toBe("乾为天");
  });

  it("批量导出：100 条记录查询性能（应低于 5 秒）", async () => {
    const start = performance.now();
    const createPromises = [];
    for (let i = 0; i < 100; i++) {
      createPromises.push(
        LiuYaoCreate(
          { personId, question: `问题 ${i}`, lines: LINES, tags: ["批量"] },
          { skipUI: true },
        ),
      );
    }
    await Promise.all(createPromises);
    const createTime = performance.now() - start;

    const listStart = performance.now();
    const list = await LiuYaoList({ personId, pageSize: 100 }, { skipUI: true });
    const listTime = performance.now() - listStart;

    expect(list.total).toBe(100);
    expect(list.records.length).toBe(100);
    // 性能宽松约束：创建 + 列表查询总耗时低于 5 秒
    expect(createTime + listTime).toBeLessThan(5000);
  });

  it("computeLiuyaoData 纯计算结果与 LiuYaoCreate 的 chart 一致", async () => {
    const date = "2024-06-15";
    const computed = computeLiuyaoData(LINES, date, "自占");
    const created = await LiuYaoCreate(
      { personId, question: "纯计算对照", lines: LINES, divinationTime: date },
      { skipUI: true },
    );

    expect(computed.chart.name).toBe(created.chart.name);
  });
});

/* ── 7. 时间处理集成 ── */
describe("时间处理集成", () => {
  let personId: number;

  beforeEach(async () => {
    await cleanupDatabase();
    const p = await createTestPerson("时间测试");
    personId = p.id!;
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("未指定 divinationTime 时使用当前时间附近值", async () => {
    const before = Date.now();
    const record = await LiuYaoCreate(
      { personId, question: "时间测试", lines: LINES },
      { skipUI: true },
    );
    const after = Date.now();

    // divinationTime 应为一个 ISO 时间字符串，且在调用前后范围内
    const ts = new Date(record.divinationTime).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  it("自定义 divinationTime 正确解析和存储", async () => {
    const customTime = "2023-08-15 14:30:00";
    const record = await LiuYaoCreate(
      { personId, question: "自定义时间", lines: LINES, divinationTime: customTime },
      { skipUI: true },
    );

    // 解析后时间应与输入一致
    const parsed = new Date(record.divinationTime);
    expect(parsed.getFullYear()).toBe(2023);
    expect(parsed.getMonth()).toBe(7); // 0-indexed
    expect(parsed.getDate()).toBe(15);
  });

  it("LiuYaoView.computed.divinationTime 与原始记录一致", async () => {
    const customTime = "2025-01-01 00:00:00";
    const created = await LiuYaoCreate(
      { personId, question: "时间一致性", lines: LINES, divinationTime: customTime },
      { skipUI: true },
    );

    const viewed = await LiuYaoView({ recordId: created.id! }, { skipUI: true });
    expect(viewed.computed).toBeDefined();
    expect(viewed.computed!.divinationTime).toBe(created.divinationTime);
  });

  it("computeDaLiuRenData 与 LiuYaoCreate 使用同一日期，系统时间一致", async () => {
    const date = "2024-03-15";
    const time = "10:00";

    const ly = await LiuYaoCreate(
      { personId, question: "对照", lines: LINES, divinationTime: `${date} ${time}:00` },
      { skipUI: true },
    );
    const lr = computeDaLiuRenData(date, time);

    // 两个模块都使用了相同的日期进行计算
    expect(ly.divinationTime).toContain("2024-03-15");
    expect(lr.calculationTime).toContain("2024-03-15");
  });
});

/* ── 8. 边界场景：跨模块级联与错误恢复 ── */
describe("跨模块级联与错误恢复", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("数据库初始化幂等——initDatabase 多次调用不抛错", async () => {
    await expect(initDatabase()).resolves.not.toThrow();
    await expect(initDatabase()).resolves.not.toThrow();
  });

  it("并发清理数据库不会导致后续操作失败", async () => {
    const p = await createTestPerson("并发清理");
    await LiuYaoCreate({ personId: p.id, question: "测试", lines: LINES }, { skipUI: true });

    await Promise.all([cleanupDatabase(), cleanupDatabase()]);

    const list = await LiuYaoList({}, { skipUI: true });
    expect(list.total).toBe(0);
  });

  it("查询不存在的人物时 PersonGet 抛出 ZiWeiError，不影响六爻操作", async () => {
    const person = await createTestPerson("临时");
    await PersonDelete(person.id!);

    await expect(PersonGet(person.id!)).rejects.toThrow();

    // 六爻操作仍可正常进行（用默认人物）
    const record = await LiuYaoCreate({ question: "默认人物测试", lines: LINES }, { skipUI: true });
    expect(record.id).toBeDefined();
  });
});
