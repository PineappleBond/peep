/**
 * debugApi/helpers 边缘场景测试
 *
 * 覆盖 pollUntil、isDialogOpen、waitForRecordSaved/waitForDocSaved、
 * nextFrame、resetUiState 等辅助函数的正常与边缘场景。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock callbacks 模块
vi.mock("./callbacks", () => ({
  getGetZwds: () => null,
  getGetPerson: () => null,
  getSelectPerson: () => null,
  getNavigate: () => null,
  getCallbacksReady: () => ({ ziwei: false, daliuren: false, liuyao: false, wiki: false }),
  getOpenCreateDialog: () => null,
  getOpenLiuyaoCreateDialog: () => null,
  getOpenWikiEditor: () => null,
}));

// Mock logger（nextFrame 已移至 logger.ts，需包含在 mock 中）
vi.mock("./logger", () => ({
  log: vi.fn(),
  timer: () => () => {},
  nextFrame: () => Promise.resolve(),
}));

const {
  pollUntil,
  nextFrame,
  resetUiState,
  getUiState,
  isDialogOpen,
  waitForRecordSaved,
  waitForDocSaved,
} = await import("./helpers");

/* ─────────────── pollUntil ─────────────── */

describe("pollUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("条件立即满足时返回 true", async () => {
    const promise = pollUntil(() => true, { timeout: 100, interval: 10 });
    await vi.advanceTimersByTimeAsync(0);
    expect(await promise).toBe(true);
  });

  it("条件永远不满足时返回 false", async () => {
    const promise = pollUntil(() => false, { timeout: 50, interval: 10 });
    // 快进超过超时时间
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toBe(false);
  });

  it("条件在几次轮询后满足", async () => {
    let count = 0;
    const promise = pollUntil(
      () => {
        count++;
        return count >= 3;
      },
      { timeout: 1000, interval: 10 },
    );
    // 推进时间让轮询执行
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(15);
    }
    expect(await promise).toBe(true);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("使用默认参数", async () => {
    const promise = pollUntil(() => true);
    await vi.advanceTimersByTimeAsync(0);
    expect(await promise).toBe(true);
  });
});

/* ─────────────── nextFrame ─────────────── */

describe("nextFrame", () => {
  it("返回 Promise", () => {
    const result = nextFrame();
    expect(result).toBeInstanceOf(Promise);
  });

  it("最终 resolve", async () => {
    // 在非浏览器环境中降级为 setTimeout(16ms)
    await expect(nextFrame()).resolves.toBeUndefined();
  });
});

/* ─────────────── UI 状态追踪 ─────────────── */

describe("resetUiState + getUiState", () => {
  it("重置后所有字段为 null", () => {
    resetUiState();
    const state = getUiState();
    expect(state.currentPage).toBeNull();
    expect(state.currentPersonId).toBeNull();
    expect(state.currentWikiDocId).toBeNull();
    expect(state.currentDaLiuRenRecordId).toBeNull();
    expect(state.currentLiuyaoRecordId).toBeNull();
  });
});

/* ─────────────── isDialogOpen ─────────────── */

describe("isDialogOpen", () => {
  it("所有页面默认返回 false（mock 回调均返回 null）", () => {
    expect(isDialogOpen("daliuren")).toBe(false);
    expect(isDialogOpen("liuyao")).toBe(false);
    expect(isDialogOpen("wiki")).toBe(false);
  });
});

/* ─────────────── pollUntil 边缘场景 ─────────────── */

describe("pollUntil 边缘场景", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("异步条件函数也能正确处理", async () => {
    let called = false;
    const promise = pollUntil(
      async () => {
        called = true;
        return true;
      },
      { timeout: 100, interval: 10 },
    );
    await vi.advanceTimersByTimeAsync(0);
    // 给 async 一个 tick
    await vi.advanceTimersByTimeAsync(5);
    expect(await promise).toBe(true);
    expect(called).toBe(true);
  });

  it("timeout 为 0 时立即返回 false（条件不满足时）", async () => {
    const promise = pollUntil(() => false, { timeout: 0, interval: 10 });
    await vi.advanceTimersByTimeAsync(0);
    expect(await promise).toBe(false);
  });

  it("interval 大于 timeout 时也能正常结束", async () => {
    const promise = pollUntil(() => false, { timeout: 10, interval: 100 });
    // 需要推进足够时间让 setTimeout(100) resolve，然后 Date.now 才能超过 timeout
    await vi.advanceTimersByTimeAsync(200);
    expect(await promise).toBe(false);
  });
});

/* ─────────────── waitForPersist 参数传递 ─────────────── */

describe("waitForRecordSaved / waitForDocSaved 参数传递", () => {
  it("waitForRecordSaved(id=undefined) 直接返回", async () => {
    await expect(waitForRecordSaved(undefined)).resolves.toBeUndefined();
  });

  it("waitForDocSaved(id=undefined) 直接返回", async () => {
    await expect(waitForDocSaved(undefined)).resolves.toBeUndefined();
  });

  it("waitForRecordSaved(id=null) 直接返回", async () => {
     
    await expect(waitForRecordSaved(null as any)).resolves.toBeUndefined();
  });
});
