/**
 * AI 导出 · JSON 序列化：把整张命盘 + 当前运限序列化为结构化 JSON，
 * 供 Markdown / TOON 导出与 AI 推理消费。
 * 注：人生K线（含月K线、十年规划表的均值/高光/低谷列）为盘面自研量化参考，
 * 不随任何导出携带——自定分值易被 AI 当作命理定论引用，造成误报。
 */
import { util } from "iztro";
import type { Astrolabe, Horoscope, Zwds } from "../useZwds";
import {
  MUTAGEN_CHARS,
  MUTAGEN_TABLE_LABEL,
  STEMS,
  bodyPalaceBranchOf,
  type Scope,
} from "../utils";
import { lunarToSolarStr } from "../lunar";
import {
  analyzeChart,
  buildChartIndex,
  detectHoroscopePatterns,
  scanHoroscopePatterns,
  type HoroPattern,
} from "../analysis";
import { RULEBOOK_MD, STAR_MUTAGEN_MD, topicGuidesMd } from "../knowledge";
import { serializeStar, serializeAdjStar, STAR_WEIGHT_NOTE, AGE_NOTE } from "./starWeights";

export { AGE_NOTE };

/** 导出选项：流日默认不导出（无关层级稀释 AI 注意力，择日场景再勾选） */
export type ExportOptions = {
  /** 附当前观测流日（择日用） */
  withDaily?: boolean;
};

/** 本宫自化（离心）：宫干四化命中本宫主星/辅星 */
export function getSelfMutagens(p: Astrolabe["palaces"][number]) {
  const table = util.getMutagensByHeavenlyStem(p.heavenlyStem) as string[];
  const own = new Set([...p.majorStars, ...p.minorStars].map((s) => s.name as string));
  return table
    .map((star, k) => ({ star, mutagen: MUTAGEN_CHARS[k] }))
    .filter((x) => own.has(x.star));
}

export function schoolLabel(algorithm: string): string {
  return algorithm === "zhongzhou"
    ? "中州派（王亭之体系）"
    : "南派三合（《紫微斗数全书》通行版）";
}

function serializeHoroscopeItem(item: Horoscope[Scope]) {
  return {
    index: item.index,
    name: item.name,
    heavenlyStem: item.heavenlyStem,
    earthlyBranch: item.earthlyBranch,
    palaceNames: item.palaceNames,
    mutagen: item.mutagen,
    ...(item.stars ? { stars: item.stars.map((g) => g.map(serializeStar)) } : {}),
  };
}

/** 当前流年的流月一览（含闰月位、逐月格局扫描） */
export function getMonthlyOfYear(z: Zwds) {
  const { astrolabe, pick, months } = z;
  if (!astrolabe) return [];
  const ix = buildChartIndex(astrolabe); // 十二流月共享一份索引
  const results: Record<string, unknown>[] = [];
  for (const cell of months) {
    const dateStr = lunarToSolarStr(pick.year, cell.month, 15, cell.leap);
    if (!dateStr) continue;
    try {
      const h = astrolabe.horoscope(dateStr, 0);
      const pats = detectHoroscopePatterns(
        astrolabe,
        "monthly",
        h.monthly.index,
        h.monthly.heavenlyStem as string,
        h.monthly.earthlyBranch as string,
        ix
      );
      results.push({
        month: cell.month,
        isLeapMonth: cell.leap,
        label: cell.label,
        ganZhi: cell.gz,
        ...serializeHoroscopeItem(h.monthly),
        patterns: pats.map((p) => `${p.name}(${p.kind})`),
      });
    } catch (e) {
      console.warn("[serialize] Failed to compute monthly horoscope:", e);
    }
  }
  return results;
}

/** 当前拨盘所指的流月单元（含闰月判定） */
export function currentMonthCell(z: Zwds) {
  return z.months.find((m) => m.month === z.pick.month && m.leap === z.effLeap);
}

/** 当前大限+流年+流月的运限格局扫描（以运限命宫三方为中心，与盘面面板共用入口） */
export function horoscopePatternsOf(
  z: Zwds
): { decadal: HoroPattern[]; yearly: HoroPattern[]; monthly: HoroPattern[] } | null {
  const a = z.astrolabe;
  const h = z.horoscope;
  if (!a || !h) return null;
  return scanHoroscopePatterns(a, h);
}

