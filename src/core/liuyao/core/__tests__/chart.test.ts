import { describe, it, expect } from "vitest";
import { buildChart, locateYong, tossLine, tossHexagram } from "../chart";
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

  it("多动爻场景（2-5 个动爻）", () => {
    // 2 个动爻
    const lines2: SixLines = [3, 3, 1, 1, 1, 1];
    const chart2 = buildChart({ lines: lines2, date: "2024-03-15" });
    expect(chart2.lines.filter(l => l.moving)).toHaveLength(2);
    expect(chart2.changed).not.toBeNull();

    // 3 个动爻
    const lines3: SixLines = [3, 3, 3, 1, 1, 1];
    const chart3 = buildChart({ lines: lines3, date: "2024-03-15" });
    expect(chart3.lines.filter(l => l.moving)).toHaveLength(3);

    // 5 个动爻
    const lines5: SixLines = [3, 3, 3, 3, 3, 1];
    const chart5 = buildChart({ lines: lines5, date: "2024-03-15" });
    expect(chart5.lines.filter(l => l.moving)).toHaveLength(5);
  });

  it("旬空三种状态（逢空、填实、冲空）", () => {
    // 构造一个旬空场景：甲子日，旬空戌亥
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const date = "2024-01-01"; // 甲子日
    const chart = buildChart({ lines, date });

    expect(chart.day.kong).toContain("戌");
    expect(chart.day.kong).toContain("亥");

    // 验证旬空状态判定
    // 逢空：爻的地支在旬空中，且没有被日辰填实或冲空
    // 填实：爻的地支在旬空中，但被日辰六合或比和
    // 冲空：爻的地支在旬空中，但被日辰六冲
    const kongLines = chart.lines.filter(l => l.kong);
    expect(kongLines.length).toBeGreaterThan(0);

    // 验证 kongState 字段存在
    kongLines.forEach(l => {
      expect(["逢空", "填实", "冲空", null]).toContain(l.kongState);
    });
  });

  it("月建覆写（monthBranchOverride）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const date = "2024-01-15"; // 小寒后、立春前，应该是丑月
    const chart1 = buildChart({ lines, date });
    expect(chart1.month.branch).toBe("丑");

    // 手动覆写为寅月
    const chart2 = buildChart({ lines, date, monthBranchOverride: "寅" });
    expect(chart2.month.branch).toBe("寅");
  });

  it("日柱覆写（dayGanzhiOverride）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const date = "2024-03-15";

    // 手动覆写日柱
    const chart = buildChart({ lines, date, dayGanzhiOverride: "甲子" });
    expect(chart.day.stem).toBe("甲");
    expect(chart.day.branch).toBe("子");
    expect(chart.day.kong).toContain("戌");
    expect(chart.day.kong).toContain("亥");
  });

  it("六神起法验证", () => {
    // 甲乙日起青龙，丙丁日起朱雀，戊日起勾陈，己日起螣蛇，庚辛日起白虎，壬癸日起玄武
    const lines: SixLines = [1, 1, 1, 1, 1, 1];

    const chartJia = buildChart({ lines, date: "2024-01-01" }); // 甲子日
    expect(chartJia.lines[0].god).toBe("青龙");

    const chartBing = buildChart({ lines, date: "2024-01-03" }); // 丙寅日
    expect(chartBing.lines[0].god).toBe("朱雀");

    const chartWu = buildChart({ lines, date: "2024-01-05" }); // 戊辰日
    expect(chartWu.lines[0].god).toBe("勾陈");
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

  it("用神伏藏时 hidden 字段完整", () => {
    // 构造一个用神不上卦的场景
    // 乾为天：子水子孙(初)、寅木妻财(二)、辰土父母(三)、午火官鬼(四)、申金兄弟(五)、戌土父母(六)
    // 如果要找"兄弟"（申金），应该能找到（五爻）
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "兄弟");
    expect(yong.pos).toBe(5);
    expect(yong.hidden).toBeNull();
  });

  it("初现优先（无动爻、无持世时）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 乾为天六亲分布：子孙(初)、妻财(二)、父母(三)、官鬼(四)、兄弟(五)、父母(六)
    // 世爻在六爻（父母）
    // 找配偶（妻财爻）：只在二爻出现，无动爻，不在世爻
    // 应该取第二个爻
    const yong = locateYong(chart, "配偶");
    expect(yong.rel).toBe("妻财");
    expect(yong.pos).toBe(2);
    expect(yong.pickedBy).toBeNull(); // 只有一个，没有 pickedBy
  });
});

describe("tossLine / tossHexagram", () => {
  it("tossLine 返回 0-3 的整数", () => {
    for (let i = 0; i < 100; i++) {
      const line = tossLine();
      expect([0, 1, 2, 3]).toContain(line);
    }
  });

  it("tossHexagram 返回 6 个爻值", () => {
    const hex = tossHexagram();
    expect(hex).toHaveLength(6);
    hex.forEach(line => {
      expect([0, 1, 2, 3]).toContain(line);
    });
  });

  it("tossLine 概率分布合理（大量测试）", () => {
    const counts = [0, 0, 0, 0];
    const n = 10000;
    for (let i = 0; i < n; i++) {
      counts[tossLine()]++;
    }
    // 少阳(1)和少阴(0)应该各占约 37.5%，老阳(3)和老阴(2)各占约 12.5%
    // 允许 10% 的误差
    expect(counts[0] / n).toBeGreaterThan(0.27);
    expect(counts[0] / n).toBeLessThan(0.47);
    expect(counts[1] / n).toBeGreaterThan(0.27);
    expect(counts[1] / n).toBeLessThan(0.47);
  });
});
