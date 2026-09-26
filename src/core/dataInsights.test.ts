/**
 * 数据洞察引擎测试：验证模式识别、异常检测、趋势分析与建议生成
 */
import { describe, expect, it } from "vitest";
import { generateInsights, generateMarkdownReport, type InsightsInput } from "./dataInsights";
import type { LiurenRecord, WikiDocument } from "./personDb";

/** 构造一个最小可用的 LiurenRecord */
function makeLiuren(overrides: Partial<LiurenRecord> = {}): LiurenRecord {
  return {
    id: 1,
    personId: 1,
    calculationTime: "2024-01-01 12:00:00",
    question: "测试问题",
    note: "",
    background: "",
    tags: [],
    result: {} as LiurenRecord["result"],
    savedAt: new Date("2024-06-01T12:00:00Z").getTime(),
    ...overrides,
  };
}

/** 构造一个最小可用的 WikiDocument */
function makeWiki(overrides: Partial<WikiDocument> = {}): WikiDocument {
  return {
    id: 1,
    personId: 1,
    title: "测试文档",
    content: "测试内容",
    tags: [],
    savedAt: new Date("2024-06-01T12:00:00Z").getTime(),
    updatedAt: new Date("2024-06-01T12:00:00Z").getTime(),
    ...overrides,
  };
}

describe("generateInsights：空数据", () => {
  it("无记录时返回空洞察列表", () => {
    const input: InsightsInput = { liurenRecords: [], wikiDocs: [] };
    const result = generateInsights(input);
    expect(result.insights).toEqual([]);
    expect(result.tagFrequencies).toEqual([]);
    expect(result.summary.totalLiuren).toBe(0);
    expect(result.summary.totalWiki).toBe(0);
    expect(result.summary.totalTags).toBe(0);
    expect(result.summary.activeDays).toBe(0);
  });
});

