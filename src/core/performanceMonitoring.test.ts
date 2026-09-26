/**
 * 性能监控模块单元测试
 *
 * 覆盖：
 *  1. 领域指标记录与查询（recordDomainMetric / getDomainMetrics / getDomainMetricSummary）
 *  2. 便捷测量函数（measureSync / measureAsync）
 *  3. 性能预算检查
 *  4. Web Vitals 评级（rateVitals 含 INP）
 *  5. webVitals 模块（getWebVitalsReport / formatVitalValue）
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordDomainMetric,
  getDomainMetrics,
  getDomainMetricSummary,
  clearDomainMetrics,
  measureSync,
  measureAsync,
  rateVitals,
  checkPerformanceBudgets,
  setPerformanceBudgets,
  type WebVitals,
} from "./performance";
import { getWebVitalsReport, formatVitalValue, isVitalGood } from "./webVitals";

/* ─────────────── 测试夹具 ─────────────── */

beforeEach(() => {
  clearDomainMetrics();
  // 重置性能预算为默认
  setPerformanceBudgets([]);
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 1：领域指标记录与查询
 * ═══════════════════════════════════════════════════════════════ */

describe("领域指标：记录与查询", () => {
  it("recordDomainMetric 记录后可通过 getDomainMetrics 查询", () => {
    recordDomainMetric("test.metric", 10.5);
    recordDomainMetric("test.metric", 20.3);
    recordDomainMetric("other.metric", 5.0);

    const all = getDomainMetrics();
    expect(all.length).toBe(3);

    const filtered = getDomainMetrics("test.metric");
    expect(filtered.length).toBe(2);
    expect(filtered[0].duration).toBe(10.5);
    expect(filtered[1].duration).toBe(20.3);
  });

  it("领域指标包含时间戳和标签", () => {
    const before = Date.now();
    recordDomainMetric("test.metric", 10, { tags: ["cold-cache"] });
    const after = Date.now();

    const metrics = getDomainMetrics("test.metric");
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe("test.metric");
    expect(metrics[0].duration).toBe(10);
    expect(metrics[0].tags).toContain("cold-cache");
    expect(metrics[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(metrics[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("领域指标包含可选上下文", () => {
    recordDomainMetric("test.metric", 10, {
      context: { personId: 1, name: "测试" },
    });

    const metrics = getDomainMetrics("test.metric");
    expect(metrics[0].context).toEqual({ personId: 1, name: "测试" });
  });

  it("环形缓冲：超过 500 条时淘汰最早记录", () => {
    for (let i = 0; i < 600; i++) {
      recordDomainMetric("test.metric", i);
    }

    const all = getDomainMetrics("test.metric", 1000);
    expect(all.length).toBeLessThanOrEqual(500);
    // 最早的 100 条应被淘汰，当前第一条应 >= 100
    expect(all[0].duration).toBeGreaterThanOrEqual(100);
  });

  it("limit 参数限制返回条数", () => {
    for (let i = 0; i < 10; i++) {
      recordDomainMetric("test.metric", i);
    }

    const limited = getDomainMetrics("test.metric", 3);
    expect(limited.length).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 2：领域指标统计摘要
 * ═══════════════════════════════════════════════════════════════ */

describe("领域指标：统计摘要", () => {
  it("getDomainMetricSummary 按名称分组统计", () => {
    recordDomainMetric("computeScopeData", 10);
    recordDomainMetric("computeScopeData", 20);
    recordDomainMetric("computeScopeData", 30);
    recordDomainMetric("buildHbarData", 5);
    recordDomainMetric("buildHbarData", 15);

    const summary = getDomainMetricSummary();

    expect(Object.keys(summary)).toEqual(["computeScopeData", "buildHbarData"]);

    // computeScopeData: count=3, avg=20, min=10, max=30
    expect(summary.computeScopeData.count).toBe(3);
    expect(summary.computeScopeData.avg).toBe(20);
    expect(summary.computeScopeData.min).toBe(10);
    expect(summary.computeScopeData.max).toBe(30);

    // buildHbarData: count=2, avg=10, min=5, max=15
    expect(summary.buildHbarData.count).toBe(2);
    expect(summary.buildHbarData.avg).toBe(10);
    expect(summary.buildHbarData.min).toBe(5);
    expect(summary.buildHbarData.max).toBe(15);
  });

  it("P95 计算正确", () => {
    // 记录 20 条指标，值从 1 到 20
    for (let i = 1; i <= 20; i++) {
      recordDomainMetric("test.p95", i);
    }

    const summary = getDomainMetricSummary();
    // P95 索引 = min(19, floor(20 * 0.95)) = min(19, 19) = 19
    // 排序后 values[19] = 20（0-indexed，第 20 个值）
    expect(summary["test.p95"].p95).toBe(20);
  });

  it("空摘要时返回空对象", () => {
    const summary = getDomainMetricSummary();
    expect(Object.keys(summary).length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 3：便捷测量函数
 * ═══════════════════════════════════════════════════════════════ */

describe("便捷测量：measureSync / measureAsync", () => {
  it("measureSync 测量同步函数并记录指标", () => {
    const result = measureSync("sync.test", () => {
      // 模拟一些计算
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });

    expect(result).toBe(499500);

    const metrics = getDomainMetrics("sync.test");
    expect(metrics.length).toBe(1);
    expect(metrics[0].tags).toContain("success");
    expect(metrics[0].duration).toBeGreaterThanOrEqual(0);
  });

  it("measureSync 异常时记录错误标签", () => {
    expect(() =>
      measureSync("sync.error", () => {
        throw new Error("测试错误");
      }),
    ).toThrow("测试错误");

    const metrics = getDomainMetrics("sync.error");
    expect(metrics.length).toBe(1);
    expect(metrics[0].tags).toContain("error");
  });

  it("measureAsync 测量异步函数并记录指标", async () => {
    const result = await measureAsync("async.test", async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 42;
    });

    expect(result).toBe(42);

    const metrics = getDomainMetrics("async.test");
    expect(metrics.length).toBe(1);
    expect(metrics[0].tags).toContain("success");
    expect(metrics[0].duration).toBeGreaterThanOrEqual(5); // 至少等 10ms
  });

  it("measureAsync 异常时记录错误标签", async () => {
    await expect(
      measureAsync("async.error", async () => {
        throw new Error("异步错误");
      }),
    ).rejects.toThrow("异步错误");

    const metrics = getDomainMetrics("async.error");
    expect(metrics.length).toBe(1);
    expect(metrics[0].tags).toContain("error");
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 4：性能预算检查
 * ═══════════════════════════════════════════════════════════════ */

describe("性能预算检查", () => {
  it("checkPerformanceBudgets 无超标时返回空数组", () => {
    const violations = checkPerformanceBudgets();
    // 默认预算检查 vitals（当前为空，所以无超标）
    expect(violations.length).toBe(0);
  });

  it("领域指标预算超标时返回违规", () => {
    setPerformanceBudgets([
      { name: "排盘超时", metric: "domain", domainName: "slowOp", threshold: 50 },
    ]);

    recordDomainMetric("slowOp", 100);

    const violations = checkPerformanceBudgets();
    expect(violations.length).toBe(1);
    expect(violations[0].budget.name).toBe("排盘超时");
    expect(violations[0].actual).toBe(100);
    expect(violations[0].overage).toBe(50);
  });

  it("领域指标预算未超标时无违规", () => {
    setPerformanceBudgets([
      { name: "排盘超时", metric: "domain", domainName: "fastOp", threshold: 100 },
    ]);

    recordDomainMetric("fastOp", 30);

    const violations = checkPerformanceBudgets();
    expect(violations.length).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 5：Web Vitals 评级（含 INP）
 * ═══════════════════════════════════════════════════════════════ */

describe("Web Vitals 评级", () => {
  it("rateVitals 包含 INP 评级", () => {
    const vitals: WebVitals = { inp: 150 };
    const rating = rateVitals(vitals);
    expect(rating.inp).toBe("good"); // 150ms <= 200ms 阈值
  });

  it("INP 需改进评级", () => {
    const vitals: WebVitals = { inp: 350 };
    const rating = rateVitals(vitals);
    expect(rating.inp).toBe("needs-improvement"); // 200 < 350 <= 500
  });

  it("INP 差评级", () => {
    const vitals: WebVitals = { inp: 600 };
    const rating = rateVitals(vitals);
    expect(rating.inp).toBe("poor"); // 600 > 500
  });

  it("INP 未采集时评级为 unknown", () => {
    const vitals: WebVitals = {};
    const rating = rateVitals(vitals);
    expect(rating.inp).toBe("unknown");
  });

  it("完整评级包含所有指标", () => {
    const vitals: WebVitals = {
      lcp: 2000,
      fid: 80,
      inp: 150,
      cls: 0.05,
      fcp: 1500,
      ttfb: 600,
    };
    const rating = rateVitals(vitals);

    expect(rating.lcp).toBe("good");
    expect(rating.fid).toBe("good");
    expect(rating.inp).toBe("good");
    expect(rating.cls).toBe("good");
    expect(rating.fcp).toBe("good");
    expect(rating.ttfb).toBe("good");
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 场景 6：webVitals 模块
 * ═══════════════════════════════════════════════════════════════ */

describe("webVitals 模块", () => {
  it("getWebVitalsReport 返回完整报告结构", () => {
    const report = getWebVitalsReport();

    expect(report.vitals).toBeDefined();
    expect(report.overallRating).toBeDefined();
    expect(report.timestamp).toBeGreaterThan(0);
    expect(Array.isArray(report.suggestions)).toBe(true);
    // 应包含 6 个核心指标（LCP/FID/INP/CLS/FCP/TTFB）
    expect(report.vitals.length).toBe(6);
  });

  it("formatVitalValue 格式化毫秒值", () => {
    expect(formatVitalValue("LCP", 2500.5)).toBe("2500.5 ms");
    expect(formatVitalValue("FCP", undefined)).toBe("-");
  });

  it("formatVitalValue CLS 不带单位", () => {
    expect(formatVitalValue("CLS", 0.123)).toBe("0.123");
  });

  it("isVitalGood 指标未采集时返回 false", () => {
    // 无数据时所有指标均非 good
    expect(isVitalGood("LCP")).toBe(false);
    expect(isVitalGood("非指标")).toBe(false);
  });
});
