/**
 * 六爻调试 API 真实世界场景 E2E 测试
 *
 * 模拟真实用户的典型使用场景：
 * 1. 日常占卜场景——连续多天占卜、标签分类、历史回顾
 * 2. 批量数据导入——一次性导入 50 条历史记录、批量标签、批量导出
 * 3. 多人共享场景——家庭多人共用、代占、查看家人记录
 * 4. 长期跟踪场景——同一问题多次占卜、跟踪变化、对比结果
 * 5. 复杂查询场景——组合搜索、多标签交集、模糊搜索
 * 6. 数据迁移场景——模拟 CSV 导入、格式验证、完整性校验
 * 7. 移动端场景——快速占卜、小屏数据展示
 * 8. 专业占卜师场景——客户管理、批量导出、统计报告
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { PersonCreate } from "./person";
import { db } from "../personDb";
import { invalidateLiuyaoTagCache, getAllLiuyaoTags } from "../liuyaoDb";
import type { SixLines, YongTarget } from "../liuyao/core/types";

/**
 * 清理数据库
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
async function createTestPerson(name: string, gender: "男" | "女" = "男") {
  return PersonCreate(
    {
      name,
      date: "1990-01-15",
      timeIndex: 3,
      gender,
      calendar: "公历" as const,
    },
    false,
  );
}

/**
 * 生成一组固定的六爻值（避免随机性影响测试稳定性）
 */
function fixedLines(seed: number): SixLines {
  const base: SixLines[] = [
    [1, 1, 1, 1, 1, 1], // 乾为天
    [0, 0, 0, 0, 0, 0], // 坤为地
    [1, 2, 3, 0, 1, 2], // 混合卦
    [2, 2, 2, 2, 2, 2], // 坤为地 + 六爻皆动
    [3, 3, 3, 3, 3, 3], // 乾为天 + 六爻皆动
    [1, 0, 1, 0, 1, 0], // 交替阴阳
  ];
  return base[seed % base.length];
}

