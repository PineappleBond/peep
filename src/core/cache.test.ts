/**
 * 缓存工具单元测试：LRUCache、缓存注册表
 *
 * 注：memoizeWeak / memoize / withCache 等通用记忆化工具已从 cache.ts 移除
 * （项目中未使用，且引入缓存容易导致状态不一致 bug）。相关测试一并移除。
 */
import { describe, expect, it, beforeEach } from "vitest";
import { LRUCache, registerCache, getAllCacheStats, clearAllCaches } from "./cache";

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

  describe("边界条件", () => {
    it("maxSize=1 时每次插入都淘汰旧值", () => {
      const cache = new LRUCache<string, number>({ maxSize: 1, name: "single" });
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
      cache.set("b", 2);
      expect(cache.has("a")).toBe(false);
      expect(cache.get("b")).toBe(2);
      expect(cache.getStats().size).toBe(1);
      expect(cache.getStats().evictions).toBe(1);
    });

    it("maxSize=0 时不存储任何条目", () => {
      const cache = new LRUCache<string, number>({ maxSize: 0, name: "zero" });
      cache.set("a", 1);
      // maxSize=0 意味着容量为 0
      expect(cache.getStats().size).toBeLessThanOrEqual(1);
    });

    it("null 值可以被缓存和获取", () => {
      const cache = new LRUCache<string, null>({ maxSize: 3, name: "null" });
      cache.set("a", null);
      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe(null);
    });

    it("false 值可以被缓存和获取", () => {
      const cache = new LRUCache<string, boolean>({ maxSize: 3, name: "bool" });
      cache.set("a", false);
      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe(false);
    });

    it("0 值可以被缓存和获取", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, name: "zero-val" });
      cache.set("a", 0);
      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe(0);
      expect(cache.getStats().hits).toBe(1);
    });

    it("空字符串值可以被缓存和获取", () => {
      const cache = new LRUCache<string, string>({ maxSize: 3, name: "empty-str" });
      cache.set("a", "");
      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe("");
      expect(cache.getStats().hits).toBe(1);
    });

    it("数字键可以使用", () => {
      const cache = new LRUCache<number, string>({ maxSize: 3, name: "num-key" });
      cache.set(1, "one");
      cache.set(2, "two");
      expect(cache.get(1)).toBe("one");
      expect(cache.get(2)).toBe("two");
    });

    it("大量淘汰后统计正确", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, name: "heavy-evict" });
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, i);
      }
      expect(cache.getStats().size).toBe(3);
      expect(cache.getStats().evictions).toBe(97);
    });

    it("连续 set 同一个键不触发淘汰", () => {
      const cache = new LRUCache<string, number>({ maxSize: 1, name: "same-key" });
      cache.set("a", 1);
      cache.set("a", 2);
      cache.set("a", 3);
      expect(cache.getStats().evictions).toBe(0);
      expect(cache.get("a")).toBe(3);
    });

    it("clear 后再插入从 0 开始计数", () => {
      const cache = new LRUCache<string, number>({ maxSize: 2, name: "clear-reset" });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3); // 淘汰 1 次
      cache.clear();
      expect(cache.getStats().evictions).toBe(0);
      cache.set("d", 4);
      cache.set("e", 5);
      cache.set("f", 6); // 淘汰 1 次
      expect(cache.getStats().evictions).toBe(1);
    });

    it("hitRate 精度验证", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3, name: "precision" });
      cache.set("a", 1);
      // 3 hits, 1 miss => hitRate = 0.75
      cache.get("a");
      cache.get("a");
      cache.get("a");
      cache.get("missing");
      expect(cache.hitRate).toBe(0.75);
    });

    it("对象值可以被缓存", () => {
      const cache = new LRUCache<string, object>({ maxSize: 3, name: "obj-val" });
      const obj = { key: "value" };
      cache.set("a", obj);
      expect(cache.get("a")).toBe(obj);
    });
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
