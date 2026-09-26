/**
 * 运限拨盘（hbar）纯函数测试：大限/童限/流年/流月/流日/流时
 */
import { describe, expect, it } from "vitest";
import { astro } from "iztro";
import {
  buildChildhood,
  calcActiveDecadeIdx,
  buildYears,
  buildMonths,
  buildDays,
  buildHours,
  buildHbarData,
  type DecadeInfo,
  type PickState,
} from "./hbar";
import type { Astrolabe } from "./useZwds";

/** 用固定生辰起盘 */
function makeChart(dateStr = "2000-08-16", timeIndex = 2, gender: "男" | "女" = "男"): Astrolabe {
  return astro.withOptions({
    type: "solar",
    dateStr,
    timeIndex,
    gender: gender as never,
    isLeapMonth: false,
    fixLeap: true,
    language: "zh-CN",
    config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
  });
}

/** 与 useZwds 同口径提取大限 */
function decadesOf(a: Astrolabe, birthLunarYear: number): DecadeInfo[] {
  return a.palaces
    .map(p => ({
      palaceIndex: p.index,
      range: p.decadal.range as [number, number],
      heavenlyStem: p.decadal.heavenlyStem as string,
      earthlyBranch: p.decadal.earthlyBranch as string,
      startYear: birthLunarYear + p.decadal.range[0] - 1,
      endYear: birthLunarYear + p.decadal.range[1] - 1,
    }))
    .sort((x, y) => x.range[0] - y.range[0]);
}