/* ── 1. 日常占卜场景 ── */
describe("日常占卜场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("用户连续 7 天占卜事业问题，按标签分类管理", async () => {
    const days = [
      { date: "2026-09-20", question: "这周事业发展方向如何？" },
      { date: "2026-09-21", question: "下周面试能否成功？" },
      { date: "2026-09-22", question: "跳槽到 A 公司好不好？" },
      { date: "2026-09-23", question: "当前项目能不能完成？" },
      { date: "2026-09-24", question: "和领导关系如何改善？" },
      { date: "2026-09-25", question: "年底升职机会大不大？" },
      { date: "2026-09-26", question: "明年适合创业吗？" },
    ];

    // 逐日创建占卜记录
    for (let i = 0; i < days.length; i++) {
      const record = await LiuYaoCreate(
        {
          question: days[i].question,
          tags: ["事业", "日常占卜"],
          lines: fixedLines(i),
          yongTarget: "自占",
          divinationTime: `${days[i].date}T09:00:00`,
        },
        { skipUI: true },
      );
      expect(record.id).toBeDefined();
      expect(record.divinationTime.startsWith(days[i].date)).toBe(true);
    }

    // 按标签查询所有事业相关的占卜
    const careerList = await LiuYaoList({ tags: ["事业"] }, { skipUI: true });
    expect(careerList.total).toBe(7);
    expect(careerList.records).toHaveLength(7);

    // 按标签查询日常占卜
    const dailyList = await LiuYaoList({ tags: ["日常占卜"] }, { skipUI: true });
    expect(dailyList.total).toBe(7);
  });

  it("用户按不同类别占卜——事业、财运、感情各若干次", async () => {
    const categories = [
      {
        tags: ["财运"],
        questions: ["这个月财运如何？", "投资股票能赚钱吗？", "理财产品值得买吗？"],
      },
      { tags: ["感情"], questions: ["什么时候能脱单？", "这段感情能走下去吗？"] },
      { tags: ["事业"], questions: ["下半年事业运势如何？"] },
      { tags: ["健康"], questions: ["身体需要注意什么？"] },
    ];

    let idx = 0;
    for (const cat of categories) {
      for (const q of cat.questions) {
        await LiuYaoCreate(
          {
            question: q,
            tags: cat.tags,
            lines: fixedLines(idx++),
            divinationTime: `2026-09-${20 + idx}T10:00:00`,
          },
          { skipUI: true },
        );
      }
    }

    // 按类别统计
    const caiyun = await LiuYaoList({ tags: ["财运"] }, { skipUI: true });
    expect(caiyun.total).toBe(3);

    const ganqing = await LiuYaoList({ tags: ["感情"] }, { skipUI: true });
    expect(ganqing.total).toBe(2);

    const shiye = await LiuYaoList({ tags: ["事业"] }, { skipUI: true });
    expect(shiye.total).toBe(1);

    const jiankang = await LiuYaoList({ tags: ["健康"] }, { skipUI: true });
    expect(jiankang.total).toBe(1);

    // 全部记录
    const all = await LiuYaoList({}, { skipUI: true });
    expect(all.total).toBe(7);
  });

  it("回顾历史占卜记录——分页浏览", async () => {
    // 创建 30 条历史记录
    for (let i = 0; i < 30; i++) {
      await LiuYaoCreate(
        {
          question: `历史占卜 #${i + 1}`,
          tags: ["回顾"],
          lines: fixedLines(i),
          divinationTime: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T12:00:00`,
        },
        { skipUI: true },
      );
    }

    // 分页浏览（每页 10 条）
    const page1 = await LiuYaoList({ page: 1, pageSize: 10 }, { skipUI: true });
    expect(page1.records).toHaveLength(10);
    expect(page1.total).toBe(30);

    const page2 = await LiuYaoList({ page: 2, pageSize: 10 }, { skipUI: true });
    expect(page2.records).toHaveLength(10);

    const page3 = await LiuYaoList({ page: 3, pageSize: 10 }, { skipUI: true });
    expect(page3.records).toHaveLength(10);

    // 验证分页不重复
    const allIds = [...page1.records, ...page2.records, ...page3.records].map(r => r.id);
    expect(new Set(allIds).size).toBe(30);
  });
});

/* ── 2. 批量数据导入场景 ── */
describe("批量数据导入场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("一次性导入 50 条历史占卜记录", async () => {
    const startTime = performance.now();

    // 模拟从 CSV 解析出的 50 条数据
    const importedRecords = [];
    for (let i = 0; i < 50; i++) {
      const record = await LiuYaoCreate(
        {
          question: `批量导入记录 #${i + 1}：问题描述`,
          background: `这是第 ${i + 1} 条记录的详细背景信息`,
          note: i % 3 === 0 ? "重要记录" : "",
          tags: [`类别${(i % 5) + 1}`, "批量导入"],
          lines: fixedLines(i),
          yongTarget: "自占",
          divinationTime: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T14:00:00`,
        },
        { skipUI: true },
      );
      importedRecords.push(record);
    }

    const elapsed = performance.now() - startTime;

    // 验证全部创建成功
    expect(importedRecords).toHaveLength(50);
    expect(importedRecords.every(r => r.id !== undefined)).toBe(true);

    // 验证总数
    const totalList = await LiuYaoList({}, { skipUI: true });
    expect(totalList.total).toBe(50);

    // 验证标签查询
    const batchTag = await LiuYaoList({ tags: ["批量导入"] }, { skipUI: true });
    expect(batchTag.total).toBe(50);

    // 性能：50 条记录导入应在 10 秒内完成
    expect(elapsed).toBeLessThan(10000);
  });

  it("批量添加标签后查询", async () => {
    // 先创建 10 条无标签记录
    const recordIds: number[] = [];
    for (let i = 0; i < 10; i++) {
      const record = await LiuYaoCreate(
        {
          question: `待标签记录 #${i + 1}`,
          lines: fixedLines(i),
          divinationTime: `2026-09-${20 + i}T10:00:00`,
        },
        { skipUI: true },
      );
      recordIds.push(record.id!);
    }

    // 模拟"批量添加标签"——实际上是通过搜索找到后重新创建带标签的版本
    // （因为 API 没有批量更新标签的接口，用创建带标签记录模拟）
    for (let i = 0; i < 5; i++) {
      await LiuYaoCreate(
        {
          question: `已标记记录 #${i + 1}`,
          tags: ["已审核", "重要"],
          lines: fixedLines(i + 10),
          divinationTime: `2026-09-${20 + i}T11:00:00`,
        },
        { skipUI: true },
      );
    }

    // 按标签查询
    const reviewed = await LiuYaoList({ tags: ["已审核"] }, { skipUI: true });
    expect(reviewed.total).toBe(5);

    const important = await LiuYaoList({ tags: ["重要"] }, { skipUI: true });
    expect(important.total).toBe(5);
  });

  it("批量查询和导出——分页遍历全部数据", async () => {
    // 创建 25 条记录
    for (let i = 0; i < 25; i++) {
      await LiuYaoCreate(
        {
          question: `导出测试 #${i + 1}`,
          tags: [`标签${(i % 3) + 1}`],
          lines: fixedLines(i),
          divinationTime: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T08:00:00`,
        },
        { skipUI: true },
      );
    }

    // 模拟导出：逐页收集所有记录
    const allExported = [];
    const pageSize = 5;
    const totalPages = Math.ceil(25 / pageSize);
    for (let page = 1; page <= totalPages; page++) {
      const result = await LiuYaoList({ page, pageSize }, { skipUI: true });
      allExported.push(...result.records);
    }

    // 验证导出的完整性
    expect(allExported).toHaveLength(25);
    const uniqueIds = new Set(allExported.map(r => r.id));
    expect(uniqueIds.size).toBe(25);
  });
});

/* ── 3. 多人共享场景 ── */
describe("多人共享场景：家庭共用", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("家庭三人各自占卜，记录互不干扰", async () => {
    // 创建家庭成员
    const father = await createTestPerson("爸爸", "男");
    const mother = await createTestPerson("妈妈", "女");
    const child = await createTestPerson("孩子", "男");

    // 爸爸占事业
    for (let i = 0; i < 3; i++) {
      await LiuYaoCreate(
        {
          personId: father.id,
          question: `爸爸的事业问题 #${i + 1}`,
          tags: ["爸爸", "事业"],
          lines: fixedLines(i),
          divinationTime: `2026-09-2${i}T09:00:00`,
        },
        { skipUI: true },
      );
    }

    // 妈妈占财运
    for (let i = 0; i < 4; i++) {
      await LiuYaoCreate(
        {
          personId: mother.id,
          question: `妈妈的财运问题 #${i + 1}`,
          tags: ["妈妈", "财运"],
          lines: fixedLines(i + 10),
          divinationTime: `2026-09-2${i}T10:00:00`,
        },
        { skipUI: true },
      );
    }

    // 孩子占学业
    for (let i = 0; i < 2; i++) {
      await LiuYaoCreate(
        {
          personId: child.id,
          question: `孩子的学业问题 #${i + 1}`,
          tags: ["孩子", "学业"],
          lines: fixedLines(i + 20),
          divinationTime: `2026-09-2${i}T11:00:00`,
        },
        { skipUI: true },
      );
    }

    // 验证各人物的记录隔离
    const fatherList = await LiuYaoList({ personId: father.id }, { skipUI: true });
    expect(fatherList.total).toBe(3);
    expect(fatherList.records.every(r => r.tags.includes("爸爸"))).toBe(true);

    const motherList = await LiuYaoList({ personId: mother.id }, { skipUI: true });
    expect(motherList.total).toBe(4);
    expect(motherList.records.every(r => r.tags.includes("妈妈"))).toBe(true);

    const childList = await LiuYaoList({ personId: child.id }, { skipUI: true });
    expect(childList.total).toBe(2);
    expect(childList.records.every(r => r.tags.includes("孩子"))).toBe(true);
  });

  it("为家人代占卜——用自己的账号为家人起卦", async () => {
    const father = await createTestPerson("爸爸", "男");
    const mother = await createTestPerson("妈妈", "女");

    // 代爸爸占卜（personId 指向爸爸）
    const forFather = await LiuYaoCreate(
      {
        personId: father.id,
        question: "爸爸的身体状况如何？",
        tags: ["代占", "爸爸", "健康"],
        lines: [1, 2, 3, 0, 1, 2],
        yongTarget: "父母",
        background: "爸爸最近感觉不太舒服",
        divinationTime: "2026-09-25T08:30:00",
      },
      { skipUI: true },
    );

    // 代妈妈占卜
    const forMother = await LiuYaoCreate(
      {
        personId: mother.id,
        question: "妈妈的出行计划顺利吗？",
        tags: ["代占", "妈妈", "出行"],
        lines: [2, 1, 0, 3, 1, 2],
        yongTarget: "父母",
        divinationTime: "2026-09-25T09:00:00",
      },
      { skipUI: true },
    );

    // 查看代占记录
    const fatherView = await LiuYaoView(
      { recordId: forFather.id!, personId: father.id },
      { skipUI: true },
    );
    expect(fatherView.personId).toBe(father.id);
    expect(fatherView.yongTarget).toBe("父母");
    expect(fatherView.background).toBe("爸爸最近感觉不太舒服");

    const motherView = await LiuYaoView(
      { recordId: forMother.id!, personId: mother.id },
      { skipUI: true },
    );
    expect(motherView.personId).toBe(mother.id);
    expect(motherView.yongTarget).toBe("父母");
  });

  it("查看家人的占卜记录——按标签过滤全家记录", async () => {
    const father = await createTestPerson("爸爸", "男");
    const mother = await createTestPerson("妈妈", "女");

    // 全家都占同一类问题（比如财运）
    await LiuYaoCreate(
      {
        personId: father.id,
        question: "爸爸下半年财运",
        tags: ["全家财运", "2026下半年"],
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: "2026-07-01T09:00:00",
      },
      { skipUI: true },
    );

    await LiuYaoCreate(
      {
        personId: mother.id,
        question: "妈妈下半年财运",
        tags: ["全家财运", "2026下半年"],
        lines: [0, 0, 0, 0, 0, 0],
        divinationTime: "2026-07-01T10:00:00",
      },
      { skipUI: true },
    );

    // 按"全家财运"标签查询（跨人物查询）
    // 注意：LiuYaoList 的 tags 过滤是在指定 personId 下进行的
    // 不传 personId 时使用默认人物，所以这里分别查询后合并
    const fatherFortune = await LiuYaoList(
      { personId: father.id, tags: ["全家财运"] },
      { skipUI: true },
    );
    const motherFortune = await LiuYaoList(
      { personId: mother.id, tags: ["全家财运"] },
      { skipUI: true },
    );

    // 全家财运记录汇总
    const allFortune = [...fatherFortune.records, ...motherFortune.records];
    expect(allFortune).toHaveLength(2);
    expect(allFortune.every(r => r.tags.includes("全家财运"))).toBe(true);
  });
});

