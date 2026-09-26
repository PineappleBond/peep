/**
 * 建除十二直测试
 */
import { describe, expect, it } from "vitest";
import { getJianChu, getMonthJianChu, type JianChuType } from "./jianchu";

describe("建除十二直", () => {
  describe("getJianChu 单支判定", () => {
    it("月建自身 = 建", () => {
      for (let m = 0; m < 12; m++) {
        expect(getJianChu(m, m)).toBe("建");
      }
    });

    it("月建后一位 = 除", () => {
      expect(getJianChu(0, 1)).toBe("除"); // 子月，丑 = 除
      expect(getJianChu(2, 3)).toBe("除"); // 寅月，卯 = 除
    });

    it("完整十二直顺序（寅月为例）", () => {
      // 寅月（月支=2）起建，顺排：寅=建、卯=除、辰=满、巳=平、午=定、未=执、
      // 申=破、酉=危、戌=成、亥=收、子=开、丑=闭
      const order: JianChuType[] = [
        "建", "除", "满", "平", "定", "执", "破", "危", "成", "收", "开", "闭",
      ];
      for (let i = 0; i < 12; i++) {
        const target = (2 + i) % 12;
        expect(getJianChu(2, target)).toBe(order[i]);
      }
    });

    it("跨月建边界回绕（亥月，子=建后一位=除）", () => {
      expect(getJianChu(11, 0)).toBe("除"); // 亥月(11)，子(0) = 除
    });
  });

  describe("getMonthJianChu 全月建除", () => {
    it("返回 12 个地支的建除类型", () => {
      const all = getMonthJianChu(2); // 寅月
      expect(Object.keys(all)).toHaveLength(12);
      expect(all[2]).toBe("建");
    });

    it("十二种建除类型各出现一次", () => {
      const all = getMonthJianChu(0); // 子月
      const types = new Set(Object.values(all));
      expect(types.size).toBe(12);
    });
  });
});
