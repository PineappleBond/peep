// 农历和节气计算工具 - 使用 lunar-typescript

import { Solar, EightChar } from "lunar-typescript";

/**
 * 根据节气确定八字月份（基于节气）
 */
export function getBaziMonth(year: number, month: number, day: number): number {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const ec = EightChar.fromLunar(lunar);
  // 获取月柱地支索引，映射到八字月份（1-12）
  const monthZhi = ec.getMonthZhi();
  const MONTH_ZHI = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
  return MONTH_ZHI.indexOf(monthZhi) + 1;
}

/**
 * 计算准确的日柱（基于真太阳时）
 */
export function calculateDayPillarAccurate(year: number, month: number, day: number): {
  tianGan: string;
  diZhi: string;
} {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const ec = EightChar.fromLunar(lunar);

  return {
    tianGan: ec.getDayGan(),
    diZhi: ec.getDayZhi(),
  };
}

/**
 * 将公历小时转换为时辰（0-11 对应子~亥）
 */
export function getShiChen(hour: number, _minute: number = 0): number {
  if (hour === 23 || hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

/**
 * 计算完整的四柱干支（使用 lunar-typescript 的 EightChar，精度到流时）
 */
export function calculateFourPillars(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0,
  yearDivide: "lichun" | "zhengyue" = "lichun"
): {
  year: [string, string];
  month: [string, string];
  day: [string, string];
  hour: [string, string];
} {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();

  if (yearDivide === "zhengyue") {
    // 正月初一为年分界
    return {
      year: [lunar.getYearGan(), lunar.getYearZhi()],
      month: [lunar.getMonthGanExact(), lunar.getMonthZhiExact()],
      day: [lunar.getDayGanExact(), lunar.getDayZhiExact()],
      hour: [lunar.getTimeGan(), lunar.getTimeZhi()],
    };
  }

  // 默认：立春节气为年分界（精确到立春的准确时刻）
  return {
    year: [lunar.getYearGanExact(), lunar.getYearZhiExact()],
    month: [lunar.getMonthGanExact(), lunar.getMonthZhiExact()],
    day: [lunar.getDayGanExact(), lunar.getDayZhiExact()],
    hour: [lunar.getTimeGan(), lunar.getTimeZhi()],
  };
}

/**
 * 获取 EightChar 实例（用于更高级的八字计算，如大运）
 */
export function getEightChar(year: number, month: number, day: number, hour: number, minute: number = 0): EightChar {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  return EightChar.fromLunar(lunar);
}
