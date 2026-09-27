/**
 * 状态调试工具测试：
 * 验证 registerStateInspector / getAllStateSnapshots 在 DEV 环境下的注册与快照功能
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerStateInspector, getAllStateSnapshots } from "../core/stateDebug";

describe("stateDebug", () => {
  beforeEach(() => {
    // 模拟 DEV 环境
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registerStateInspector 注册检查器并返回清理函数", () => {
    const cleanup = registerStateInspector("test.counter", () => ({
      name: "counter",
      value: 42,
      source: "test",
    }));

    const snapshots = getAllStateSnapshots();
    const found = snapshots.find(s => s.name === "counter");
    expect(found).toBeDefined();
    expect(found?.value).toBe(42);
    expect(found?.source).toBe("test");

    cleanup();
    const after = getAllStateSnapshots();
    expect(after.find(s => s.name === "counter")).toBeUndefined();
  });

  it("getAllStateSnapshots 返回所有已注册检查器的快照", () => {
    const cleanup1 = registerStateInspector("test.a", () => ({
      name: "a",
      value: "hello",
      source: "test",
    }));
    const cleanup2 = registerStateInspector("test.b", () => ({
      name: "b",
      value: { x: 1 },
      source: "test",
    }));

    const snapshots = getAllStateSnapshots();
    expect(snapshots.length).toBeGreaterThanOrEqual(2);

    cleanup1();
    cleanup2();
  });
});
