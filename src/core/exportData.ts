/**
 * 数据导出模块：统一处理紫微斗数、大六壬、知识库三类数据的导出。
 *
 * 支持格式：
 * - Markdown（MD）：可读性最佳，适合 AI 输入或阅读
 * - JSON：结构化备份，可再导入
 * - CSV：表格数据（大六壬记录列表、Wiki 文档列表）
 *
 * 口径约定（与 CLAUDE.md 一致）：
 * - AI 导出不携带人生K线量化数据（含月K线、十年规划表的均值/高光/低谷列）
 * - 流日/流时默认不随导出（择日/择时场景由 UI 勾选附加）
 * - 小限保留导出但带口径备注（辅助年系统，勿与流年混同）
 * - 杂曜带 weight 权重档（中=可参与断事，低=仅叠加参考）
 */
import type { Person, LiurenRecord, WikiDocument } from "./personDb";
import type { Zwds } from "./useZwds";
import type { ChartAnalysis } from "./analysis";
import { BRANCHES } from "./utils";

/* ─────────────── 杂曜权重档 ─────────────── */

/**
 * 杂曜权重：导出时附带每颗杂曜的参考权重。
 * - 中：可参与断事（对宫位含义有较明确影响）
 * - 低：仅叠加参考（象征性点缀，不作为主要依据）
 */
export const ADJ_MID_WEIGHT: Record<string, "中" | "低"> = {
  // 中等权重杂曜（有一定断事意义）
  天官: "中",
  天福: "中",
  天才: "中",
  天寿: "中",
  天刑: "中",
  天姚: "中",
  天哭: "中",
  天虚: "中",
  龙池: "中",
  凤阁: "中",
  红鸾: "中",
  天喜: "中",
  孤辰: "中",
  寡宿: "中",
  破军: "中",
  台辅: "中",
  封诰: "中",
  天月: "中",
  三台: "中",
  八座: "中",
  恩光: "中",
  天贵: "中",
  解神: "中",
  天巫: "中",
  天德: "中",
  月德: "中",
  // 低权重杂曜（仅叠加参考）
  天空: "低",
  截空: "低",
  旬空: "低",
  截路: "低",
  空亡: "低",
};

/** 未列入上表的杂曜默认权重 */
export const ADJ_DEFAULT_WEIGHT: "中" | "低" = "低";

/**
 * 获取杂曜权重档
 */
export function getMinorWeight(starName: string): "中" | "低" {
  return ADJ_MID_WEIGHT[starName] ?? ADJ_DEFAULT_WEIGHT;
}

/* ─────────────── 导出选项 ─────────────── */

/** 导出数据范围 */
export type ExportScope = "all" | "currentPerson" | "currentPage";

/** 导出格式 */
export type ExportFormat = "md" | "json" | "csv";

/** 导出选项 */
export type ExportOptions = {
  /** 导出格式 */
  format: ExportFormat;
  /** 数据范围 */
  scope: ExportScope;
  /** 是否包含元数据（导出时间、版本等） */
  includeMeta: boolean;
  /** 是否包含流日（默认不随导出） */
  includeDaily: boolean;
  /** 是否包含流时（默认不随导出） */
  includeHourly: boolean;
  /** 指定人物列表（scope="all" 时使用） */
  persons?: Person[];
  /** 当前人物 */
  currentPerson?: Person | null;
  /** 当前紫微盘数据 */
  zwds?: Zwds | null;
  /** 大六壬记录 */
  liurenRecords?: LiurenRecord[];
  /** Wiki 文档 */
  wikiDocs?: WikiDocument[];
};

/* ─────────────── 工具函数 ─────────────── */

/** 安全文件名：去除特殊字符 */
export function safeFilename(name: string): string {
  return name.replace(/[^\w一-鿿-]/g, "_").replace(/_+/g, "_") || "export";
}

/** 触发浏览器下载（延迟释放 ObjectURL 确保下载启动） */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // 延迟释放，确保浏览器有足够时间启动下载
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 当前 ISO 时间戳（用于元数据） */
function nowISO(): string {
  return new Date().toISOString();
}

