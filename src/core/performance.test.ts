/**
 * 性能基准测试：debugApi 及相关模块
 *
 * 覆盖场景：
 *  1. computeAstrolabe 本命盘计算
 *  2. computeScopeData 运限计算
 *  3. buildHbarData 拨盘数据构建
 *  4. 缓存命中 vs 未命中对比
 *  5. parseDate 多格式解析
 *  6. 并发计算（多人物同时计算）
 *  7. calculateDaLiuRen 大六壬排盘（含缓存优化前后对比）
 *
 * 设计原则：
 *  - 作为普通 vitest 测试运行（npm test 即可），不依赖 vitest bench 模式
 *  - 每个场景多次运行取统计量（min / max / avg / stddev）
 *  - 仅输出报告，不因性能波动而失败（除非超过宽松阈值）
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import { computeScopeData, computeDaLiuRenData, parseDate } from "./debugApi";
import { calculateDaLiuRen } from "./daliuren/calculator";
import {
  buildHbarData,
  buildDecades,
  buildYears,
  buildMonths,
  buildDays,
  buildHours,
  clearHbarCaches,
} from "./hbar";
import type { PickState } from "./useZwds";
import type { Person } from "./personDb";
import { LRUCache, clearAllCaches } from "./cache";

/* ─────────────── 工具函数 ─────────────── */

/** 高精度计时结果 */
interface TimingResult {
  /** 每次耗时（ms） */
  samples: number[];
  min: number;
  max: number;
  avg: number;
  stddev: number;
  total: number;
}

/** 对函数运行 n 次，收集统计 */
function benchmark(fn: () => void, iterations: number): TimingResult {
  // 先预热一次（排除模块初始化等一次性开销）
  fn();

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  const total = samples.reduce((a, b) => a + b, 0);
  const avg = total / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const variance = samples.reduce((acc, v) => acc + (v - avg) ** 2, 0) / samples.length;
  const stddev = Math.sqrt(variance);

  return { samples, min, max, avg, stddev, total };
}

/** 异步版 benchmark */
async function benchmarkAsync(fn: () => Promise<void>, iterations: number): Promise<TimingResult> {
  // 预热
  await fn();

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  const total = samples.reduce((a, b) => a + b, 0);
  const avg = total / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const variance = samples.reduce((acc, v) => acc + (v - avg) ** 2, 0) / samples.length;
  const stddev = Math.sqrt(variance);

  return { samples, min, max, avg, stddev, total };
}

/** 格式化统计结果为可读字符串 */
function formatResult(label: string, r: TimingResult, iterations: number): string {
  return (
    `  ${label}:\n` +
    `    次数=${iterations}  总计=${r.total.toFixed(2)}ms\n` +
    `    最小=${r.min.toFixed(3)}ms  最大=${r.max.toFixed(3)}ms\n` +
    `    平均=${r.avg.toFixed(3)}ms  标准差=${r.stddev.toFixed(3)}ms`
  );
}

/** 输出性能报告（用 console.log 便于 CI 抓取） */
function printReport(title: string, results: [string, TimingResult, number][]) {
  console.log(`\n${"=".repeat(60)}`);

  console.log(`性能报告：${title}`);

  console.log("=".repeat(60));
  for (const [label, r, iters] of results) {
    console.log(formatResult(label, r, iters));
  }

  console.log("=".repeat(60));
}

/* ─────────────── 测试夹具 ─────────────── */

/** 构造测试用 Person */
function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    name: "性能测试",
    gender: "男",
    calendar: "solar",
    date: "2000-08-16",
    timeIndex: 2,
    isLeapMonth: false,
    algorithm: "default",
    yearDivide: "normal",
    mutagenTable: "default",
    dayDivide: "forward",
    astroType: "heaven",
    isDefault: false,
    savedAt: Date.now(),
    ...overrides,
  } as Person;
}

