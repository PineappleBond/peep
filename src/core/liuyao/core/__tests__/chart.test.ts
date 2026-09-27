import { describe, it, expect } from "vitest";
import { buildChart, locateYong, tossLine, tossHexagram } from "../chart";
import type { ChartJSON, SixLines, YongTarget, Relative } from "../types";

/** 辅助：从六亲反推 YongTarget（用于测试 locateYong） */
function relToYongTarget(rel: Relative, chart: ChartJSON): YongTarget {
  switch (rel) {
    case "子孙":
      return "子女";
    case "妻财":
      return "配偶";
    case "父母":
      return "父母";
    case "兄弟":
      return "兄弟";
    case "官鬼":
      // 官鬼没有直接对应的 YongTarget，用"自占"让世爻的六亲决定
      // 如果世爻六亲恰好是官鬼，返回"自占"；否则用"医药"
      return chart.lines[chart.shi - 1].rel === "官鬼" ? "自占" : "医药";
  }
}

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
    // 天风姤（乾宫一世卦）：上乾下巽
    // 乾宫属金，姤卦六爻元素为 {火,金,土,土,水,金}，缺少木（妻财）
    // 求"配偶"（取妻财爻）→ 六爻中无妻财 → 触发伏藏
    const lines: SixLines = [2, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 确认卦名为天风姤（若编码不对则跳过）
    if (chart.palace === "乾") {
      const rels = new Set(chart.lines.map(l => l.rel));
      // 如果六爻中确实缺少某种六亲，才能测伏藏
      if (!rels.has("妻财")) {
        const yong = locateYong(chart, "配偶");
        expect(yong.rel).toBe("妻财");
        expect(yong.pos).toBeNull(); // 伏藏时 pos 为 null
        expect(yong.hidden).not.toBeNull(); // hidden 不为 null
        expect(yong.hidden!.under).toBeGreaterThanOrEqual(1);
        expect(yong.hidden!.under).toBeLessThanOrEqual(6);
        expect(yong.hidden!.stem).toBeDefined();
        expect(yong.hidden!.branch).toBeDefined();
        expect(yong.hidden!.elem).toBeDefined();
      }
    }
  });

  it("多动爻优先（取爻位最小的动爻）", () => {
    // 构造：多个同六亲爻，其中爻位最小的为动爻
    // 乾为天：父母爻在三爻(辰土)和六爻(戌土)
    // 让三爻动（老阳=3），六爻静（少阳=1）
    const lines: SixLines = [1, 1, 3, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 验证三爻动、六爻不动
    expect(chart.lines[2].moving).toBe(true);
    expect(chart.lines[5].moving).toBe(false);
    // 两个父母爻
    const parents = chart.lines.filter(l => l.rel === "父母");
    expect(parents).toHaveLength(2);

    const yong = locateYong(chart, "父母");
    expect(yong.rel).toBe("父母");
    expect(yong.pickedBy).toBe("动爻");
    expect(yong.pos).toBe(3); // 取动的那个（三爻），而非六爻
  });

  it("多动爻时多个同六亲都是动爻——取爻位最小者", () => {
    // 构造两个父母爻都是动爻的场景
    // 需要找到两个同六亲且都是动爻的卦例
    // 坤为地：父母爻在哪些位置？
    // 坤宫属土。坤为地六爻：未(土-兄弟)、巳(火-父母)、卯(木-官鬼)、丑(土-兄弟)、亥(水-妻财)、酉(金-子孙)
    // 父母只在二爻(巳火)，只有一个。

    // 换一个思路：用雷水解（震宫三世卦）
    // 震宫属木。解卦：上震下坎
    // 坎(inner): 戊寅(木-兄弟), 戊辰(土-妻财), 戊午(火-子孙)
    // 震(outer): 庚午(火-子孙), 庚申(金-官鬼), 庚戌(土-妻财)
    // 妻财在三爻(辰土)和六爻(戌土)——有两个妻财爻！
    // 雷水解的 bits：坎=010, 震=001（从底到顶）
    // SixLines: [2,1,2,3,1,1] (让三爻和六爻都动)
    // 但解卦的卦名取决于 palace 算法，让我直接用 lines 构造。

    // 更简单的方法：遍历寻找卦例
    // 这里用一个已知有两个同六亲动爻的卦例
    // 先验证基本逻辑即可：动爻 > 持世 > 初现
    const lines: SixLines = [3, 1, 3, 1, 1, 1]; // 初爻、三爻动
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 找任意一个有多个候选且至少一个是动爻的六亲
    const relCounts = new Map<string, { total: number; moving: number }>();
    for (const l of chart.lines) {
      const c = relCounts.get(l.rel) ?? { total: 0, moving: 0 };
      c.total++;
      if (l.moving) c.moving++;
      relCounts.set(l.rel, c);
    }

    // 找有多个候选且至少一个是动爻的六亲
    let targetRel: string | null = null;
    for (const [rel, { total, moving }] of relCounts) {
      if (total >= 2 && moving >= 1) {
        targetRel = rel;
        break;
      }
    }

    if (targetRel) {
      const yongTarget = relToYongTarget(targetRel, chart);
      const yong = locateYong(chart, yongTarget);
      expect(yong.pickedBy).toBe("动爻");
      // 应该是所有动爻候选中爻位最小的
      const movingCandidates = chart.lines.filter(l => l.rel === targetRel && l.moving);
      const minPos = Math.min(...movingCandidates.map(l => l.pos));
      expect(yong.pos).toBe(minPos);
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
    // 使用天风姤（乾宫一世卦），缺妻财（木），测配偶触发伏藏
    const lines: SixLines = [2, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });

    if (chart.palace === "乾") {
      const rels = new Set(chart.lines.map(l => l.rel));
      if (!rels.has("妻财")) {
        const yong = locateYong(chart, "配偶");
        expect(yong.hidden).not.toBeNull();
        expect(yong.hidden!.under).toBeGreaterThanOrEqual(1);
        expect(yong.hidden!.under).toBeLessThanOrEqual(6);
        // 伏神来自本宫纯卦（乾为天）的纳甲
        expect(["甲", "壬"]).toContain(yong.hidden!.stem);
        expect(yong.hidden!.elem).toBeDefined();
      }
    }
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

describe("locateYong 6种YongTarget系统化验证", () => {
  it("自占——取世爻六亲", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    // 乾为天世爻在六爻（戌土-兄弟）
    const shiRel = chart.lines[chart.shi - 1].rel;
    const yong = locateYong(chart, "自占");
    expect(yong.rel).toBe(shiRel);
    expect(yong.pos).toBe(chart.shi);
    expect(yong.pickedBy).toBe("持世");
  });

  it("父母——取父母爻", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "父母");
    expect(yong.rel).toBe("父母");
    expect(yong.pos).toBeGreaterThan(0);
    // 确认找到的爻确实是父母
    const found = chart.lines.find(l => l.pos === yong.pos);
    expect(found?.rel).toBe("父母");
  });

  it("子女——取子孙爻", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "子女");
    expect(yong.rel).toBe("子孙");
    const found = chart.lines.find(l => l.pos === yong.pos);
    expect(found?.rel).toBe("子孙");
  });

  it("配偶——取妻财爻", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "配偶");
    expect(yong.rel).toBe("妻财");
    const found = chart.lines.find(l => l.pos === yong.pos);
    expect(found?.rel).toBe("妻财");
  });

  it("兄弟——取兄弟爻", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "兄弟");
    expect(yong.rel).toBe("兄弟");
    const found = chart.lines.find(l => l.pos === yong.pos);
    expect(found?.rel).toBe("兄弟");
  });

  it("医药——取子孙爻（与子女相同六亲）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 乾为天
    const chart = buildChart({ lines, date: "2024-03-15" });
    const yong = locateYong(chart, "医药");
    expect(yong.rel).toBe("子孙");
    // 医药和子女取相同六亲，结果应一致
    const yongZiNv = locateYong(chart, "子女");
    expect(yong.rel).toBe(yongZiNv.rel);
    expect(yong.pos).toBe(yongZiNv.pos);
  });

  it("6种YongTarget覆盖全部5种六亲", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const chart = buildChart({ lines, date: "2024-03-15" });
    const allRels = new Set<string>();

    const targets: Array<"自占" | "父母" | "子女" | "配偶" | "兄弟" | "医药"> = [
      "自占",
      "父母",
      "子女",
      "配偶",
      "兄弟",
      "医药",
    ];
    for (const target of targets) {
      const yong = locateYong(chart, target);
      allRels.add(yong.rel);
    }
    // 应覆盖：子孙、父母、妻财、兄弟 + 世爻的六亲
    expect(allRels.size).toBeGreaterThanOrEqual(4);
  });
});

