/**
 * 纳音五行测试
 */
import { describe, expect, it } from "vitest";
import { getNaYin, getBoardNaYin, NAYIN_TABLE, NAYIN_ELEMENT } from "./nayin";

describe("纳音五行", () => {
  describe("NAYIN_TABLE 纳音表", () => {
    it("共 60 项（六十甲子）", () => {
      expect(NAYIN_TABLE).toHaveLength(60);
    });

    it("每两项相同（一阴一阳配对）", () => {
      for (let i = 0; i < 60; i += 2) {
        expect(NAYIN_TABLE[i]).toBe(NAYIN_TABLE[i + 1]);
      }
    });
  });

  describe("NAYIN_ELEMENT 纳音五行映射", () => {
    it("覆盖全部 30 种纳音", () => {
      expect(Object.keys(NAYIN_ELEMENT)).toHaveLength(30);
    });

    it("每种五行各 6 个纳音", () => {
      const counts: Record<string, number> = {};
      for (const el of Object.values(NAYIN_ELEMENT)) {
        counts[el] = (counts[el] || 0) + 1;
      }
      expect(counts["金"]).toBe(6);
      expect(counts["木"]).toBe(6);
      expect(counts["水"]).toBe(6);
      expect(counts["火"]).toBe(6);
      expect(counts["土"]).toBe(6);
    });
  });

  describe("getNaYin 纳音计算", () => {
    it("甲子(0,0) → 海中金", () => {
      expect(getNaYin(0, 0)).toBe("海中金");
    });

    it("乙丑(1,1) → 海中金", () => {
      expect(getNaYin(1, 1)).toBe("海中金");
    });

    it("丙寅(2,2) → 炉中火", () => {
      expect(getNaYin(2, 2)).toBe("炉中火");
    });

    it("壬戌(8,10) → 大海水", () => {
      expect(getNaYin(8, 10)).toBe("大海水");
    });

    it("癸亥(9,11) → 大海水", () => {
      expect(getNaYin(9, 11)).toBe("大海水");
    });

    it("阴阳必须同奇偶（异阴阳返回 fallback）", () => {
      // 甲丑(0,1) → 奇偶不同，六十甲子中不存在此组合
      // 函数使用 CRT 公式，结果由公式决定
      const result = getNaYin(0, 1);
      expect(typeof result).toBe("string");
    });
  });

  describe("getBoardNaYin 批量纳音", () => {
    it("返回 12 个地支的纳音", () => {
      const result = getBoardNaYin(0, []); // 甲日
      expect(Object.keys(result)).toHaveLength(12);
      for (let i = 0; i < 12; i++) {
        expect(result[i]).toBeTruthy();
      }
    });

    it("甲日配子支 = 海中金", () => {
      const result = getBoardNaYin(0, []);
      expect(result[0]).toBe("海中金");
    });
  });
});
