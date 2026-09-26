/**
 * 数据洞察引擎：分析用户记录，提供智能洞察与建议
 *
 * 设计原则：
 * - 纯函数、无副作用，便于测试
 * - 轻量级算法，避免阻塞 UI（无 DOM 操作、无外部依赖）
 * - 支持两类数据源：大六壬记录（LiurenRecord）+ Wiki 文档（WikiDocument）
 * - 洞察类型：pattern（模式）、anomaly（异常）、trend（趋势）、suggestion（建议）
 */
import type { LiurenRecord, WikiDocument } from "./personDb";

/** 严重程度：low=参考级 / medium=值得关注 / high=强烈建议 */
export type Severity = "low" | "medium" | "high";

/** 洞察类型 */
export type InsightType = "pattern" | "anomaly" | "trend" | "suggestion";

/** 单条洞察 */
export interface Insight {
  /** 洞察类型 */
  type: InsightType;
  /** 翻译键（前端通过 i18n.t 解析，支持参数插值） */
  titleKey: string;
  /** 翻译参数（如 { count: 12, tag: "感情" }） */
  titleParams?: Record<string, string | number>;
  /** 详细描述（翻译键） */
  descriptionKey: string;
  /** 描述参数 */
  descriptionParams?: Record<string, string | number>;
  /** 严重程度 */
  severity: Severity;
  /** 关联数据（便于前端渲染图表或跳转） */
  data?: Record<string, unknown>;
}

/** 输入给洞察引擎的完整数据 */
export interface InsightsInput {
  liurenRecords: LiurenRecord[];
  wikiDocs: WikiDocument[];
  /** 现在时间戳（测试注入用，默认 Date.now()） */
  now?: number;
}

/** 聚合结果：便于前端直接渲染 */
export interface InsightsResult {
  insights: Insight[];
  /** 标签频次（按降序） */
  tagFrequencies: Array<{ tag: string; count: number }>;
  /** 月度活跃度（按时间升序，键为 YYYY-MM） */
  monthlyActivity: Array<{ month: string; liurenCount: number; wikiCount: number }>;
  /** 总体统计 */
  summary: {
    totalLiuren: number;
    totalWiki: number;
    totalTags: number;
    activeDays: number;
    averageGapDays: number;
  };
}

/* ───────────────────────── 工具函数 ───────────────────────── */

/** 毫秒 → 天数（保留两位小数） */
function msToDays(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60 * 24)) * 100) / 100;
}

