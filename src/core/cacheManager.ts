/**
 * 缓存管理模块：IndexedDB 体积估算、预热、清理
 *
 * 设计：
 * - 体积估算：优先使用 navigator.storage.estimate()（浏览器官方 API），
 *   回退到按记录数 × 平均大小的经验估算
 * - 预热：启动时触发一次关键数据读取，让 IndexedDB 提前完成内部初始化
 *   （首次访问延迟较高，预热后用户交互更顺畅）
 * - 清理：提供"压缩/优化"入口，删除冗余数据（如重复默认人物）
 *
 * 浏览器兼容性：
 * - navigator.storage.estimate 在主流现代浏览器均已支持
 * - Safari 私有模式早期版本可能抛错，已做兜底处理
 */
import { db } from "./personDb";
import { recordDomainMetric } from "./performance";

/* ─────────────── 类型 ─────────────── */

export interface StorageEstimate {
  /** 当前 origin 已用字节数 */
  usage: number;
  /** 当前 origin 可用配额字节数 */
  quota: number;
  /** 使用比例（0-1） */
  usageRatio: number;
  /** 数据来源：'browser' 表示浏览器 API；'estimated' 表示估算 */
  source: "browser" | "estimated";
}

/* ─────────────── 体积估算 ─────────────── */

/**
 * 估算当前 origin 的 IndexedDB 存储使用情况
 * - 优先浏览器官方 API（精确）
 * - 失败时回退到基于记录数的经验估算
 */
export async function estimateStorageUsage(): Promise<StorageEstimate> {
  const start = performance.now();
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est && typeof est.usage === "number" && typeof est.quota === "number") {
        const usageRatio = est.quota > 0 ? est.usage / est.quota : 0;
        recordDomainMetric("cache.estimate", performance.now() - start, {
          context: { source: "browser", usage: est.usage, quota: est.quota },
        });
        return {
          usage: est.usage,
          quota: est.quota,
          usageRatio,
          source: "browser",
        };
      }
    }
  } catch (err) {
    console.warn("[cacheManager] 浏览器估算 API 失败，回退到经验估算", err);
  }

  // 回退：基于记录数的经验估算
  // 假设每条记录平均 1KB（保守值，人物/六壬记录通常 0.5-2KB）
  const AVG_RECORD_BYTES = 1024;
  try {
    const [pCount, lCount, wCount, wlCount] = await Promise.all([
      db.persons.count(),
      db.liurenRecords.count(),
      db.wikiDocs.count(),
      db.wikiLinks.count(),
    ]);
    const totalRecords = pCount + lCount + wCount + wlCount;
    const estimatedUsage = totalRecords * AVG_RECORD_BYTES;
    // 配额假设为 10% 磁盘空间（浏览器典型默认值）；这里用 500MB 做相对估算
    const estimatedQuota = 500 * 1024 * 1024;
    recordDomainMetric("cache.estimate", performance.now() - start, {
      context: { source: "estimated", records: totalRecords },
    });
    return {
      usage: estimatedUsage,
      quota: estimatedQuota,
      usageRatio: estimatedUsage / estimatedQuota,
      source: "estimated",
    };
  } catch (err) {
    recordDomainMetric("cache.estimate", performance.now() - start, {
      tags: ["error"],
    });
    console.error("[cacheManager] 记录数统计失败", err);
    return {
      usage: 0,
      quota: 0,
      usageRatio: 0,
      source: "estimated",
    };
  }
}

/* ─────────────── 预热 ─────────────── */

/** 是否已执行过预热（避免重复触发） */
let warmed = false;

/**
 * 缓存预热：启动时读取少量关键数据，让 IndexedDB 完成内部初始化
 * - 默认人物 + 最近保存的人物：首屏立即需要
 * - 预热失败仅记录日志，不阻塞应用启动
 */
export async function warmupCache(): Promise<void> {
  if (warmed) return;
  warmed = true;
  const start = performance.now();
  try {
    await Promise.all([
      db.persons.filter(p => p.isDefault).first(),
      db.persons.orderBy("savedAt").reverse().limit(5).toArray(),
    ]);
    recordDomainMetric("cache.warmup", performance.now() - start);
  } catch (err) {
    recordDomainMetric("cache.warmup", performance.now() - start, {
      tags: ["error"],
    });
    console.warn("[cacheManager] 预热失败（不影响功能）", err);
  }
}

/* ─────────────── 清理 ─────────────── */

/**
 * 清理冗余数据：
 * - 合并重复的默认人物（保留 id 最小的一条）
 * - 未来可扩展：清理孤立 Wiki 链接、空标签等
 *
 * 返回清理结果统计
 */
export async function cleanupRedundantData(): Promise<{
  duplicateDefaultsRemoved: number;
}> {
  const defaults = await db.persons.filter(p => p.isDefault).toArray();
  let removed = 0;
  if (defaults.length > 1) {
    defaults.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const [, ...dupes] = defaults;
    await db.persons.bulkDelete(dupes.map(d => d.id!).filter(id => id != null));
    removed = dupes.length;
  }
  return { duplicateDefaultsRemoved: removed };
}

/**
 * 请求持久化存储（persisent storage）
 * - 浏览器在存储压力下可能清理 non-persistent 的 origin 数据
 * - 设为 persistent 后浏览器会尽量避免清理
 * - 失败不阻塞（仅影响数据留存优先级）
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    const persisted = await navigator.storage.persist();
    return persisted === true;
  } catch (err) {
    console.warn("[cacheManager] 请求持久化存储失败", err);
    return false;
  }
}

/**
 * 查询当前是否已处于持久化存储模式
 */
export async function isPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
      return false;
    }
    return (await navigator.storage.persisted()) === true;
  } catch {
    return false;
  }
}
