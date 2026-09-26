/**
 * 运限拨盘（hbar）数据计算：大运/流年/流月/流日/流时列表
 * 纯函数，供 useZwds 和 debugApi 共享
 */
import { BRANCHES, LUNAR_DAYS, LUNAR_MONTHS, hourGanZhi, monthGanZhi, yearGanZhi } from "./utils";
import { daysInLunarMonth, dayGanZhi, leapMonthOf, lunarToSolarStr } from "./lunar";
import type { Astrolabe } from "./useZwds";

/* ─────────────── 类型定义 ─────────────── */

/** 运限拨盘选择状态：当前选中的年月日时+闰月标志 */
export type PickState = { year: number; month: number; day: number; hour: number; leap: boolean };

/** 大限信息：所在宫位、起止年份、干支、虚岁范围 */
export type DecadeInfo = {
  palaceIndex: number;
  range: [number, number];
  heavenlyStem: string;
  earthlyBranch: string;
  startYear: number;
  endYear: number;
};

/** 童限信息：起运前的时间段（出生至大限开始前） */
export type Childhood = {
  startYear: number;
  endYear: number;
  label: string;
};

/** 拨盘流年单元格数据：年份/干支/虚岁 */
export type CellYear = { year: number; gz: string; age: number };
/** 拨盘流月单元格：月份/闰月标志/月名/干支 */
export type CellMonth = { month: number; leap: boolean; label: string; gz: string };
/** 拨盘流日单元格：日号/日期标签/干支 */
export type CellDay = { day: number; label: string; gz: string };
/** 拨盘流时单元格：时辰索引/时辰名/干支 */
export type CellHour = { hour: number; label: string; gz: string };

/* ─────────────── hbar 完整数据 ─────────────── */

/**
 * 运限拨盘完整数据：大限列表、童限、流年/流月/流日/流时单元格，
 * 以及当前各级激活索引。
 */
export type HbarData = {
  decades: DecadeInfo[];
  childhood: Childhood | null;
  /** 当前大限索引（-1 = 童限） */
  activeDecadeIdx: number;
  years: CellYear[];
  /** 当前流年在 years 数组中的索引 */
  activeYearIdx: number;
  months: CellMonth[];
  /** 当前流月在 months 数组中的索引 */
  activeMonthIdx: number;
  days: CellDay[];
  /** 当前流日在 days 数组中的索引 */
  activeDayIdx: number;
  hours: CellHour[];
  /** 当前流时在 hours 数组中的索引（0-11） */
  activeHourIdx: number;
  pick: PickState;
  effLeap: boolean;
  clampedDay: number;
};

/* ─────────────── 纯函数计算 ─────────────── */

/** 计算十二大限（按起限年龄升序） */
export function buildDecades(astrolabe: Astrolabe, birthLunarYear: number): DecadeInfo[] {
  return astrolabe.palaces
    .map(p => ({
      palaceIndex: p.index,
      range: p.decadal.range as [number, number],
      heavenlyStem: p.decadal.heavenlyStem as string,
      earthlyBranch: p.decadal.earthlyBranch as string,
      startYear: birthLunarYear + p.decadal.range[0] - 1,
      endYear: birthLunarYear + p.decadal.range[1] - 1,
    }))
    .sort((a, b) => a.range[0] - b.range[0]);
}

/** 计算童限（出生 ~ 起运前一年） */
export function buildChildhood(decades: DecadeInfo[], birthLunarYear: number): Childhood | null {
  if (!decades.length) return null;
  const first = decades[0].range[0];
  if (first <= 1) return null;
  return {
    startYear: birthLunarYear,
    endYear: birthLunarYear + first - 2,
    label: `1~${first - 1}岁`,
  };
}

/** 计算当前大限索引（-1 = 童限） */
export function calcActiveDecadeIdx(
  pickYear: number,
  decades: DecadeInfo[],
  birthLunarYear: number,
): number {
  if (!decades.length) return -1;
  const age = pickYear - birthLunarYear + 1;
  if (age < decades[0].range[0]) return -1;
  const i = decades.findIndex(d => age >= d.range[0] && age <= d.range[1]);
  return i >= 0 ? i : decades.length - 1;
}