/** 时间戳 → YYYY-MM（月度桶键） */
function toMonthKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** 时间戳 → YYYY-MM-DD（日期桶键） */
function toDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 统计频次并按降序排列 */
function countFrequencies<T>(items: T[]): Array<{ value: T; count: number }> {
  const map = new Map<T, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 简易线性回归：返回斜率（每月变化量）和 R²
 * 用于趋势分析
 */
function linearRegression(ys: number[]): { slope: number; r2: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, r2: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
    sumY2 += ys[i] * ys[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const meanY = sumY / n;
  const ssTot = sumY2 - n * meanY * meanY;
  if (ssTot === 0) return { slope, r2: 0 };
  // 计算 R²
  let ssRes = 0;
  const intercept = (sumY - slope * sumX) / n;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (ys[i] - predicted) ** 2;
  }
  const r2 = 1 - ssRes / ssTot;
  return { slope, r2: Math.max(0, r2) };
}

/* ───────────────────────── 核心分析 ───────────────────────── */

/**
 * 模式识别：高频标签、事件类型分布、问题类别
 */
function analyzePatterns(input: InsightsInput): Insight[] {
  const { liurenRecords, wikiDocs } = input;
  const insights: Insight[] = [];
  if (liurenRecords.length === 0 && wikiDocs.length === 0) return insights;

  // 1. 高频标签（大六壬 + Wiki）
  const allTags = [
    ...liurenRecords.flatMap(r => r.tags ?? []),
    ...wikiDocs.flatMap(d => d.tags ?? []),
  ];
  const tagFreq = countFrequencies(allTags);
  if (tagFreq.length > 0) {
    const [top] = tagFreq;
    if (top.count >= 3) {
      insights.push({
        type: "pattern",
        titleKey: "insights.pattern.topTag.title",
        titleParams: { tag: top.value, count: top.count },
        descriptionKey: "insights.pattern.topTag.desc",
        descriptionParams: {
          tag: top.value,
          count: top.count,
          total: allTags.length,
          ratio: Math.round((top.count / Math.max(allTags.length, 1)) * 100),
        },
        severity: top.count >= 10 ? "high" : top.count >= 5 ? "medium" : "low",
        data: { tag: top.value, count: top.count },
      });
    }
    // 多个标签占据主导（前 3 标签占比 > 70%）
    if (tagFreq.length >= 3 && allTags.length >= 5) {
      const top3 = tagFreq.slice(0, 3).reduce((sum, t) => sum + t.count, 0);
      const ratio = top3 / allTags.length;
      if (ratio > 0.7) {
        insights.push({
          type: "pattern",
          titleKey: "insights.pattern.tagConcentration.title",
          titleParams: { ratio: Math.round(ratio * 100) },
          descriptionKey: "insights.pattern.tagConcentration.desc",
          descriptionParams: {
            tags: tagFreq
              .slice(0, 3)
              .map(t => t.value)
              .join("、"),
          },
          severity: "medium",
          data: { top3: tagFreq.slice(0, 3), ratio },
        });
      }
    }
  }

  // 2. 常用问题类别（从问题文本中提取关键词模式）
  const questionPatterns = detectQuestionCategories(liurenRecords);
  if (questionPatterns.length > 0 && questionPatterns[0].count >= 3) {
    const [top] = questionPatterns;
    insights.push({
      type: "pattern",
      titleKey: "insights.pattern.questionCategory.title",
      titleParams: { category: top.value, count: top.count },
      descriptionKey: "insights.pattern.questionCategory.desc",
      descriptionParams: { category: top.value, count: top.count },
      severity: "low",
      data: { category: top.value, count: top.count },
    });
  }

  // 3. Wiki 文档规模洞察
  if (wikiDocs.length >= 10) {
    insights.push({
      type: "pattern",
      titleKey: "insights.pattern.wikiScale.title",
      titleParams: { count: wikiDocs.length },
      descriptionKey: "insights.pattern.wikiScale.desc",
      descriptionParams: { count: wikiDocs.length },
      severity: wikiDocs.length >= 50 ? "high" : "medium",
      data: { wikiCount: wikiDocs.length },
    });
  }

  return insights;
}

/**
 * 问题类别探测：从问题文本中识别常见关键词
 * 返回类别名与计数
 */
function detectQuestionCategories(
  records: LiurenRecord[],
): Array<{ value: string; count: number }> {
  // 类别关键词映射（按优先级）
  const categories: Array<{ name: string; keywords: string[] }> = [
    { name: "感情", keywords: ["感情", "恋爱", "婚姻", "对象", "桃花", "感情", "love"] },
    { name: "事业", keywords: ["工作", "事业", "升职", "跳槽", "职业", "job", "career"] },
    { name: "财运", keywords: ["财", "投资", "理财", "收入", "money", "财运"] },
    { name: "健康", keywords: ["健康", "病", "身体", "医", "health"] },
    { name: "学业", keywords: ["考试", "学业", "升学", "读书", "study"] },
    { name: "出行", keywords: ["出行", "旅游", "出差", "搬迁", "travel"] },
  ];
  const results: Array<{ value: string; count: number }> = [];
  for (const cat of categories) {
    const count = records.filter(r => {
      const q = (r.question || "").toLowerCase();
      return cat.keywords.some(kw => q.includes(kw.toLowerCase()));
    }).length;
    if (count > 0) results.push({ value: cat.name, count });
  }
  return results.sort((a, b) => b.count - a.count);
}

/**
 * 异常检测：长时间未活动、异常间隔、异常记录长度
 */
function detectAnomalies(input: InsightsInput): Insight[] {
  const { liurenRecords, wikiDocs, now = Date.now() } = input;
  const insights: Insight[] = [];

  // 合并所有活动的时间戳（按升序）
  const allTimestamps = [
    ...liurenRecords.map(r => r.savedAt),
    ...wikiDocs.map(d => d.savedAt),
  ].sort((a, b) => a - b);

  if (allTimestamps.length === 0) return insights;

  // 1. 长时间未活动
  const lastActivity = allTimestamps[allTimestamps.length - 1];
  const gapSinceLast = msToDays(now - lastActivity);
  if (gapSinceLast >= 30) {
    insights.push({
      type: "anomaly",
      titleKey: "insights.anomaly.inactiveLong.title",
      titleParams: { days: Math.round(gapSinceLast) },
      descriptionKey: "insights.anomaly.inactiveLong.desc",
      descriptionParams: { days: Math.round(gapSinceLast) },
      severity: gapSinceLast >= 180 ? "high" : gapSinceLast >= 60 ? "medium" : "low",
      data: { days: gapSinceLast },
    });
  }

  // 2. 活动间隔异常（两次记录之间的间隔显著大于平均值）
  if (allTimestamps.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < allTimestamps.length; i++) {
      gaps.push(allTimestamps[i] - allTimestamps[i - 1]);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const maxGap = Math.max(...gaps);
    // 最大间隔 > 平均值 3 倍 且 > 14 天
    if (maxGap > avgGap * 3 && maxGap > 14 * 24 * 60 * 60 * 1000) {
      insights.push({
        type: "anomaly",
        titleKey: "insights.anomaly.gapSpike.title",
        titleParams: { days: Math.round(msToDays(maxGap)) },
        descriptionKey: "insights.anomaly.gapSpike.desc",
        descriptionParams: {
          maxDays: Math.round(msToDays(maxGap)),
          avgDays: Math.round(msToDays(avgGap)),
        },
        severity: "medium",
        data: { maxGapDays: msToDays(maxGap), avgGapDays: msToDays(avgGap) },
      });
    }
  }

  // 3. 异常长的问题文本（可能误把整段内容填入问题框）
  const avgQuestionLen =
    liurenRecords.length > 0
      ? liurenRecords.reduce((sum, r) => sum + (r.question?.length ?? 0), 0) / liurenRecords.length
      : 0;
  for (const r of liurenRecords) {
    const len = r.question?.length ?? 0;
    if (avgQuestionLen > 0 && len > avgQuestionLen * 5 && len >= 200) {
      insights.push({
        type: "anomaly",
        titleKey: "insights.anomaly.longQuestion.title",
        titleParams: { length: len },
        descriptionKey: "insights.anomaly.longQuestion.desc",
        descriptionParams: { length: len, avg: Math.round(avgQuestionLen) },
        severity: "low",
        data: { recordId: r.id, length: len, avgLength: Math.round(avgQuestionLen) },
      });
      break; // 只报告一条，避免重复打扰
    }
  }

  return insights;
}

/**
 * 趋势分析：活动量随时间变化、标签偏好漂移
 */
function analyzeTrends(input: InsightsInput): Insight[] {
  const { liurenRecords, wikiDocs } = input;
  const insights: Insight[] = [];

  // 构建最近 6 个月的活跃度序列
  const monthlyBuckets = buildMonthlyActivity(liurenRecords, wikiDocs, 6, input.now);
  if (monthlyBuckets.length < 3) return insights; // 数据不足以判断趋势

  const counts = monthlyBuckets.map(b => b.liurenCount + b.wikiCount);
  const { slope, r2 } = linearRegression(counts);

  // 显著上升（斜率 > 0 且 R² > 0.3）
  if (slope > 0.3 && r2 > 0.3) {
    insights.push({
      type: "trend",
      titleKey: "insights.trend.rising.title",
      titleParams: { slope: Math.round(slope * 10) / 10 },
      descriptionKey: "insights.trend.rising.desc",
      descriptionParams: { months: monthlyBuckets.length },
      severity: slope > 1 ? "high" : "medium",
      data: { slope, r2, direction: "up" },
    });
  } else if (slope < -0.3 && r2 > 0.3) {
    // 显著下降
    insights.push({
      type: "trend",
      titleKey: "insights.trend.declining.title",
      titleParams: { slope: Math.round(Math.abs(slope) * 10) / 10 },
      descriptionKey: "insights.trend.declining.desc",
      descriptionParams: { months: monthlyBuckets.length },
      severity: Math.abs(slope) > 1 ? "high" : "medium",
      data: { slope, r2, direction: "down" },
    });
  }

  // 标签偏好漂移：对比前 3 个月与后 3 个月的 top 标签
  if (monthlyBuckets.length >= 6) {
    const early = monthlyBuckets.slice(0, 3);
    const late = monthlyBuckets.slice(3);
    const earlyTagFreq = countFrequencies(
      liurenRecords
        .filter(r => {
          const mk = toMonthKey(r.savedAt);
          return early.some(b => b.month === mk);
        })
        .flatMap(r => r.tags ?? []),
    );
    const lateTagFreq = countFrequencies(
      liurenRecords
        .filter(r => {
          const mk = toMonthKey(r.savedAt);
          return late.some(b => b.month === mk);
        })
        .flatMap(r => r.tags ?? []),
    );
    if (earlyTagFreq.length > 0 && lateTagFreq.length > 0) {
      const earlyTop = earlyTagFreq[0].value;
      const lateTop = lateTagFreq[0].value;
      if (earlyTop !== lateTop) {
        insights.push({
          type: "trend",
          titleKey: "insights.trend.tagShift.title",
          titleParams: { from: earlyTop, to: lateTop },
          descriptionKey: "insights.trend.tagShift.desc",
          descriptionParams: { from: earlyTop, to: lateTop },
          severity: "low",
          data: { from: earlyTop, to: lateTop },
        });
      }
    }
  }

  return insights;
}

/**
 * 生成建议：基于以上分析结果给出可行动建议
 */
function generateSuggestions(input: InsightsInput, otherInsights: Insight[]): Insight[] {
  const { liurenRecords, wikiDocs } = input;
  const insights: Insight[] = [];

  // 1. 高频标签 → 建议创建模板
  const allTags = [
    ...liurenRecords.flatMap(r => r.tags ?? []),
    ...wikiDocs.flatMap(d => d.tags ?? []),
  ];
  const tagFreq = countFrequencies(allTags);
  if (tagFreq.length > 0 && tagFreq[0].count >= 5) {
    insights.push({
      type: "suggestion",
      titleKey: "insights.suggestion.createTemplate.title",
      titleParams: { tag: tagFreq[0].value },
      descriptionKey: "insights.suggestion.createTemplate.desc",
      descriptionParams: { tag: tagFreq[0].value, count: tagFreq[0].count },
      severity: tagFreq[0].count >= 10 ? "high" : "medium",
      data: { tag: tagFreq[0].value, count: tagFreq[0].count, action: "createTemplate" },
    });
  }

  // 2. 无标签记录占比高 → 建议整理标签
  const totalRecords = liurenRecords.length + wikiDocs.length;
  const untaggedCount =
    liurenRecords.filter(r => !r.tags || r.tags.length === 0).length +
    wikiDocs.filter(d => !d.tags || d.tags.length === 0).length;
  if (totalRecords >= 5 && untaggedCount / totalRecords > 0.4) {
    insights.push({
      type: "suggestion",
      titleKey: "insights.suggestion.organizeTags.title",
      titleParams: { ratio: Math.round((untaggedCount / totalRecords) * 100) },
      descriptionKey: "insights.suggestion.organizeTags.desc",
      descriptionParams: {
        untagged: untaggedCount,
        total: totalRecords,
      },
      severity: "medium",
      data: { untaggedCount, totalRecords },
    });
  }

  // 3. 长时间未活动 → 建议保持习惯
  const hasLongInactive = otherInsights.some(
    i => i.type === "anomaly" && i.titleKey === "insights.anomaly.inactiveLong.title",
  );
  if (hasLongInactive) {
    insights.push({
      type: "suggestion",
      titleKey: "insights.suggestion.keepHabit.title",
      titleParams: {},
      descriptionKey: "insights.suggestion.keepHabit.desc",
      descriptionParams: {},
      severity: "medium",
      data: { action: "keepHabit" },
    });
  }

  // 4. 标签数过多（>20 个不同标签）→ 建议合并相似标签
  const uniqueTags = new Set(allTags);
  if (uniqueTags.size > 20 && totalRecords >= 10) {
    insights.push({
      type: "suggestion",
      titleKey: "insights.suggestion.consolidateTags.title",
      titleParams: { count: uniqueTags.size },
      descriptionKey: "insights.suggestion.consolidateTags.desc",
      descriptionParams: { count: uniqueTags.size },
      severity: uniqueTags.size > 40 ? "high" : "medium",
      data: { uniqueTagCount: uniqueTags.size },
    });
  }

  // 5. Wiki 文档与六壬记录联动不足 → 建议关联写作
  if (liurenRecords.length >= 10 && wikiDocs.length === 0) {
    insights.push({
      type: "suggestion",
      titleKey: "insights.suggestion.linkWiki.title",
      titleParams: { count: liurenRecords.length },
      descriptionKey: "insights.suggestion.linkWiki.desc",
      descriptionParams: { count: liurenRecords.length },
      severity: "medium",
      data: { action: "linkWiki", liurenCount: liurenRecords.length },
    });
  }

  return insights;
}

/* ───────────────────────── 聚合构建 ───────────────────────── */

/**
 * 构建最近 N 个月的活跃度桶
 * 缺失的月份补 0（保证时间序列连续）
 */
function buildMonthlyActivity(
  liurenRecords: LiurenRecord[],
  wikiDocs: WikiDocument[],
  months: number,
  nowTs?: number,
): Array<{ month: string; liurenCount: number; wikiCount: number }> {
  const now = new Date(nowTs ?? Date.now());
  const buckets: Array<{ month: string; liurenCount: number; wikiCount: number }> = [];
  // 生成最近 N 个月的键
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ month: key, liurenCount: 0, wikiCount: 0 });
  }
  // 填充数据
  for (const r of liurenRecords) {
    const mk = toMonthKey(r.savedAt);
    const bucket = buckets.find(b => b.month === mk);
    if (bucket) bucket.liurenCount++;
  }
  for (const d of wikiDocs) {
    const mk = toMonthKey(d.savedAt);
    const bucket = buckets.find(b => b.month === mk);
    if (bucket) bucket.wikiCount++;
  }
  return buckets;
}

