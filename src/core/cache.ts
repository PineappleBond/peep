/**
 * 轻量缓存工具：为纯函数提供记忆化能力。
 * 设计原则：
 * - 简单：不使用第三方库，避免增加包体积
 * - 安全：限制缓存大小防止内存泄漏
 * - 可观测：开发环境输出命中率统计
 */

/* ─────────────── 类型定义 ─────────────── */

/** 缓存统计信息 */
export type CacheStats = {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
};

/** LRU 缓存配置 */
export type LRUCacheOptions = {
  /** 最大条目数（默认 100） */
  maxSize?: number;
  /** 缓存名称（用于统计日志） */
  name?: string;
};

/* ─────────────── LRU 缓存 ─────────────── */

/**
 * 简易 LRU 缓存：基于 Map 的有序性（ES6+ Map 按插入顺序维护键）。
 * - 命中时删除再重插，使最近使用的键位于末尾
 * - 超限时删除最久未使用的键（Map 第一个键）
 */
export class LRUCache<K, V> {
  private readonly cache: Map<K, V>;
  private readonly maxSize: number;
  private readonly name: string;
  private hits: number;
  private misses: number;
  private evictions: number;

  constructor(options: LRUCacheOptions = {}) {
    this.cache = new Map<K, V>();
    this.maxSize = options.maxSize ?? 100;
    this.name = options.name ?? "unnamed";
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 移到末尾（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
      this.hits++;
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    // 已存在则先删除（更新位置）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用（Map 第一个键）
      const firstKey = this.cache.keys().next().value as K | undefined;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
    };
  }

  /** 命中率（0-1）；无请求时返回 0 */
  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }
}

/* ─────────────── 函数记忆化工具 ─────────────── */

/**
 * 缓存命中包装：WeakMap 对"未存"和"存了 undefined"返回的都是 undefined，无法区分。
 * 用包装对象 { v: result } 存储，使缓存值始终为 truthy 对象引用。
 * 开销极低（仅一个轻量对象包装），相比 fn 本身的计算可忽略。
 */
interface CacheHit<V> {
  v: V;
}

/**
 * 单参数函数记忆化：使用 WeakMap 避免内存泄漏（键为对象时自动回收）。
 * 适用于：astrolabe → 计算结果 这类以对象为键的场景。
 *
 * 使用包装对象（CacheHit）存储返回值，正确缓存 undefined。
 * 旧实现用 `cached !== undefined` 判断，导致原函数返回 undefined 时每次都 miss。
 */
export function memoizeWeak<T extends object, R>(fn: (arg: T) => R): (arg: T) => R {
  const cache = new WeakMap<T, CacheHit<R>>();
  return function memoized(arg: T): R {
    const hit = cache.get(arg);
    if (hit) return hit.v;
    const result = fn(arg);
    cache.set(arg, { v: result });
    return result;
  };
}

/**
 * 多参数函数记忆化：使用 LRU 缓存，以序列化参数为键。
 * 适用于：buildMonths(year)、buildDays(year, month) 这类以原始值为键的场景。
 *
 * 安全说明：默认使用 JSON.stringify(args) 作为缓存键。
 * 如果参数来自外部输入，恶意构造的字符串可能与合法参数产生相同缓存键（缓存投毒）。
 * 当前调用方均为内部计算函数（参数为数字/日期等原始值），风险可接受。
 * 若未来用于安全敏感场景，请传入自定义 keyFn 对输入进行规范化或哈希。
 */
export function memoize<A extends unknown[], R>(
  fn: (...args: A) => R,
  options: LRUCacheOptions & { keyFn?: (...args: A) => string } = {},
): (...args: A) => R {
  const { maxSize = 100, name = fn.name || "anonymous", keyFn } = options;
  const cache = new LRUCache<string, R>({ maxSize, name });

  return function memoized(...args: A): R {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * 带清理函数的缓存包装：用于需要在特定条件下清空缓存的场景。
 * 返回 { fn: 缓存后的函数, clear: 清理函数, stats: 统计函数 }
 */
export function withCache<A extends unknown[], R>(
  fn: (...args: A) => R,
  options: LRUCacheOptions & { keyFn?: (...args: A) => string } = {},
): {
  fn: (...args: A) => R;
  clear: () => void;
  stats: () => CacheStats;
} {
  const { maxSize = 100, name = fn.name || "anonymous", keyFn } = options;
  const cache = new LRUCache<string, R>({ maxSize, name });

  const cachedFn = function (...args: A): R {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  return {
    fn: cachedFn,
    clear: () => cache.clear(),
    stats: () => cache.getStats(),
  };
}

/* ─────────────── 缓存注册表（全局统计） ─────────────── */

/** 缓存注册表：集中管理所有缓存实例，便于统一输出统计 */
const cacheRegistry = new Map<string, { getStats: () => CacheStats; clear: () => void }>();

/** 注册缓存实例 */
export function registerCache(
  name: string,
  stats: { getStats: () => CacheStats; clear: () => void },
): void {
  cacheRegistry.set(name, stats);
}

/** 获取全部缓存统计 */
export function getAllCacheStats(): Record<string, CacheStats> {
  const result: Record<string, CacheStats> = {};
  for (const [name, cache] of cacheRegistry) {
    result[name] = cache.getStats();
  }
  return result;
}

/** 清空全部缓存 */
export function clearAllCaches(): void {
  for (const [, cache] of cacheRegistry) {
    cache.clear();
  }
}
