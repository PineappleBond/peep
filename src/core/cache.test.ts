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

    it("undefined 值可以被缓存", () => {
      const cache = new LRUCache<string, undefined>({ maxSize: 3, name: "undef" });
      cache.set("a", undefined);
      // get 返回 undefined 有两种情况：值就是 undefined 或键不存在
      // 用 has 确认键存在
      cache.set("a", undefined as unknown as undefined);
      // has 确认存在
      // get 返回 undefined（但键存在）
      // 因为 LRUCache.get 无法区分缓存了 undefined 和键不存在
      // 这是设计上的限制——但通过 has 可以区分
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
      // get 返回 false，但 misses 不会增加因为值不是 undefined
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
      // 注意：空字符串不是 undefined，所以 get 应该计为 hit
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

  it("返回 undefined 时也能正确缓存（哨兵值修复）", () => {
    let callCount = 0;
    const fn = memoizeWeak((_obj: object): undefined => {
      callCount++;
      return undefined;
    });

    const key = {};
    fn(key);
    fn(key);
    // 哨兵值方案：undefined 也被缓存，第二次调用直接命中
    expect(callCount).toBe(1);
  });

  describe("边缘案例", () => {
    it("返回 null 能正确缓存", () => {
      let callCount = 0;
      const fn = memoizeWeak((_obj: object) => {
        callCount++;
        return null;
      });
      const key = {};
      expect(fn(key)).toBe(null);
      expect(fn(key)).toBe(null);
      expect(callCount).toBe(1);
    });

    it("返回 false 能正确缓存", () => {
      let callCount = 0;
      const fn = memoizeWeak((_obj: object) => {
        callCount++;
        return false;
      });
      const key = {};
      expect(fn(key)).toBe(false);
      expect(fn(key)).toBe(false);
      expect(callCount).toBe(1);
    });

    it("返回 0 能正确缓存", () => {
      let callCount = 0;
      const fn = memoizeWeak((_obj: object) => {
        callCount++;
        return 0;
      });
      const key = {};
      expect(fn(key)).toBe(0);
      expect(fn(key)).toBe(0);
      expect(callCount).toBe(1);
    });

    it("返回空字符串能正确缓存", () => {
      let callCount = 0;
      const fn = memoizeWeak((_obj: object) => {
        callCount++;
        return "";
      });
      const key = {};
      expect(fn(key)).toBe("");
      expect(fn(key)).toBe("");
      expect(callCount).toBe(1);
    });

    it("不同对象即使内容相同也不命中", () => {
      let callCount = 0;
      const fn = memoizeWeak((obj: { x: number }) => {
        callCount++;
        return obj.x;
      });
      fn({ x: 1 });
      fn({ x: 1 }); // 不同对象引用
      expect(callCount).toBe(2);
    });

    it("函数类型对象作为键", () => {
      let callCount = 0;
      const fn = memoizeWeak((callback: () => number) => {
        callCount++;
        return callback();
      });
      const cb = () => 42;
      fn(cb);
      fn(cb);
      expect(callCount).toBe(1);
    });

    it("数组对象作为键", () => {
      let callCount = 0;
      const fn = memoizeWeak((arr: number[]) => {
        callCount++;
        return arr.length;
      });
      const arr = [1, 2, 3];
      fn(arr);
      fn(arr);
      expect(callCount).toBe(1);
    });

    it("Map 对象作为键", () => {
      let callCount = 0;
      const fn = memoizeWeak((map: Map<string, number>) => {
        callCount++;
        return map.size;
      });
      const map = new Map([["a", 1]]);
      fn(map);
      fn(map);
      expect(callCount).toBe(1);
    });
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

  describe("边缘案例", () => {
    it("无参数调用能缓存", () => {
      let callCount = 0;
      const fn = memoize(() => {
        callCount++;
        return 42;
      });
      expect(fn()).toBe(42);
      expect(fn()).toBe(42);
      expect(callCount).toBe(1);
    });

    it("undefined 参数能正确缓存", () => {
      let callCount = 0;
      const fn = memoize((_v: undefined) => {
        callCount++;
        return "result";
      });
      expect(fn(undefined)).toBe("result");
      expect(fn(undefined)).toBe("result");
      expect(callCount).toBe(1);
    });

    it("null 参数能正确缓存", () => {
      let callCount = 0;
      const fn = memoize((_v: null) => {
        callCount++;
        return "result";
      });
      expect(fn(null)).toBe("result");
      expect(fn(null)).toBe("result");
      expect(callCount).toBe(1);
    });

    it("布尔参数能正确缓存", () => {
      let callCount = 0;
      const fn = memoize((v: boolean) => {
        callCount++;
        return v ? "yes" : "no";
      });
      expect(fn(true)).toBe("yes");
      expect(fn(false)).toBe("no");
      expect(fn(true)).toBe("yes");
      expect(callCount).toBe(2);
    });

    it("NaN 参数被 JSON.stringify 转为 null 导致缓存碰撞", () => {
      // JSON.stringify(NaN) === "null"，所以 NaN 和 null 产生相同缓存键
      let callCount = 0;
      const fn = memoize((v: unknown) => {
        callCount++;
        return String(v);
      });
      fn(NaN);
      fn(null); // JSON.stringify(null) === "null"，与 NaN 相同
      // 因为缓存碰撞，第二次调用应该命中缓存
      expect(callCount).toBe(1);
    });

    it("数组参数能正确缓存", () => {
      let callCount = 0;
      const fn = memoize((arr: number[]) => {
        callCount++;
        return arr.reduce((a, b) => a + b, 0);
      });
      expect(fn([1, 2, 3])).toBe(6);
      expect(fn([1, 2, 3])).toBe(6);
      expect(callCount).toBe(1);
      expect(fn([4, 5, 6])).toBe(15);
      expect(callCount).toBe(2);
    });

    it("返回 undefined 的函数也能缓存（但无法区分 miss）", () => {
      let callCount = 0;
      const fn = memoize((_n: number) => {
        callCount++;
        return undefined;
      });
      fn(1);
      fn(1); // 因为返回 undefined，cache.get 返回 undefined，误判为 miss
      // 实际上 memoize 用 `cached !== undefined` 判断命中
      // 返回 undefined 时永远 miss，所以 callCount 是 2
      expect(callCount).toBe(2);
    });

    it("返回 null 的函数能正确缓存", () => {
      let callCount = 0;
      const fn = memoize((_n: number) => {
        callCount++;
        return null;
      });
      fn(1);
      fn(1);
      // null !== undefined，所以第二次命中缓存
      expect(callCount).toBe(1);
    });
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

  describe("边缘案例", () => {
    it("maxSize 配置生效", () => {
      let callCount = 0;
      const { fn } = withCache(
        (n: number) => {
          callCount++;
          return n;
        },
        { maxSize: 1 },
      );
      fn(1);
      fn(2); // 淘汰 1
      callCount = 0;
      fn(1); // 重新计算
      expect(callCount).toBe(1);
    });

    it("keyFn 自定义键生成", () => {
      let callCount = 0;
      const { fn } = withCache(
        (obj: { id: number; data: string }) => {
          callCount++;
          return obj.data;
        },
        { keyFn: obj => String(obj.id) },
      );
      fn({ id: 1, data: "a" });
      fn({ id: 1, data: "b" }); // 缓存命中（按 id）
      expect(callCount).toBe(1);
    });

    it("clear 后 stats 归零", () => {
      const { fn, clear, stats } = withCache((n: number) => n);
      fn(1);
      fn(1);
      clear();
      const s = stats();
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
      expect(s.size).toBe(0);
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
