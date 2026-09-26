/**
 * 神煞计算测试
 */
import { describe, expect, it } from "vitest";
import { calculateShenSha } from "./shensha";

describe("神煞计算", () => {
  // 2024-02-04 立春后：甲辰年 丙寅月 甲子日 庚午时
  const yearBranch = 4; // 辰
  const monthBranch = 2; // 寅
  const dayStem = 0; // 甲
  const dayBranch = 0; // 子
  const hourBranch = 6; // 午

  const shas = calculateShenSha(yearBranch, monthBranch, dayStem, dayBranch, hourBranch);

  it("返回非空神煞列表", () => {
    expect(shas.length).toBeGreaterThan(20);
  });

  it("每个神煞含 name/branch/type/description 四字段", () => {
    for (const s of shas) {
      expect(s.name).toBeTruthy();
      expect(s.branch).toBeGreaterThanOrEqual(0);
      expect(s.branch).toBeLessThan(12);
      expect(["吉", "凶"]).toContain(s.type);
      expect(s.description).toBeTruthy();
    }
  });

  it("岁破在年支对冲位（辰→戌）", () => {
    const suiPo = shas.find(s => s.name === "岁破");
    expect(suiPo).toBeDefined();
    expect(suiPo!.branch).toBe(10); // 戌
  });

  it("驿马在日支三合长生对冲（子→申子辰→马在寅）", () => {
    const yiMa = shas.find(s => s.name === "驿马");
    expect(yiMa).toBeDefined();
    expect(yiMa!.branch).toBe(2); // 寅
  });

  it("将星在日支三合帝旺位（子→申子辰→帝旺在子）", () => {
    const jiangXing = shas.find(s => s.name === "将星");
    expect(jiangXing).toBeDefined();
    expect(jiangXing!.branch).toBe(0); // 子
  });

  it("华盖在日支三合墓库位（子→申子辰→墓在辰）", () => {
    const huaGai = shas.find(s => s.name === "华盖");
    expect(huaGai).toBeDefined();
    expect(huaGai!.branch).toBe(4); // 辰
  });

  it("禄神在日干临官位（甲→寅）", () => {
    const luShen = shas.find(s => s.name === "禄神");
    expect(luShen).toBeDefined();
    expect(luShen!.branch).toBe(2); // 寅
  });

  it("吉煞与凶煞数量均不为零", () => {
    const jiCount = shas.filter(s => s.type === "吉").length;
    const xiongCount = shas.filter(s => s.type === "凶").length;
    expect(jiCount).toBeGreaterThan(0);
    expect(xiongCount).toBeGreaterThan(0);
  });

  it("不同日支得出不同驿马位", () => {
    // 申子辰→马在寅，寅午戌→马在申
    const sha1 = calculateShenSha(4, 2, 0, 0, 6); // 子日
    const sha2 = calculateShenSha(4, 2, 0, 6, 6); // 午日
    const ma1 = sha1.find(s => s.name === "驿马")!.branch;
    const ma2 = sha2.find(s => s.name === "驿马")!.branch;
    expect(ma1).not.toBe(ma2);
  });
});
