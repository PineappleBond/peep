/**
 * 地支刑冲破害合关系检测测试
 */
import { describe, expect, it } from "vitest";
import { findBranchRelations, type BranchRelation } from "./relations";

describe("findBranchRelations 刑冲破害合检测", () => {
  it("六冲：子午冲", () => {
    const rels = findBranchRelations([0, 6]); // 子、午
    expect(rels.some(r => r.type === "冲" && r.description.includes("子午"))).toBe(true);
  });

  it("六合：子丑合", () => {
    const rels = findBranchRelations([0, 1]); // 子、丑
    expect(rels.some(r => r.type === "合")).toBe(true);
  });

  it("三刑：寅巳申无恩之刑", () => {
    const rels = findBranchRelations([2, 5]); // 寅、巳
    expect(rels.some(r => r.type === "刑" && r.description.includes("无恩"))).toBe(true);
  });

  it("三刑：丑戌未恃势之刑", () => {
    const rels = findBranchRelations([1, 7]); // 丑、未
    expect(rels.some(r => r.type === "刑" && r.description.includes("恃势"))).toBe(true);
  });

  it("三刑：子卯无礼之刑", () => {
    const rels = findBranchRelations([0, 3]); // 子、卯
    expect(rels.some(r => r.type === "刑" && r.description.includes("无礼"))).toBe(true);
  });

  it("自刑：辰辰自刑（单支重复出现）", () => {
    const rels = findBranchRelations([4, 4]); // 辰、辰
    expect(rels.some(r => r.type === "刑" && r.description.includes("自刑"))).toBe(true);
  });

  it("自刑：非自刑支重复不产生自刑", () => {
    const rels = findBranchRelations([0, 0]); // 子、子（子非自刑支）
    expect(rels.some(r => r.type === "刑" && r.description.includes("自刑"))).toBe(false);
  });

  it("六破：子酉破", () => {
    const rels = findBranchRelations([0, 9]); // 子、酉
    expect(rels.some(r => r.type === "破")).toBe(true);
  });

  it("六害：子未害", () => {
    const rels = findBranchRelations([0, 7]); // 子、未
    expect(rels.some(r => r.type === "害")).toBe(true);
  });

  it("空列表返回空", () => {
    expect(findBranchRelations([])).toHaveLength(0);
  });

  it("单个元素无关系", () => {
    expect(findBranchRelations([0])).toHaveLength(0);
  });

  it("多支混合关系检测", () => {
    // 子(0) 午(6) 卯(3)：子午冲、子卯刑
    const rels = findBranchRelations([0, 6, 3]);
    const types = rels.map(r => r.type);
    expect(types).toContain("冲");
    expect(types).toContain("刑");
  });

  it("无关系的地支组合返回空", () => {
    // 寅(2) 辰(4)：无特殊关系
    const rels = findBranchRelations([2, 4]);
    expect(rels).toHaveLength(0);
  });
});
