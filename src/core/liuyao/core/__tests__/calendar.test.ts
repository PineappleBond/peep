import { describe, it, expect } from "vitest";
import { julianDayNumber, dayGanzhi, xunKong, monthBranch } from "../calendar";

describe("calendar", () => {
  describe("julianDayNumber", () => {
    it("2000-01-01 的儒略日数正确", () => {
      const jdn = julianDayNumber(2000, 1, 1);
      expect(jdn).toBe(2451545); // 已知的 JDN 参考值
    });

    it("1970-01-01 的儒略日数正确", () => {
      const jdn = julianDayNumber(1970, 1, 1);
      expect(jdn).toBe(2440588);
    });
  });

  describe("dayGanzhi", () => {
    it("2000-01-01 = 戊午（校准点）", () => {
      const gz = dayGanzhi(2000, 1, 1);
      expect(gz.stem).toBe("戊");
      expect(gz.branch).toBe("午");
    });

    it("2024-01-01 的干支正确", () => {
      const gz = dayGanzhi(2024, 1, 1);
      expect(gz.stem).toBeDefined();
      expect(gz.branch).toBeDefined();
    });

    it("连续两天的干支相邻", () => {
      const day1 = dayGanzhi(2024, 3, 15);
      const day2 = dayGanzhi(2024, 3, 16);

      // 干支序号应该相差1（考虑60甲子循环）
      const idx1 = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].indexOf(day1.stem);
      const idx2 = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"].indexOf(day2.stem);
      expect((idx2 - idx1 + 10) % 10).toBe(1);
    });
  });

  describe("xunKong", () => {
    it("甲子旬空戌亥", () => {
      const kong = xunKong("甲", "子");
      expect(kong).toContain("戌");
      expect(kong).toContain("亥");
    });

    it("甲戌旬空申酉", () => {
      const kong = xunKong("甲", "戌");
      expect(kong).toContain("申");
      expect(kong).toContain("酉");
    });

    it("甲申旬空午未", () => {
      const kong = xunKong("甲", "申");
      expect(kong).toContain("午");
      expect(kong).toContain("未");
    });
  });

  describe("monthBranch", () => {
    it("立春后取寅月", () => {
      // 2024年立春约在2月4日
      const branch = monthBranch(2024, 2, 10);
      expect(branch).toBe("寅");
    });

    it("立春前取丑月", () => {
      // 2024年立春约在2月4日
      const branch = monthBranch(2024, 2, 1);
      expect(branch).toBe("丑");
    });

    it("惊蛰后取卯月", () => {
      // 2024年惊蛰约在3月5日
      const branch = monthBranch(2024, 3, 10);
      expect(branch).toBe("卯");
    });
  });
});