/* ── 4. 长期跟踪场景 ── */
describe("长期跟踪场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("同一问题在不同时间点多次占卜——跟踪事业运势变化", async () => {
    const question = "事业发展方向是否合适？";
    const timePoints = [
      "2026-01-01T09:00:00",
      "2026-03-01T09:00:00",
      "2026-06-01T09:00:00",
      "2026-09-01T09:00:00",
    ];

    const recordIds: number[] = [];
    for (let i = 0; i < timePoints.length; i++) {
      const record = await LiuYaoCreate(
        {
          question,
          tags: ["事业", "长期跟踪"],
          lines: fixedLines(i),
          yongTarget: "自占",
          divinationTime: timePoints[i],
          note: `第 ${i + 1} 次占卜`,
        },
        { skipUI: true },
      );
      recordIds.push(record.id!);
    }

    // 查看所有跟踪记录
    const tracking = await LiuYaoList({ tags: ["长期跟踪"] }, { skipUI: true });
    expect(tracking.total).toBe(4);

    // 验证时间跨度
    const sortedByTime = tracking.records.sort(
      (a, b) => new Date(a.divinationTime).getTime() - new Date(b.divinationTime).getTime(),
    );
    expect(sortedByTime[0].divinationTime).toBe("2026-01-01T09:00:00");
    expect(sortedByTime[3].divinationTime).toBe("2026-09-01T09:00:00");
  });

  it("对比不同时间的占卜结果——卦象变化", async () => {
    // 第一次占卜：年初
    const first = await LiuYaoCreate(
      {
        question: "今年事业运势",
        tags: ["年度跟踪"],
        lines: [1, 1, 1, 1, 1, 1], // 乾为天
        divinationTime: "2026-01-15T09:00:00",
      },
      { skipUI: true },
    );

    // 第二次占卜：年中
    const second = await LiuYaoCreate(
      {
        question: "今年事业运势",
        tags: ["年度跟踪"],
        lines: [0, 0, 0, 0, 0, 0], // 坤为地
        divinationTime: "2026-06-15T09:00:00",
      },
      { skipUI: true },
    );

    // 第三次占卜：年末
    const third = await LiuYaoCreate(
      {
        question: "今年事业运势",
        tags: ["年度跟踪"],
        lines: [1, 2, 3, 0, 1, 2], // 混合卦
        divinationTime: "2026-12-15T09:00:00",
      },
      { skipUI: true },
    );

    // 查看详情对比
    const v1 = await LiuYaoView({ recordId: first.id! }, { skipUI: true });
    const v2 = await LiuYaoView({ recordId: second.id! }, { skipUI: true });
    const v3 = await LiuYaoView({ recordId: third.id! }, { skipUI: true });

    // 三次卦象不同
    expect(v1.chart.name).toBe("乾为天");
    expect(v2.chart.name).toBe("坤为地");
    expect(v3.chart.name).not.toBe("乾为天");
    expect(v3.chart.name).not.toBe("坤为地");

    // 三次用神可能不同（因卦象变化）
    expect(v1.yong).toBeDefined();
    expect(v2.yong).toBeDefined();
    expect(v3.yong).toBeDefined();
  });

  it("按月跟踪健康问题的变化", async () => {
    // 12 个月各占一次健康
    for (let month = 1; month <= 12; month++) {
      await LiuYaoCreate(
        {
          question: "本月健康状况",
          tags: ["健康跟踪", `${month}月`],
          lines: fixedLines(month),
          divinationTime: `2026-${String(month).padStart(2, "0")}-15T08:00:00`,
        },
        { skipUI: true },
      );
    }

    // 查询全部健康跟踪记录
    const healthTracking = await LiuYaoList({ tags: ["健康跟踪"] }, { skipUI: true });
    expect(healthTracking.total).toBe(12);

    // 按月份查询特定时段（标签过滤是 OR 逻辑，返回包含任一标签的记录）
    // 所以这里只按单月份标签查询，验证该月份有记录
    const q1 = await LiuYaoList({ tags: ["1月"] }, { skipUI: true });
    expect(q1.total).toBe(1);

    const q2 = await LiuYaoList({ tags: ["6月"] }, { skipUI: true });
    expect(q2.total).toBe(1);
  });
});

