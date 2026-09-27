/**
 * 六爻 hbar 缓存一致性测试
 *
 * 验证 LRU 缓存的正确性：
 * - 相同输入产生相同输出（确定性）
 * - 缓存命中不损坏数据
 * - 多次调用返回一致结果
 */

import { describe, it, expect } from "vitest";
import { buildLiuyaoHbarData } from "../liuyao/hbar";

describe("hbar 缓存一致性", () => {
  it("相同输入多次调用返回相同结果", () => {
    const divinationTime = "2024-06-15T10:30:00";
    const pick = { year: 2024, month: 6, day: 15, hour: 10 };

    const result1 = buildLiuyaoHbarData(divinationTime, pick);
    const result2 = buildLiuyaoHbarData(divinationTime, pick);
    const result3 = buildLiuyaoHbarData(divinationTime, pick);

    // 深度比较关键数据
    expect(result1.years).toEqual(result2.years);
    expect(result2.years).toEqual(result3.years);
    expect(result1.months).toEqual(result2.months);
    expect(result1.days).toEqual(result2.days);
    expect(result1.hours).toEqual(result2.hours);
    expect(result1.activeYearIdx).toBe(result2.activeYearIdx);
  });

  it("不同输入产生不同输出", () => {
    const pick1 = { year: 2024, month: 6, day: 15, hour: 10 };
    const pick2 = { year: 2023, month: 6, day: 15, hour: 10 };

    const result1 = buildLiuyaoHbarData("2024-06-15T10:30:00", pick1);
    const result2 = buildLiuyaoHbarData("2023-06-15T10:30:00", pick2);

    // 年份列表应不同（中心年份不同）
    expect(result1.years.length).toBe(result2.years.length);
    // activeYearIdx 对应的年份应不同（因为 pick 不同）
    const activeYear1 = result1.years[result1.activeYearIdx];
    const activeYear2 = result2.years[result2.activeYearIdx];
    expect(activeYear1.year).toBe(2024);
    expect(activeYear2.year).toBe(2023);
  });

  it("缓存命中后数据完整性", () => {
    const divinationTime = "2024-03-15T14:00:00";
    const pick = { year: 2024, month: 3, day: 15, hour: 14 };

    // 第一次调用（缓存未命中）
    const result1 = buildLiuyaoHbarData(divinationTime, pick);

    // 验证基本结构
    expect(result1.years.length).toBeGreaterThan(0);
    expect(result1.months).toHaveLength(12);
    expect(result1.days.length).toBeGreaterThan(0);
    expect(result1.hours.length).toBeGreaterThan(0);

    // 第二次调用（缓存命中）
    const result2 = buildLiuyaoHbarData(divinationTime, pick);

    // 验证结构仍完整
    expect(result2.years.length).toBe(result1.years.length);
    expect(result2.months).toHaveLength(12);
    expect(result2.days.length).toBe(result1.days.length);
    expect(result2.hours.length).toBe(result1.hours.length);
  });

  it("流年列表以起卦年份为中心", () => {
    const divinationTime = "2024-06-15T10:00:00";
    const pick = { year: 2024, month: 6, day: 15, hour: 10 };

    const result = buildLiuyaoHbarData(divinationTime, pick);

    // 找到 activeYearIdx 对应的年份
    const activeYear = result.years[result.activeYearIdx];
    expect(activeYear.gz).toBeDefined();
    expect(activeYear.year).toBe(2024);

    // 流年列表应包含起卦年份
    const years = result.years.map(y => y.year);
    expect(years).toContain(2024);
  });

  it("月列表始终为12个阳历月", () => {
    const testCases = ["2024-01-15T10:00:00", "2024-06-15T10:00:00", "2024-12-15T10:00:00"];

    for (const dt of testCases) {
      const result = buildLiuyaoHbarData(dt, { year: 2024, month: 6, day: 15, hour: 10 });
      expect(result.months).toHaveLength(12);
    }
  });

  it("日列表数量合理（28-31天）", () => {
    const result = buildLiuyaoHbarData("2024-02-15T10:00:00", {
      year: 2024,
      month: 2,
      day: 15,
      hour: 10,
    });

    // 2月应有28-29天（闰年29天）
    expect(result.days.length).toBeGreaterThanOrEqual(28);
    expect(result.days.length).toBeLessThanOrEqual(31);
  });

  it("时列表始终为12个时辰", () => {
    const result = buildLiuyaoHbarData("2024-06-15T10:00:00", {
      year: 2024,
      month: 6,
      day: 15,
      hour: 10,
    });

    expect(result.hours).toHaveLength(12);
  });
});
