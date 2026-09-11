import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import type { Person } from "@/lib/db";
import { personToBaziInput, applyScopeToHoroscopeStore, parseDatetime, getActivePerson } from "@/lib/horoscope-utils";
import {
  analyzeChart,
  buildChartIndex,
  detectPatterns,
  getSanfangSnapshots,
  getBorrowedStars,
  getFlyMatrix,
  traceMutagenChains,
  getJiaGong,
  detectHoroscopePatterns,
  scanHoroscopePatterns,
  type Pattern,
  type SanfangSnapshot,
  type BorrowedInfo,
  type FlyMatrix,
  type MutagenChains,
  type JiaGong,
  type HoroPattern,
  type ChartAnalysis,
} from "@/modules/ziwei/core/analysis";
import {
  effectiveBirth,
  DEFAULT_BIRTH_INPUT,
  type BirthInput,
  type Astrolabe,
  type Horoscope,
  type DecadeInfo,
} from "@/modules/ziwei/core/useZwds";
import { MUTAGEN_TABLES } from "@/modules/ziwei/core/utils";
import type { ChartIndex } from "@/modules/ziwei/core/chartIndex";
import type { HoroscopeScope } from "@/lib/peep-api";

/* ───────── Person → BirthInput ───────── */

function personToBirthInput(person: Person): BirthInput {
  const gender = person.gender === "female" ? "女" : "男";
  const calendar = person.isLunar ? "lunar" : "solar";

  let timeIndex = 6; // 默认午时（与 bazi 模块 hour=12 一致）
  let exactTime = "";
  if (person.birthTime) {
    if (/^\d{1,2}:\d{2}$/.test(person.birthTime)) {
      const [h, m] = person.birthTime.split(":").map(Number);
      const hour = h + m / 60;
      if (hour >= 23) {
        timeIndex = 12;
      } else {
        timeIndex = Math.floor((hour + 1) / 2);
      }
      exactTime = person.birthTime;
    } else {
      const parsed = parseInt(person.birthTime, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 12) {
        timeIndex = parsed;
      }
    }
  }

  return {
    ...DEFAULT_BIRTH_INPUT,
    name: person.name,
    gender: gender as "男" | "女",
    calendar,
    date: person.birthDate,
    timeIndex,
    isLeapMonth: false,
    exactTime,
    useTrueSolar: false,
    // algorithm/yearDivide/mutagenTable 已在 DEFAULT_BIRTH_INPUT 中强制为中州派+立春
    dayDivide: "forward",
    astroType: "heaven",
  };
}

/* ───────── 起盘 ───────── */

function createAstrolabe(input: BirthInput): Astrolabe {
  const effective = effectiveBirth(input);
  try {
    return astro.withOptions({
      type: effective.calendar,
      dateStr: effective.dateStr,
      timeIndex: effective.timeIndex,
      gender: input.gender as unknown as GenderName,
      isLeapMonth: input.isLeapMonth,
      fixLeap: true,
      language: "zh-CN",
      astroType: input.algorithm === "zhongzhou" ? input.astroType : "heaven",
      config: {
        algorithm: input.algorithm,
        yearDivide: input.yearDivide,
        horoscopeDivide: input.yearDivide,
        dayDivide: input.dayDivide,
        mutagens: (MUTAGEN_TABLES[input.mutagenTable] ?? MUTAGEN_TABLES.default) as never,
      },
    });
  } catch (e) {
    // 保留原始错误信息以便调用方诊断
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[peep-api-ziwei] 排盘失败:", msg);
    throw new Error(`紫微排盘失败：${msg}`);
  }
}

/* ───────── 延迟函数 ───────── */

/* ───────── ziweiAPI ───────── */

