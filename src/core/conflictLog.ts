/**
 * 同步冲突历史记录模块
 *
 * 设计：
 * - 每次 detectConflicts 发现冲突时，由调用方记录一条冲突事件
 * - 记录包含：时间、各表冲突数量、用户采取的解决策略、是否成功
 * - 持久化在 localStorage（轻量，便于跨会话查看）
 * - 循环缓冲：最多保留 MAX_RECORDS 条，超出自动丢弃旧记录
 *
 * 用途：
 * - SyncDialog 的"冲突历史"面板展示过往冲突
 * - 便于用户回顾自己的同步习惯与数据冲突频率
 * - 未来可导出为诊断信息
 */
import type { BackupData } from "./importData";

/* ─────────────── 类型 ─────────────── */

export type ConflictResolution =
  /** 覆盖：清空本地后写入 */
  | "overwrite"
  /** 合并：保留本地，仅追加新记录 */
  | "merge"
  /** 智能合并：按 savedAt 比较，最后写入胜出 */
  | "smart"
  /** 用户取消操作 */
  | "cancelled";

export interface ConflictRecord {
  /** 发生时间戳 */
  at: number;
  /** 各表冲突 ID 数量 */
  counts: {
    persons: number;
    liuren: number;
    wiki: number;
  };
  /** 冲突总数 */
  total: number;
  /** 用户最终采用的解决方式 */
  resolution?: ConflictResolution;
  /** 是否处理成功 */
  success?: boolean;
  /** 失败原因 */
  error?: string;
  /** 来源备份的导出时间（如果有） */
  remoteExportedAt?: string;
}

/* ─────────────── 存储 ─────────────── */

const STORAGE_KEY = "peep-conflict-history";
const MAX_RECORDS = 30;

export function loadConflictHistory(): ConflictRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(records: ConflictRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* 忽略，通常是 quota 错误 */
  }
}

/* ─────────────── 写入 ─────────────── */

/**
 * 记录一次冲突事件
 * - 仅当总冲突数 > 0 时才写入
 * - 返回是否成功写入（便于调用方决策）
 */
export function appendConflictRecord(
  counts: ConflictRecord["counts"],
  meta?: { remoteExportedAt?: string },
): ConflictRecord | null {
  const total = counts.persons + counts.liuren + counts.wiki;
  if (total <= 0) return null;
  const rec: ConflictRecord = {
    at: Date.now(),
    counts,
    total,
    remoteExportedAt: meta?.remoteExportedAt,
  };
  const all = loadConflictHistory();
  all.unshift(rec);
  saveHistory(all);
  return rec;
}

/**
 * 为最近一条冲突记录附加解决结果
 * - 按 at 时间戳匹配最近一条未带 resolution 的记录
 * - 找不到则忽略（避免覆盖已处理的历史）
 */
export function resolveLastConflict(
  resolution: ConflictResolution,
  outcome: { success: boolean; error?: string },
): void {
  const all = loadConflictHistory();
  const idx = all.findIndex(r => r.resolution === undefined);
  if (idx < 0) return;
  all[idx] = {
    ...all[idx],
    resolution,
    success: outcome.success,
    error: outcome.error,
  };
  saveHistory(all);
}

export function clearConflictHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}

/* ─────────────── 辅助 ─────────────── */

/**
 * 从备份数据与 detectConflicts 的结果快速生成一条冲突记录并写入
 * - 便于 SyncDialog 在"解析链接后立即记录"的简化流程
 */
export function logConflictFromPreview(
  counts: ConflictRecord["counts"],
  data: BackupData,
): ConflictRecord | null {
  return appendConflictRecord(counts, {
    remoteExportedAt: data.meta?.exportedAt,
  });
}
