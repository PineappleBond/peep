/**
 * lunar-lite / lunar-typescript 封装：农历⇄公历、干支取值、闰月（全部带兜底，越界不抛出）。
 *
 * 注意：lunar-lite 的 getTotalDaysOfLunarMonth / getLeapMonth / getLeapDays 引用了
 * 不存在的 LUNAR_INFO 常量（0.2.x 已知损坏，调用必抛错），故月天数与闰月
 * 一律直接走其底层依赖 lunar-typescript 计算。
 */
import { solar2lunar, lunar2solar, getHeavenlyStemAndEarthlyBranchBySolarDate } from "lunar-lite";
import { LunarMonth, LunarYear } from "lunar-typescript";
import { LUNAR_MONTHS, LUNAR_DAYS } from "./utils";

/** 格式化 Date 为 YYYY-M-D 字符串 */
export function fmtSolar(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 农历某年的闰月月份；无闰月或异常返回 0 */
export function leapMonthOf(year: number): number {
  try {
    return LunarYear.fromYear(year).getLeapMonth();
  } catch {
    return 0;
  }
}

/** 农历某月天数（isLeap=true 且该月确为闰月时取闰月天数），异常时按 29 */
export function daysInLunarMonth(year: number, month: number, isLeap = false): number {
  try {
    const key = isLeap && leapMonthOf(year) === month ? -month : month;
    return LunarMonth.fromYm(year, key)?.getDayCount() ?? 29;
  } catch {
    return 29;
  }
}

/** 农历 → 公历字符串 YYYY-M-D（支持闰月；非闰月时 isLeap 被忽略），失败返回 null */
export function lunarToSolarStr(
  year: number,
  month: number,
  day: number,
  isLeap = false,
): string | null {
  try {
    const s = lunar2solar(`${year}-${month}-${day}`, isLeap);
    return `${s.solarYear}-${s.solarMonth}-${s.solarDay}`;
  } catch {
    return null;
  }
}

/**
 * 获取当前时刻的农历日期（年月日+时辰+闰月标志）。
 * 时辰按 2 小时一个时辰计算（0=子时, 1=丑时, ...11=亥时）。
 * 异常时回退到公历 1月1日。
 */
export function todayLunar(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  leap: boolean;
} {
  const now = new Date();
  const hour = Math.floor((now.getHours() + 1) / 2) % 12; // 0~11 子~亥
  try {
    const l = solar2lunar(now);
    return { year: l.lunarYear, month: l.lunarMonth, day: l.lunarDay, hour, leap: l.isLeap };
  } catch {
    return { year: now.getFullYear(), month: 1, day: 1, hour, leap: false };
  }
}

/**
 * 公历日期转农历日期
 *
 * @param date 公历日期（Date 对象或 YYYY-MM-DD 格式字符串）
 * @returns 农历日期对象，包含年月日时分和闰月标志
 */
export function solarToLunar(date: Date | string): {
  /** 农历年 */
  year: number;
  /** 农历月 */
  month: number;
  /** 农历日 */
  day: number;
  /** 时辰索引（0-11，子时=0，丑时=1，...亥时=11） */
  hour: number;
  /** 是否闰月 */
  leap: boolean;
  /** 年干支 */
  yearGz: string;
  /** 月干支 */
  monthGz: string;
  /** 日干支 */
  dayGz: string;
  /** 时干支 */
  hourGz: string;
  /** 农历月名称（如"正月"、"腊月"） */
  monthName: string;
  /** 农历日名称（如"初一"、"十五"） */
  dayName: string;
  /** 时辰名称（如"子时"、"丑时"） */
  hourName: string;
} {
  const d = typeof date === "string" ? new Date(date) : date;
  const hour = Math.floor((d.getHours() + 1) / 2) % 12; // 0~11 子~亥

  try {
    const l = solar2lunar(d);
    const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const gz = getHeavenlyStemAndEarthlyBranchBySolarDate(dateStr, 2);
    const yearGz = gz.yearly.join("");
    const monthGz = gz.monthly.join("");
    const dayGz = gz.daily.join("");
    const hourGz = gz.hourly.join("");

    return {
      year: l.lunarYear,
      month: l.lunarMonth,
      day: l.lunarDay,
      hour,
      leap: l.isLeap,
      yearGz,
      monthGz,
      dayGz,
      hourGz,
      monthName: l.isLeap ? `闰${LUNAR_MONTHS[l.lunarMonth - 1]}` : LUNAR_MONTHS[l.lunarMonth - 1],
      dayName: LUNAR_DAYS[l.lunarDay - 1] || `${l.lunarDay}日`,
      hourName: [
        "子时",
        "丑时",
        "寅时",
        "卯时",
        "辰时",
        "巳时",
        "午时",
        "未时",
        "申时",
        "酉时",
        "戌时",
        "亥时",
      ][hour],
    };
  } catch {
    // 转换失败时回退到公历
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour,
      leap: false,
      yearGz: "",
      monthGz: "",
      dayGz: "",
      hourGz: "",
      monthName: `${d.getMonth() + 1}月`,
      dayName: `${d.getDate()}日`,
      hourName: [
        "子时",
        "丑时",
        "寅时",
        "卯时",
        "辰时",
        "巳时",
        "午时",
        "未时",
        "申时",
        "酉时",
        "戌时",
        "亥时",
      ][hour],
    };
  }
}

/** 某公历日的日柱干支，失败返回空串 */
export function dayGanZhi(solarStr: string): string {
  try {
    return getHeavenlyStemAndEarthlyBranchBySolarDate(solarStr, 2).daily.join("");
  } catch {
    return "";
  }
}

/** 农历日期字符串（YYYY-M-D，支持闰月）→ 公历字符串，失败返回 null */
export function lunarStrToSolarStr(dateStr: string, isLeapMonth: boolean): string | null {
  try {
    const s = lunar2solar(dateStr, isLeapMonth);
    return `${s.solarYear}-${s.solarMonth}-${s.solarDay}`;
  } catch {
    return null;
  }
}

/**
 * 从阳历日期计算拨盘选择状态（PickState）
 *
 * @param date 阳历日期（Date 对象或 YYYY-MM-DD 格式字符串）
 * @returns 拨盘选择状态（年月日时+闰月标志）
 */
export function solarToPickState(date: Date | string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  leap: boolean;
} {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    const l = solar2lunar(d);
    const hour = Math.floor((d.getHours() + 1) / 2) % 12;
    return {
      year: l.lunarYear,
      month: l.lunarMonth,
      day: l.lunarDay,
      hour,
      leap: l.isLeap,
    };
  } catch {
    // 转换失败时回退到公历
    const hour = Math.floor((d.getHours() + 1) / 2) % 12;
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour,
      leap: false,
    };
  }
}
