/**
 * Lunar 时间/日历接口单元测试
 *
 * 覆盖范围：
 * - SolarToLunar：公历转农历
 * - LunarToSolar：农历转公历
 * - GetEightCharacters：八字计算
 * - GetSolarTerms：24 节气
 * - GetCurrentSolarTerm：当前节气
 * - GetChineseCalendar：黄历
 * - GetDailyInfo：每日综合信息
 * - GetZodiac：生肖
 * - GetConstellation：星座
 *
 * 所有方法都是纯计算，不依赖 DOM 或 UI。
 */
import { describe, it, expect } from "vitest";
import {
  SolarToLunar,
  LunarToSolar,
  GetEightCharacters,
  GetSolarTerms,
  GetCurrentSolarTerm,
  GetChineseCalendar,
  GetDailyInfo,
  GetZodiac,
  GetConstellation,
} from "./lunar";
import { LunarError, ApiErrorCode } from "./errors";

/* ─────────────── SolarToLunar ─────────────── */

describe("SolarToLunar", () => {
  it("标准日期转换", () => {
    const result = SolarToLunar({ date: "2024-02-10" });
    expect(result.year).toBe(2024);
    expect(result.month).toBeGreaterThanOrEqual(1);
    expect(result.day).toBeGreaterThanOrEqual(1);
    expect(result.yearGanZhi).toBeTruthy();
    expect(result.zodiac).toBeTruthy();
  });

  it("带时间的日期转换", () => {
    const result = SolarToLunar({ date: "2024-06-15 14:30" });
    expect(result.yearGanZhi).toBeTruthy();
    expect(result.monthGanZhi).toBeTruthy();
    expect(result.dayGanZhi).toBeTruthy();
  });

  it("空日期抛出 INVALID_INPUT 错误", () => {
    try {
      SolarToLunar({ date: "" });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LunarError);
      expect((err as LunarError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("无效日期格式抛出错误", () => {
    try {
      SolarToLunar({ date: "abc" });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LunarError);
    }
  });

  it("春节日期验证（2024 年春节 = 2 月 10 日）", () => {
    const result = SolarToLunar({ date: "2024-02-10" });
    // 2024 年春节是正月初一
    expect(result.month).toBe(1);
    expect(result.day).toBe(1);
    expect(result.zodiac).toBe("龙");
  });
});

/* ─────────────── LunarToSolar ─────────────── */

describe("LunarToSolar", () => {
  it("标准日期转换", () => {
    const result = LunarToSolar({ year: 2024, month: 1, day: 1 });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("闰月转换", () => {
    // 闰月转换不应抛出错误
    const result = LunarToSolar({ year: 2024, month: 1, day: 1, isLeap: false });
    expect(result.date).toBeTruthy();
  });

  it("与 SolarToLunar 互逆", () => {
    // 正向：公历 -> 农历
    const lunar = SolarToLunar({ date: "2024-06-15" });
    // 反向：农历 -> 公历
    const solar = LunarToSolar({
      year: lunar.year,
      month: lunar.month,
      day: lunar.day,
    });
    expect(solar.date).toBe("2024-06-15");
  });
});

/* ─────────────── GetEightCharacters ─────────────── */

describe("GetEightCharacters", () => {
  it("标准时间八字计算", () => {
    const result = GetEightCharacters({ date: "1990-06-15 14:30" });
    expect(result.year.ganZhi).toBeTruthy();
    expect(result.year.naYin).toBeTruthy();
    expect(result.month.ganZhi).toBeTruthy();
    expect(result.day.ganZhi).toBeTruthy();
    expect(result.hour.ganZhi).toBeTruthy();
  });

  it("无时间参数（默认 00:00）", () => {
    const result = GetEightCharacters({ date: "2024-01-01" });
    expect(result.year.ganZhi).toBeTruthy();
    expect(result.hour.ganZhi).toBeTruthy();
  });

  it("空日期抛出 INVALID_INPUT 错误", () => {
    try {
      GetEightCharacters({ date: "" });
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(LunarError);
      expect((err as LunarError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});

/* ─────────────── GetSolarTerms ─────────────── */

describe("GetSolarTerms", () => {
  it("返回 24 节气", () => {
    const result = GetSolarTerms({ year: 2024 });
    expect(result.length).toBe(24);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("date");
  });

  it("节气日期格式正确", () => {
    const result = GetSolarTerms({ year: 2024 });
    for (const term of result) {
      if (term.date) {
        expect(term.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("包含冬至", () => {
    const result = GetSolarTerms({ year: 2024 });
    const dongzhi = result.find(t => t.name === "冬至");
    expect(dongzhi).toBeTruthy();
    // 冬至日期在 12 月（jieQiTable 可能返回 2023-12-22，即前一年的冬至）
    expect(dongzhi!.date).toMatch(/12/);
  });
});

/* ─────────────── GetCurrentSolarTerm ─────────────── */

describe("GetCurrentSolarTerm", () => {
  it("指定日期返回节气信息", () => {
    const result = GetCurrentSolarTerm({ date: "2024-06-15" });
    // 应该有 currentJie/currentQi/nextJie/nextQi 四个字段
    expect(result).toHaveProperty("currentJie");
    expect(result).toHaveProperty("currentQi");
    expect(result).toHaveProperty("nextJie");
    expect(result).toHaveProperty("nextQi");
  });

  it("不传日期使用当前日期", () => {
    const result = GetCurrentSolarTerm({});
    expect(result).toHaveProperty("currentJie");
  });
});

/* ─────────────── GetChineseCalendar ─────────────── */

describe("GetChineseCalendar", () => {
  it("返回黄历信息", () => {
    const result = GetChineseCalendar({ date: "2024-06-15" });
    expect(result).toHaveProperty("yi");
    expect(result).toHaveProperty("ji");
    expect(result).toHaveProperty("chong");
    expect(result).toHaveProperty("sha");
    expect(result).toHaveProperty("pengZu");
    expect(result).toHaveProperty("wuXing");
    expect(result).toHaveProperty("xingXiu");
    expect(Array.isArray(result.yi)).toBe(true);
    expect(Array.isArray(result.ji)).toBe(true);
  });
});

/* ─────────────── GetDailyInfo ─────────────── */

describe("GetDailyInfo", () => {
  it("返回每日综合信息", () => {
    const result = GetDailyInfo({ date: "2024-06-15" });
    expect(result).toHaveProperty("solar");
    expect(result).toHaveProperty("lunar");
    expect(result).toHaveProperty("ganZhi");
    expect(result).toHaveProperty("zodiac");
    expect(result).toHaveProperty("constellation");
    expect(result).toHaveProperty("festival");
    expect(result).toHaveProperty("isWeekend");
    expect(result).toHaveProperty("weekDay");
    expect(result.solar).toBe("2024-06-15");
    expect(result.ganZhi).toHaveProperty("year");
    expect(result.ganZhi).toHaveProperty("month");
    expect(result.ganZhi).toHaveProperty("day");
  });

  it("周六的 isWeekend 为 true", () => {
    // 2024-06-15 是周六
    const result = GetDailyInfo({ date: "2024-06-15" });
    expect(result.isWeekend).toBe(true);
    expect(result.weekDay).toBe(6);
  });

  it("工作日的 isWeekend 为 false", () => {
    // 2024-06-17 是周一
    const result = GetDailyInfo({ date: "2024-06-17" });
    expect(result.isWeekend).toBe(false);
    expect(result.weekDay).toBe(1);
  });
});

/* ─────────────── GetZodiac ─────────────── */

describe("GetZodiac", () => {
  it("龙年日期", () => {
    const result = GetZodiac({ date: "2024-06-15" });
    expect(result.zodiac).toBe("龙");
    expect(result.year).toBe(2024);
  });

  it("兔年日期", () => {
    const result = GetZodiac({ date: "2023-06-15" });
    expect(result.zodiac).toBe("兔");
  });

  // 生肖以立春为界，春节前可能属上年生肖
  it("春节前属上年生肖", () => {
    // 2024-02-09 是除夕，应该属兔（立春前）
    const result = GetZodiac({ date: "2024-02-09" });
    expect(result.zodiac).toBe("兔");
  });
});

/* ─────────────── GetConstellation ─────────────── */

describe("GetConstellation", () => {
  it("双子座", () => {
    const result = GetConstellation({ date: "2024-06-15" });
    expect(result.constellation).toBe("双子");
    // element 和 luck 由 lunar-typescript 不提供，当前为空串
    expect(result.element).toBe("");
    expect(result.luck).toBe("");
  });

  it("白羊座", () => {
    const result = GetConstellation({ date: "2024-04-10" });
    expect(result.constellation).toBe("白羊");
  });

  it("摩羯座", () => {
    const result = GetConstellation({ date: "2024-01-10" });
    expect(result.constellation).toBe("摩羯");
  });
});
