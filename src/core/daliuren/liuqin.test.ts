/**
 * 六亲关系测试
 */
import { describe, expect, it } from "vitest";
import { getLiuQin, getAllLiuQin } from "./liuqin";

describe("六亲关系", () => {
  describe("getLiuQin 单支判定", () => {
    // 甲(0) = 木，以木为"我"
    it("甲日(木)：寅卯=兄弟、亥子=父母、巳午=子孙、辰戌丑未=妻财、申酉=官鬼", () => {
      // 同我 = 兄弟
      expect(getLiuQin(0, 2)).toBe("兄弟"); // 寅(木)
      expect(getLiuQin(0, 3)).toBe("兄弟"); // 卯(木)
      // 生我 = 父母
      expect(getLiuQin(0, 11)).toBe("父母"); // 亥(水) 水生木
      expect(getLiuQin(0, 0)).toBe("父母"); // 子(水)
      // 我生 = 子孙
      expect(getLiuQin(0, 5)).toBe("子孙"); // 巳(火) 木生火
      expect(getLiuQin(0, 6)).toBe("子孙"); // 午(火)
      // 我克 = 妻财
      expect(getLiuQin(0, 4)).toBe("妻财"); // 辰(土) 木克土
      expect(getLiuQin(0, 1)).toBe("妻财"); // 丑(土)
      // 克我 = 官鬼
      expect(getLiuQin(0, 8)).toBe("官鬼"); // 申(金) 金克木
      expect(getLiuQin(0, 9)).toBe("官鬼"); // 酉(金)
    });

    // 丙(2) = 火，以火为"我"
    it("丙日(火)：巳午=兄弟、寅卯=父母、辰戌丑未=子孙、申酉=妻财、亥子=官鬼", () => {
      expect(getLiuQin(2, 5)).toBe("兄弟"); // 巳(火)
      expect(getLiuQin(2, 2)).toBe("父母"); // 寅(木) 木生火
      expect(getLiuQin(2, 4)).toBe("子孙"); // 辰(土) 火生土
      expect(getLiuQin(2, 8)).toBe("妻财"); // 申(金) 火克金
      expect(getLiuQin(2, 0)).toBe("官鬼"); // 子(水) 水克火
    });

    // 庚(6) = 金，以金为"我"
    it("庚日(金)：申酉=兄弟、辰戌丑未=父母、亥子=子孙、寅卯=妻财、巳午=官鬼", () => {
      expect(getLiuQin(6, 8)).toBe("兄弟"); // 申(金)
      expect(getLiuQin(6, 4)).toBe("父母"); // 辰(土) 土生金
      expect(getLiuQin(6, 11)).toBe("子孙"); // 亥(水) 金生水
      expect(getLiuQin(6, 2)).toBe("妻财"); // 寅(木) 金克木
      expect(getLiuQin(6, 6)).toBe("官鬼"); // 午(火) 火克金
    });
  });

  describe("getAllLiuQin 全支六亲", () => {
    it("返回 12 个地支的六亲", () => {
      const all = getAllLiuQin(0); // 甲日
      expect(Object.keys(all)).toHaveLength(12);
    });

    it("每种六亲出现次数符合五行分布", () => {
      const all = getAllLiuQin(0); // 甲日(木)
      const counts: Record<string, number> = {};
      for (const v of Object.values(all)) {
        counts[v] = (counts[v] || 0) + 1;
      }
      // 木=2支(兄弟)、水=2支(父母)、火=2支(子孙)、土=4支(妻财)、金=2支(官鬼)
      expect(counts["兄弟"]).toBe(2);
      expect(counts["父母"]).toBe(2);
      expect(counts["子孙"]).toBe(2);
      expect(counts["妻财"]).toBe(4);
      expect(counts["官鬼"]).toBe(2);
    });
  });
});