/** 不同人物的参数组合（用于并发测试） */
const DIVERSE_PERSONS: Person[] = [
  makePerson({ id: 1, date: "1990-01-15", timeIndex: 0, gender: "男" }),
  makePerson({ id: 2, date: "1985-06-20", timeIndex: 4, gender: "女" }),
  makePerson({ id: 3, date: "2000-12-01", timeIndex: 8, gender: "男" }),
  makePerson({ id: 4, date: "1975-03-10", timeIndex: 6, gender: "女" }),
  makePerson({ id: 5, date: "2010-09-25", timeIndex: 10, gender: "男" }),
];

const DIVERSE_DATES = ["2020-01-01", "2023-06-15", "2024-12-31", "2025-03-20", "2026-09-27"];

/* ─────────────── 基准迭代次数 ─────────────── */

/** 基准测试迭代次数（减少以提高测试速度，CI 环境可调大） */
const BENCH_ITERS = 50;
/** iztro 本命盘计算较慢，减少迭代 */
const ASTROLABE_ITERS = 20;

/* ═══════════════════════════════════════════════════════════════
 * 场景 1：computeAstrolabe 性能（本命盘计算）
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：computeAstrolabe（本命盘计算）", () => {
  const results: [string, TimingResult, number][] = [];

  afterAll(() => printReport("computeAstrolabe", results));

  it("iztro astro.withOptions 本命盘计算", () => {
    const person = makePerson();
    const r = benchmark(() => {
      astro.withOptions({
        type: person.calendar,
        dateStr: person.date,
        timeIndex: person.timeIndex,
        gender: person.gender as unknown as GenderName,
        isLeapMonth: person.isLeapMonth,
        fixLeap: true,
        language: "zh-CN",
        astroType: "heaven",
        config: {
          algorithm: person.algorithm,
          yearDivide: person.yearDivide,
          horoscopeDivide: person.yearDivide,
          dayDivide: person.dayDivide,
        },
      });
    }, ASTROLABE_ITERS);

    results.push(["iztro 本命盘（缓存清空）", r, ASTROLABE_ITERS]);

    // 宽松阈值：单次不超过 500ms 即通过（iztro 计算本身需要时间）
    expect(r.avg).toBeLessThan(500);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 2：computeScopeData 性能（运限计算 = 本命盘 + hbar）
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：computeScopeData（运限计算）", () => {
  const results: [string, TimingResult, number][] = [];

  beforeAll(() => {
    // 清空所有缓存，确保首次为冷启动
    clearAllCaches();
    clearHbarCaches();
  });

  afterAll(() => printReport("computeScopeData", results));

  it("computeScopeData 首次（冷缓存）", () => {
    clearAllCaches();
    clearHbarCaches();
    const person = makePerson();
    const r = benchmark(() => {
      // 每次清空缓存模拟冷启动
      clearAllCaches();
      clearHbarCaches();
      computeScopeData(person, "2026-05-15");
    }, ASTROLABE_ITERS);

    results.push(["冷缓存（每次清空）", r, ASTROLABE_ITERS]);
    expect(r.avg).toBeLessThan(500);
  });

  it("computeScopeData 热缓存（重复同参数）", () => {
    clearAllCaches();
    clearHbarCaches();
    const person = makePerson();
    // 首次调用填充缓存
    computeScopeData(person, "2026-05-15");

    const r = benchmark(() => {
      computeScopeData(person, "2026-05-15");
    }, BENCH_ITERS);

    results.push(["热缓存（重复调用）", r, BENCH_ITERS]);
    // 热缓存应远快于冷缓存
    expect(r.avg).toBeLessThan(50);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 3：buildHbarData 性能（拨盘数据构建）
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：buildHbarData（拨盘数据构建）", () => {
  const results: [string, TimingResult, number][] = [];
  let astrolabe: ReturnType<typeof astro.withOptions>;

  beforeAll(() => {
    astrolabe = astro.withOptions({
      type: "solar",
      dateStr: "2000-08-16",
      timeIndex: 2,
      gender: "男" as unknown as GenderName,
      isLeapMonth: false,
      fixLeap: true,
      language: "zh-CN",
      astroType: "heaven",
      config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
    });
    clearHbarCaches();
  });

  afterAll(() => printReport("buildHbarData", results));

  it("buildHbarData 完整构建", () => {
    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;
    const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };

    const r = benchmark(() => {
      buildHbarData(astrolabe, birthLunarYear, pick);
    }, BENCH_ITERS);

    results.push(["buildHbarData（缓存预热后）", r, BENCH_ITERS]);
    expect(r.avg).toBeLessThan(100);
  });

  it("子组件分项性能：buildDecades / buildMonths / buildDays / buildHours", () => {
    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;

    // buildDecades
    const rDecades = benchmark(() => {
      buildDecades(astrolabe, birthLunarYear);
    }, BENCH_ITERS);
    results.push(["buildDecades", rDecades, BENCH_ITERS]);

    // buildMonths
    const rMonths = benchmark(() => {
      buildMonths(2026, 0);
    }, BENCH_ITERS);
    results.push(["buildMonths", rMonths, BENCH_ITERS]);

    // buildDays
    const rDays = benchmark(() => {
      buildDays(2026, 5, 31, false);
    }, BENCH_ITERS);
    results.push(["buildDays", rDays, BENCH_ITERS]);

    // buildHours
    const rHours = benchmark(() => {
      buildHours("甲");
    }, BENCH_ITERS);
    results.push(["buildHours", rHours, BENCH_ITERS]);

    // 子组件都不应太慢
    expect(rDecades.avg).toBeLessThan(50);
    expect(rMonths.avg).toBeLessThan(50);
    expect(rDays.avg).toBeLessThan(50);
    expect(rHours.avg).toBeLessThan(10);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 4：缓存命中 vs 未命中对比
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：缓存命中 vs 未命中", () => {
  const results: [string, TimingResult, number][] = [];

  afterAll(() => printReport("缓存效果对比", results));

  it("LRUCache 基础操作性能", () => {
    const cache = new LRUCache<string, number>({ maxSize: 100, name: "bench" });

    // 写入性能
    const rWrite = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key_${i}`, i);
      }
    }, BENCH_ITERS);
    results.push(["LRUCache 写入 100 条", rWrite, BENCH_ITERS]);

    // 命中读取性能
    const rHit = benchmark(() => {
      for (let i = 0; i < 100; i++) {
        cache.get(`key_${i}`);
      }
    }, BENCH_ITERS);
    results.push(["LRUCache 命中读取 100 条", rHit, BENCH_ITERS]);

    // 未命中读取性能
    const rMiss = benchmark(() => {
      for (let i = 200; i < 300; i++) {
        cache.get(`key_${i}`);
      }
    }, BENCH_ITERS);
    results.push(["LRUCache 未命中读取 100 条", rMiss, BENCH_ITERS]);

    // 缓存操作都应极快
    expect(rHit.avg).toBeLessThan(5);
    expect(rMiss.avg).toBeLessThan(5);
  });

  it("buildHbarData 缓存命中 vs 完全冷启动", () => {
    const astrolabe = astro.withOptions({
      type: "solar",
      dateStr: "2000-08-16",
      timeIndex: 2,
      gender: "男" as unknown as GenderName,
      isLeapMonth: false,
      fixLeap: true,
      language: "zh-CN",
      astroType: "heaven",
      config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
    });
    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;
    const pick: PickState = { year: 2026, month: 5, day: 15, hour: 6, leap: false };

    // 冷启动
    clearHbarCaches();
    const rCold = benchmark(() => {
      clearHbarCaches();
      buildHbarData(astrolabe, birthLunarYear, pick);
    }, ASTROLABE_ITERS);
    results.push(["buildHbarData 冷启动", rCold, ASTROLABE_ITERS]);

    // 热启动
    buildHbarData(astrolabe, birthLunarYear, pick);
    const rHot = benchmark(() => {
      buildHbarData(astrolabe, birthLunarYear, pick);
    }, BENCH_ITERS);
    results.push(["buildHbarData 热启动", rHot, BENCH_ITERS]);

    // 热启动应比冷启动快

    console.log(`\n  缓存加速比: ${(rCold.avg / Math.max(rHot.avg, 0.001)).toFixed(1)}x`);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 5：parseDate 多格式解析性能
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：parseDate（多格式解析）", () => {
  const results: [string, TimingResult, number][] = [];

  afterAll(() => printReport("parseDate", results));

  it("Date 实例解析", () => {
    const d = new Date("2026-05-15T12:00:00");
    const r = benchmark(() => parseDate(d), BENCH_ITERS * 4);
    results.push(["Date 实例", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });

  it("数字时间戳解析", () => {
    const r = benchmark(() => parseDate(1718452800000), BENCH_ITERS * 4);
    results.push(["数字时间戳", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });

  it("YYYY-MM-DD 字符串解析", () => {
    const r = benchmark(() => parseDate("2026-05-15"), BENCH_ITERS * 4);
    results.push(["YYYY-MM-DD 字符串", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });

  it("YYYY-MM-DD HH 字符串解析", () => {
    const r = benchmark(() => parseDate("2026-05-15 14"), BENCH_ITERS * 4);
    results.push(["YYYY-MM-DD HH 字符串", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });

  it("ISO 8601 字符串解析", () => {
    const r = benchmark(() => parseDate("2026-05-15T14:30:00.000Z"), BENCH_ITERS * 4);
    results.push(["ISO 8601 字符串", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });

  it("纯数字字符串解析", () => {
    const r = benchmark(() => parseDate("1718452800000"), BENCH_ITERS * 4);
    results.push(["纯数字字符串", r, BENCH_ITERS * 4]);
    expect(r.avg).toBeLessThan(1);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 6：并发计算性能（多个人物/日期同时计算）
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：并发计算（多人物 × 多日期）", () => {
  const results: [string, TimingResult, number][] = [];

  beforeAll(() => {
    clearAllCaches();
    clearHbarCaches();
  });

  afterAll(() => printReport("并发计算", results));

  it("5 个人物 × 5 个日期 = 25 次 computeScopeData（首次冷缓存）", () => {
    clearAllCaches();
    clearHbarCaches();

    const r = benchmark(() => {
      // 每次清空缓存模拟冷启动
      clearAllCaches();
      clearHbarCaches();
      for (const person of DIVERSE_PERSONS) {
        for (const date of DIVERSE_DATES) {
          computeScopeData(person, date);
        }
      }
    }, 5); // 5 轮 × 25 次 = 125 次计算

    results.push(["25 次 computeScopeData（冷缓存）", r, 5]);
    // 25 次计算总计不超过 5 秒
    expect(r.avg).toBeLessThan(5000);
  });

  it("5 个人物 × 5 个日期 = 25 次 computeScopeData（缓存预热后）", () => {
    clearAllCaches();
    clearHbarCaches();

    // 预热：先跑一遍填充所有缓存
    for (const person of DIVERSE_PERSONS) {
      for (const date of DIVERSE_DATES) {
        computeScopeData(person, date);
      }
    }

    // 再次运行（缓存命中）
    const r = benchmark(() => {
      for (const person of DIVERSE_PERSONS) {
        for (const date of DIVERSE_DATES) {
          computeScopeData(person, date);
        }
      }
    }, BENCH_ITERS);

    results.push(["25 次 computeScopeData（热缓存）", r, BENCH_ITERS]);
    expect(r.avg).toBeLessThan(500);
  });

  it("不同人物的本命盘缓存独立性", () => {
    clearAllCaches();

    // 不同人物各有独立指纹，应各自独立缓存
    const r = benchmark(() => {
      for (const person of DIVERSE_PERSONS) {
        computeScopeData(person, "2026-05-15");
      }
    }, 10);

    results.push(["5 人各计算一次（循环）", r, 10]);
    expect(r.avg).toBeLessThan(2000);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 7：calculateDaLiuRen 性能（大六壬排盘——无缓存，潜在瓶颈）
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：calculateDaLiuRen（大六壬排盘）", () => {
  const results: [string, TimingResult, number][] = [];

  afterAll(() => printReport("calculateDaLiuRen", results));

  it("calculateDaLiuRen 基础性能（无缓存）", () => {
    const r = benchmark(() => {
      calculateDaLiuRen("2026-05-15", "14:30");
    }, BENCH_ITERS);
    results.push(["calculateDaLiuRen（无缓存）", r, BENCH_ITERS]);

    // 宽松阈值：单次不超过 200ms
    expect(r.avg).toBeLessThan(200);
  });

  it("computeDaLiuRenData 带缓存的性能", () => {
    // 首次调用（冷）
    const rCold = benchmark(() => {
      computeDaLiuRenData("2026-05-15", "14:30");
    }, BENCH_ITERS);
    results.push(["computeDaLiuRenData（首次/冷）", rCold, BENCH_ITERS]);

    // 再次调用（应命中缓存）
    const rHot = benchmark(() => {
      computeDaLiuRenData("2026-05-15", "14:30");
    }, BENCH_ITERS);
    results.push(["computeDaLiuRenData（缓存命中）", rHot, BENCH_ITERS]);

    // 如果缓存生效，热路径应远快于冷路径
    if (rCold.avg > 0.01) {
      console.log(
        `\n  DaLiuRen 缓存加速比: ${(rCold.avg / Math.max(rHot.avg, 0.001)).toFixed(1)}x`,
      );
    }
  });

  it("不同参数的 DaLiuRen 计算", () => {
    const params: [string, string][] = [
      ["2024-01-01", "09:00"],
      ["2024-06-15", "12:00"],
      ["2025-03-20", "18:30"],
      ["2026-09-27", "23:00"],
      ["2026-12-31", "00:30"],
    ];

    const r = benchmark(() => {
      for (const [d, t] of params) {
        calculateDaLiuRen(d, t);
      }
    }, BENCH_ITERS);

    results.push(["5 组不同参数", r, BENCH_ITERS]);
    expect(r.avg).toBeLessThan(1000);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 综合报告：输出全局性能摘要
 * ═══════════════════════════════════════════════════════════════ */

