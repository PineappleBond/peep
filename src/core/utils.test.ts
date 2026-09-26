/** 干支/五虎遁/五鼠遁/时辰/真太阳时 边界测试 */
import { describe, expect, it } from "vitest";
import {
  abbrPalace,
  applyTrueSolar,
  bodyPalaceBranchOf,
  branchRelation,
  equationOfTime,
  fixIndex,
  hourGanZhi,
  isYangStem,
  mod,
  monthGanZhi,
  timeIndexFromClock,
  yearGanZhi,
  yearStemIndex,
} from "./utils";

describe("干支推算", () => {
  it("年干支：1984 甲子起元", () => {
    expect(yearGanZhi(1984)).toBe("甲子");
    expect(yearGanZhi(2024)).toBe("甲辰");
    expect(yearGanZhi(2025)).toBe("乙巳");
    expect(yearGanZhi(2026)).toBe("丙午");
    expect(yearGanZhi(1900)).toBe("庚子");
  });

  it("五虎遁月干支（正月建寅）", () => {
    expect(monthGanZhi(2024, 1)).toBe("丙寅"); // 甲己丙作首
    expect(monthGanZhi(2025, 1)).toBe("戊寅"); // 乙庚戊为头
    expect(monthGanZhi(2026, 1)).toBe("庚寅"); // 丙辛庚上起
    expect(monthGanZhi(2024, 12)).toBe("丁丑");
    expect(monthGanZhi(2025, 11)).toBe("戊子");
  });

  it("五鼠遁时干支", () => {
    expect(hourGanZhi("甲", 0)).toBe("甲子"); // 甲己还加甲
    expect(hourGanZhi("乙", 0)).toBe("丙子"); // 乙庚丙作初
    expect(hourGanZhi("癸", 0)).toBe("壬子"); // 戊癸壬子是真途
    expect(hourGanZhi("甲", 11)).toBe("乙亥");
  });

  it("阳干判断", () => {
    expect(isYangStem("甲")).toBe(true);
    expect(isYangStem("乙")).toBe(false);
    expect(isYangStem("壬")).toBe(true);
  });
});

describe("时辰与真太阳时", () => {
  it("钟表小时 → timeIndex（23 点为晚子时 12）", () => {
    expect(timeIndexFromClock(0)).toBe(0); // 早子
    expect(timeIndexFromClock(1)).toBe(1); // 丑
    expect(timeIndexFromClock(6)).toBe(3); // 卯
    expect(timeIndexFromClock(12)).toBe(6); // 午
    expect(timeIndexFromClock(22)).toBe(11); // 亥
    expect(timeIndexFromClock(23)).toBe(12); // 晚子
  });

  it("均时差在 ±17 分钟内", () => {
    for (let d = 1; d <= 365; d += 7) {
      expect(Math.abs(equationOfTime(d))).toBeLessThan(17);
    }
  });

  it("真太阳时校正：东经 120 度只剩均时差；西部经度大幅回拨", () => {
    const r120 = applyTrueSolar("2000-6-15", "12:00", 120)!;
    expect(Math.abs(r120.offsetMinutes - r120.eotMinutes)).toBeLessThan(1e-9);
    const r90 = applyTrueSolar("2000-6-15", "12:00", 90)!; // 经度差 -120 分钟
    expect(r90.offsetMinutes).toBeLessThan(-100);
    expect(r90.timeIndex).toBe(5); // 约 10:00 → 巳时
  });

  it("真太阳时跨日回拨：凌晨出生向西校正跌回前一日", () => {
    const r = applyTrueSolar("2000-6-15", "00:30", 90)!;
    expect(r.dateStr).toBe("2000-6-14");
    expect(r.timeIndex).toBe(11); // 约 22:30 → 亥时
  });

  it("非法输入返回 null", () => {
    expect(applyTrueSolar("bad", "12:00", 120)).toBeNull();
    expect(applyTrueSolar("2000-6-15", "xx", 120)).toBeNull();
  });
});

