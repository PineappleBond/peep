/**
 * 排盘主 Hook：iztro 负责全部命理计算，这里负责
 * 「大限/流年/流月/流日/流时」拨盘状态 → 目标公历日期 → horoscope。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import type { MutagenTableKey, Scope } from "./utils";
import { MUTAGEN_TABLES, applyTrueSolar } from "./utils";
import { leapMonthOf, lunarStrToSolarStr } from "./lunar";
import { resolveBirthPlace } from "./place";
import { buildLifeKline } from "./lifeKline";
import { analyzeChart } from "./analysis";
import {
  buildDecades,
  buildChildhood,
  calcActiveDecadeIdx,
  buildYears,
  buildMonths,
  buildDays,
  buildHours,
  type PickState,
  type DecadeInfo,
  type Childhood,
  type CellYear,
  type CellMonth,
  type CellDay,
  type CellHour,
} from "./hbar";

// 重新导出 hbar 类型供外部使用
export type { PickState, DecadeInfo, Childhood, CellYear, CellMonth, CellDay, CellHour };

/** iztro 本命盘对象类型（由 astro.bySolar 返回） */
export type Astrolabe = ReturnType<typeof astro.bySolar>;
/** iztro 运限数据对象类型（由 astrolabe.horoscope 返回） */
export type Horoscope = ReturnType<Astrolabe["horoscope"]>;
/** 单个宫位数据（十二宫之一） */
export type PalaceData = Astrolabe["palaces"][number];

/**
 * 排盘输入参数：包含生辰信息、流派选择、真太阳时设置等全部起盘配置。
 * 所有字段都有默认值（见 DEFAULT_BIRTH_INPUT），旧存档缺字段时由此补齐。
 */
export type BirthInput = {
  name: string;
  gender: "男" | "女";
  calendar: "solar" | "lunar";
  /** YYYY-MM-DD（阳历，或农历年月日数字） */
  date: string;
  /** 0~12（早子~晚子） */
  timeIndex: number;
  isLeapMonth: boolean;
  /** 精确出生时刻 HH:mm（真太阳时启用时使用） */
  exactTime: string;
  /** 按真太阳时排盘（勾选后展开时刻与出生地区） */
  useTrueSolar: boolean;
  /** 出生地模式：中国城市（省市区经度表+东八区）/ 海外（IANA 时区） */
  placeMode: "china" | "overseas";
  /** 出生地区（省/市/区三级，经度由此查表） */
  province: string;
  city: string;
  district: string;
  /** 海外出生时区（IANA 名，如 Asia/Tokyo；默认取浏览器系统时区） */
  timezone: string;
  /** 安星流派：通行版（南派）/ 中州派 */
  algorithm: "default" | "zhongzhou";
  /** 年分界：正月初一 / 立春（同时作用于运限分界）；随流派自动预设，可手动覆盖 */
  yearDivide: "normal" | "exact";
  /** 十干四化表：通行 / 中州（庚壬天府化科）；随流派自动预设，可手动覆盖 */
  mutagenTable: MutagenTableKey;
  /** 晚子时归日：forward=归次日（通行默认）/ current=归当日 */
  dayDivide: "forward" | "current";
  /** 盘型（中州派特有）：天盘 / 地盘（身宫起局重排）/ 人盘（福德宫起局重排） */
  astroType: "heaven" | "earth" | "human";
  /** 常居住地（可选，不参与排盘，随导出供 AI 做地域/方位参考） */
  residence: string;
};

/**
 * 起盘参数的中性默认值：新字段随版本增加，localStorage 主输入与多盘档案里的
 * 旧存档缺这些字段，读取侧必须以本默认值补齐——否则 undefined 会渗入排盘配置
 * （iztro 全局配置粘性，mutagens: undefined 不清除残留，会静默沿用上一张盘的四化表）。
 */
