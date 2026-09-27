/**
 * 网络状态模块单元测试
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// Mock localStorage 与 window 事件
let memStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => (k in memStore ? memStore[k] : null),
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  get length() {
    return Object.keys(memStore).length;
  },
  key: (i: number) => Object.keys(memStore)[i] ?? null,
  clear: () => {
    memStore = {};
  },
};

// 简易 EventTarget 模拟（避免依赖 jsdom）
type Listener = (ev: Event) => void;
const listeners: Record<string, Listener[]> = {};
const mockWindow = {
  addEventListener: (name: string, fn: Listener) => {
    listeners[name] = listeners[name] || [];
    listeners[name].push(fn);
  },
  removeEventListener: (name: string, fn: Listener) => {
    listeners[name] = (listeners[name] || []).filter(l => l !== fn);
  },
  dispatchEvent: (ev: Event) => {
    (listeners[ev.type] || []).forEach(l => l(ev));
    return true;
  },
};

function dispatchWindowEvent(name: "online" | "offline") {
  mockWindow.dispatchEvent(new Event(name) as Event);
}

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

describe("networkStatus", () => {
  beforeEach(() => {
    vi.resetModules();
    memStore = {};
    for (const k of Object.keys(listeners)) delete listeners[k];
    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("window", mockWindow);
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isOnline", () => {
    it("默认跟随 navigator.onLine", async () => {
      setNavigatorOnline(true);
      const { isOnline, refreshNetworkStatus } = await import("./networkStatus");
      expect(isOnline()).toBe(true);
      setNavigatorOnline(false);
      refreshNetworkStatus();
      expect(isOnline()).toBe(false);
    });
  });

  describe("subscribeNetwork", () => {
    it("状态变化时通知订阅者", async () => {
      setNavigatorOnline(true);
      const { subscribeNetwork, refreshNetworkStatus, __resetNetworkStatusForTest } =
        await import("./networkStatus");
      __resetNetworkStatusForTest();
      refreshNetworkStatus();

      const listener = vi.fn();
      const unsub = subscribeNetwork(listener);

      setNavigatorOnline(false);
      dispatchWindowEvent("offline");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].online).toBe(false);

      unsub();
      dispatchWindowEvent("online");
      // 取消订阅后不再收到通知
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("状态未变时不触发通知", async () => {
      setNavigatorOnline(true);
      const { subscribeNetwork, refreshNetworkStatus, __resetNetworkStatusForTest } =
        await import("./networkStatus");
      __resetNetworkStatusForTest();
      refreshNetworkStatus();

      const listener = vi.fn();
      const unsub = subscribeNetwork(listener);
      dispatchWindowEvent("online");
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe("getNetworkSnapshot", () => {
    it("返回完整状态对象", async () => {
      const { getNetworkSnapshot } = await import("./networkStatus");
      const snapshot = getNetworkSnapshot();
      expect(snapshot).toHaveProperty("online");
      expect(snapshot).toHaveProperty("lastChangedAt");
      expect(snapshot).toHaveProperty("offlineCount");
      expect(typeof snapshot.online).toBe("boolean");
      expect(typeof snapshot.lastChangedAt).toBe("number");
      expect(typeof snapshot.offlineCount).toBe("number");
    });

    it("离线次数在每次 offline 时递增", async () => {
      setNavigatorOnline(true);
      const { getNetworkSnapshot, refreshNetworkStatus, __resetNetworkStatusForTest } =
        await import("./networkStatus");
      __resetNetworkStatusForTest();
      refreshNetworkStatus();
      expect(getNetworkSnapshot().offlineCount).toBe(0);
      setNavigatorOnline(false);
      dispatchWindowEvent("offline");
      expect(getNetworkSnapshot().offlineCount).toBe(1);
      setNavigatorOnline(true);
      dispatchWindowEvent("online");
      setNavigatorOnline(false);
      dispatchWindowEvent("offline");
      expect(getNetworkSnapshot().offlineCount).toBe(2);
    });
  });
});
