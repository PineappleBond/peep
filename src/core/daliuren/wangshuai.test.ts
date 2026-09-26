/**
 * 旺相休囚死测试：季节旺衰判断
 */
import { describe, expect, it } from "vitest";
import { getWangXiang, getAllWangXiang } from "./wangshuai";

describe("旺相休囚死", () => {
  describe("getWangXiang 单支判定", () => {
    it("寅月(木旺)：寅卯=旺、巳午=相、亥子=休、申酉=囚、辰戌丑未=死", () => {
      // 寅月 → 木旺
      expect(getWangXiang(2, 2)).toBe("旺"); // 寅(木) 在寅月
      expect(getWangXiang(2, 3)).toBe("旺"); // 卯(木) 在寅月
      expect(getWangXiang(2, 5)).toBe("相"); // 巳(火) 在寅月（木生火）
      expect(getWangXiang(2, 6)).toBe("相"); // 午(火) 在寅月
      expect(getWangXiang(2, 11)).toBe("休"); // 亥(水) 在寅月（水生木）
      expect(getWangXiang(2, 0)).toBe("休"); // 子(水) 在寅月
      expect(getWangXiang(2, 8)).toBe("囚"); // 申(金) 在寅月（金克木）
      expect(getWangXiang(2, 9)).toBe("囚"); // 酉(金) 在寅月
      expect(getWangXiang(2, 4)).toBe("死"); // 辰(土) 在寅月（木克土）
      expect(getWangXiang(2, 1)).toBe("死"); // 丑(土) 在寅月
    });

    it("午月(火旺)：巳午=旺、辰戌丑未=相、寅卯=休、亥子=囚、申酉=死", () => {
      expect(getWangXiang(6, 6)).toBe("旺"); // 午(火) 在午月
      expect(getWangXiang(6, 5)).toBe("旺"); // 巳(火) 在午月
      expect(getWangXiang(6, 4)).toBe("相"); // 辰(土) 在午月（火生土）
      expect(getWangXiang(6, 2)).toBe("休"); // 寅(木) 在午月（木生火）
      expect(getWangXiang(6, 0)).toBe("囚"); // 子(水) 在午月（水克火）
      expect(getWangXiang(6, 8)).toBe("死"); // 申(金) 在午月（火克金）
    });

    it("酉月(金旺)：申酉=旺、亥子=相、辰戌丑未=休、巳午=囚、寅卯=死", () => {
      expect(getWangXiang(9, 9)).toBe("旺"); // 酉(金) 在酉月
      expect(getWangXiang(9, 8)).toBe("旺"); // 申(金) 在酉月
      expect(getWangXiang(9, 0)).toBe("相"); // 子(水) 在酉月（金生水）
      expect(getWangXiang(9, 4)).toBe("休"); // 辰(土) 在酉月（土生金）
      expect(getWangXiang(9, 6)).toBe("囚"); // 午(火) 在酉月（火克金）
      expect(getWangXiang(9, 2)).toBe("死"); // 寅(木) 在酉月（金克木）
    });

    it("子月(水旺)：亥子=旺、寅卯=相、申酉=休、辰戌丑未=囚、巳午=死", () => {
      expect(getWangXiang(0, 0)).toBe("旺"); // 子(水) 在子月
      expect(getWangXiang(0, 11)).toBe("旺"); // 亥(水) 在子月
      expect(getWangXiang(0, 2)).toBe("相"); // 寅(木) 在子月（水生木）
      expect(getWangXiang(0, 8)).toBe("休"); // 申(金) 在子月（金生水）
      expect(getWangXiang(0, 4)).toBe("囚"); // 辰(土) 在子月（土克水）
      expect(getWangXiang(0, 6)).toBe("死"); // 午(火) 在子月（水克火）
    });

    it("辰月(土旺)：辰戌丑未=旺、申酉=相、巳午=休、寅卯=囚、亥子=死", () => {
      expect(getWangXiang(4, 4)).toBe("旺"); // 辰(土) 在辰月
      expect(getWangXiang(4, 1)).toBe("旺"); // 丑(土) 在辰月
      expect(getWangXiang(4, 8)).toBe("相"); // 申(金) 在辰月（土生金）
      expect(getWangXiang(4, 6)).toBe("休"); // 午(火) 在辰月（火生土）
      // 木克土（target克当令）→ 囚
      expect(getWangXiang(4, 2)).toBe("囚"); // 寅(木) 在辰月
      expect(getWangXiang(4, 3)).toBe("囚"); // 卯(木) 在辰月
      // 土克水（当令克target）→ 死
      expect(getWangXiang(4, 11)).toBe("死"); // 亥(水) 在辰月
      expect(getWangXiang(4, 0)).toBe("死"); // 子(水) 在辰月
    });
  });

  describe("getAllWangXiang 全支旺衰", () => {
    it("返回 12 个地支的旺衰状态", () => {
      const all = getAllWangXiang(2); // 寅月
      expect(Object.keys(all)).toHaveLength(12);
      // 统计各状态数量
      const counts: Record<string, number> = {};
      for (const v of Object.values(all)) {
        counts[v] = (counts[v] || 0) + 1;
      }
      // 寅月：2 木旺、2 火相、2 水休、2 金囚、4 土死
      expect(counts["旺"]).toBe(2);
      expect(counts["相"]).toBe(2);
      expect(counts["休"]).toBe(2);
      expect(counts["囚"]).toBe(2);
      expect(counts["死"]).toBe(4);
    });
  });
});
