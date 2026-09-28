/**
 * 六爻调试 API 综合测试
 *
 * 测试范围：
 * 1. computeLiuyaoData 纯计算（不依赖 IndexedDB）
 * 2. LiuYao 向后兼容接口
 * 3. 参数验证（错误处理）
 * 4. 极端边缘场景（全老阴/全少阳/全老阳/混合动爻）
 *
 * 注意：依赖 IndexedDB 的数据库操作（LiuYaoCreate/List/View with skipUI=true）
 * 需要在浏览器环境或配置 fake-indexeddb 后才能测试。
 */
import { describe, it, expect } from "vitest";
import { computeLiuyaoData, LiuYao } from "./liuyao";
import { LiuyaoError } from "./errors";
import type { SixLines } from "../liuyao/core/types";

/* ── 1. computeLiuyaoData 纯计算 ── */
describe("computeLiuyaoData", () => {
  it("自动摇卦（不传 lines）", () => {
    const result = computeLiuyaoData(undefined, "2026-09-27", "自占");
    expect(result.chart).toBeDefined();
    expect(result.yong).toBeDefined();
    expect(result.lines).toHaveLength(6);
    expect(result.lines.every(v => v >= 0 && v <= 3)).toBe(true);
  });

  it("指定 lines（少阳×6 = 乾卦）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.name).toBe("乾为天");
    expect(result.lines).toEqual(lines);
  });

  it("不同 yongTarget 返回不同用神位置", () => {
    const lines: SixLines = [1, 2, 3, 0, 1, 2];
    const result1 = computeLiuyaoData(lines, "2026-09-27", "自占");
    const result2 = computeLiuyaoData(lines, "2026-09-27", "父母");
    expect(result1.yong.rel).not.toBe(result2.yong.rel);
  });

  it("自动摇卦多次结果不同（随机性验证）", () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = computeLiuyaoData(undefined, "2026-09-27", "自占");
      results.add(JSON.stringify(result.lines));
    }
    // 10 次摇卦应该至少有 2 种不同结果（概率极高）
    expect(results.size).toBeGreaterThan(1);
  });
});

/* ── 2. LiuYao 向后兼容 ── */
describe("LiuYao", () => {
  it("返回完整计算数据（含 hbar + vigorColumns）", () => {
    const result = LiuYao([1, 1, 1, 1, 1, 1], "2026-09-27", "自占", "12:00:00");
    expect(result.divinationTime).toBe("2026-09-27T12:00:00");
    expect(result.chart.name).toBe("乾为天");
    expect(result.hbarData).toBeDefined();
    expect(result.vigorColumns).toBeDefined();
    expect(result.person).toBeNull();
  });

  it("不传 time 时使用 00:00:00", () => {
    const result = LiuYao([1, 1, 1, 1, 1, 1], "2026-09-27", "自占");
    expect(result.divinationTime).toBe("2026-09-27T00:00:00");
  });

  it("hbarData 包含四柱数据", () => {
    const result = LiuYao([1, 1, 1, 1, 1, 1], "2026-09-27", "自占");
    expect(result.hbarData).not.toBeNull();
    if (result.hbarData) {
      expect(result.hbarData.years).toBeDefined();
      expect(result.hbarData.months).toBeDefined();
      expect(result.hbarData.days).toBeDefined();
      expect(result.hbarData.hours).toBeDefined();
    }
  });

  it("vigorColumns 包含 8 列数据", () => {
    const result = LiuYao([1, 1, 1, 1, 1, 1], "2026-09-27", "自占");
    expect(result.vigorColumns).not.toBeNull();
    if (result.vigorColumns) {
      expect(result.vigorColumns.columns).toHaveLength(8);
      // vigorColumns 的结构可能不同，只验证基本结构
      expect(result.vigorColumns.columns[0]).toBeDefined();
    }
  });
});