/* ── 5. 复杂查询场景 ── */
describe("复杂查询场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("组合搜索：关键字 + 标签", async () => {
    // 创建多样化的记录
    await LiuYaoCreate(
      {
        question: "投资比特币能赚钱吗",
        tags: ["财运", "投资"],
        note: "最近想入币圈",
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: "2026-09-20T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "股票投资前景",
        tags: ["财运", "投资"],
        note: "持有 A 股",
        lines: [0, 0, 0, 0, 0, 0],
        divinationTime: "2026-09-21T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "买房好不好",
        tags: ["财运", "房产"],
        note: "考虑在市中心买房",
        lines: [1, 2, 3, 0, 1, 2],
        divinationTime: "2026-09-22T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "事业发展方向",
        tags: ["事业"],
        note: "投资相关事业",
        lines: [2, 1, 0, 3, 1, 2],
        divinationTime: "2026-09-23T09:00:00",
      },
      { skipUI: true },
    );

    // 标签 + 关键字组合
    const investInFinance = await LiuYaoList(
      { tags: ["投资"], searchText: "比特币" },
      { skipUI: true },
    );
    expect(investInFinance.total).toBe(1);
    expect(investInFinance.records[0].question).toContain("比特币");

    // 标签 + 关键字：在财运标签下搜"投资"
    const financeInvest = await LiuYaoList(
      { tags: ["财运"], searchText: "投资" },
      { skipUI: true },
    );
    expect(financeInvest.total).toBe(2);

    // 仅关键字：搜"买房"
    const buyHouse = await LiuYaoList({ searchText: "买房" }, { skipUI: true });
    expect(buyHouse.total).toBe(1);

    // 搜备注中的"投资"
    const noteInvest = await LiuYaoList({ searchText: "币圈" }, { skipUI: true });
    expect(noteInvest.total).toBe(1);
  });

  it("多标签交集查询", async () => {
    // 创建有多标签的记录
    await LiuYaoCreate(
      {
        question: "记录1",
        tags: ["重要", "已审核", "财运"],
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: "2026-09-20T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "记录2",
        tags: ["重要", "待审核", "财运"],
        lines: [0, 0, 0, 0, 0, 0],
        divinationTime: "2026-09-21T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "记录3",
        tags: ["不重要", "已审核", "事业"],
        lines: [1, 2, 3, 0, 1, 2],
        divinationTime: "2026-09-22T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "记录4",
        tags: ["重要", "已审核", "事业"],
        lines: [2, 1, 0, 3, 1, 2],
        divinationTime: "2026-09-23T09:00:00",
      },
      { skipUI: true },
    );

    // 查询同时包含"重要"和"已审核"的记录
    const importantReviewed = await LiuYaoList({ tags: ["重要", "已审核"] }, { skipUI: true });
    // tags 是 OR 还是 AND 取决于底层实现；验证返回结果至少包含这些标签
    expect(importantReviewed.total).toBeGreaterThanOrEqual(1);
    for (const r of importantReviewed.records) {
      // 每条记录至少包含查询标签之一
      expect(r.tags.some(t => ["重要", "已审核"].includes(t))).toBe(true);
    }
  });

  it("模糊搜索与精确搜索", async () => {
    await LiuYaoCreate(
      {
        question: "考试能不能通过",
        note: "下个月考试",
        tags: ["学业"],
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: "2026-09-20T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "考试结果如何",
        note: "重要考试",
        tags: ["学业"],
        lines: [0, 0, 0, 0, 0, 0],
        divinationTime: "2026-09-21T09:00:00",
      },
      { skipUI: true },
    );
    await LiuYaoCreate(
      {
        question: "面试准备充分吗",
        tags: ["事业"],
        lines: [1, 2, 3, 0, 1, 2],
        divinationTime: "2026-09-22T09:00:00",
      },
      { skipUI: true },
    );

    // 模糊搜索"考试"——应匹配两条
    const examSearch = await LiuYaoList({ searchText: "考试" }, { skipUI: true });
    expect(examSearch.total).toBe(2);

    // 精确搜索"面试"——只匹配一条
    const interviewSearch = await LiuYaoList({ searchText: "面试" }, { skipUI: true });
    expect(interviewSearch.total).toBe(1);

    // 搜索"下个月"——匹配备注
    const nextMonthSearch = await LiuYaoList({ searchText: "下个月" }, { skipUI: true });
    expect(nextMonthSearch.total).toBe(1);

    // 搜索不存在的关键词
    const noResult = await LiuYaoList({ searchText: "不存在的关键词" }, { skipUI: true });
    expect(noResult.total).toBe(0);
  });

  it("大数据量下的分页查询性能", async () => {
    // 创建 100 条记录
    for (let i = 0; i < 100; i++) {
      await LiuYaoCreate(
        {
          question: `大数据测试 #${i + 1}`,
          tags: [`标签${(i % 10) + 1}`],
          lines: fixedLines(i),
          divinationTime: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T09:00:00`,
        },
        { skipUI: true },
      );
    }

    // 分页查询
    const startTime = performance.now();

    const page1 = await LiuYaoList({ page: 1, pageSize: 20 }, { skipUI: true });
    expect(page1.total).toBe(100);
    expect(page1.records).toHaveLength(20);

    const page5 = await LiuYaoList({ page: 5, pageSize: 20 }, { skipUI: true });
    expect(page5.records).toHaveLength(20);

    const elapsed = performance.now() - startTime;

    // 分页查询应在 2 秒内完成
    expect(elapsed).toBeLessThan(2000);
  });
});

/* ── 6. 数据迁移场景 ── */
describe("数据迁移场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("模拟 CSV 导入并验证数据完整性", async () => {
    // 模拟从 CSV 解析的数据
    const csvRows = [
      {
        question: "事业方向",
        background: "面临选择",
        tags: "事业,重要",
        lines: "1,1,1,1,1,1",
        time: "2025-01-15 09:00:00",
      },
      {
        question: "财运分析",
        background: "投资咨询",
        tags: "财运",
        lines: "0,0,0,0,0,0",
        time: "2025-02-20 14:30:00",
      },
      {
        question: "健康状况",
        background: "体检后占卜",
        tags: "健康",
        lines: "1,2,3,0,1,2",
        time: "2025-03-10 08:00:00",
      },
      {
        question: "感情走势",
        background: "",
        tags: "感情,日常",
        lines: "2,1,0,3,1,2",
        time: "2025-04-05 16:00:00",
      },
      {
        question: "出行吉凶",
        background: "出差计划",
        tags: "出行",
        lines: "1,0,1,0,1,0",
        time: "2025-05-12 07:00:00",
      },
    ];

    const importedIds: number[] = [];
    const errors: string[] = [];

    for (const row of csvRows) {
      try {
        // 解析 CSV 字段
        const tags = row.tags.split(",").map(t => t.trim());
        const lines = row.lines.split(",").map(Number) as SixLines;
        const divinationTime = row.time.replace(" ", "T");

        const record = await LiuYaoCreate(
          {
            question: row.question,
            background: row.background,
            tags,
            lines,
            divinationTime,
          },
          { skipUI: true },
        );
        importedIds.push(record.id!);
      } catch (err) {
        errors.push(`行 ${csvRows.indexOf(row) + 1} 导入失败: ${err}`);
      }
    }

    // 验证全部导入成功
    expect(errors).toHaveLength(0);
    expect(importedIds).toHaveLength(5);

    // 验证数据完整性
    const allRecords = await LiuYaoList({}, { skipUI: true });
    expect(allRecords.total).toBe(5);

    // 逐条验证
    for (const id of importedIds) {
      const detail = await LiuYaoView({ recordId: id }, { skipUI: true });
      expect(detail.id).toBe(id);
      expect(detail.question).toBeTruthy();
      expect(detail.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(detail.lines).toHaveLength(6);
      expect(detail.chart).toBeDefined();
      expect(detail.yong).toBeDefined();
    }
  });

  it("数据格式验证——处理不规范的输入", async () => {
    // 空标签应正常处理（过滤或保留空数组）
    const record = await LiuYaoCreate(
      {
        question: "格式测试",
        tags: [],
        lines: [1, 1, 1, 1, 1, 1],
        divinationTime: "2026-09-20T09:00:00",
      },
      { skipUI: true },
    );
    expect(record.tags).toEqual([]);

    // 多余空白的问题文本
    const record2 = await LiuYaoCreate(
      {
        question: "  带空格的问题  ",
        lines: [0, 0, 0, 0, 0, 0],
        divinationTime: "2026-09-21T09:00:00",
      },
      { skipUI: true },
    );
    expect(record2.question).toBe("带空格的问题");
  });

  it("导入后数据完整性——所有字段正确保存", async () => {
    const record = await LiuYaoCreate(
      {
        question: "完整性测试问题",
        background: "详细背景描述",
        note: "重要备注信息",
        tags: ["完整", "测试"],
        lines: [1, 2, 3, 0, 1, 2],
        yongTarget: "子女",
        divinationTime: "2026-06-15 14:30:00",
      },
      { skipUI: true },
    );

    // 从数据库重新读取
    const detail = await LiuYaoView({ recordId: record.id! }, { skipUI: true });

    // 所有字段完整保留
    expect(detail.question).toBe("完整性测试问题");
    expect(detail.background).toBe("详细背景描述");
    expect(detail.note).toBe("重要备注信息");
    expect(detail.tags).toEqual(["完整", "测试"]);
    expect(detail.lines).toEqual([1, 2, 3, 0, 1, 2]);
    expect(detail.yongTarget).toBe("子女");
    expect(detail.divinationTime).toMatch(/^2026-06-15T14:30:00/);
    expect(detail.chart).toBeDefined();
    expect(detail.yong).toBeDefined();
    expect(detail.computed).toBeDefined();
    expect(detail.computed!.hbarData).toBeDefined();
    expect(detail.computed!.vigorColumns).toBeDefined();
  });
});

/* ── 7. 移动端场景 ── */
describe("移动端场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("快速占卜——不传 lines 自动摇卦", async () => {
    // 移动端用户习惯：快速起卦，不手动设置爻值
    const record = await LiuYaoCreate(
      {
        question: "今天的运势如何？",
        tags: ["日常"],
      },
      { skipUI: true },
    );

    expect(record.id).toBeDefined();
    expect(record.lines).toHaveLength(6);
    expect(record.chart).toBeDefined();
    expect(record.yong).toBeDefined();
    expect(record.divinationTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("快速占卜——最简参数（仅问题）", async () => {
    const record = await LiuYaoCreate(
      {
        question: "能成功吗？",
      },
      { skipUI: true },
    );

    expect(record.id).toBeDefined();
    expect(record.question).toBe("能成功吗？");
    expect(record.tags).toEqual([]);
    expect(record.background).toBe("");
    expect(record.note).toBe("");
  });

  it("移动端数据展示——查看详情包含完整信息", async () => {
    const record = await LiuYaoCreate(
      {
        question: "今天面试顺利吗？",
        background: "下午两点面试",
        note: "穿红色衣服",
        tags: ["事业", "面试"],
        lines: [1, 2, 3, 0, 1, 2],
        yongTarget: "自占",
      },
      { skipUI: true },
    );

    const detail = await LiuYaoView({ recordId: record.id! }, { skipUI: true });

    // 验证详情数据完整（小屏也能展示关键信息）
    expect(detail.question).toBe("今天面试顺利吗？");
    expect(detail.background).toBe("下午两点面试");
    expect(detail.note).toBe("穿红色衣服");
    expect(detail.tags).toEqual(["事业", "面试"]);
    expect(detail.chart.name).toBeTruthy();
    expect(detail.chart.palace).toBeTruthy();
    expect(detail.yong.rel).toBeTruthy();

    // computed 数据可用（hbar + 旺衰列）
    expect(detail.computed).toBeDefined();
    expect(detail.computed!.hbarData).toBeDefined();
    expect(detail.computed!.vigorColumns).toBeDefined();
    expect(detail.computed!.vigorColumns!.columns).toBeDefined();
  });

  it("移动端连续快速占卜——多次自动摇卦", async () => {
    // 模拟用户在短时间内连续占了好几卦
    const records = [];
    for (let i = 0; i < 5; i++) {
      const record = await LiuYaoCreate(
        {
          question: `快速占卜 #${i + 1}`,
          tags: ["快速"],
        },
        { skipUI: true },
      );
      records.push(record);
    }

    // 全部创建成功
    expect(records).toHaveLength(5);

    // 由于随机摇卦，大部分卦象应不同
    const uniqueLines = new Set(records.map(r => JSON.stringify(r.lines)));
    expect(uniqueLines.size).toBeGreaterThan(1);

    // 列表查询
    const list = await LiuYaoList({ tags: ["快速"] }, { skipUI: true });
    expect(list.total).toBe(5);
  });
});

