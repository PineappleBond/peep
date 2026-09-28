/**
 * 调试 API - 时间/日历相关接口
 *
 * 代理 lunar-typescript 库，提供公历/农历转换、八字、节气、黄历、星座生肖等功能。
 * 所有方法都是纯计算，不操控 UI。
 */

import { Solar, Lunar, EightChar, LunarYear } from "lunar-typescript";
import { log } from "./logger";
import { LunarError, ApiErrorCode } from "./errors";
import { validateNonEmptyString } from "./validate";
import { withErrorHandlingSync } from "./helpers";

/**
 * 公历转农历
 *
 * @param params - { date: 公历日期字符串，如 "2024-06-15" 或 "2024-06-15 14:30" }
 * @returns 农历日期对象 { year, month, day, isLeap, yearGanZhi, monthGanZhi, dayGanZhi, zodiac }
 */
export function SolarToLunar(params: { date: string }): {
  year: number;
  month: number;
  day: number;
  isLeap: boolean;
  yearGanZhi: string;
  monthGanZhi: string;
  dayGanZhi: string;
  zodiac: string;
} {
  return withErrorHandlingSync("SolarToLunar", LunarError, () => {
    validateNonEmptyString(params.date, "date", "SolarToLunar", LunarError);

    log("info", "SolarToLunar", "公历转农历", { date: params.date });

    const dateStr = params.date.trim();
    const [datePart, timePart = "00:00"] = dateStr.split(/\s+/);
    const [year, month, day] = datePart.split("-").map(Number);

    if (!year || !month || !day) {
      throw new LunarError("日期格式无效，应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm", "SolarToLunar", {
        context: { date: params.date },
        suggestion: "请使用公历日期，格式：2024-06-15 或 2024-06-15 14:30",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }

    const [hour, minute = 0] = timePart.split(":").map(Number);
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();

    const result = {
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      isLeap: lunar.getMonth() < 0,
      yearGanZhi: lunar.getYearInGanZhi(),
      monthGanZhi: lunar.getMonthInGanZhi(),
      dayGanZhi: lunar.getDayInGanZhi(),
      zodiac: lunar.getYearShengXiao(),
    };

    log("info", "SolarToLunar", "转换成功", result);
    return result;
  });
}

/**
 * 农历转公历
 *
 * @param params - { year, month, day, isLeap? }
 * @returns 公历日期字符串 { date: "YYYY-MM-DD" }
 */
export function LunarToSolar(params: {
  year: number;
  month: number;
  day: number;
  isLeap?: boolean;
}): { date: string } {
  return withErrorHandlingSync("LunarToSolar", LunarError, () => {
    log("info", "LunarToSolar", "农历转公历", params);

    const lunar = Lunar.fromYmd(
      params.year,
      params.isLeap ? -params.month : params.month,
      params.day,
    );
    const solar = lunar.getSolar();

    const result = {
      date: `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`,
    };

    log("info", "LunarToSolar", "转换成功", result);
    return result;
  });
}

/**
 * 获取八字（四柱）
 *
 * @param params - { date: 公历日期时间字符串，如 "2024-06-15 14:30" }
 * @returns 八字对象 { year, month, day, hour } 每柱为 { ganZhi, naYin }
 */
export function GetEightCharacters(params: { date: string }): {
  year: { ganZhi: string; naYin: string };
  month: { ganZhi: string; naYin: string };
  day: { ganZhi: string; naYin: string };
  hour: { ganZhi: string; naYin: string };
} {
  return withErrorHandlingSync("GetEightCharacters", LunarError, () => {
    validateNonEmptyString(params.date, "date", "GetEightCharacters", LunarError);

    log("info", "GetEightCharacters", "计算八字", { date: params.date });

    const dateStr = params.date.trim();
    const [datePart, timePart = "00:00"] = dateStr.split(/\s+/);
    const [year, month, day] = datePart.split("-").map(Number);

    if (!year || !month || !day) {
      throw new LunarError("日期格式无效", "GetEightCharacters", {
        context: { date: params.date },
        suggestion: "请使用公历日期，格式：2024-06-15 14:30",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }

    const [hour, minute = 0] = timePart.split(":").map(Number);
    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();
    const eightChar = lunar.getEightChar();

    const result = {
      year: { ganZhi: eightChar.getYear(), naYin: eightChar.getYearNaYin() },
      month: { ganZhi: eightChar.getMonth(), naYin: eightChar.getMonthNaYin() },
      day: { ganZhi: eightChar.getDay(), naYin: eightChar.getDayNaYin() },
      hour: { ganZhi: eightChar.getTime(), naYin: eightChar.getTimeNaYin() },
    };

    log("info", "GetEightCharacters", "计算成功", result);
    return result;
  });
}

/**
 * 获取某年的 24 节气
 *
 * @param params - { year: 年份 }
 * @returns 节气列表，每项 { name, date, description }
 */
export function GetSolarTerms(params: { year: number }): Array<{
  name: string;
  date: string;
  description: string;
}> {
  return withErrorHandlingSync("GetSolarTerms", LunarError, () => {
    log("info", "GetSolarTerms", "获取节气", { year: params.year });

    // 从该年第一天获取节气表
    const solar = Solar.fromYmd(params.year, 1, 1);
    const lunar = solar.getLunar();
    const jieQiTable = lunar.getJieQiTable();
    const jieQiList = lunar.getJieQiList();

    // 只返回中文节气名称（过滤掉英文键如 DA_XUE）
    const result = jieQiList
      .filter(name => !/^[A-Z_]+$/.test(name)) // 过滤纯英文键
      .map(name => {
        const jieSolar = jieQiTable[name];
        return {
          name,
          date: jieSolar
            ? `${jieSolar.getYear()}-${String(jieSolar.getMonth()).padStart(2, "0")}-${String(jieSolar.getDay()).padStart(2, "0")}`
            : "",
          description: "", // lunar-typescript 没有直接提供节气描述
        };
      });

    log("info", "GetSolarTerms", "获取成功", { count: result.length });
    return result;
  });
}

/**
 * 获取当前/指定日期的节气信息
 *
 * @param params - { date?: 公历日期，省略则用当前日期 }
 * @returns 节气信息 { currentJie, currentQi, nextJie, nextQi }
 */
export function GetCurrentSolarTerm(params: { date?: string }): {
  currentJie: { name: string; date: string | null } | null;
  currentQi: { name: string; date: string | null } | null;
  nextJie: { name: string; date: string | null } | null;
  nextQi: { name: string; date: string | null } | null;
} {
  return withErrorHandlingSync("GetCurrentSolarTerm", LunarError, () => {
    log("info", "GetCurrentSolarTerm", "获取当前节气", { date: params.date });

    let solar: Solar;
    if (params.date) {
      const dateStr = params.date.trim();
      const [datePart, timePart = "00:00"] = dateStr.split(/\s+/);
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute = 0] = timePart.split(":").map(Number);
      solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    } else {
      solar = Solar.fromDate(new Date());
    }

    const lunar = solar.getLunar();
    const jieQiTable = lunar.getJieQiTable();
    const currentJieName = lunar.getJie();
    const currentQiName = lunar.getQi();
    const nextJie = lunar.getNextJie();
    const nextQi = lunar.getNextQi();

    // 从节气表中查找日期
    const getJieQiDate = (name: string | null): string | null => {
      if (!name) return null;
      const jieSolar = jieQiTable[name];
      if (!jieSolar) return null;
      return `${jieSolar.getYear()}-${String(jieSolar.getMonth()).padStart(2, "0")}-${String(jieSolar.getDay()).padStart(2, "0")}`;
    };

    const result = {
      currentJie: currentJieName
        ? { name: currentJieName, date: getJieQiDate(currentJieName) }
        : null,
      currentQi: currentQiName ? { name: currentQiName, date: getJieQiDate(currentQiName) } : null,
      nextJie: nextJie ? { name: nextJie.getName(), date: getJieQiDate(nextJie.getName()) } : null,
      nextQi: nextQi ? { name: nextQi.getName(), date: getJieQiDate(nextQi.getName()) } : null,
    };

    log("info", "GetCurrentSolarTerm", "获取成功", result);
    return result;
  });
}

/**
 * 获取传统黄历信息
 *
 * @param params - { date?: 公历日期，省略则用当前日期 }
 * @returns 黄历信息 { yi, ji, chong, sha, pengZu, taiShen, wuXing, xingXiu, etc. }
 */
export function GetChineseCalendar(params: { date?: string }): {
  yi: string[];
  ji: string[];
  chong: string;
  sha: string;
  pengZu: string;
  taiShen: string;
  wuXing: string;
  xingXiu: string;
  xingXiuAnimal: string;
  xingXiuLuck: string;
} {
  return withErrorHandlingSync("GetChineseCalendar", LunarError, () => {
    log("info", "GetChineseCalendar", "获取黄历", { date: params.date });

    let solar: Solar;
    if (params.date) {
      const dateStr = params.date.trim();
      const [datePart, timePart = "00:00"] = dateStr.split(/\s+/);
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute = 0] = timePart.split(":").map(Number);
      solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    } else {
      solar = Solar.fromDate(new Date());
    }

    const lunar = solar.getLunar();

    const result = {
      yi: lunar.getDayYi(),
      ji: lunar.getDayJi(),
      chong: lunar.getDayChong(),
      sha: lunar.getDaySha(),
      pengZu: `${lunar.getPengZuGan()} ${lunar.getPengZuZhi()}`,
      taiShen: lunar.getDayPositionTai(),
      wuXing: lunar.getDayNaYin(),
      xingXiu: lunar.getXiu(),
      xingXiuAnimal: lunar.getAnimal(),
      xingXiuLuck: lunar.getXiuLuck(),
    };

    log("info", "GetChineseCalendar", "获取成功", result);
    return result;
  });
}

/**
 * 获取每日综合信息
 *
 * @param params - { date?: 公历日期，省略则用当前日期 }
 * @returns 综合信息 { solar, lunar, ganZhi, zodiac, constellation, festival, etc. }
 */
export function GetDailyInfo(params: { date?: string }): {
  solar: string;
  lunar: string;
  ganZhi: { year: string; month: string; day: string };
  zodiac: string;
  constellation: string;
  festival: string[];
  isWeekend: boolean;
  weekDay: number;
} {
  return withErrorHandlingSync("GetDailyInfo", LunarError, () => {
    log("info", "GetDailyInfo", "获取每日信息", { date: params.date });

    let solar: Solar;
    if (params.date) {
      const dateStr = params.date.trim();
      const [datePart, timePart = "00:00"] = dateStr.split(/\s+/);
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute = 0] = timePart.split(":").map(Number);
      solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    } else {
      solar = Solar.fromDate(new Date());
    }

    const lunar = solar.getLunar();

    const result = {
      solar: `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`,
      lunar: `${lunar.getYear()}-${String(lunar.getMonth()).padStart(2, "0")}-${String(lunar.getDay()).padStart(2, "0")}`,
      ganZhi: {
        year: lunar.getYearInGanZhi(),
        month: lunar.getMonthInGanZhi(),
        day: lunar.getDayInGanZhi(),
      },
      zodiac: lunar.getYearShengXiao(),
      constellation: solar.getXingZuo(),
      festival: lunar.getFestivals(),
      isWeekend: solar.getWeek() === 0 || solar.getWeek() === 6,
      weekDay: solar.getWeek(),
    };

    log("info", "GetDailyInfo", "获取成功", result);
    return result;
  });
}

/**
 * 获取生肖
 *
 * @param params - { date?: 公历日期，省略则用当前日期 }
 * @returns 生肖信息 { zodiac, year }
 */
export function GetZodiac(params: { date?: string }): { zodiac: string; year: number } {
  return withErrorHandlingSync("GetZodiac", LunarError, () => {
    log("info", "GetZodiac", "获取生肖", { date: params.date });

    let solar: Solar;
    if (params.date) {
      const dateStr = params.date.trim();
      const [datePart] = dateStr.split(/\s+/);
      const [year, month, day] = datePart.split("-").map(Number);
      solar = Solar.fromYmd(year, month, day);
    } else {
      solar = Solar.fromDate(new Date());
    }

    const lunar = solar.getLunar();

    const result = {
      zodiac: lunar.getYearShengXiao(),
      year: lunar.getYear(),
    };

    log("info", "GetZodiac", "获取成功", result);
    return result;
  });
}

/**
 * 获取星座
 *
 * @param params - { date?: 公历日期，省略则用当前日期 }
 * @returns 星座信息 { constellation, element, luck }
 */
export function GetConstellation(params: { date?: string }): {
  constellation: string;
  element: string;
  luck: string;
} {
  return withErrorHandlingSync("GetConstellation", LunarError, () => {
    log("info", "GetConstellation", "获取星座", { date: params.date });

    let solar: Solar;
    if (params.date) {
      const dateStr = params.date.trim();
      const [datePart] = dateStr.split(/\s+/);
      const [year, month, day] = datePart.split("-").map(Number);
      solar = Solar.fromYmd(year, month, day);
    } else {
      solar = Solar.fromDate(new Date());
    }

    const result = {
      constellation: solar.getXingZuo(),
      element: "", // lunar-typescript 不提供星座元素信息
      luck: "", // lunar-typescript 不提供星座运势信息
    };

    log("info", "GetConstellation", "获取成功", result);
    return result;
  });
}