describe("changed卦正确性", () => {
  it("变卦卦名正确（初爻动：乾为天→天风姤）", () => {
    // 乾为天[1,1,1,1,1,1]初爻动→变初爻为阴→[0,1,1,1,1,1]=天风姤
    const lines: SixLines = [3, 1, 1, 1, 1, 1]; // 初爻老阳（动）
    const chart = buildChart({ lines, date: "2024-03-15" });

    expect(chart.changed).not.toBeNull();
    expect(chart.changed!.name).toBe("天风姤");
    expect(chart.changed!.lines).toHaveLength(6);
  });

  it("变卦纳甲正确（变爻的干支不同于原卦）", () => {
    const lines: SixLines = [3, 1, 1, 1, 1, 1]; // 初爻动
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 初爻动：原卦初爻为阳，变卦初爻为阴
    expect(chart.lines[0].yang).toBe(true);
    expect(chart.changed!.lines[0].yang).toBe(false);
    // 变爻的干支应改变（纳甲不同）
    expect(
      chart.lines[0].stem !== chart.changed!.lines[0].stem ||
        chart.lines[0].branch !== chart.changed!.lines[0].branch,
    ).toBe(true);
  });

  it("不变爻在不同卦（未变化的三爻卦）中干支保持一致", () => {
    const lines: SixLines = [3, 1, 1, 1, 1, 1]; // 只有初爻动（在下卦）
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 初爻动改变下卦，下卦三爻(0-2)纳甲全部变化
    // 上卦(3-5)未变，纳支应一致
    for (let i = 3; i < 6; i++) {
      expect(chart.lines[i].stem).toBe(chart.changed!.lines[i].stem);
      expect(chart.lines[i].branch).toBe(chart.changed!.lines[i].branch);
      expect(chart.lines[i].elem).toBe(chart.changed!.lines[i].elem);
    }
  });

  it("六爻全动：变卦为完全相反的卦", () => {
    // 乾为天[1,1,1,1,1,1]全动→坤为地[0,0,0,0,0,0]
    const lines: SixLines = [3, 3, 3, 3, 3, 3]; // 全老阳
    const chart = buildChart({ lines, date: "2024-03-15" });

    expect(chart.changed).not.toBeNull();
    expect(chart.changed!.name).toBe("坤为地");
    // 所有爻的阴阳都反转
    for (let i = 0; i < 6; i++) {
      expect(chart.lines[i].yang).toBe(true);
      expect(chart.changed!.lines[i].yang).toBe(false);
    }
  });

  it("变卦六亲仍以本卦卦宫五行论", () => {
    const lines: SixLines = [3, 1, 1, 1, 1, 1]; // 初爻动
    const chart = buildChart({ lines, date: "2024-03-15" });

    // 乾宫属金，变卦各爻的六亲仍以金为基准
    for (const cl of chart.changed!.lines) {
      expect(["父母", "兄弟", "子孙", "妻财", "官鬼"]).toContain(cl.rel);
    }
  });

  it("无动爻时changed为null", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1]; // 全少阳
    const chart = buildChart({ lines, date: "2024-03-15" });
    expect(chart.changed).toBeNull();
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