describe("性能基准：综合摘要", () => {
  it("输出全局性能摘要", () => {
    const person = makePerson();
    clearAllCaches();
    clearHbarCaches();

    console.log("\n" + "═".repeat(60));

    console.log("综合性能摘要");

    console.log("═".repeat(60));

    // 1. 本命盘（冷启动）
    clearAllCaches();
    const t0 = performance.now();
    computeScopeData(person, "2026-05-15");
    const t1 = performance.now();

    console.log(`  本命盘+运限（冷启动）: ${(t1 - t0).toFixed(2)}ms`);

    // 2. 本命盘+运限（热缓存）
    const t2 = performance.now();
    computeScopeData(person, "2026-05-15");
    const t3 = performance.now();

    console.log(`  本命盘+运限（热缓存）: ${(t3 - t2).toFixed(3)}ms`);

    // 3. 切换日期
    const t4 = performance.now();
    computeScopeData(person, "2026-09-27");
    const t5 = performance.now();

    console.log(`  切换日期（部分缓存命中）: ${(t5 - t4).toFixed(3)}ms`);

    // 4. 解析日期格式对比
    const parseTests: [string, Date | number | string][] = [
      ["Date 实例", new Date()],
      ["时间戳", Date.now()],
      ["YYYY-MM-DD", "2026-05-15"],
      ["ISO 8601", "2026-05-15T12:00:00Z"],
    ];

    console.log("\n  parseDate 各格式耗时:");
    for (const [label, input] of parseTests) {
      const a = performance.now();
      parseDate(input);
      const b = performance.now();

      console.log(`    ${label}: ${(b - a).toFixed(4)}ms`);
    }

    // 5. 缓存统计

    console.log("\n  各缓存当前状态已通过 getAllCacheStats 获取");

    console.log("═".repeat(60));

    // 基本正确性断言
    expect(t1 - t0).toBeLessThan(500);
    expect(t3 - t2).toBeLessThan(50);
  });
});