/** 计算活跃天数（去重） */
function countActiveDays(liurenRecords: LiurenRecord[], wikiDocs: WikiDocument[]): number {
  const days = new Set<string>();
  for (const r of liurenRecords) days.add(toDayKey(r.savedAt));
  for (const d of wikiDocs) days.add(toDayKey(d.savedAt));
  return days.size;
}

/** 计算平均活动间隔（天） */
function calcAverageGap(liurenRecords: LiurenRecord[], wikiDocs: WikiDocument[]): number {
  const ts = [...liurenRecords.map(r => r.savedAt), ...wikiDocs.map(d => d.savedAt)].sort(
    (a, b) => a - b,
  );
  if (ts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < ts.length; i++) total += ts[i] - ts[i - 1];
  return msToDays(total / (ts.length - 1));
}

/* ───────────────────────── 主入口 ───────────────────────── */

/**
 * 生成全部数据洞察
 *
 * @param input 输入数据（大六壬记录 + Wiki 文档）
 * @returns 聚合后的洞察结果，含 insights 列表、统计摘要、图表数据
 */
export function generateInsights(input: InsightsInput): InsightsResult {
  const { liurenRecords, wikiDocs } = input;

  // 聚合基础数据
  const allTags = [
    ...liurenRecords.flatMap(r => r.tags ?? []),
    ...wikiDocs.flatMap(d => d.tags ?? []),
  ];
  const tagFrequencies = countFrequencies(allTags).map(f => ({
    tag: f.value,
    count: f.count,
  }));
  const monthlyActivity = buildMonthlyActivity(liurenRecords, wikiDocs, 6, input.now);
  const summary = {
    totalLiuren: liurenRecords.length,
    totalWiki: wikiDocs.length,
    totalTags: new Set(allTags).size,
    activeDays: countActiveDays(liurenRecords, wikiDocs),
    averageGapDays: calcAverageGap(liurenRecords, wikiDocs),
  };

  // 分阶段生成洞察（建议阶段依赖前序结果）
  const patterns = analyzePatterns(input);
  const anomalies = detectAnomalies(input);
  const trends = analyzeTrends(input);
  const baseInsights = [...patterns, ...anomalies, ...trends];
  const suggestions = generateSuggestions(input, baseInsights);

  return {
    insights: [...baseInsights, ...suggestions],
    tagFrequencies,
    monthlyActivity,
    summary,
  };
}