describe("中州派地/人盘身宫", () => {
  it("bodyPalaceBranchOf：重排后从宫列表取真身宫支（iztro 顶层字段滞留天盘旧值）", async () => {
    const { astro } = await import("iztro");
    const cast = (astroType: "heaven" | "earth" | "human") =>
      astro.withOptions({
        type: "solar",
        dateStr: "1990-06-15",
        timeIndex: 4,
        gender: "男" as never,
        isLeapMonth: false,
        fixLeap: true,
        language: "zh-CN",
        astroType,
        config: { algorithm: "zhongzhou", yearDivide: "exact", horoscopeDivide: "exact" },
      });
    const heaven = cast("heaven");
    // 天盘：顶层字段与宫列表一致，helper 透传
    expect(bodyPalaceBranchOf(heaven.palaces, heaven.earthlyBranchOfBodyPalace)).toBe(
      heaven.earthlyBranchOfBodyPalace
    );
    for (const t of ["earth", "human"] as const) {
      const a = cast(t);
      const real = a.palaces.find(p => p.isBodyPalace)!.earthlyBranch;
      expect(bodyPalaceBranchOf(a.palaces, a.earthlyBranchOfBodyPalace)).toBe(real);
      // 上游 rearrangeAstrolable 目前不更新顶层身宫支；iztro 修复后此断言变红，即可评估移除本兜底
      expect(a.earthlyBranchOfBodyPalace).not.toBe(real);
    }
  });
});

describe("mod 与 fixIndex", () => {
  it("mod 始终返回非负余数", () => {
    expect(mod(-1, 12)).toBe(11);
    expect(mod(0, 12)).toBe(0);
    expect(mod(11, 12)).toBe(11);
    expect(mod(12, 12)).toBe(0);
    expect(mod(13, 12)).toBe(1);
    expect(mod(-13, 12)).toBe(11);
  });

  it("fixIndex 将任意整数映射到 0-11", () => {
    expect(fixIndex(0)).toBe(0);
    expect(fixIndex(11)).toBe(11);
    expect(fixIndex(12)).toBe(0);
    expect(fixIndex(-1)).toBe(11);
    expect(fixIndex(100)).toBe(4); // 100 % 12 = 4
    expect(fixIndex(-13)).toBe(11);
  });
});

describe("yearStemIndex 年干索引", () => {
  it("1984 甲子年 → 0（甲）", () => {
    expect(yearStemIndex(1984)).toBe(0);
  });

  it("2024 甲辰年 → 0（甲）", () => {
    expect(yearStemIndex(2024)).toBe(0);
  });

  it("2025 乙巳年 → 1（乙）", () => {
    expect(yearStemIndex(2025)).toBe(1);
  });

  it("1900 庚子年 → 6（庚）", () => {
    expect(yearStemIndex(1900)).toBe(6);
  });
});

describe("abbrPalace 宫位简称", () => {
  it("命宫 → 命", () => {
    expect(abbrPalace("命宫")).toBe("命");
  });

  it("undefined 或空字符串返回空", () => {
    expect(abbrPalace(undefined)).toBe("");
    expect(abbrPalace("")).toBe("");
  });

  it("不在映射表中的宫位取首字", () => {
    expect(abbrPalace("自定义")).toBe("自");
  });
});

describe("branchRelation 地支关系", () => {
  it("六合：子丑合", () => {
    expect(branchRelation("子", "丑")).toBe("六合");
  });

  it("对冲：子午冲", () => {
    expect(branchRelation("子", "午")).toBe("对冲");
  });

  it("三合：申子辰", () => {
    expect(branchRelation("申", "子")).toBe("三合");
    expect(branchRelation("子", "辰")).toBe("三合");
  });

  it("相害：子未害", () => {
    expect(branchRelation("子", "未")).toBe("相害");
  });

  it("自刑：辰辰", () => {
    expect(branchRelation("辰", "辰")).toBe("自刑");
  });

  it("同支（非自刑）：子子", () => {
    // 子不是自刑支，所以同支为"同支"
    expect(branchRelation("子", "子")).toBe("同支");
  });

  it("无关系", () => {
    expect(branchRelation("子", "寅")).toBe("无");
  });
});
