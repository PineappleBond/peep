/**
 * exportData 模块测试
 */
import { describe, it, expect } from "vitest";
import {
  safeFilename,
  getMinorWeight,
  liurenToMarkdown,
  liurenToCsv,
  wikiToCsv,
  wikiToMarkdown,
  analysisToMarkdown,
  toJson,
  performExport,
  type ExportOptions,
} from "./exportData";
import type { LiurenRecord, WikiDocument } from "./personDb";
import { makeZwdsFixture } from "./testFixtures";
import { analyzeChart } from "./analysis";

describe("safeFilename", () => {
  it("将特殊字符替换为下划线", () => {
    expect(safeFilename("张三/李四")).toBe("张三_李四");
    expect(safeFilename("hello world!")).toBe("hello_world_");
  });

  it("空字符串返回默认值", () => {
    expect(safeFilename("")).toBe("export");
  });

  it("保留中文字符", () => {
    expect(safeFilename("紫微斗数")).toBe("紫微斗数");
  });
});

describe("getMinorWeight", () => {
  it("已定义的杂耀返回对应权重", () => {
    expect(getMinorWeight("天官")).toBe("中");
    expect(getMinorWeight("天空")).toBe("低");
  });

  it("未定义的杂耀返回默认权重（低）", () => {
    expect(getMinorWeight("未知星耀")).toBe("低");
  });
});

describe("liurenToMarkdown", () => {
  it("生成大六壬 Markdown 格式", () => {
    const record = createMockLiurenRecord();
    const md = liurenToMarkdown(record);

    expect(md).toContain("# 大六壬占课");
    expect(md).toContain("占事");
    expect(md).toContain("测试占事");
    expect(md).toContain("四柱");
    expect(md).toContain("甲子");
  });

  it("包含三传信息", () => {
    const record = createMockLiurenRecord();
    const md = liurenToMarkdown(record);

    expect(md).toContain("初传");
    expect(md).toContain("中传");
    expect(md).toContain("末传");
  });
});

describe("wikiToMarkdown", () => {
  it("生成 Wiki Markdown 格式", () => {
    const docs = [createMockWikiDoc(1, "测试文档", ["标签1"])];
    const md = wikiToMarkdown(docs, "测试人物");

    expect(md).toContain("# 知识库 — 测试人物");
    expect(md).toContain("测试文档");
    expect(md).toContain("## 标签1");
  });

  it("无标签文档归入未分类", () => {
    const docs = [createMockWikiDoc(1, "无标签文档", [])];
    const md = wikiToMarkdown(docs, "测试");

    expect(md).toContain("## 未分类");
  });
});

describe("liurenToCsv", () => {
  it("生成 CSV 格式", () => {
    const records = [createMockLiurenRecord()];
    const csv = liurenToCsv(records);

    expect(csv).toContain("ID,占事,起课时间");
    expect(csv).toContain("测试占事");
  });

  it("多行记录用换行分隔", () => {
    const records = [createMockLiurenRecord(), createMockLiurenRecord()];
    const csv = liurenToCsv(records);

    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // 表头 + 2 行数据
  });
});

describe("wikiToCsv", () => {
  it("生成 Wiki CSV 格式", () => {
    const docs = [createMockWikiDoc(1, "测试", ["标签"])];
    const csv = wikiToCsv(docs);

    expect(csv).toContain("ID,标题,标签");
    expect(csv).toContain("测试");
  });
});

describe("toJson", () => {
  it("生成 JSON 格式", () => {
    const options: ExportOptions = {
      format: "json",
      scope: "currentPerson",
      includeMeta: true,
      includeDaily: false,
      includeHourly: false,
      currentPerson: {
        id: 1,
        name: "测试",
        gender: "男",
        date: "2000-01-01",
        timeIndex: 0,
        calendar: "solar",
        savedAt: Date.now(),
        isDefault: false,
        isLeapMonth: false,
        exactTime: "",
        useTrueSolar: false,
        placeMode: "china",
        province: "",
        city: "",
        district: "",
        timezone: "",
        algorithm: "default",
        yearDivide: "normal",
        mutagenTable: "default",
        dayDivide: "forward",
        astroType: "heaven",
        residence: "",
      },
    };
    const json = toJson(options);
    const data = JSON.parse(json);

    expect(data.meta).toBeDefined();
    expect(data.meta.version).toBe("1.0");
    expect(data.person.name).toBe("测试");
  });

  it("包含紫微盘数据时不含 lifeKline", () => {
    const z = makeZwdsFixture();
    const options: ExportOptions = {
      format: "json",
      scope: "currentPerson",
      includeMeta: false,
      includeDaily: false,
      includeHourly: false,
      zwds: z,
    };
    const json = toJson(options);
    const data = JSON.parse(json);

    expect(data.ziwei).toBeDefined();
    expect(data.ziwei.lifeKline).toBeUndefined();
  });
});