/**
 * 生成 Markdown 格式的数据摘要报告（便于 AI 分析）
 *
 * 注意：根据 CLAUDE.md 约定，不包含 K 线量化数据（自定分值易被 AI 当作命理定论）
 *
 * @param result 洞察结果
 * @param t 翻译函数（键 + 参数 → 文本），默认直接输出键名
 * @param locale 语言（用于静态文案分支）
 */
export function generateMarkdownReport(
  result: InsightsResult,
  t: (key: string, params?: Record<string, string | number>) => string = k => k,
  locale: "zh-CN" | "en-US" = "zh-CN",
): string {
  const zh = locale === "zh-CN";
  const lines: string[] = [];
  lines.push(zh ? "# 数据洞察报告\n" : "# Data Insights Report\n");

  // 摘要
  lines.push(zh ? "## 总览\n" : "## Summary\n");
  lines.push(
    zh
      ? `- 大六壬记录总数：${result.summary.totalLiuren}`
      : `- Total Liuren Records: ${result.summary.totalLiuren}`,
  );
  lines.push(
    zh
      ? `- Wiki 文档总数：${result.summary.totalWiki}`
      : `- Total Wiki Docs: ${result.summary.totalWiki}`,
  );
  lines.push(
    zh ? `- 标签种类数：${result.summary.totalTags}` : `- Unique Tags: ${result.summary.totalTags}`,
  );
  lines.push(
    zh ? `- 活跃天数：${result.summary.activeDays}` : `- Active Days: ${result.summary.activeDays}`,
  );
  lines.push(
    zh
      ? `- 平均活动间隔：${result.summary.averageGapDays} 天`
      : `- Avg Gap: ${result.summary.averageGapDays} days`,
  );
  lines.push("");

  // 高频标签
  if (result.tagFrequencies.length > 0) {
    lines.push(zh ? "## 高频标签 Top 10\n" : "## Top 10 Tags\n");
    const top = result.tagFrequencies.slice(0, 10);
    for (const tf of top) {
      lines.push(`- **${tf.tag}**：${tf.count}`);
    }
    lines.push("");
  }

  // 月度活跃度
  lines.push(zh ? "## 近 6 个月活跃度\n" : "## Recent 6-Month Activity\n");
  lines.push(zh ? "| 月份 | 六壬 | Wiki |" : "| Month | Liuren | Wiki |");
  lines.push("|------|--------|------|");
  for (const m of result.monthlyActivity) {
    lines.push(`| ${m.month} | ${m.liurenCount} | ${m.wikiCount} |`);
  }
  lines.push("");

  // 关键洞察
  if (result.insights.length > 0) {
    lines.push(zh ? "## 关键洞察\n" : "## Key Insights\n");
    // 按严重程度排序
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...result.insights].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
    for (const ins of sorted) {
      const typeLabel = zh
        ? ({ pattern: "模式", anomaly: "异常", trend: "趋势", suggestion: "建议" } as const)[
            ins.type
          ]
        : (
            {
              pattern: "Pattern",
              anomaly: "Anomaly",
              trend: "Trend",
              suggestion: "Suggestion",
            } as const
          )[ins.type];
      const severityLabel = zh
        ? ({ low: "低", medium: "中", high: "高" } as const)[ins.severity]
        : ({ low: "Low", medium: "Medium", high: "High" } as const)[ins.severity];
      lines.push(
        zh
          ? `- [${severityLabel}] **${typeLabel}**：${t(ins.titleKey, ins.titleParams)}——${t(ins.descriptionKey, ins.descriptionParams)}`
          : `- [${severityLabel}] **${typeLabel}**: ${t(ins.titleKey, ins.titleParams)} - ${t(ins.descriptionKey, ins.descriptionParams)}`,
      );
    }
    lines.push("");
  }

  lines.push(
    zh
      ? "_注：本报告不含人生 K 线量化数据，避免自定分值被误读为命理定论。_"
      : "_Note: This report excludes life K-line quantitative data to avoid misinterpreting custom scores as fate conclusions._",
  );

  return lines.join("\n");
}