export const DEFAULT_BIRTH_INPUT: BirthInput = {
  name: "",
  gender: "男",
  calendar: "solar",
  date: "2000-01-01",
  timeIndex: 0,
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

/** 真太阳时校正详情：钟表时间 vs 真太阳时、经度差/均时差校正量 */
export type TrueSolarInfo = {
  clockDate: string;
  clockTime: string;
  trueDate: string;
  trueTime: string;
  timeIndex: number;
  offsetMinutes: number;
  eotMinutes: number;
  longitude: number;
  /** 钟表基准偏移（分钟）：中国=480（东八）；海外=出生时刻该时区实际 UTC 偏移（含夏令时） */
  clockOffsetMinutes: number;
  /** 出生地标签（省市区，或 IANA 时区+UTC 偏移） */
  place: string;
};

/** 各运限级别的可见状态（大限/流年/流月/流日/流时） */
export type ScopeVisible = Record<Scope, boolean>;

/** 初始拨盘状态：当前阳历日期+时辰（pick 统一使用阳历） */
function initPick(): PickState {
  const now = new Date();
  const hour = Math.floor((now.getHours() + 1) / 2) % 12; // 0~11 子~亥
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour,
    leap: false, // 阳历无闰月
  };
}

/** 拨盘年份不早于出生农历年 */
function clampPick(p: PickState, birthLunarYear: number): PickState {
  return p.year < birthLunarYear ? { ...p, year: birthLunarYear } : p;
}

const DEFAULT_VISIBLE: ScopeVisible = {
  decadal: true,
  yearly: true,
  monthly: false,
  daily: false,
  hourly: false,
};

/**
 * 实际排盘参数（经真太阳时校正后）。
 * 当未启用真太阳时时 trueSolar 为 null，直接按原始输入排盘。
 */
export type EffectiveBirth = {
  calendar: "solar" | "lunar";
  dateStr: string;
  timeIndex: number;
  trueSolar: TrueSolarInfo | null;
};

/**
 * 真太阳时校正后的实际排盘参数（纯函数）。
 * 排盘 Hook、合盘从档案取盘、生时校正等场景共用，保证同一口径。
 */
export function effectiveBirth(input: BirthInput): EffectiveBirth {
  const base: EffectiveBirth = {
    calendar: input.calendar,
    dateStr: input.date,
    timeIndex: input.timeIndex,
    trueSolar: null,
  };
  if (!input.useTrueSolar || !input.exactTime) return base;
  const solarStr =
    input.calendar === "lunar" ? lunarStrToSolarStr(input.date, input.isLeapMonth) : input.date;
  if (!solarStr) return base;
  const resolved = resolveBirthPlace(input, solarStr, input.exactTime);
  const adj = applyTrueSolar(
    solarStr,
    input.exactTime,
    resolved.longitude,
    resolved.clockOffsetMinutes,
  );
  if (!adj) return base;
  return {
    calendar: "solar",
    dateStr: adj.dateStr,
    timeIndex: adj.timeIndex,
    trueSolar: {
      clockDate: solarStr,
      clockTime: input.exactTime,
      trueDate: adj.dateStr,
      trueTime: adj.timeStr,
      timeIndex: adj.timeIndex,
      offsetMinutes: adj.offsetMinutes,
      eotMinutes: adj.eotMinutes,
      longitude: resolved.longitude,
      clockOffsetMinutes: resolved.clockOffsetMinutes,
      place: resolved.place,
    },
  };
}

/**
 * 排盘主 Hook：管理紫微斗数排盘的全部状态与计算。
 *
 * @param input - 排盘输入参数（生辰/流派/真太阳时等）
 * @returns 排盘结果对象，包含本命盘、运限数据、拨盘状态、操作函数等
 *
 * 职责：
 * 1. 调用 iztro 引擎计算本命盘（Astrolabe）
 * 2. 管理运限拨盘状态（大限/流年/流月/流日/流时）
 * 3. 计算运限数据（Horoscope）
 * 4. 提供结构分析、K线等衍生数据
 */