/** 计算流年列表 */
export function buildYears(
  activeDecadeIdx: number,
  decades: DecadeInfo[],
  childhood: Childhood | null,
  birthLunarYear: number,
): CellYear[] {
  let start: number | undefined;
  let end: number | undefined;
  if (activeDecadeIdx === -1) {
    if (!childhood) return [];
    start = childhood.startYear;
    end = childhood.endYear;
  } else {
    const d = decades[activeDecadeIdx];
    if (!d) return [];
    start = d.startYear;
    end = d.endYear;
  }
  const list: CellYear[] = [];
  for (let y = start; y <= end; y++) {
    list.push({ year: y, gz: yearGanZhi(y), age: y - birthLunarYear + 1 });
  }
  return list;
}

/** 计算流月列表（含闰月） */
export function buildMonths(pickYear: number, yearLeapMonth: number): CellMonth[] {
  const list: CellMonth[] = LUNAR_MONTHS.map((label, i) => ({
    month: i + 1,
    leap: false,
    label,
    gz: monthGanZhi(pickYear, i + 1),
  }));
  if (yearLeapMonth > 0) {
    list.splice(yearLeapMonth, 0, {
      month: yearLeapMonth,
      leap: true,
      label: `闰${LUNAR_MONTHS[yearLeapMonth - 1]}`,
      gz: monthGanZhi(pickYear, yearLeapMonth),
    });
  }
  return list;
}

/** 计算流日列表 */
export function buildDays(
  pickYear: number,
  pickMonth: number,
  monthDays: number,
  effLeap: boolean,
): CellDay[] {
  const list: CellDay[] = [];
  for (let d = 1; d <= monthDays; d++) {
    const solar = lunarToSolarStr(pickYear, pickMonth, d, effLeap);
    list.push({ day: d, label: LUNAR_DAYS[d - 1], gz: solar ? dayGanZhi(solar) : "" });
  }
  return list;
}

/** 计算流时列表 */
export function buildHours(dayStem: string): CellHour[] {
  return BRANCHES.map((b, i) => ({
    hour: i,
    label: `${b}时`,
    gz: dayStem ? hourGanZhi(dayStem, i) : "",
  }));
}

/** 构建完整 hbar 数据 */
export function buildHbarData(
  astrolabe: Astrolabe | null,
  birthLunarYear: number,
  pick: PickState,
): HbarData | null {
  if (!astrolabe) return null;

  const decades = buildDecades(astrolabe, birthLunarYear);
  const childhood = buildChildhood(decades, birthLunarYear);
  const activeDecadeIdx = calcActiveDecadeIdx(pick.year, decades, birthLunarYear);

  const years = buildYears(activeDecadeIdx, decades, childhood, birthLunarYear);
  const activeYearIdx = years.findIndex(y => y.year === pick.year);

  const yearLeapMonth = leapMonthOf(pick.year);
  const effLeap = pick.leap && pick.month === yearLeapMonth;
  const monthDays = daysInLunarMonth(pick.year, pick.month, effLeap);
  const clampedDay = Math.min(pick.day, monthDays);

  const months = buildMonths(pick.year, yearLeapMonth);
  const activeMonthIdx = months.findIndex(m => m.month === pick.month && m.leap === pick.leap);

  const days = buildDays(pick.year, pick.month, monthDays, effLeap);
  const activeDayIdx = clampedDay - 1; // days 数组从 day=1 开始，索引从 0 开始

  const dayStem = days[clampedDay - 1]?.gz.charAt(0) ?? "";
  const hours = buildHours(dayStem);
  const activeHourIdx = pick.hour; // hours 数组索引就是时辰索引 0-11

  return {
    decades,
    childhood,
    activeDecadeIdx,
    years,
    activeYearIdx,
    months,
    activeMonthIdx,
    days,
    activeDayIdx,
    hours,
    activeHourIdx,
    pick,
    effLeap,
    clampedDay,
  };
}