/* ─────────────── Markdown 导出 ─────────────── */

/**
 * 紫微斗数盘面 → Markdown
 */
export function zwdsToMarkdown(
  z: Zwds,
  options: { includeDaily?: boolean; includeHourly?: boolean } = {},
): string {
  const { includeDaily = false, includeHourly = false } = options;
  const input = z.input;
  const a = z.astrolabe;

  if (!a) return "";

  let md = `# ${input.name || "未命名"} · 紫微斗数盘\n\n`;

  // 基本信息
  md += `## 基本信息\n\n`;
  md += `- **姓名**：${input.name || "未命名"}\n`;
  md += `- **性别**：${input.gender}\n`;
  md += `- **历法**：${input.calendar === "solar" ? "公历" : "农历"}\n`;
  md += `- **日期**：${input.date}\n`;
  md += `- **时辰**：${BRANCHES[input.timeIndex]}时（${input.timeIndex}）\n`;
  if (input.isLeapMonth) md += `- **闰月**：是\n`;
  if (input.useTrueSolar && input.exactTime) md += `- **真太阳时**：${input.exactTime}\n`;
  md += `- **流派**：${input.algorithm === "zhongzhou" ? "中州派" : "通行版"}\n`;
  md += `- **年分界**：${input.yearDivide === "exact" ? "立春" : "正月初一"}\n`;
  md += `- **四化表**：${input.mutagenTable === "zhongzhou" ? "中州（庚壬天府化科）" : "通行"}\n`;
  md += `- **晚子时**：${input.dayDivide === "forward" ? "归次日" : "归当日"}\n`;
  if (input.astroType !== "heaven") {
    md += `- **盘型**：${input.astroType === "earth" ? "地盘" : "人盘"}\n`;
  }
  if (input.residence) md += `- **常居住地**：${input.residence}\n`;
  md += `\n`;

  // 十二宫
  md += `## 十二宫\n\n`;
  for (const p of a.palaces) {
    md += `### ${p.name}（${p.earthlyBranch}）\n\n`;
    if (p.heavenlyStem) md += `天干：${p.heavenlyStem}\n\n`;

    if (p.majorStars.length > 0) {
      md += `**主星**：`;
      md += p.majorStars
        .map(s => {
          let txt = s.name as string;
          if (s.brightness) txt += `（${s.brightness}）`;
          return txt;
        })
        .join("、");
      md += `\n\n`;
    }

    if (p.minorStars.length > 0) {
      md += `**辅星**：`;
      md += p.minorStars.map(s => s.name as string).join("、");
      md += `\n\n`;
    }

    if (p.adjectiveStars.length > 0) {
      md += `**杂曜**：`;
      md += p.adjectiveStars
        .map(s => {
          const name = s.name as string;
          const w = getMinorWeight(name);
          return `${name}（${w}）`;
        })
        .join("、");
      md += `\n\n`;
    }
  }

  // 大限
  md += `## 大限\n\n`;
  md += `| 大限 | 年龄 | 年份 | 宫位 |\n`;
  md += `|------|------|------|------|\n`;
  for (const d of z.decades) {
    const palace = a.palaces.find(p => p.index === d.palaceIndex);
    const palaceName = palace ? `${palace.name}（${palace.earthlyBranch}）` : "";
    md += `| ${d.range[0]}-${d.range[1]} | ${d.range[0]}-${d.range[1]}岁 | ${d.startYear}-${d.startYear + 9} | ${palaceName} |\n`;
  }
  md += `\n`;

  // 小限（带口径备注）
  md += `## 小限\n\n`;
  md += `> **口径备注**：小限是辅助年系统，以生年地支起算，男顺女逆，每年一宫。\n`;
  md += `> 请勿与流年混同使用。此处仅作辅助参考。\n\n`;
  if (z.pick) {
    const age = z.pick.year - z.birthLunarYear + 1;
    md += `当前虚岁：${age} 岁\n\n`;
  }

  // 流年（当前选择年份）
  if (z.years && z.years.length > 0) {
    md += `## 流年\n\n`;
    md += `| 年份 | 干支 | 虚岁 |\n`;
    md += `|------|------|------|\n`;
    for (const y of z.years) {
      md += `| ${y.year} | ${y.gz} | ${y.age} |\n`;
    }
    md += `\n`;
  }

  // 流月
  if (z.months && z.months.length > 0) {
    md += `## 流月\n\n`;
    md += `| 月份 | 干支 |\n`;
    md += `|------|------|\n`;
    for (const m of z.months) {
      md += `| ${m.month}月${m.leap ? "（闰）" : ""} | ${m.gz} |\n`;
    }
    md += `\n`;
  }

  // 流日（可选）
  if (includeDaily && z.days && z.days.length > 0) {
    md += `## 流日\n\n`;
    md += `| 日期 | 干支 |\n`;
    md += `|------|------|\n`;
    for (const d of z.days) {
      md += `| ${d.day}日 | ${d.gz} |\n`;
    }
    md += `\n`;
  }

  // 流时（可选）
  if (includeHourly && z.hours && z.hours.length > 0) {
    md += `## 流时\n\n`;
    md += `| 时辰 | 干支 |\n`;
    md += `|------|------|\n`;
    for (const h of z.hours) {
      md += `| ${h.label} | ${h.gz} |\n`;
    }
    md += `\n`;
  }

  // 结构分析
  if (z.analysis) {
    md += analysisToMarkdown(z.analysis);
  }

  return md;
}

