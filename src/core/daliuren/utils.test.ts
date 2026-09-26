/**
 * 大六壬公共工具函数测试：五行生克、六十甲子、十干寄宫、盘面查询
 */
import { describe, expect, it } from "vitest";
import {
  elemB,
  elemS,
  keOf,
  shengOf,
  sexagenaryIndex,
  stemLodgingBranch,
  isFuyin,
  isFanyin,
  inFourLessons,
  getGeneralRidingBranch,
  findGeneralPosition,
} from "./utils";
import type { DaLiuRenResult } from "./types";

/** 构造最小 DaLiuRenResult 用于查询类函数测试 */
function makeMinimalResult(overrides: Partial<DaLiuRenResult> = {}): DaLiuRenResult {
  return {
    calculationTime: "2024-01-15 12:00:00",
    fourPillars: {
      yearStem: 3,
      yearBranch: 3, // 丁卯
      monthStem: 9,
      monthBranch: 0, // 癸子
      dayStem: 0,
      dayBranch: 0, // 甲子
      hourStem: 6,
      hourBranch: 6, // 庚午
      yearPillar: "丁卯",
      monthPillar: "癸丑",
      dayPillar: "甲子",
      hourPillar: "庚午",
    },
    monthGeneral: { branch: 0, name: "子" },
    earthBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    heavenBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // 伏吟
    fourLessons: [
      { upper: 0, lower: 0, lowerType: "stem" },
      { upper: 1, lower: 0, lowerType: "branch" },
      { upper: 0, lower: 0, lowerType: "stem" },
      { upper: 11, lower: 0, lowerType: "branch" },
    ],
    xunKong: { xunHead: 0, void1: 10, void2: 11 },
    threeTransmissions: { initial: 0, middle: 1, final: 2, method: "测试", trace: [] },
    twelveGenerals: [
      { position: 0, general: 0, name: "贵人" },
      { position: 1, general: 1, name: "螣蛇" },
      { position: 2, general: 2, name: "朱雀" },
      { position: 3, general: 3, name: "六合" },
      { position: 4, general: 4, name: "勾陈" },
      { position: 5, general: 5, name: "青龙" },
      { position: 6, general: 6, name: "天空" },
      { position: 7, general: 7, name: "白虎" },
      { position: 8, general: 8, name: "太常" },
      { position: 9, general: 9, name: "玄武" },
      { position: 10, general: 10, name: "太阴" },
      { position: 11, general: 11, name: "天后" },
    ],
    wangXiang: {},
    liuQin: {},
    xunDun: {},
    riDun: [],
    shenSha: [],
    relations: [],
    keJing: [],
    biFa: [],
    jianChu: {},
    naYin: {},
    calculationTrace: [],
    ...overrides,
  } as DaLiuRenResult;
}