export function useZwds(input: BirthInput) {
  /** 真太阳时校正后的实际排盘参数 */
  const effective = useMemo(() => effectiveBirth(input), [input]);

  const astrolabe = useMemo<Astrolabe | null>(() => {
    try {
      return astro.withOptions({
        type: effective.calendar,
        dateStr: effective.dateStr,
        timeIndex: effective.timeIndex,
        gender: input.gender as unknown as GenderName,
        isLeapMonth: input.isLeapMonth,
        fixLeap: true,
        language: "zh-CN",
        // 地盘/人盘为中州派特有，通行版强制天盘
        astroType: input.algorithm === "zhongzhou" ? input.astroType : "heaven",
        config: {
          algorithm: input.algorithm,
          yearDivide: input.yearDivide,
          horoscopeDivide: input.yearDivide,
          dayDivide: input.dayDivide,
          // 整表注入（iztro 全局配置按干合并且不清除，整表覆盖避免切换残留）；
          // 键名兜底：mutagens 传 undefined 时 iztro 保留旧表，绝不可放行
          mutagens: (MUTAGEN_TABLES[input.mutagenTable] ?? MUTAGEN_TABLES.default) as never,
        },
      });
    } catch (e) {
      console.error("[zwds] 排盘失败", e);
      return null;
    }
  }, [
    effective,
    input.gender,
    input.isLeapMonth,
    input.algorithm,
    input.yearDivide,
    input.astroType,
    input.mutagenTable,
    input.dayDivide,
  ]);

  const birthLunarYear = astrolabe?.rawDates.lunarDate.lunarYear ?? new Date().getFullYear();

  /** 十二大限，按起限年龄升序 */
  const decades = useMemo<DecadeInfo[]>(
    () => (astrolabe ? buildDecades(astrolabe, birthLunarYear) : []),
    [astrolabe, birthLunarYear],
  );

  /** 童限（出生 ~ 起运前一年） */
  const childhood = useMemo(
    () => buildChildhood(decades, birthLunarYear),
    [decades, birthLunarYear],
  );

  // 拨盘导航不持久化：命盘由存储的起盘参数直接渲染，拨盘位置每次刷新/起盘回默认（今天）
  const [pick, setPick] = useState<PickState>(initPick);
  const [visible, setVisible] = useState<ScopeVisible>(DEFAULT_VISIBLE);

  // pick 版本号：每次更新递增，用于检测并发竞态（debugApi 事务式更新后验证）
  const [pickVersion, setPickVersion] = useState(0);

  // 事务锁标志：为 true 时 useEffect 不重置 pick，防止 setHoroscopeTime 期间被覆盖
  const [pickLocked, setPickLocked] = useState(false);
  const pickLockedRef = useRef(false);
  pickLockedRef.current = pickLocked;

  // 换盘（起盘/改输入致 astrolabe 变化）或刷新挂载后回到今天（不早于出生年）
  // 如果 pickLocked 为 true（debugApi 正在事务式更新），跳过重置
  useEffect(() => {
    if (pickLockedRef.current) {
      // 事务进行中，不重置 pick——等事务完成后再由事务方负责设置正确值
      return;
    }
    setPick(clampPick(initPick(), birthLunarYear));
  }, [astrolabe, birthLunarYear]);

  /** 当前流年所落的大限序号；-1 = 童限 */
  const activeDecadeIdx = useMemo(
    () => calcActiveDecadeIdx(pick.year, decades, birthLunarYear),
    [decades, pick.year, birthLunarYear],
  );

  /** 当前大限（或童限）内的流年列表 */
  const years = useMemo<CellYear[]>(
    () => buildYears(activeDecadeIdx, decades, childhood, birthLunarYear),
    [activeDecadeIdx, decades, childhood, birthLunarYear],
  );

  /** 当年农历闰月（0=无）；buildMonths 需要此参数在正确位置插入闰月位 */
  const yearLeapMonth = useMemo(() => leapMonthOf(pick.year), [pick.year]);
  // pick 已统一为阳历，effLeap 始终为 false（阳历无闰月概念）
  const effLeap = false;

  /** 阳历月天数（与 buildHbarData 保持一致） */
  const monthDays = useMemo(
    () => new Date(pick.year, pick.month, 0).getDate(),
    [pick.year, pick.month],
  );
  const clampedDay = Math.min(pick.day, monthDays);

  /** 流月（五虎遁干支；有闰月时插入闰月位，闰月无独立月建、沿用本月干支） */
  const months = useMemo<CellMonth[]>(
    () => buildMonths(pick.year, yearLeapMonth),
    [pick.year, yearLeapMonth],
  );

  /** 流日（含日柱干支） */
  const days = useMemo<CellDay[]>(
    () => buildDays(pick.year, pick.month, monthDays, effLeap),
    [pick.year, pick.month, monthDays, effLeap],
  );

  /** 流时（五鼠遁干支） */
  const hours = useMemo<CellHour[]>(() => {
    const dayStem = days[clampedDay - 1]?.gz.charAt(0) ?? "";
    return buildHours(dayStem);
  }, [days, clampedDay]);

  /** 拨盘目标（公历）：pick 已经是阳历值，直接构造日期字符串 */
  const targetSolar = useMemo(
    () => `${pick.year}-${pick.month}-${clampedDay}`,
    [pick.year, pick.month, clampedDay],
  );

  const horoscope = useMemo<Horoscope | null>(() => {
    if (!astrolabe) return null;
    try {
      return astrolabe.horoscope(targetSolar, pick.hour);
    } catch (e) {
      console.error("[zwds] 运限计算失败", e);
      return null;
    }
  }, [astrolabe, targetSolar, pick.hour]);

  const show = (s: Scope) => setVisible(v => (v[s] ? v : { ...v, [s]: true }));

  const actions = {
    pickDecade(i: number) {
      const y = i === -1 ? (childhood?.startYear ?? birthLunarYear) : decades[i]?.startYear;
      if (y != null) setPick(p => ({ ...p, year: y }));
      show("decadal");
    },
    pickYear(y: number) {
      setPick(p => ({ ...p, year: y }));
      show("yearly");
    },
    pickMonth(m: number, leap = false) {
      setPick(p => ({ ...p, month: m, leap }));
      show("monthly");
    },
    pickDay(d: number) {
      setPick(p => ({ ...p, day: d }));
      show("daily");
    },
    pickHour(h: number) {
      setPick(p => ({ ...p, hour: h }));
      setPickVersion(v => v + 1);
      show("hourly");
    },
    /**
     * 事务式批量更新 pick：一次性设置年月日时，避免多次 setPick 调用导致的竞态。
     * 同时递增 pickVersion，供 debugApi 验证更新是否生效。
     */
    setPickBatch(partial: Partial<PickState>) {
      setPick(p => ({ ...p, ...partial }));
      setPickVersion(v => v + 1);
    },
    /**
     * 锁定 pick：阻止 useEffect 在 astrolabe 变化时重置 pick。
     * 用于 debugApi 的事务式更新期间，防止竞态。
     */
    lockPick() {
      setPickLocked(true);
    },
    /**
     * 解锁 pick：恢复 useEffect 的正常重置行为。
     */
    unlockPick() {
      setPickLocked(false);
    },
    /** 获取当前 pick 版本号（用于 debugApi 验证） */
    getPickVersion() {
      return pickVersion;
    },
    resetToday() {
      setPick(clampPick(initPick(), birthLunarYear));
    },
    toggleScope(s: Scope) {
      setVisible(v => ({ ...v, [s]: !v[s] }));
    },
    /** 只显示指定 scope，其他全部关闭 */
    showScope(s: Scope) {
      setVisible({
        decadal: false,
        yearly: false,
        monthly: false,
        daily: false,
        hourly: false,
        [s]: true,
      });
    },
    showNatal() {
      setVisible({ decadal: false, yearly: false, monthly: false, daily: false, hourly: false });
    },
  };

  /** 本命命宫索引 */
  const soulPalaceIndex = useMemo(
    () => astrolabe?.palaces.findIndex(p => p.name === "命宫") ?? -1,
    [astrolabe],
  );

  /** 人生K线（确定性量化，随盘重算） */
  const lifeKline = useMemo(
    () => buildLifeKline(astrolabe, decades, birthLunarYear),
    [astrolabe, decades, birthLunarYear],
  );

  /** 结构分析（格局/飞宫/三方四正快照/夹宫/借星）：盘面弹层与 AI 导出共用 */
  const analysis = useMemo(() => (astrolabe ? analyzeChart(astrolabe) : null), [astrolabe]);

  return {
    input,
    astrolabe,
    horoscope,
    birthLunarYear,
    decades,
    childhood,
    activeDecadeIdx,
    years,
    months,
    days,
    hours,
    monthDays,
    clampedDay,
    /** 当前拨盘月是否为有效闰月位 */
    effLeap,
    pick,
    visible,
    targetSolar,
    trueSolar: effective.trueSolar,
    soulPalaceIndex,
    lifeKline,
    analysis,
    actions,
  };
}

export type Zwds = ReturnType<typeof useZwds>;