export function buildExportData(z: Zwds, opts: ExportOptions = {}) {
  const a = z.astrolabe;
  if (!a) return null;
  const h = z.horoscope;

  const meta = {
    app: "react-zwds",
    engine: "iztro (https://github.com/SylarLong/iztro)",
    school: schoolLabel(z.input.algorithm),
    yearDivide: z.input.yearDivide === "exact" ? "立春分界" : "正月初一分界",
    astroType:
      z.input.algorithm !== "zhongzhou" || z.input.astroType === "heaven"
        ? "天盘"
        : z.input.astroType === "earth"
          ? "地盘（身宫起局重排）"
          : "人盘（福德宫起局重排）",
    mutagenTable: MUTAGEN_TABLE_LABEL[z.input.mutagenTable],
    /** 实际生效的十干四化全表（禄/权/科/忌），生年与运限四化均依此 */
    mutagenTableDetail: Object.fromEntries(
      STEMS.map((s) => [s, util.getMutagensByHeavenlyStem(s as never) as string[]])
    ),
    dayDivide: z.input.dayDivide === "current" ? "晚子时归当日" : "晚子时归次日",
    exportedAt: new Date().toISOString(),
    note: "所有命盘分析解读请以 meta.school 指定流派为准；brightness=星耀亮度（庙旺得利平不陷），mutagen=生年四化，selfMutagens=自化（宫干四化入本宫·离心），各运限四化见 horoscope 对应层级。analysis 字段为确定性结构分析（格局/三方四正快照/飞宫矩阵/四化传导链/夹宫/借星），推理时请直接引用，勿自行重算宫位关系。本导出不含任何量化评分数据（如人生K线），吉凶请依星耀、四化、格局本身推断。palaces[].ages=各宫小限岁数（虚岁）——" + AGE_NOTE,
    starWeightNote: STAR_WEIGHT_NOTE,
  };

  const input = {
    name: z.input.name || "无名",
    gender: z.input.gender,
    calendar: z.input.calendar,
    date: z.input.date,
    timeIndex: z.input.timeIndex,
    isLeapMonth: z.input.isLeapMonth,
    exactTime: z.input.exactTime || null,
    trueSolar: z.trueSolar,
    /** 常居住地：不参与排盘，供 AI 结合地域背景（气候、方位、迁移）辅助分析 */
    residence: z.input.residence || null,
  };

  const basic = {
    gender: a.gender,
    solarDate: a.solarDate,
    lunarDate: a.lunarDate,
    chineseDate: a.chineseDate,
    time: a.time,
    timeRange: a.timeRange,
    sign: a.sign,
    zodiac: a.zodiac,
    earthlyBranchOfSoulPalace: a.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: bodyPalaceBranchOf(a.palaces, a.earthlyBranchOfBodyPalace),
    soul: a.soul,
    body: a.body,
    fiveElementsClass: a.fiveElementsClass,
    startAge: z.decades[0]?.range[0] ?? null,
  };

  const palaces = a.palaces.map((p) => ({
    index: p.index,
    name: p.name,
    isBodyPalace: p.isBodyPalace,
    isOriginalPalace: p.isOriginalPalace,
    heavenlyStem: p.heavenlyStem,
    earthlyBranch: p.earthlyBranch,
    majorStars: p.majorStars.map(serializeStar),
    minorStars: p.minorStars.map(serializeStar),
    /** weight=杂耀权重（中=可参与断事，低=仅叠加参考），口径见 meta.starWeightNote */
    adjectiveStars: p.adjectiveStars.map(serializeAdjStar),
    changsheng12: p.changsheng12,
    boshi12: p.boshi12,
    jiangqian12: p.jiangqian12,
    suiqian12: p.suiqian12,
    decadal: p.decadal,
    ages: p.ages,
    selfMutagens: getSelfMutagens(p),
  }));

  const horoscope = h
    ? {
        observedSolarDate: h.solarDate,
        observedLunarDate: h.lunarDate,
        nominalAge: h.age.nominalAge,
        pick: { ...z.pick, clampedDay: z.clampedDay },
        decadal: serializeHoroscopeItem(h.decadal),
        age: { ...serializeHoroscopeItem(h.age), nominalAge: h.age.nominalAge, note: AGE_NOTE },
        yearly: {
          ...serializeHoroscopeItem(h.yearly),
          yearlyDecStar: h.yearly.yearlyDecStar,
        },
        monthly: serializeHoroscopeItem(h.monthly),
        /* 流日默认不导出：与所问主题无关时纯属噪音，择日场景由用户勾选附加 */
        ...(opts.withDaily ? { daily: serializeHoroscopeItem(h.daily) } : {}),
        yearsOfCurrentDecade: z.years,
        monthlyOfCurrentYear: getMonthlyOfYear(z),
        /** 运限格局扫描：以大限/流年命宫三方为中心（本命星曜+运限四化+运限流曜） */
        horoscopePatterns: horoscopePatternsOf(z),
      }
    : null;

  return {
    meta,
    input,
    basic,
    palaces,
    analysis: z.analysis ?? analyzeChart(a),
    horoscope,
    /** L1 知识层：推理规则速查（Markdown 文本，供 AI 直接遵循） */
    rulebook: RULEBOOK_MD,
    /** L3 知识层：十四主星四化要诀 + 分主题推理指引 */
    starEssentials: STAR_MUTAGEN_MD,
    topicGuides: topicGuidesMd(),
  };
}
