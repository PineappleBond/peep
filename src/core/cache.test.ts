/**
 * 缓存工具单元测试：LRUCache、memoizeWeak、memoize、withCache、缓存注册表
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  LRUCache,
  memoizeWeak,
  memoize,
  withCache,
  registerCache,
  getAllCacheStats,
  clearAllCaches,
  type CacheStats,
} from "./cache";

/* ─────────────── LRUCache ─────────────── */

describe("LRUCache", () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>({ maxSize: 3, name: "test" });
  });

  describe("基本 get/set", () => {
    it("设置后能获取到值", () => {
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
    });

    it("未设置的键返回 undefined", () => {
      expect(cache.get("missing")).toBeUndefined();
    });

    it("has 正确反映键是否存在", () => {
      cache.set("a", 1);
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
    });

    it("覆盖已有键更新值", () => {
      cache.set("a", 1);
      cache.set("a", 2);
      expect(cache.get("a")).toBe(2);
    });
  });

  describe("LRU 淘汰策略", () => {
    it("超过 maxSize 时淘汰最久未使用的键", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      // 此时已满（3/3），再插入 d 应淘汰最久未使用的 a
      cache.set("d", 4);

      expect(cache.has("a")).toBe(false);
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("get 操作将键标记为最近使用", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      // 访问 a，使其变为最近使用
      cache.get("a");
      // 再插入 d，应淘汰 b（最久未使用）
      cache.set("d", 4);

      expect(cache.has("a")).toBe(true); // 刚访问过，保留
      expect(cache.has("b")).toBe(false); // 最久未使用，淘汰
    });

    it("set 已有键不触发淘汰（更新位置）", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      // 更新 a 的值，使其变为最近使用
      cache.set("a", 10);
      // 再插入 d，应淘汰 b
      cache.set("d", 4);

      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe(10); // 值已更新
      expect(cache.has("b")).toBe(false);
    });
  });

  describe("统计信息", () => {
    it("初始状态：命中/未命中/淘汰均为 0", () => {
      const stats = cache.getStats();
      expect(stats).toEqual({ hits: 0, misses: 0, evictions: 0, size: 0 });
    });

    it("get 命中时 hits 递增", () => {
      cache.set("a", 1);
      cache.get("a");
      cache.get("a");
      expect(cache.getStats().hits).toBe(2);
    });

    it("get 未命中时 misses 递增", () => {
      cache.get("x");
      cache.get("y");
      expect(cache.getStats().misses).toBe(2);
    });

    it("淘汰时 evictions 递增", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.set("d", 4); // 触发淘汰
      expect(cache.getStats().evictions).toBe(1);
    });

    it("size 反映当前缓存条目数", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.getStats().size).toBe(2);
    });

    it("hitRate 正确计算命中率", () => {
      cache.set("a", 1);
      cache.get("a"); // 命中
      cache.get("b"); // 未命中
      expect(cache.hitRate).toBe(0.5);
    });

    it("无请求时 hitRate 返回 0", () => {
      expect(cache.hitRate).toBe(0);
    });
  });

  describe("clear", () => {
    it("清空缓存并重置统计", () => {
      cache.set("a", 1);
      cache.get("a");
      cache.get("b");
      cache.clear();

      expect(cache.getStats()).toEqual({ hits: 0, misses: 0, evictions: 0, size: 0 });
      expect(cache.has("a")).toBe(false);
      expect(cache.hitRate).toBe(0);
    });
  });

  describe("默认配置", () => {
    it("不传参数时 maxSize 默认 100", () => {
      const defaultCache = new LRUCache<string, string>();
      // 插入 101 个元素，应淘汰 1 个
      for (let i = 0; i < 101; i++) {
        defaultCache.set(`key${i}`, `val${i}`);
      }
      expect(defaultCache.getStats().size).toBe(100);
      expect(defaultCache.getStats().evictions).toBe(1);
    });
  });
});

/* ─────────────── memoizeWeak ─────────────── */