describe("analyzePatterns：模式识别", () => {
  it("识别高频标签（>=3 次）", () => {
    const records = [
      makeLiuren({ id: 1, tags: ["感情", "工作"] }),
      makeLiuren({ id: 2, tags: ["感情", "财运"] }),
      makeLiuren({ id: 3, tags: ["感情"] }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const topTag = result.insights.find(i => i.titleKey === "insights.pattern.topTag.title");
    expect(topTag).toBeDefined();
    expect(topTag?.titleParams?.tag).toBe("感情");
    expect(topTag?.titleParams?.count).toBe(3);
  });

  it("标签集中度 > 70% 触发集中洞察", () => {
    const records = [
      makeLiuren({ id: 1, tags: ["感情", "工作"] }),
      makeLiuren({ id: 2, tags: ["感情", "财运"] }),
      makeLiuren({ id: 3, tags: ["感情", "健康"] }),
      makeLiuren({ id: 4, tags: ["感情"] }),
      makeLiuren({ id: 5, tags: ["感情"] }),
    ];
    // 共 7 个标签，感情 5 个（71%）→ top3 必 > 70%
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const concentration = result.insights.find(
      i => i.titleKey === "insights.pattern.tagConcentration.title",
    );
    expect(concentration).toBeDefined();
  });

  it("问题类别识别（感情/事业）", () => {
    const records = [
      makeLiuren({ id: 1, question: "我的感情运势如何？" }),
      makeLiuren({ id: 2, question: "感情发展" }),
      makeLiuren({ id: 3, question: "桃花运" }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const category = result.insights.find(
      i => i.titleKey === "insights.pattern.questionCategory.title",
    );
    expect(category).toBeDefined();
    expect(category?.titleParams?.category).toBe("感情");
  });

  it("Wiki 文档规模达到 10+ 触发洞察", () => {
    const docs = Array.from({ length: 12 }, (_, i) => makeWiki({ id: i + 1 }));
    const result = generateInsights({ liurenRecords: [], wikiDocs: docs });
    const wiki = result.insights.find(i => i.titleKey === "insights.pattern.wikiScale.title");
    expect(wiki).toBeDefined();
  });
});

describe("detectAnomalies：异常检测", () => {
  it("长时间未活动（>=30 天）", () => {
    const now = new Date("2024-08-01T12:00:00Z").getTime();
    const records = [makeLiuren({ savedAt: new Date("2024-06-01T12:00:00Z").getTime() })];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [], now });
    const inactive = result.insights.find(
      i => i.titleKey === "insights.anomaly.inactiveLong.title",
    );
    expect(inactive).toBeDefined();
    expect(inactive?.titleParams?.days).toBe(61);
  });

  it("活动间隔异常峰值", () => {
    // 5 条记录，间隔分别为 1 天、1 天、1 天、100 天 → 最大间隔远超平均
    const base = new Date("2024-01-01T00:00:00Z").getTime();
    const day = 24 * 60 * 60 * 1000;
    const records = [
      makeLiuren({ id: 1, savedAt: base }),
      makeLiuren({ id: 2, savedAt: base + day }),
      makeLiuren({ id: 3, savedAt: base + 2 * day }),
      makeLiuren({ id: 4, savedAt: base + 3 * day }),
      makeLiuren({ id: 5, savedAt: base + 103 * day }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const spike = result.insights.find(i => i.titleKey === "insights.anomaly.gapSpike.title");
    expect(spike).toBeDefined();
  });

  it("问题文本异常长", () => {
    // 构造 10 条短问题 + 1 条超长问题，使超长文本 > 平均长度 5 倍
    const shortQ = "问";
    const longQ = "测".repeat(200); // 200 字符
    const records = [
      ...Array.from({ length: 10 }, (_, i) => makeLiuren({ id: i + 1, question: shortQ })),
      makeLiuren({ id: 11, question: longQ }),
    ];
    // 平均长度 ≈ (10 + 200) / 11 ≈ 19，200 > 19*5=95 ✓
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const long = result.insights.find(i => i.titleKey === "insights.anomaly.longQuestion.title");
    expect(long).toBeDefined();
    expect(long?.data?.length).toBe(200);
  });
});

describe("analyzeTrends：趋势分析", () => {
  it("活跃度显著上升触发上升洞察", () => {
    // 构造近 6 个月逐月递增的数据
    const base = new Date("2024-01-15T12:00:00Z").getTime();
    const month = 30 * 24 * 60 * 60 * 1000;
    const records: LiurenRecord[] = [];
    // 每月递增：1、2、3、4、5、6 条
    for (let m = 0; m < 6; m++) {
      const count = m + 1;
      for (let i = 0; i < count; i++) {
        records.push(
          makeLiuren({
            id: records.length + 1,
            savedAt: base + m * month + i * 24 * 60 * 60 * 1000,
          }),
        );
      }
    }
    // now 落在 2024-06，使 6 个桶恰好覆盖 2024-01 ~ 2024-06
    const now = new Date("2024-06-20T12:00:00Z").getTime();
    const result = generateInsights({ liurenRecords: records, wikiDocs: [], now });
    const rising = result.insights.find(i => i.titleKey === "insights.trend.rising.title");
    expect(rising).toBeDefined();
    expect(rising?.data?.direction).toBe("up");
  });

  it("活跃度显著下降触发下降洞察", () => {
    const base = new Date("2024-01-15T12:00:00Z").getTime();
    const month = 30 * 24 * 60 * 60 * 1000;
    const records: LiurenRecord[] = [];
    // 每月递减：6、5、4、3、2、1 条
    for (let m = 0; m < 6; m++) {
      const count = 6 - m;
      for (let i = 0; i < count; i++) {
        records.push(
          makeLiuren({
            id: records.length + 1,
            savedAt: base + m * month + i * 24 * 60 * 60 * 1000,
          }),
        );
      }
    }
    const now = new Date("2024-06-20T12:00:00Z").getTime();
    const result = generateInsights({ liurenRecords: records, wikiDocs: [], now });
    const declining = result.insights.find(i => i.titleKey === "insights.trend.declining.title");
    expect(declining).toBeDefined();
    expect(declining?.data?.direction).toBe("down");
  });

  it("数据不足 3 个月不触发趋势洞察", () => {
    const records = [
      makeLiuren({ id: 1, savedAt: new Date("2024-06-01T12:00:00Z").getTime() }),
      makeLiuren({ id: 2, savedAt: new Date("2024-06-15T12:00:00Z").getTime() }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const trends = result.insights.filter(i => i.type === "trend");
    expect(trends).toEqual([]);
  });
});

describe("generateSuggestions：建议生成", () => {
  it("高频标签建议创建模板", () => {
    const records = Array.from({ length: 10 }, (_, i) => makeLiuren({ id: i + 1, tags: ["感情"] }));
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const tmpl = result.insights.find(
      i => i.titleKey === "insights.suggestion.createTemplate.title",
    );
    expect(tmpl).toBeDefined();
    expect(tmpl?.titleParams?.tag).toBe("感情");
  });

  it("无标签比例高时建议整理标签", () => {
    // 6 条记录，5 条无标签
    const records = [
      ...Array.from({ length: 5 }, (_, i) => makeLiuren({ id: i + 1, tags: [] })),
      makeLiuren({ id: 6, tags: ["感情"] }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const org = result.insights.find(i => i.titleKey === "insights.suggestion.organizeTags.title");
    expect(org).toBeDefined();
  });

  it("标签过多时建议合并", () => {
    // 25 条记录，每条一个独特标签
    const records = Array.from({ length: 25 }, (_, i) =>
      makeLiuren({ id: i + 1, tags: [`tag${i}`] }),
    );
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const consolidate = result.insights.find(
      i => i.titleKey === "insights.suggestion.consolidateTags.title",
    );
    expect(consolidate).toBeDefined();
  });

  it("长时间未活动建议保持习惯", () => {
    const now = new Date("2024-09-01T12:00:00Z").getTime();
    const records = [makeLiuren({ savedAt: new Date("2024-06-01T12:00:00Z").getTime() })];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [], now });
    const habit = result.insights.find(i => i.titleKey === "insights.suggestion.keepHabit.title");
    expect(habit).toBeDefined();
  });

  it("六壬记录多但无 Wiki 时建议关联写作", () => {
    const records = Array.from({ length: 12 }, (_, i) => makeLiuren({ id: i + 1 }));
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const link = result.insights.find(i => i.titleKey === "insights.suggestion.linkWiki.title");
    expect(link).toBeDefined();
  });
});

describe("summary：聚合统计", () => {
  it("正确计算活跃天数与平均间隔", () => {
    const base = new Date("2024-01-01T12:00:00Z").getTime();
    const day = 24 * 60 * 60 * 1000;
    const records = [
      makeLiuren({ id: 1, savedAt: base }),
      // 同一天另一条 → 不增加 activeDays
      makeLiuren({ id: 2, savedAt: base + 1000, tags: ["额外"] }),
      makeLiuren({ id: 3, savedAt: base + day }),
    ];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    expect(result.summary.activeDays).toBe(2);
    expect(result.summary.totalLiuren).toBe(3);
    expect(result.summary.totalTags).toBe(1);
    expect(result.summary.averageGapDays).toBeGreaterThan(0);
  });
});

describe("generateMarkdownReport", () => {
  it("生成有效的 Markdown 文本", () => {
    const records = [makeLiuren({ id: 1, tags: ["感情"] }), makeLiuren({ id: 2, tags: ["感情"] })];
    const result = generateInsights({ liurenRecords: records, wikiDocs: [] });
    const md = generateMarkdownReport(result);
    expect(md).toContain("# 数据洞察报告");
    expect(md).toContain("## 总览");
    expect(md).toContain("大六壬记录总数");
    expect(md).toContain("近 6 个月活跃度");
    // 不含 K 线量化数据列（均值/高光/低谷）
    expect(md).not.toContain("均值");
    expect(md).not.toContain("高光");
    // 含注释
    expect(md).toContain("不含人生 K 线量化数据");
  });

  it("支持英文输出", () => {
    const result = generateInsights({ liurenRecords: [], wikiDocs: [] });
    const md = generateMarkdownReport(result, undefined, "en-US");
    expect(md).toContain("# Data Insights Report");
  });

  it("使用传入的翻译函数", () => {
    const records = [makeLiuren({ id: 1, tags: ["感情"] })];
    // 构造能触发洞察的数据
    const moreRecords = [
      ...records,
      makeLiuren({ id: 2, tags: ["感情"] }),
      makeLiuren({ id: 3, tags: ["感情"] }),
    ];
    const result = generateInsights({ liurenRecords: moreRecords, wikiDocs: [] });
    const t = (key: string) => `[翻译:${key}]`;
    const md = generateMarkdownReport(result, t);
    expect(md).toContain("[翻译:");
  });
});