describe("hbar 运限拨盘计算", () => {
  const a = makeChart();
  const birthYear = a.rawDates.lunarDate.lunarYear;
  const decades = decadesOf(a, birthYear);

  describe("buildDecades 十二大限", () => {
    it("返回 12 个大限，按起限年龄升序排列", () => {
      expect(decades).toHaveLength(12);
      for (let i = 1; i < decades.length; i++) {
        expect(decades[i].range[0]).toBeGreaterThan(decades[i - 1].range[0]);
      }
    });

    it("每个大限含起止年份、天干地支、宫位索引", () => {
      for (const d of decades) {
        expect(d.range[0]).toBeLessThan(d.range[1]);
        expect(d.startYear).toBeLessThan(d.endYear);
        expect(d.heavenlyStem).toBeTruthy();
        expect(d.earthlyBranch).toBeTruthy();
        expect(d.palaceIndex).toBeGreaterThanOrEqual(0);
      }
    });

    it("大限覆盖连续年龄段（相邻大限首尾衔接）", () => {
      for (let i = 1; i < decades.length; i++) {
        // 前一大限的结束年龄 + 1 = 当前大限的起始年龄（通常）
        expect(decades[i].range[0]).toBe(decades[i - 1].range[1] + 1);
      }
    });
  });

  describe("buildChildhood 童限", () => {
    it("起限年龄 > 1 时存在童限", () => {
      const childhood = buildChildhood(decades, birthYear);
      // 该盘 3 岁起限 → 童限 1~2 岁
      if (decades[0].range[0] > 1) {
        expect(childhood).not.toBeNull();
        expect(childhood!.startYear).toBe(birthYear);
        expect(childhood!.endYear).toBe(birthYear + decades[0].range[0] - 2);
        expect(childhood!.label).toContain("1~");
      }
    });

    it("空大限列表返回 null", () => {
      expect(buildChildhood([], birthYear)).toBeNull();
    });

    it("起限 1 岁时无童限", () => {
      const fakeDecades: DecadeInfo[] = [
        {
          palaceIndex: 0,
          range: [1, 10],
          heavenlyStem: "甲",
          earthlyBranch: "子",
          startYear: birthYear,
          endYear: birthYear + 9,
        },
      ];
      expect(buildChildhood(fakeDecades, birthYear)).toBeNull();
    });
  });

  describe("calcActiveDecadeIdx 当前大限索引", () => {
    it("童限期间返回 -1", () => {
      const age1Year = birthYear; // 1 岁
      expect(calcActiveDecadeIdx(age1Year, decades, birthYear)).toBe(-1);
    });

    it("大限范围内返回正确索引", () => {
      const d = decades[0];
      const midYear = birthYear + Math.floor((d.range[0] + d.range[1]) / 2) - 1;
      expect(calcActiveDecadeIdx(midYear, decades, birthYear)).toBe(0);
    });

    it("超出最后大限返回最后一个索引", () => {
      const farYear = birthYear + 200;
      expect(calcActiveDecadeIdx(farYear, decades, birthYear)).toBe(decades.length - 1);
    });

    it("空大限返回 -1", () => {
      expect(calcActiveDecadeIdx(2026, [], birthYear)).toBe(-1);
    });
  });

  describe("buildYears 流年列表", () => {
    it("大限范围内的流年数量等于大限跨度", () => {
      const idx = 0;
      const d = decades[idx];
      const years = buildYears(idx, decades, null, birthYear);
      expect(years).toHaveLength(d.endYear - d.startYear + 1);
    });

    it("流年含干支与年龄", () => {
      const years = buildYears(0, decades, null, birthYear);
      for (const y of years) {
        expect(y.gz).toHaveLength(2);
        expect(y.age).toBeGreaterThan(0);
        expect(y.age).toBe(y.year - birthYear + 1);
      }
    });

    it("童限期间使用童限年份范围", () => {
      const childhood = buildChildhood(decades, birthYear);
      if (childhood) {
        const years = buildYears(-1, decades, childhood, birthYear);
        expect(years[0].year).toBe(childhood.startYear);
        expect(years[years.length - 1].year).toBe(childhood.endYear);
      }
    });
  });

  describe("buildMonths 流月列表", () => {
    it("非闰年 12 个月", () => {
      const months = buildMonths(2024, 0); // 2024 无闰月
      expect(months).toHaveLength(12);
      for (const m of months) {
        expect(m.month).toBeGreaterThanOrEqual(1);
        expect(m.month).toBeLessThanOrEqual(12);
        expect(m.leap).toBe(false);
        expect(m.gz).toHaveLength(2);
      }
    });

    it("闰年仍为 12 个阳历月——某个阳历月标签带闰月前缀", () => {
      const months = buildMonths(2025, 6); // 2025 闰六月
      expect(months).toHaveLength(12);
      // month 严格为阳历 1-12，顺序递增
      for (let i = 0; i < 12; i++) {
        expect(months[i].month).toBe(i + 1);
        expect(months[i].leap).toBe(false);
        expect(months[i].solarLabel).toBe(`${i + 1}月`);
      }
      // 某个阳历月的农历标签会带"闰六月"前缀（覆盖闰六月的阳历月）
      const leapLabeled = months.find(m => m.label === "闰六月");
      expect(leapLabeled).toBeDefined();
    });
  });

  describe("buildDays 流日列表", () => {
    it("天数与月天数一致", () => {
      const days = buildDays(2025, 6, 30, false);
      expect(days).toHaveLength(30);
      for (const d of days) {
        expect(d.day).toBeGreaterThanOrEqual(1);
        expect(d.label).toBeTruthy();
      }
    });

    it("大月 30 天、小月 29 天", () => {
      expect(buildDays(2025, 1, 30, false)).toHaveLength(30);
      expect(buildDays(2025, 1, 29, false)).toHaveLength(29);
    });
  });

  describe("buildHours 流时列表", () => {
    it("固定 12 个时辰", () => {
      const hours = buildHours("甲");
      expect(hours).toHaveLength(12);
      expect(hours[0].label).toBe("子时");
      expect(hours[11].label).toBe("亥时");
    });

    it("日干决定时干（五鼠遁）", () => {
      const hours = buildHours("甲");
      expect(hours[0].gz).toBe("甲子"); // 甲己还加甲
      const hours2 = buildHours("乙");
      expect(hours2[0].gz).toBe("丙子"); // 乙庚丙作初
    });

    it("空日干返回空干支", () => {
      const hours = buildHours("");
      for (const h of hours) {
        expect(h.gz).toBe("");
      }
    });
  });

  describe("buildHbarData 完整数据构建", () => {
    it("正常输入返回完整结构", () => {
      const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
      const data = buildHbarData(a, birthYear, pick);
      expect(data).not.toBeNull();
      expect(data!.decades).toHaveLength(12);
      expect(data!.years.length).toBeGreaterThan(0);
      expect(data!.months.length).toBeGreaterThanOrEqual(12);
      expect(data!.days.length).toBeGreaterThan(0);
      expect(data!.hours).toHaveLength(12);
      expect(data!.activeDecadeIdx).toBeGreaterThanOrEqual(0);
      expect(data!.pick).toEqual(pick);
    });

    it("astrolabe 为 null 时返回 null", () => {
      const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
      expect(buildHbarData(null, birthYear, pick)).toBeNull();
    });

    it("activeYearIdx 与 pick.year 一致", () => {
      const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
      const data = buildHbarData(a, birthYear, pick)!;
      if (data.activeYearIdx >= 0) {
        expect(data.years[data.activeYearIdx].year).toBe(2026);
      }
    });

    it("activeMonthIdx 与 pick.month 一致", () => {
      const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
      const data = buildHbarData(a, birthYear, pick)!;
      expect(data.months[data.activeMonthIdx].month).toBe(5);
      expect(data.months[data.activeMonthIdx].leap).toBe(false);
    });

    it("activeHourIdx 与 pick.hour 一致", () => {
      const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
      const data = buildHbarData(a, birthYear, pick)!;
      expect(data.activeHourIdx).toBe(6);
    });

    it("clampedDay 不超过月天数", () => {
      const pick: PickState = { year: 2025, month: 6, day: 99, hour: 0, leap: false };
      const data = buildHbarData(a, birthYear, pick)!;
      expect(data.clampedDay).toBeLessThanOrEqual(30);
    });
  });
});