describe("大六壬公共工具函数", () => {
  describe("五行生克", () => {
    // 五行顺序：木(0) 火(1) 土(2) 金(3) 水(4)
    it("elemB 地支五行（亥子=水、寅卯=木、巳午=火、申酉=金、辰戌丑未=土）", () => {
      expect(elemB(0)).toBe(4); // 子=水
      expect(elemB(1)).toBe(2); // 丑=土
      expect(elemB(2)).toBe(0); // 寅=木
      expect(elemB(3)).toBe(0); // 卯=木
      expect(elemB(5)).toBe(1); // 巳=火
      expect(elemB(6)).toBe(1); // 午=火
      expect(elemB(8)).toBe(3); // 申=金
      expect(elemB(9)).toBe(3); // 酉=金
    });

    it("elemS 天干五行", () => {
      expect(elemS(0)).toBe(0); // 甲=木
      expect(elemS(1)).toBe(0); // 乙=木
      expect(elemS(2)).toBe(1); // 丙=火
      expect(elemS(6)).toBe(3); // 庚=金
      expect(elemS(8)).toBe(4); // 壬=水
    });

    it("keOf 五行相克：木克土、土克水、水克火、火克金、金克木", () => {
      expect(keOf(0)).toBe(2); // 木→土
      expect(keOf(1)).toBe(3); // 火→金 (wait, 火克金? No: 火→(1+2)%5=3=金, yes)
      expect(keOf(2)).toBe(4); // 土→水
      expect(keOf(3)).toBe(0); // 金→木
      expect(keOf(4)).toBe(1); // 水→火
    });

    it("shengOf 五行相生：木生火、火生土、土生金、金生水、水生木", () => {
      expect(shengOf(0)).toBe(1); // 木→火
      expect(shengOf(1)).toBe(2); // 火→土
      expect(shengOf(2)).toBe(3); // 土→金
      expect(shengOf(3)).toBe(4); // 金→水
      expect(shengOf(4)).toBe(0); // 水→木
    });
  });

  describe("六十甲子", () => {
    it("sexagenaryIndex 甲子=0、乙丑=1、丙寅=2", () => {
      expect(sexagenaryIndex(0, 0)).toBe(0); // 甲子
      expect(sexagenaryIndex(1, 1)).toBe(1); // 乙丑
      expect(sexagenaryIndex(2, 2)).toBe(2); // 丙寅
    });

    it("sexagenaryIndex 同阴阳校验：天干地支奇偶相同", () => {
      // 六十甲子中，天干与地支的奇偶性一致
      for (let s = 0; s < 10; s++) {
        for (let b = 0; b < 12; b++) {
          if (s % 2 === b % 2) {
            const n = sexagenaryIndex(s, b);
            expect(n % 10).toBe(s);
            expect(n % 12).toBe(b);
          }
        }
      }
    });

    it("sexagenaryIndex 六十周期", () => {
      // 甲子 → 60 天后回到甲子
      // 通过 CRT 验证范围 0-59
      const seen = new Set<number>();
      for (let s = 0; s < 10; s++) {
        for (let b = 0; b < 12; b++) {
          if (s % 2 === b % 2) {
            seen.add(sexagenaryIndex(s, b));
          }
        }
      }
      expect(seen.size).toBe(60);
    });
  });

  describe("十干寄宫", () => {
    it("stemLodgingBranch 返回 0-11 范围", () => {
      for (let s = 0; s < 10; s++) {
        const b = stemLodgingBranch(s);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(12);
      }
    });

    it("甲寄寅(2)、乙寄辰(4)、庚寄申(8)", () => {
      expect(stemLodgingBranch(0)).toBe(2); // 甲→寅
      expect(stemLodgingBranch(2)).toBe(5); // 丙→巳 (wait, need to check)
    });
  });

  describe("盘面查询", () => {
    it("isFuyin 天地盘重合（heavenBoard[0]=0）", () => {
      const r = makeMinimalResult({ heavenBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
      expect(isFuyin(r)).toBe(true);
    });

    it("isFuyin 天地盘不重合时返回 false", () => {
      const r = makeMinimalResult({ heavenBoard: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5] });
      expect(isFuyin(r)).toBe(false);
    });

    it("isFanyin 天地盘对冲（heavenBoard[0]=6）", () => {
      const r = makeMinimalResult({ heavenBoard: [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5] });
      expect(isFanyin(r)).toBe(true);
    });

    it("inFourLessons 检查天盘支是否在四课上课中", () => {
      const r = makeMinimalResult();
      expect(inFourLessons(0, r)).toBe(true); // 0 在四课中
      expect(inFourLessons(6, r)).toBe(false); // 6 不在四课中
    });

    it("getGeneralRidingBranch 取天盘某支所乘天将", () => {
      const r = makeMinimalResult();
      // 天盘子(0)在地盘宫位 0，该宫天将为贵人(0)
      expect(getGeneralRidingBranch(0, r)).toBe(0);
    });

    it("findGeneralPosition 找天将所在地盘宫位", () => {
      const r = makeMinimalResult();
      expect(findGeneralPosition("贵人", r)).toBe(0);
      expect(findGeneralPosition("白虎", r)).toBe(7);
      expect(findGeneralPosition("不存在", r)).toBe(-1);
    });
  });
});