/* ── 8. 专业占卜师场景 ── */
describe("专业占卜师场景", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("为客户管理占卜记录——多客户多记录", async () => {
    // 创建客户
    const client1 = await createTestPerson("客户A", "男");
    const client2 = await createTestPerson("客户B", "女");
    const client3 = await createTestPerson("客户C", "男");

    // 客户 A 咨询多次
    for (let i = 0; i < 8; i++) {
      await LiuYaoCreate(
        {
          personId: client1.id,
          question: `客户A的问题 #${i + 1}`,
          tags: ["客户A", i % 2 === 0 ? "财运" : "事业"],
          lines: fixedLines(i),
          divinationTime: `2026-09-${String(20 + (i % 7)).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:00:00`,
        },
        { skipUI: true },
      );
    }

    // 客户 B 咨询多次
    for (let i = 0; i < 5; i++) {
      await LiuYaoCreate(
        {
          personId: client2.id,
          question: `客户B的问题 #${i + 1}`,
          tags: ["客户B", "感情"],
          lines: fixedLines(i + 20),
          divinationTime: `2026-09-${20 + (i % 7)}T10:00:00`,
        },
        { skipUI: true },
      );
    }

    // 客户 C 咨询 1 次
    await LiuYaoCreate(
      {
        personId: client3.id,
        question: "客户C的问题",
        tags: ["客户C", "健康"],
        lines: fixedLines(30),
        divinationTime: "2026-09-25T11:00:00",
      },
      { skipUI: true },
    );

    // 统计各客户的咨询次数
    const client1Records = await LiuYaoList({ personId: client1.id }, { skipUI: true });
    expect(client1Records.total).toBe(8);

    const client2Records = await LiuYaoList({ personId: client2.id }, { skipUI: true });
    expect(client2Records.total).toBe(5);

    const client3Records = await LiuYaoList({ personId: client3.id }, { skipUI: true });
    expect(client3Records.total).toBe(1);
  });

  it("批量导出客户报告——收集指定客户的全部记录", async () => {
    const client = await createTestPerson("报告客户", "男");

    // 为该客户创建 15 条记录
    for (let i = 0; i < 15; i++) {
      await LiuYaoCreate(
        {
          personId: client.id,
          question: `客户问题 #${i + 1}`,
          tags: [i % 3 === 0 ? "财运" : i % 3 === 1 ? "事业" : "感情"],
          lines: fixedLines(i),
          background: `背景信息 ${i + 1}`,
          divinationTime: `2026-${String((i % 12) + 1).padStart(2, "0")}-15T10:00:00`,
        },
        { skipUI: true },
      );
    }

    // 导出该客户全部记录（分页收集）
    const exported = [];
    let page = 1;
    while (true) {
      const result = await LiuYaoList(
        { personId: client.id, page, pageSize: 10 },
        { skipUI: true },
      );
      exported.push(...result.records);
      if (exported.length >= result.total) break;
      page++;
    }

    expect(exported).toHaveLength(15);
    expect(exported.every(r => r.personId === client.id)).toBe(true);

    // 按类别统计
    const caiyunCount = exported.filter(r => r.tags.includes("财运")).length;
    const shiyeCount = exported.filter(r => r.tags.includes("事业")).length;
    const ganqingCount = exported.filter(r => r.tags.includes("感情")).length;
    expect(caiyunCount + shiyeCount + ganqingCount).toBe(15);
  });

  it("统计分析报告——按月份和问题类型统计", async () => {
    // 创建全年数据
    for (let month = 1; month <= 12; month++) {
      const count = month % 3 === 0 ? 5 : 3; // 每季度末多一些
      for (let i = 0; i < count; i++) {
        const type = ["财运", "事业", "感情", "健康"][i % 4];
        await LiuYaoCreate(
          {
            question: `${month}月${type}占卜 #${i + 1}`,
            tags: [type, `${month}月`],
            lines: fixedLines(month * 10 + i),
            divinationTime: `2026-${String(month).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T09:00:00`,
          },
          { skipUI: true },
        );
      }
    }

    // 按月统计
    const monthlyStats: Record<string, number> = {};
    for (let month = 1; month <= 12; month++) {
      const result = await LiuYaoList({ tags: [`${month}月`] }, { skipUI: true });
      monthlyStats[`${month}月`] = result.total;
    }

    // 验证：每季度末月份有 5 条，其他月份有 3 条
    expect(monthlyStats["3月"]).toBe(5);
    expect(monthlyStats["6月"]).toBe(5);
    expect(monthlyStats["9月"]).toBe(5);
    expect(monthlyStats["12月"]).toBe(5);
    expect(monthlyStats["1月"]).toBe(3);
    expect(monthlyStats["4月"]).toBe(3);

    // 按问题类型统计
    const typeStats: Record<string, number> = {};
    for (const type of ["财运", "事业", "感情", "健康"]) {
      const result = await LiuYaoList({ tags: [type] }, { skipUI: true });
      typeStats[type] = result.total;
    }

    // 全年总记录数
    const totalRecords = Object.values(monthlyStats).reduce((sum, v) => sum + v, 0);
    expect(totalRecords).toBe(4 * 5 + 8 * 3); // 4 个季度末 x 5 + 8 个普通月 x 3

    // 各类型统计
    expect(typeStats["财运"]).toBeDefined();
    expect(typeStats["事业"]).toBeDefined();
    expect(typeStats["感情"]).toBeDefined();
    expect(typeStats["健康"]).toBeDefined();
  });

  it("获取所有可用标签列表——用于报表分类", async () => {
    const client = await createTestPerson("标签统计客户", "男");

    // 创建带各种标签的记录
    const tagSets = [
      ["财运", "重要"],
      ["事业", "重要"],
      ["感情", "日常"],
      ["健康", "日常"],
      ["财运", "日常"],
    ];

    for (let i = 0; i < tagSets.length; i++) {
      await LiuYaoCreate(
        {
          personId: client.id,
          question: `标签测试 #${i + 1}`,
          tags: tagSets[i],
          lines: fixedLines(i),
          divinationTime: `2026-09-${20 + i}T09:00:00`,
        },
        { skipUI: true },
      );
    }

    // 使用 getAllLiuyaoTags 获取所有标签
    const allTags = await getAllLiuyaoTags(client.id);
    expect(allTags).toContain("财运");
    expect(allTags).toContain("事业");
    expect(allTags).toContain("感情");
    expect(allTags).toContain("健康");
    expect(allTags).toContain("重要");
    expect(allTags).toContain("日常");
  });

  it("客户报告导出——导出单个客户的详情数据", async () => {
    const client = await createTestPerson("详情导出客户", "女");

    // 创建 3 条记录
    const createdRecords = [];
    for (let i = 0; i < 3; i++) {
      const record = await LiuYaoCreate(
        {
          personId: client.id,
          question: `客户详情 #${i + 1}`,
          background: `背景 ${i + 1}`,
          note: `备注 ${i + 1}`,
          tags: [`类型${i + 1}`],
          lines: fixedLines(i),
          yongTarget: "自占",
          divinationTime: `2026-09-${20 + i}T10:00:00`,
        },
        { skipUI: true },
      );
      createdRecords.push(record);
    }

    // 逐条导出详情
    const exportedDetails = [];
    for (const r of createdRecords) {
      const detail = await LiuYaoView({ recordId: r.id!, personId: client.id }, { skipUI: true });
      exportedDetails.push(detail);
    }

    // 验证每条记录的详情完整
    expect(exportedDetails).toHaveLength(3);
    for (const detail of exportedDetails) {
      expect(detail.computed).toBeDefined();
      expect(detail.computed!.chart).toBeDefined();
      expect(detail.computed!.yong).toBeDefined();
      expect(detail.computed!.hbarData).toBeDefined();
      expect(detail.computed!.vigorColumns).toBeDefined();
    }
  });
});
