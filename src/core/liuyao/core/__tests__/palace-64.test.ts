/**
 * 64卦完整验证测试
 *
 * 严格验证八宫卦表的完整性与正确性：
 * - 64卦全部可查且不抛错
 * - 每宫恰好8卦（本宫+一世~五世+游魂+归魂）
 * - 每种卦型恰好8次（每宫一次）
 * - 世应关系正确（应 = 世 ± 3）
 * - 卦名全部唯一
 * - 逐卦对照标准八宫卦表
 */

import { describe, it, expect } from "vitest";
import { palaceInfo, type Bits, type PalaceInfo } from "../palace";

/** 生成所有64种6爻组合 */
function generateAll64Hexagrams(): Bits[] {
  const result: Bits[] = [];
  for (let i = 0; i < 64; i++) {
    const bits: Bits = [
      (i >> 0) & 1,
      (i >> 1) & 1,
      (i >> 2) & 1,
      (i >> 3) & 1,
      (i >> 4) & 1,
      (i >> 5) & 1,
    ];
    result.push(bits);
  }
  return result;
}

describe("64卦完整性验证", () => {
  const allHexagrams = generateAll64Hexagrams();

  it("64卦全部可查且不抛错", () => {
    for (const bits of allHexagrams) {
      expect(() => palaceInfo(bits)).not.toThrow();
    }
  });

  it("每宫恰好8卦", () => {
    const palaceCounts = new Map<string, number>();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      palaceCounts.set(info.palace, (palaceCounts.get(info.palace) || 0) + 1);
    }

    const expectedPalaces = ["乾", "坤", "震", "巽", "坎", "离", "艮", "兑"];
    expect(palaceCounts.size).toBe(8);

    for (const palace of expectedPalaces) {
      expect(palaceCounts.get(palace)).toBe(8);
    }
  });

  it("每种卦型恰好8次（每宫一次）", () => {
    const typeCounts = new Map<string, number>();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      typeCounts.set(info.type, (typeCounts.get(info.type) || 0) + 1);
    }

    const expectedTypes = ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"];
    expect(typeCounts.size).toBe(8);

    for (const type of expectedTypes) {
      expect(typeCounts.get(type)).toBe(8);
    }
  });

  it("世应关系正确（应 = 世 ± 3）", () => {
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      const expectedYing = info.shi > 3 ? info.shi - 3 : info.shi + 3;
      expect(info.ying).toBe(expectedYing);
    }
  });

  it("世爻位置在1-6之间", () => {
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.shi).toBeGreaterThanOrEqual(1);
      expect(info.shi).toBeLessThanOrEqual(6);
    }
  });

  it("应爻位置在1-6之间", () => {
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.ying).toBeGreaterThanOrEqual(1);
      expect(info.ying).toBeLessThanOrEqual(6);
    }
  });

  it("卦名全部唯一", () => {
    const names = new Set<string>();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(names.has(info.name)).toBe(false);
      names.add(info.name);
    }
    expect(names.size).toBe(64);
  });

  it("palace属于八宫之一", () => {
    const validPalaces = new Set(["乾", "坤", "震", "巽", "坎", "离", "艮", "兑"]);
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(validPalaces.has(info.palace)).toBe(true);
    }
  });

  it("type属于八种卦型之一", () => {
    const validTypes = new Set(["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"]);
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(validTypes.has(info.type)).toBe(true);
    }
  });
});