describe("memoizeWeak", () => {
  it("相同对象键返回缓存结果", () => {
    let callCount = 0;
    const fn = memoizeWeak((obj: { x: number }) => {
      callCount++;
      return obj.x * 2;
    });

    const key = { x: 5 };
    expect(fn(key)).toBe(10);
    expect(fn(key)).toBe(10); // 缓存命中
    expect(callCount).toBe(1);
  });

  it("不同对象键分别计算", () => {
    let callCount = 0;
    const fn = memoizeWeak((obj: { x: number }) => {
      callCount++;
      return obj.x * 2;
    });

    expect(fn({ x: 5 })).toBe(10);
    expect(fn({ x: 5 })).toBe(10); // 不同对象引用，不命中
    expect(callCount).toBe(2);
  });

  it("返回值为 falsy 时也能缓存（undefined 除外）", () => {
    let callCount = 0;
    const fn = memoizeWeak((_obj: object) => {
      callCount++;
      return 0; // falsy 但非 undefined
    });

    const key = {};
    fn(key);
    fn(key);
    // 因为 cached !== undefined 判断，0 !== undefined → 命中
    expect(callCount).toBe(1);
  });

  it("返回 undefined 时不缓存（每次重新调用）", () => {
    let callCount = 0;
    const fn = memoizeWeak((_obj: object): undefined => {
      callCount++;
      return undefined;
    });

    const key = {};
    fn(key);
    fn(key);
    // cached 为 undefined → 不命中 → 每次都调用
    expect(callCount).toBe(2);
  });
});

/* ─────────────── memoize ─────────────── */

describe("memoize", () => {
  it("相同参数返回缓存结果", () => {
    let callCount = 0;
    const fn = memoize((a: number, b: number) => {
      callCount++;
      return a + b;
    });

    expect(fn(1, 2)).toBe(3);
    expect(fn(1, 2)).toBe(3); // 缓存命中
    expect(callCount).toBe(1);
  });

  it("不同参数分别计算", () => {
    let callCount = 0;
    const fn = memoize((a: number, b: number) => {
      callCount++;
      return a + b;
    });

    expect(fn(1, 2)).toBe(3);
    expect(fn(3, 4)).toBe(7);
    expect(callCount).toBe(2);
  });

  it("自定义 keyFn 改变缓存键生成方式", () => {
    let callCount = 0;
    const fn = memoize(
      (obj: { id: number; data: string }) => {
        callCount++;
        return obj.data.toUpperCase();
      },
      { keyFn: obj => String(obj.id) }, // 仅按 id 缓存
    );

    expect(fn({ id: 1, data: "hello" })).toBe("HELLO");
    // 相同 id，不同 data → 缓存命中（按 id 作为键）
    expect(fn({ id: 1, data: "world" })).toBe("HELLO");
    expect(callCount).toBe(1);
  });

  it("LRU 淘汰：超过 maxSize 时淘汰旧条目", () => {
    let callCount = 0;
    const fn = memoize(
      (n: number) => {
        callCount++;
        return n * 2;
      },
      { maxSize: 2 },
    );

    fn(1); // 缓存 [1]
    fn(2); // 缓存 [1, 2]
    fn(3); // 缓存 [2, 3]，淘汰 1
    callCount = 0; // 重置计数

    fn(1); // 1 已被淘汰，重新计算
    expect(callCount).toBe(1);
  });
});

/* ─────────────── withCache ─────────────── */

describe("withCache", () => {
  it("返回缓存函数、清理函数和统计函数", () => {
    const { fn, clear, stats } = withCache((n: number) => n * 2);

    expect(typeof fn).toBe("function");
    expect(typeof clear).toBe("function");
    expect(typeof stats).toBe("function");
  });

  it("缓存函数正常工作", () => {
    let callCount = 0;
    const { fn } = withCache((n: number) => {
      callCount++;
      return n * 2;
    });

    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  it("clear 清空缓存", () => {
    let callCount = 0;
    const { fn, clear } = withCache((n: number) => {
      callCount++;
      return n * 2;
    });

    fn(5);
    clear();
    fn(5); // 缓存已清空，重新计算
    expect(callCount).toBe(2);
  });

  it("stats 返回统计信息", () => {
    const { fn, stats } = withCache((n: number) => n * 2);

    fn(1); // miss
    fn(1); // hit
    fn(2); // miss

    const s = stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(2);
    expect(s.size).toBe(2);
  });
});

/* ─────────────── 缓存注册表 ─────────────── */

describe("缓存注册表", () => {
  it("registerCache 注册后 getAllCacheStats 能获取统计", () => {
    const testCache = new LRUCache<string, number>({ name: "registryTest" });
    registerCache("registryTest", testCache);

    testCache.set("x", 1);
    testCache.get("x");

    const allStats = getAllCacheStats();
    expect(allStats["registryTest"]).toBeDefined();
    expect(allStats["registryTest"].hits).toBe(1);
    expect(allStats["registryTest"].size).toBe(1);
  });

  it("clearAllCaches 清空所有已注册缓存", () => {
    const cache1 = new LRUCache<string, number>({ name: "c1" });
    const cache2 = new LRUCache<string, number>({ name: "c2" });
    registerCache("c1", cache1);
    registerCache("c2", cache2);

    cache1.set("a", 1);
    cache2.set("b", 2);

    clearAllCaches();

    expect(cache1.has("a")).toBe(false);
    expect(cache2.has("b")).toBe(false);
  });
});