describe("performExport", () => {
  it("MD 格式返回 .md 文件", () => {
    const options: ExportOptions = {
      format: "md",
      scope: "currentPerson",
      includeMeta: false,
      includeDaily: false,
      includeHourly: false,
      currentPerson: {
        id: 1,
        name: "测试",
        gender: "男",
        date: "2000-01-01",
        timeIndex: 0,
        calendar: "solar",
        savedAt: Date.now(),
        isDefault: false,
        isLeapMonth: false,
        exactTime: "",
        useTrueSolar: false,
        placeMode: "china",
        province: "",
        city: "",
        district: "",
        timezone: "",
        algorithm: "default",
        yearDivide: "normal",
        mutagenTable: "default",
        dayDivide: "forward",
        astroType: "heaven",
        residence: "",
      },
    };
    const result = performExport(options);

    expect(result.filename).toMatch(/\.md$/);
    expect(result.mimeType).toContain("markdown");
  });

  it("JSON 格式返回 .json 文件", () => {
    const options: ExportOptions = {
      format: "json",
      scope: "currentPerson",
      includeMeta: false,
      includeDaily: false,
      includeHourly: false,
    };
    const result = performExport(options);

    expect(result.filename).toMatch(/\.json$/);
    expect(result.mimeType).toContain("json");
  });

  it("CSV 格式返回 .csv 文件", () => {
    const options: ExportOptions = {
      format: "csv",
      scope: "currentPerson",
      includeMeta: false,
      includeDaily: false,
      includeHourly: false,
      liurenRecords: [createMockLiurenRecord()],
    };
    const result = performExport(options);

    expect(result.filename).toMatch(/\.csv$/);
    expect(result.mimeType).toContain("csv");
  });

  it("包含元数据时在 MD 顶部添加导出信息", () => {
    const options: ExportOptions = {
      format: "md",
      scope: "currentPerson",
      includeMeta: true,
      includeDaily: false,
      includeHourly: false,
      wikiDocs: [createMockWikiDoc(1, "测试", [])],
    };
    const result = performExport(options);

    expect(result.content).toContain("导出时间");
    expect(result.content).toContain("版本");
  });
});

describe("analysisToMarkdown 完整性", () => {
  it("输出包含飞宫四化、传导链、夹宫、借星各节", () => {
    const z = makeZwdsFixture();
    const analysis = analyzeChart(z.astrolabe!);
    const md = analysisToMarkdown(analysis);

    // 格局
    if (analysis.patterns.length > 0) {
      expect(md).toContain("### 格局");
    }
    // 三方四正（含会吉/会煞/四化会入/借星）
    expect(md).toContain("### 三方四正");
    // 飞宫四化
    expect(md).toContain("### 飞宫四化");
    // 四化传导链
    expect(md).toContain("### 四化传导链");
    if (analysis.mutagenChains.lu.length > 0) expect(md).toContain("**禄链**");
    if (analysis.mutagenChains.ji.length > 0) expect(md).toContain("**忌链**");
    // 夹宫
    if (analysis.jiaGong.length > 0) {
      expect(md).toContain("### 夹宫关系");
    }
    // 借星
    if (analysis.borrowed.length > 0) {
      expect(md).toContain("### 空宫借星");
    }
  });

  it("空分析结果不抛错且返回基本结构", () => {
    const emptyAnalysis = {
      note: "",
      patterns: [],
      sanfang: [],
      flyMatrix: { palaces: [], sentences: [], note: "" },
      mutagenChains: { ji: [], lu: [], note: "" },
      jiaGong: [],
      borrowed: [],
    };
    const md = analysisToMarkdown(emptyAnalysis);
    expect(md).toContain("## 结构分析");
    expect(md).not.toContain("### 格局");
    expect(md).not.toContain("### 飞宫四化");
  });
});

/* ─────────────── 测试夹具 ─────────────── */

function createMockLiurenRecord(): LiurenRecord {
  return {
    id: 1,
    personId: 1,
    calculationTime: "2026-01-01 12:00:00",
    question: "测试占事",
    note: "测试备注",
    background: "",
    tags: ["测试"],
    savedAt: Date.now(),
    result: {
      calculationTime: "2026-01-01 12:00:00",
      fourPillars: {
        yearStem: 0,
        yearBranch: 0,
        monthStem: 0,
        monthBranch: 0,
        dayStem: 0,
        dayBranch: 0,
        hourStem: 0,
        hourBranch: 0,
        yearPillar: "甲子",
        monthPillar: "乙丑",
        dayPillar: "丙寅",
        hourPillar: "丁卯",
      },
      monthGeneral: { branch: 0, name: "登明" },
      earthBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      heavenBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      fourLessons: [
        { upper: 0, lower: 0, lowerType: "stem" },
        { upper: 1, lower: 1, lowerType: "branch" },
        { upper: 2, lower: 2, lowerType: "branch" },
        { upper: 3, lower: 3, lowerType: "branch" },
      ],
      xunKong: { xunHead: 0, void1: 10, void2: 11 },
      threeTransmissions: {
        method: "元首",
        initial: 0,
        middle: 1,
        final: 2,
        trace: [],
      },
      twelveGenerals: Array.from({ length: 12 }, (_, i) => ({
        position: i,
        general: i,
        name: `天将${i}`,
      })),
      wangXiang: {},
      liuQin: { 0: "父母", 1: "兄弟" },
      xunDun: {},
      riDun: [],
      shenSha: [],
      relations: [],
      keJing: [],
      biFa: [],
      jianChu: {},
      naYin: {},
      calculationTrace: [],
    },
  };
}

function createMockWikiDoc(id: number, title: string, tags: string[]): WikiDocument {
  return {
    id,
    personId: 1,
    title,
    content: "这是测试内容。",
    tags,
    savedAt: Date.now(),
    updatedAt: Date.now(),
  };
}