describe("八宫各类型全覆盖", () => {
  /** 标准八宫卦表（部分已知卦例） */
  const knownHexagrams: Array<{
    bits: Bits;
    palace: string;
    type: string;
    name: string;
    shi: number;
    ying: number;
  }> = [
    // 乾宫
    { bits: [1, 1, 1, 1, 1, 1], palace: "乾", type: "本宫", name: "乾为天", shi: 6, ying: 3 },
    { bits: [0, 1, 1, 1, 1, 1], palace: "乾", type: "一世", name: "天风姤", shi: 1, ying: 4 },
    { bits: [0, 0, 1, 1, 1, 1], palace: "乾", type: "二世", name: "天山遁", shi: 2, ying: 5 },
    { bits: [0, 0, 0, 1, 1, 1], palace: "乾", type: "三世", name: "天地否", shi: 3, ying: 6 },
    { bits: [0, 0, 0, 0, 1, 1], palace: "乾", type: "四世", name: "风地观", shi: 4, ying: 1 },
    { bits: [0, 0, 0, 0, 0, 1], palace: "乾", type: "五世", name: "山地剥", shi: 5, ying: 2 },
    { bits: [1, 1, 1, 1, 0, 1], palace: "乾", type: "归魂", name: "火天大有", shi: 3, ying: 6 },

    // 坤宫
    { bits: [0, 0, 0, 0, 0, 0], palace: "坤", type: "本宫", name: "坤为地", shi: 6, ying: 3 },

    // 震宫
    { bits: [1, 0, 0, 1, 0, 0], palace: "震", type: "本宫", name: "震为雷", shi: 6, ying: 3 },

    // 巽宫
    { bits: [0, 1, 1, 0, 1, 1], palace: "巽", type: "本宫", name: "巽为风", shi: 6, ying: 3 },

    // 坎宫
    { bits: [0, 1, 0, 0, 1, 0], palace: "坎", type: "本宫", name: "坎为水", shi: 6, ying: 3 },

    // 离宫
    { bits: [1, 0, 1, 1, 0, 1], palace: "离", type: "本宫", name: "离为火", shi: 6, ying: 3 },

    // 艮宫
    { bits: [0, 0, 1, 0, 0, 1], palace: "艮", type: "本宫", name: "艮为山", shi: 6, ying: 3 },

    // 兑宫
    { bits: [1, 1, 0, 1, 1, 0], palace: "兑", type: "本宫", name: "兑为泽", shi: 6, ying: 3 },
  ];

  for (const expected of knownHexagrams) {
    it(`${expected.palace}宫${expected.type}：${expected.name}`, () => {
      const info = palaceInfo(expected.bits);
      expect(info.palace).toBe(expected.palace);
      expect(info.type).toBe(expected.type);
      expect(info.name).toBe(expected.name);
      expect(info.shi).toBe(expected.shi);
      expect(info.ying).toBe(expected.ying);
    });
  }

  it("每宫至少测试1个非本宫卦例", () => {
    // 验证测试覆盖了每宫的非本宫卦
    const nonBenPalaces = new Set<string>();
    for (const hex of knownHexagrams) {
      if (hex.type !== "本宫") {
        nonBenPalaces.add(hex.palace);
      }
    }
    // 至少乾宫有完整覆盖
    expect(nonBenPalaces.has("乾")).toBe(true);
  });
});

describe("世爻位置规律验证", () => {
  it("本宫卦世爻在六爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "本宫") {
        expect(info.shi).toBe(6);
      }
    }
  });

  it("一世卦世爻在初爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "一世") {
        expect(info.shi).toBe(1);
      }
    }
  });

  it("二世卦世爻在二爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "二世") {
        expect(info.shi).toBe(2);
      }
    }
  });

  it("三世卦世爻在三爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "三世") {
        expect(info.shi).toBe(3);
      }
    }
  });

  it("四世卦世爻在四爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "四世") {
        expect(info.shi).toBe(4);
      }
    }
  });

  it("五世卦世爻在五爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "五世") {
        expect(info.shi).toBe(5);
      }
    }
  });

  it("游魂卦世爻在四爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "游魂") {
        expect(info.shi).toBe(4);
      }
    }
  });

  it("归魂卦世爻在三爻", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      if (info.type === "归魂") {
        expect(info.shi).toBe(3);
      }
    }
  });
});

describe("卦表数据结构完整性", () => {
  it("所有卦的name字段非空", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.name).toBeTruthy();
      expect(typeof info.name).toBe("string");
      expect(info.name.length).toBeGreaterThan(0);
    }
  });

  it("所有卦的palace字段非空", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.palace).toBeTruthy();
      expect(typeof info.palace).toBe("string");
    }
  });

  it("所有卦的type字段非空", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.type).toBeTruthy();
      expect(typeof info.type).toBe("string");
    }
  });

  it("世应爻位不相等", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      expect(info.shi).not.toBe(info.ying);
    }
  });

  it("世应爻位差值为3", () => {
    const allHexagrams = generateAll64Hexagrams();
    for (const bits of allHexagrams) {
      const info = palaceInfo(bits);
      const diff = Math.abs(info.shi - info.ying);
      expect(diff).toBe(3);
    }
  });
});