/**
 * 结构分析 → Markdown（完整输出格局/三方/飞宫/传导链/夹宫/借星）
 */
export function analysisToMarkdown(analysis: ChartAnalysis): string {
  let md = `## 结构分析\n\n`;

  // 格局
  if (analysis.patterns.length > 0) {
    md += `### 格局\n\n`;
    for (const p of analysis.patterns) {
      md += `- **${p.name}**（${p.kind}）：${p.meaning}\n`;
    }
    md += `\n`;
  }

  // 三方四正
  if (analysis.sanfang.length > 0) {
    md += `### 三方四正\n\n`;
    for (const s of analysis.sanfang) {
      md += `**${s.palaceName}（${s.branch}）**\n\n`;
      for (const seat of s.seats) {
        md += `- ${seat.role}：${seat.palaceName}（${seat.branch}）— ${seat.majors || "无主星"}\n`;
      }
      if (s.auspicious.length > 0) md += `- 会吉：${s.auspicious.join("、")}\n`;
      if (s.inauspicious.length > 0) md += `- 会煞：${s.inauspicious.join("、")}\n`;
      if (s.natalMutagens.length > 0) md += `- 生年四化会入：${s.natalMutagens.join("、")}\n`;
      if (s.borrowed) md += `- ${s.borrowed}\n`;
      md += `\n`;
    }
  }

  // 飞宫四化
  if (analysis.flyMatrix.palaces.length > 0) {
    md += `### 飞宫四化\n\n`;
    for (const sentence of analysis.flyMatrix.sentences) {
      md += `- ${sentence}\n`;
    }
    md += `\n`;
  }

  // 四化传导链
  if (analysis.mutagenChains.ji.length > 0 || analysis.mutagenChains.lu.length > 0) {
    md += `### 四化传导链\n\n`;
    if (analysis.mutagenChains.lu.length > 0) {
      md += `**禄链**\n\n`;
      for (const c of analysis.mutagenChains.lu) {
        md += `- ${c.text}\n`;
      }
      md += `\n`;
    }
    if (analysis.mutagenChains.ji.length > 0) {
      md += `**忌链**\n\n`;
      for (const c of analysis.mutagenChains.ji) {
        md += `- ${c.text}\n`;
      }
      md += `\n`;
    }
  }

  // 夹宫关系
  if (analysis.jiaGong.length > 0) {
    md += `### 夹宫关系\n\n`;
    for (const j of analysis.jiaGong) {
      md += `- **${j.palaceName}（${j.branch}）**${j.kind}：${j.detail}（${j.good ? "吉" : "注意"}）\n`;
    }
    md += `\n`;
  }

  // 空宫借星
  if (analysis.borrowed.length > 0) {
    md += `### 空宫借星\n\n`;
    for (const b of analysis.borrowed) {
      md += `- **${b.palaceName}（${b.branch}）**借对宫【${b.oppositeName}】${b.borrowed.join("、")}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * 大六壬记录 → Markdown
 */
export function liurenToMarkdown(record: LiurenRecord): string {
  const r = record.result;
  let md = `# 大六壬占课\n\n`;

  // 基本信息
  md += `## 占课信息\n\n`;
  md += `- **占事**：${record.question || "未设"}\n`;
  md += `- **时间**：${record.calculationTime}\n`;
  if (record.note) md += `- **备注**：${record.note}\n`;
  if (record.background) md += `- **背景**：${record.background}\n`;
  if (record.tags.length > 0) md += `- **标签**：${record.tags.join("、")}\n`;
  md += `\n`;

  // 四柱
  md += `## 四柱\n\n`;
  md += `| 年 | 月 | 日 | 时 |\n`;
  md += `|----|----|----|----|\n`;
  md += `| ${r.fourPillars.yearPillar} | ${r.fourPillars.monthPillar} | ${r.fourPillars.dayPillar} | ${r.fourPillars.hourPillar} |\n\n`;

  // 月将
  md += `## 月将\n\n`;
  md += `${r.monthGeneral.name}（${BRANCHES[r.monthGeneral.branch]}）\n\n`;

  // 天地盘
  md += `## 天地盘\n\n`;
  md += `| 地盘 | ${r.earthBoard.map(b => BRANCHES[b]).join(" | ")} |\n`;
  md += `| 天盘 | ${r.heavenBoard.map(b => BRANCHES[b]).join(" | ")} |\n\n`;

  // 四课
  md += `## 四课\n\n`;
  md += `| 课 | 上课 | 下课 |\n`;
  md += `|----|------|------|\n`;
  for (let i = 0; i < r.fourLessons.length; i++) {
    const fl = r.fourLessons[i];
    md += `| 第${i + 1}课 | ${BRANCHES[fl.upper]} | ${BRANCHES[fl.lower]}${fl.lowerType === "stem" ? "（干寄）" : ""} |\n`;
  }
  md += `\n`;

  // 三传
  md += `## 三传\n\n`;
  md += `- **取法**：${r.threeTransmissions.method}\n`;
  md += `- **初传**：${BRANCHES[r.threeTransmissions.initial]}\n`;
  md += `- **中传**：${BRANCHES[r.threeTransmissions.middle]}\n`;
  md += `- **末传**：${BRANCHES[r.threeTransmissions.final]}\n\n`;

  // 旬空
  md += `## 旬空\n\n`;
  md += `空亡：${BRANCHES[r.xunKong.void1]}、${BRANCHES[r.xunKong.void2]}\n\n`;

  // 十二天将
  md += `## 十二天将\n\n`;
  md += `| 地盘 | ${r.twelveGenerals.map(g => BRANCHES[g.position]).join(" | ")} |\n`;
  md += `| 天将 | ${r.twelveGenerals.map(g => g.name).join(" | ")} |\n\n`;

  // 六亲
  md += `## 六亲\n\n`;
  for (let i = 0; i < 12; i++) {
    if (r.liuQin[i]) {
      md += `- ${BRANCHES[i]}：${r.liuQin[i]}\n`;
    }
  }
  md += `\n`;

  // 课经
  if (r.keJing && r.keJing.length > 0) {
    md += `## 课经\n\n`;
    for (const k of r.keJing) {
      md += `- **${k.rule.name}**：${k.rule.description}\n`;
    }
    md += `\n`;
  }

  // 毕法
  if (r.biFa && r.biFa.length > 0) {
    md += `## 毕法\n\n`;
    for (const b of r.biFa) {
      md += `- **${b.rule.name}**：${b.rule.description}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Wiki 文档 → Markdown（llms.txt 格式）
 */
export function wikiToMarkdown(docs: WikiDocument[], personName: string): string {
  let md = `# 知识库 — ${personName}\n\n`;
  md += `> ${personName} 的紫微斗数知识库\n\n`;

  // 按标签分组
  const tagMap = new Map<string, WikiDocument[]>();
  const untagged: WikiDocument[] = [];
  for (const doc of docs) {
    if (doc.tags.length === 0) {
      untagged.push(doc);
    } else {
      for (const tag of doc.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, []);
        tagMap.get(tag)?.push(doc);
      }
    }
  }

  const renderDocs = (list: WikiDocument[]) =>
    list
      .map(d => {
        const preview = d.content.split("\n")[0].slice(0, 100) || "（无内容）";
        return `- [${d.title || "（无标题）"}](#doc-${d.id}): ${preview}`;
      })
      .join("\n");

  for (const [tag, list] of Array.from(tagMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    md += `## ${tag}\n\n${renderDocs(list)}\n\n`;
  }
  if (untagged.length > 0) {
    md += `## 未分类\n\n${renderDocs(untagged)}\n\n`;
  }

  // 文档详情
  md += `---\n\n`;
  for (const doc of docs) {
    md += `<a id="doc-${doc.id}"></a>\n\n`;
    md += `## ${doc.title || "（无标题）"}\n\n`;
    md += doc.content;
    md += `\n\n---\n\n`;
  }

  return md;
}

/* ─────────────── JSON 导出 ─────────────── */

/**
 * 完整数据 → JSON（结构化备份）
 */
export function toJson(options: ExportOptions): string {
  const data: Record<string, unknown> = {};

  if (options.includeMeta) {
    data.meta = {
      version: "1.0",
      exportedAt: nowISO(),
      scope: options.scope,
    };
  }

  // 人物信息
  if (options.currentPerson) {
    data.person = {
      id: options.currentPerson.id,
      name: options.currentPerson.name,
      gender: options.currentPerson.gender,
      date: options.currentPerson.date,
      timeIndex: options.currentPerson.timeIndex,
      calendar: options.currentPerson.calendar,
      residence: options.currentPerson.residence,
    };
  }

  // 紫微盘数据（不携带人生K线量化数据）
  const astrolabe = options.zwds?.astrolabe;
  if (astrolabe) {
    const z = options.zwds!;
    data.ziwei = {
      input: z.input,
      birthLunarYear: z.birthLunarYear,
      decades: z.decades.map(d => ({
        range: d.range,
        startYear: d.startYear,
        palaceIndex: d.palaceIndex,
      })),
      palaces: astrolabe.palaces.map(p => ({
        name: p.name,
        earthlyBranch: p.earthlyBranch,
        heavenlyStem: p.heavenlyStem,
        majorStars: p.majorStars.map(s => ({ name: s.name, brightness: s.brightness })),
        minorStars: p.minorStars.map(s => ({ name: s.name })),
        adjectiveStars: p.adjectiveStars.map(s => ({
          name: s.name,
          weight: getMinorWeight(s.name as string),
        })),
      })),
      // 不含 lifeKline 量化数据
    };
  }

  // 大六壬记录
  if (options.liurenRecords && options.liurenRecords.length > 0) {
    data.liuren = options.liurenRecords.map(r => ({
      id: r.id,
      calculationTime: r.calculationTime,
      question: r.question,
      note: r.note,
      background: r.background,
      tags: r.tags,
      result: r.result, // 完整卦象数据
    }));
  }

  // Wiki 文档
  if (options.wikiDocs && options.wikiDocs.length > 0) {
    data.wiki = options.wikiDocs.map(d => ({
      id: d.id,
      title: d.title,
      content: d.content,
      tags: d.tags,
      savedAt: d.savedAt,
      updatedAt: d.updatedAt,
    }));
  }

  return JSON.stringify(data, null, 2);
}

/* ─────────────── CSV 导出 ─────────────── */

/**
 * 大六壬记录 → CSV
 */
export function liurenToCsv(records: LiurenRecord[]): string {
  const headers = [
    "ID",
    "占事",
    "起课时间",
    "备注",
    "标签",
    "四柱",
    "月将",
    "三传取法",
    "初传",
    "中传",
    "末传",
  ];
  const rows = records.map(r => [
    r.id ?? "",
    escapeCsvField(r.question),
    escapeCsvField(r.calculationTime),
    escapeCsvField(r.note),
    escapeCsvField(r.tags.join(";")),
    `${r.result.fourPillars.yearPillar} ${r.result.fourPillars.monthPillar} ${r.result.fourPillars.dayPillar} ${r.result.fourPillars.hourPillar}`,
    r.result.monthGeneral.name,
    r.result.threeTransmissions.method,
    BRANCHES[r.result.threeTransmissions.initial],
    BRANCHES[r.result.threeTransmissions.middle],
    BRANCHES[r.result.threeTransmissions.final],
  ]);

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

/**
 * Wiki 文档 → CSV
 */
export function wikiToCsv(docs: WikiDocument[]): string {
  const headers = ["ID", "标题", "标签", "内容预览", "创建时间", "更新时间"];
  const rows = docs.map(d => [
    d.id ?? "",
    escapeCsvField(d.title),
    escapeCsvField(d.tags.join(";")),
    escapeCsvField(d.content.slice(0, 200)),
    new Date(d.savedAt).toISOString(),
    new Date(d.updatedAt).toISOString(),
  ]);

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

/** CSV 字段转义（处理逗号、双引号、换行符） */
function escapeCsvField(field: string | number | undefined): string {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/* ─────────────── 统一导出入口 ─────────────── */

/**
 * 执行导出
 * @returns 导出的文件名和内容
 */
export function performExport(options: ExportOptions): {
  filename: string;
  content: string;
  mimeType: string;
} {
  const personName = options.currentPerson?.name || "未命名";
  const timestamp = new Date().toISOString().slice(0, 10);

  switch (options.format) {
    case "md": {
      let content = "";
      if (options.zwds?.astrolabe) {
        content += zwdsToMarkdown(options.zwds, {
          includeDaily: options.includeDaily,
          includeHourly: options.includeHourly,
        });
      }
      if (options.liurenRecords && options.liurenRecords.length > 0) {
        if (content) content += "\n\n---\n\n";
        content += options.liurenRecords.map(liurenToMarkdown).join("\n\n---\n\n");
      }
      if (options.wikiDocs && options.wikiDocs.length > 0) {
        if (content) content += "\n\n---\n\n";
        content += wikiToMarkdown(options.wikiDocs, personName);
      }
      if (options.includeMeta) {
        content = `> 导出时间：${nowISO()}\n> 版本：1.0\n\n${content}`;
      }
      return {
        filename: `${safeFilename(personName)}-${timestamp}.md`,
        content,
        mimeType: "text/markdown;charset=utf-8",
      };
    }

    case "json": {
      const content = toJson(options);
      return {
        filename: `${safeFilename(personName)}-${timestamp}.json`,
        content,
        mimeType: "application/json;charset=utf-8",
      };
    }

    case "csv": {
      let content = "";
      if (options.liurenRecords && options.liurenRecords.length > 0) {
        content = liurenToCsv(options.liurenRecords);
      } else if (options.wikiDocs && options.wikiDocs.length > 0) {
        content = wikiToCsv(options.wikiDocs);
      } else {
        content = "暂无可导出的表格数据";
      }
      return {
        filename: `${safeFilename(personName)}-${timestamp}.csv`,
        content,
        mimeType: "text/csv;charset=utf-8",
      };
    }
  }
}
