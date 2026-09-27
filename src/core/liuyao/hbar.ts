/**
 * 六爻运限拨盘（hbar）数据计算：流年/流月/流日/流时列表
 * 纯函数，供 LiuyaoPage 和 debugApi 共享
 *
 * 与紫微 hbar 的区别：
 * - 无大限（decades）、无童限（childhood）
 * - 年份列表以起卦时间为中心（±N 年），而非大限范围
 * - 复用紫微 hbar 的 buildMonths/buildDays/buildHours（月/日/时计算逻辑通用）
 *
 * 性能优化：
 * - 复用紫微 hbar 的 dayGanZhiCache 和 solar2lunarCache（跨模块共享）
 * - buildLiuyaoMonths 按年份缓存
 * - buildLiuyaoDays 按"年-月"缓存
 * - 流年列表按"起卦时间±range"缓存
 */
import {
  buildMonths as buildZiweiMonths,
  buildDays as buildZiweiDays,
  buildHours as buildZiweiHours,
  type CellYear,
  type CellMonth,
  type CellDay,
  type CellHour,
} from "../hbar";
import { LRUCache, registerCache } from "../cache";
import { yearGanZhi } from "../utils";

/* ─────────────── 类型定义 ─────────────── */

/** 六爻 hbar 可见性状态 */
export type LiuyaoHbarVisible = {
  yearly: boolean;
  monthly: boolean;
  daily: boolean;
  hourly: boolean;
};

/** 六爻 hbar 选择状态 */
export type LiuyaoHbarPick = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

/** 六爻 hbar 完整状态 */
export type LiuyaoHbarState = {
  visible: LiuyaoHbarVisible;
  pick: LiuyaoHbarPick;
};

/** 六爻 hbar 完整数据 */
export type LiuyaoHbarData = {
  years: CellYear[];
  activeYearIdx: number;
  months: CellMonth[];
  activeMonthIdx: number;
  days: CellDay[];
  activeDayIdx: number;
  hours: CellHour[];
  activeHourIdx: number;
};

/* ─────────────── 缓存实例 ─────────────── */

/** 流年列表缓存（按"起卦时间-range"键） */
const buildYearsCache = new LRUCache<string, { years: CellYear[]; activeIdx: number }>({
  maxSize: 20,
  name: "liuyaoYears",
});

/** buildLiuyaoMonths 按年份缓存（复用紫微的缓存逻辑） */
const buildMonthsCache = new LRUCache<number, CellMonth[]>({
  maxSize: 50,
  name: "liuyaoMonths",
});

/** buildLiuyaoDays 按"年-月"缓存 */
const buildDaysCache = new LRUCache<string, CellDay[]>({
  maxSize: 200,
  name: "liuyaoDays",
});

/** 注册缓存到全局注册表 */
registerCache("liuyaoYears", buildYearsCache);
registerCache("liuyaoMonths", buildMonthsCache);
registerCache("liuyaoDays", buildDaysCache);

/* ─────────────── 纯函数计算 ─────────────── */

/**
 * 构建流年列表：以起卦时间为中心，前后各 N 年
 * @param divinationTime 起卦时间 ISO 字符串
 * @param range 前后年数（默认 5，共 11 年）
 * @param pickYear 当前选中的年份
 */
export function buildLiuyaoYears(
  divinationTime: string,
  range: number = 5,
  pickYear: number,
): { years: CellYear[]; activeIdx: number } {
  const cacheKey = `${divinationTime}-${range}`;
  const cached = buildYearsCache.get(cacheKey);
  if (cached) return cached;

  const divDate = new Date(divinationTime);
  const divYear = divDate.getFullYear();
  const startYear = divYear - range;
  const endYear = divYear + range;

  const years: CellYear[] = [];
  let activeIdx = 0;

  for (let y = startYear; y <= endYear; y++) {
    const gz = yearGanZhi(y);
    const age = y - divDate.getFullYear(); // 相对起卦年的偏移
    years.push({ year: y, gz, age });
    if (y === pickYear) {
      activeIdx = years.length - 1;
    }
  }

  const result = { years, activeIdx };
  buildYearsCache.set(cacheKey, result);
  return result;
}

/**
 * 构建流月列表：复用紫微 hbar 的 buildMonths
 * @param year 年份
 */
export function buildLiuyaoMonths(year: number): CellMonth[] {
  const cached = buildMonthsCache.get(year);
  if (cached) return cached;

  // 六爻不使用闰月，第二个参数传 0
  const result = buildZiweiMonths(year, 0);
  buildMonthsCache.set(year, result);
  return result;
}

/**
 * 构建流日列表：复用紫微 hbar 的 buildDays
 * @param year 年份
 * @param month 月份（1-12）
 */
export function buildLiuyaoDays(year: number, month: number): CellDay[] {
  const cacheKey = `${year}-${month}`;
  const cached = buildDaysCache.get(cacheKey);
  if (cached) return cached;

  // 计算当月天数
  const daysInMonth = new Date(year, month, 0).getDate();
  // 六爻不使用闰月，effLeap 传 false
  const result = buildZiweiDays(year, month, daysInMonth, false);
  buildDaysCache.set(cacheKey, result);
  return result;
}

/**
 * 构建流时列表：复用紫微 hbar 的 buildHours
 * @param dayStem 日干（用于推算时干）
 */
export function buildLiuyaoHours(dayStem: string): CellHour[] {
  return buildZiweiHours(dayStem);
}

/**
 * 构建完整六爻 hbar 数据
 * @param divinationTime 起卦时间 ISO 字符串
 * @param pick 当前选择的时间点
 * @param range 流年范围（默认 5）
 */
export function buildLiuyaoHbarData(
  divinationTime: string,
  pick: LiuyaoHbarPick,
  range: number = 5,
): LiuyaoHbarData {
  // 1. 流年
  const yearsResult = buildLiuyaoYears(divinationTime, range, pick.year);

  // 2. 流月
  const months = buildLiuyaoMonths(pick.year);
  const activeMonthIdx = Math.max(0, pick.month - 1); // month 是 1-based

  // 3. 流日
  const days = buildLiuyaoDays(pick.year, pick.month);
  const activeDayIdx = Math.max(0, pick.day - 1); // day 是 1-based

  // 4. 流时：需要日干
  // 从 days 中获取当前日的干支，提取日干
  const currentDay = days[activeDayIdx];
  const dayGz = currentDay?.gz || "";
  const dayStem = dayGz.charAt(0); // 干支第一个字是天干
  const hours = buildLiuyaoHours(dayStem);
  const activeHourIdx = pick.hour; // hour 是 0-based 索引

  return {
    years: yearsResult.years,
    activeYearIdx: yearsResult.activeIdx,
    months,
    activeMonthIdx,
    days,
    activeDayIdx,
    hours,
    activeHourIdx,
  };
}