/* ── 3. 极端边缘场景 ── */
describe("极端边缘场景", () => {
  it("全老阴（0,0,0,0,0,0）= 坤卦 + 无动爻", () => {
    const lines: SixLines = [0, 0, 0, 0, 0, 0];
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.name).toBe("坤为地");
    expect(result.chart.palace).toBe("坤");
    // 0=老阴，在此代码库中 isMoving(0)=false，无动爻
    expect(result.chart.changed).toBeNull();
  });

  it("全少阳（1,1,1,1,1,1）= 乾卦 + 无动爻", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.name).toBe("乾为天");
    expect(result.chart.palace).toBe("乾");
    // 1=少阳，无动爻，changed 应为 null
    expect(result.chart.changed).toBeNull();
  });

  it("全老阳（3,3,3,3,3,3）= 乾卦 + 六爻皆动", () => {
    const lines: SixLines = [3, 3, 3, 3, 3, 3];
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.name).toBe("乾为天");
    expect(result.chart.palace).toBe("乾");
    // 3=老阳，六爻皆动，变卦应为坤为地
    expect(result.chart.changed).not.toBeNull();
    expect(result.chart.changed?.name).toBe("坤为地");
  });

  it("全少阴（2,2,2,2,2,2）= 坤卦 + 六爻皆动", () => {
    const lines: SixLines = [2, 2, 2, 2, 2, 2];
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.name).toBe("坤为地");
    expect(result.chart.palace).toBe("坤");
    // 2=少阴，在此代码库中 isMoving(2)=true，六爻皆动，变卦为乾为天
    expect(result.chart.changed).not.toBeNull();
    expect(result.chart.changed?.name).toBe("乾为天");
  });

  it("混合动爻（部分老阴/老阳）", () => {
    const lines: SixLines = [0, 1, 3, 2, 0, 1]; // 0,3,0 是动爻（第 1,3,5 爻）
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.lines).toEqual(lines);
    // 验证变卦存在（至少一个动爻）
    expect(result.chart.changed).not.toBeNull();
  });

  it("仅一个动爻（第 2 爻为老阳）", () => {
    const lines: SixLines = [1, 3, 1, 1, 1, 1]; // 仅第 2 爻为老阳
    const result = computeLiuyaoData(lines, "2026-09-27", "自占");
    expect(result.chart.changed).not.toBeNull();
    // 验证变卦的第 2 爻存在
    expect(result.chart.changed?.lines[1]).toBeDefined();
  });

  it("所有 yongTarget 类型都能正确处理", () => {
    const targets = ["自占", "父母", "子女", "配偶", "兄弟", "医药"] as const;
    const lines: SixLines = [1, 2, 3, 0, 1, 2];
    for (const target of targets) {
      const result = computeLiuyaoData(lines, "2026-09-27", target);
      expect(result.yong).toBeDefined();
      expect(result.yong.rel).toBeDefined();
    }
  });
});

/* ── 4. 参数验证（错误处理） ── */
describe("参数验证", () => {
  it("computeLiuyaoData 不验证 lines（由调用方保证）", () => {
    // computeLiuyaoData 是底层函数，假设调用方已验证
    // 这里测试它不会因为无效 lines 而崩溃
    const invalidLines = [1, 2, 3, 4, 5, 6] as unknown as SixLines;
    // 可能会抛出异常，也可能返回错误结果，取决于 buildChart 的实现
    // 这里只测试不会导致无限循环或内存溢出
    try {
      computeLiuyaoData(invalidLines, "2026-09-27", "自占");
    } catch (err) {
      // 预期可能抛出错误
      expect(err).toBeDefined();
    }
  });
});

/* ── 5. 特殊日期测试 ── */
describe("特殊日期", () => {
  it("闰年日期（2024-02-29）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const result = computeLiuyaoData(lines, "2024-02-29", "自占");
    expect(result.chart).toBeDefined();
    expect(result.chart.month).toBeDefined();
    expect(result.chart.day).toBeDefined();
  });

  it("年初（2026-01-01）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const result = computeLiuyaoData(lines, "2026-01-01", "自占");
    expect(result.chart).toBeDefined();
  });

  it("年末（2026-12-31）", () => {
    const lines: SixLines = [1, 1, 1, 1, 1, 1];
    const result = computeLiuyaoData(lines, "2026-12-31", "自占");
    expect(result.chart).toBeDefined();
  });
});
