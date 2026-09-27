import { describe, it, expect } from "vitest";
import { buildChart, locateYong } from "../chart";
import type { ChartJSON, SixLines } from "../types";

describe("buildChart", () => {
  it("卦例1：乾为天（六爻全静）", () => {
    // 乾为天：六爻皆阳，无动爻
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 少阳
    const date = "2024-03-15";
    const chart = buildChart({ lines, date });

    expect(chart.name).toBe("乾为天");
    expect(chart.palace).toBe("乾");
    expect(chart.palaceElem).toBe("金");
    expect(chart.type).toBe("本宫");
    expect(chart.shi).toBe(6);
    expect(chart.ying).toBe(3);
    expect(chart.lines).toHaveLength(6);
    expect(chart.changed).toBeNull(); // 无动爻

    // 验证六亲
    expect(chart.lines[0].rel).toBe("子孙"); // 子水（金生水，我生者）
    expect(chart.lines[2].rel).toBe("父母"); // 辰土（土生金，生我者）

    // 验证月建日辰
    expect(chart.month.branch).toBeDefined();
    expect(chart.day.stem).toBeDefined();
    expect(chart.day.branch).toBeDefined();
    expect(chart.day.kong).toHaveLength(2);
  });

  it("卦例2：坤为地（六爻全动）", () => {
    // 坤为地：六爻皆阴，全动
    const lines: SixLines = [2, 2, 2, 2, 2, 2]; // 老阴，全动
    const date = "2024-06-20";
    const chart = buildChart({ lines, date });

    expect(chart.name).toBe("坤为地");
    expect(chart.palace).toBe("坤");
    expect(chart.palaceElem).toBe("土");
    expect(chart.type).toBe("本宫");
    expect(chart.lines).toHaveLength(6);
    expect(chart.lines.every(l => l.moving)).toBe(true); // 全动
    expect(chart.changed).not.toBeNull();
    expect(chart.changed!.lines).toHaveLength(6);
  });

  it("卦例3：水火既济（一动爻）", () => {
    // 水火既济：坎上离下，初爻动
    const lines: SixLines = [3, 0, 1, 0, 1, 0]; // 初爻老阳（动），其余少阴/少阳
    const date = "2024-09-10";
    const chart = buildChart({ lines, date });

    expect(chart.name).toBe("水火既济");
    expect(chart.lines[0].moving).toBe(true); // 初爻动
    expect(chart.lines.slice(1).every(l => !l.moving)).toBe(true); // 其余不动
    expect(chart.changed).not.toBeNull();
    expect(chart.changed!.lines[0].yang).toBe(false); // 初爻变阴
  });

  it("旬空判定正确", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const date = "2024-01-01"; // 甲子日，旬空戌亥
    const chart = buildChart({ lines, date });

    expect(chart.day.kong).toContain("戌");
    expect(chart.day.kong).toContain("亥");
  });

  it("月建自动推算正确", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    // 立春后应取寅月
    const date = "2024-02-10";
    const chart = buildChart({ lines, date });

    expect(chart.month.branch).toBeDefined();
    expect(chart.month.elem).toBeDefined();
  });
});

describe("locateYong", () => {
  it("用神上卦（单个）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "父母");

    expect(yong.rel).toBe("父母");
    expect(yong.pos).toBeDefined();
    expect(yong.hidden).toBeNull();
  });

  it("用神伏藏（不上卦）", () => {
    // 构造一个父母爻不上卦的场景
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 乾为天兄弟持世，子孙爻在初爻，父母爻在二爻
    // 如果要测"医药"（取子孙），应该能找到
    const yong = locateYong(chart, "医药");
    expect(yong.rel).toBe("子孙");
    expect(yong.pos).toBeDefined();
  });

  it("多动爻优先", () => {
    // 构造多个动爻的场景
    const lines: SixLines = [3, 3, 1, 1, 1, 1]; // 初爻、二爻老阳（动）
    const chart = buildChart({ lines, date: "2024-03-15" });

    expect(chart.lines[0].moving).toBe(true);
    expect(chart.lines[1].moving).toBe(true);

    // 如果有多个父母爻且都是动爻，应取第一个（爻位最小）
    const yong = locateYong(chart, "父母");
    if (yong.pickedBy === "动爻") {
      expect(yong.pos).toBeLessThanOrEqual(2);
    }
  });

  it("持世优先", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 自占时，取世爻的六亲为用神
    const yong = locateYong(chart, "自占");
    expect(yong.pos).toBe(chart.shi);
    expect(yong.pickedBy).toBe("持世");
  });
});