/** 提取运限数据摘要 */
function extractHoroscopeSummary(
  astrolabe: Astrolabe,
  scope: HoroscopeScope,
): Record<string, unknown> | null {
  try {
    // 解析 datetime 为目标公历日期
    const dt = parseDatetime(scope.datetime);
    // 转换为 YYYY-MM-DD 格式
    const targetDate = `${dt.year}-${String(dt.month).padStart(2, "0")}-${String(dt.day).padStart(2, "0")}`;
    // 转换为时辰索引 (0-11)
    const hourIndex = Math.floor((dt.hour + 1) / 2) % 12;

    // 调用 iztro 的 horoscope 方法获取运限
    const horoscope = astrolabe.horoscope(targetDate, hourIndex);

    // 根据 level 返回对应层级的数据
    const result: Record<string, unknown> = {};

    if (["dayun", "liunian", "liuyue", "liuri", "liushi"].includes(scope.level)) {
      result.大限 = horoscope.decadal;
    }
    if (["liunian", "liuyue", "liuri", "liushi"].includes(scope.level)) {
      result.流年 = horoscope.yearly;
    }
    if (["liuyue", "liuri", "liushi"].includes(scope.level)) {
      result.流月 = horoscope.monthly;
    }
    if (["liuri", "liushi"].includes(scope.level)) {
      result.流日 = horoscope.daily;
    }
    if (scope.level === "liushi") {
      result.流时 = horoscope.hourly;
    }

    return result;
  } catch (e) {
    console.error("[peep-api-ziwei] 运限计算失败", e);
    return null;
  }
}

export const ziweiAPI = {
  /**
   * 紫微排盘工作流：
   * 1. 读取人物信息
   * 2. 计算本命盘
   * 3. 根据 scope 计算运限（大限/流年/流月/流日/流时）
   * 4. 同步到 horoscopeStore UI
   * 5. 返回完整排盘数据（纯数据操作，不做页面跳转）
   */
  async chart(personId: number, scope: HoroscopeScope): Promise<{
    星盘: Astrolabe;
    运限: Record<string, unknown> | null;
  }> {
    // 1. 读取人物
    const person = await getActivePerson(personId);

    // 2. 计算排盘（createAstrolabe 失败时直接抛出异常）
    const input = personToBirthInput(person);
    const a = createAstrolabe(input);

    // 3. 提取运限数据
    const horoscopeSummary = extractHoroscopeSummary(a, scope);

    // 4. 同步时间维度选择器 UI
    const baziInput = personToBaziInput(person);
    applyScopeToHoroscopeStore(baziInput, scope);

    return {
      星盘: a,
      运限: horoscopeSummary,
    };
  },
};

/* ───────── analysisAPI ───────── */

export const analysisAPI = {
  detectPatterns(astrolabe: Astrolabe, ix?: ChartIndex): Pattern[] {
    return detectPatterns(astrolabe, ix);
  },
  getSanfangSnapshots(astrolabe: Astrolabe, ix?: ChartIndex): SanfangSnapshot[] {
    return getSanfangSnapshots(astrolabe, ix);
  },
  getBorrowedStars(astrolabe: Astrolabe, ix?: ChartIndex): BorrowedInfo[] {
    return getBorrowedStars(astrolabe, ix);
  },
  buildChartIndex(astrolabe: Astrolabe): ChartIndex {
    return buildChartIndex(astrolabe);
  },
  getFlyMatrix(astrolabe: Astrolabe, ix?: ChartIndex): FlyMatrix {
    return getFlyMatrix(astrolabe, ix);
  },
  traceMutagenChains(astrolabe: Astrolabe, ix?: ChartIndex): MutagenChains {
    return traceMutagenChains(astrolabe, ix);
  },
  getJiaGong(astrolabe: Astrolabe, ix?: ChartIndex): JiaGong[] {
    return getJiaGong(astrolabe, ix);
  },
  detectHoroscopePatterns(
    astrolabe: Astrolabe,
    scope: "decadal" | "yearly" | "monthly",
    soulIdxOfScope: number,
    stem: string,
    branch: string,
    ix?: ChartIndex,
  ): HoroPattern[] {
    return detectHoroscopePatterns(astrolabe, scope, soulIdxOfScope, stem, branch, ix);
  },
  scanHoroscopePatterns(
    astrolabe: Astrolabe,
    h: {
      decadal: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
      yearly: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
      monthly?: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
    },
  ): { decadal: HoroPattern[]; yearly: HoroPattern[]; monthly: HoroPattern[] } {
    return scanHoroscopePatterns(astrolabe, h);
  },
  analyzeChart(astrolabe: Astrolabe): ChartAnalysis {
    return analyzeChart(astrolabe);
  },
};

export type {
  Astrolabe,
  Horoscope,
  BirthInput,
  DecadeInfo,
  Pattern,
  SanfangSnapshot,
  BorrowedInfo,
  FlyMatrix,
  MutagenChains,
  JiaGong,
  HoroPattern,
  ChartAnalysis,
  ChartIndex,
};
