/**
 * 大六壬历史盘面后台迁移
 *
 * 算法修正（如九宗门取法变更）后，已存储在 IndexedDB 的旧 DaLiuRenResult
 * 不会自动刷新。本模块负责：
 *
 * 1. 在 app 启动时检测 localStorage 触发标记（由 migrations.ts v5 写入）。
 * 2. 后台逐条重算所有 algorithmVersion < CURRENT_ALGORITHM_VERSION 的记录。
 * 3. 通过回调把进度推送给 UI（toast / 进度条）。
 * 4. 提供"手动重触发"入口，供设置面板或未来同类修复复用。
 *
 * 设计要点：
 * - 不阻塞 DB 打开：migrations.ts v5 只打标记，重算在 app 启动后异步跑。
 * - 批处理 + 让出主线程：每批处理 BATCH_SIZE 条后 setTimeout(0)，保持 UI 响应。
 * - 单条容错：任一记录重算失败只记录失败计数，不中断整批。
 * - 幂等：重复调用无副作用，已完成记录的 algorithmVersion 已是最新，会被跳过。
 */
import { db, getPerson, type LiurenRecord } from "./personDb";
import { calculateDaLiuRen } from "./daliuren/calculator";
import { CURRENT_ALGORITHM_VERSION } from "./daliuren/constants";
import type { DaLiuRenResult } from "./daliuren/types";
import { LIUREN_REPAIR_TRIGGER_KEY } from "./migrations";

/** 每批处理的记录数；之后让出主线程一次，避免长事务卡 UI。 */
const BATCH_SIZE = 20;

/** 迁移进度 */
export interface RepairProgress {
  /** 是否正在进行 */
  running: boolean;
  /** 待处理总数 */
  total: number;
  /** 已处理（含成功+失败） */
  processed: number;
  /** 成功重算数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 跳过的记录数（已经是最新版本） */
  skipped: number;
}

type Listener = (p: RepairProgress) => void;

const initialProgress: RepairProgress = {
  running: false,
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
};

let progress: RepairProgress = { ...initialProgress };
const listeners = new Set<Listener>();

function setProgress(patch: Partial<RepairProgress>) {
  progress = { ...progress, ...patch };
  for (const l of listeners) {
    try {
      l(progress);
    } catch {
      /* 忽略监听器错误 */
    }
  }
}

/** 订阅进度变化（组件挂载时调用，返回取消订阅函数） */
export function subscribeRepair(listener: Listener): () => void {
  listeners.add(listener);
  // 立即推送一次当前状态，让 UI 能拿到最新值
  try {
    listener(progress);
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(listener);
  };
}

/** 获取当前进度快照 */
export function getRepairProgress(): RepairProgress {
  return progress;
}

/**
 * 解析 calculationTime（"YYYY-MM-DD HH:mm:ss"）为 date 与 time 字符串
 *
 * 兼容 "/" 或 "-" 分隔；如果格式异常返回 null，由调用方跳过。
 */
function parseCalculationTime(calculationTime: string): { date: string; time: string } | null {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(
    calculationTime,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const pad = (x: string) => x.padStart(2, "0");
  return {
    date: `${y}-${pad(mo)}-${pad(d)}`,
    time: `${pad(h)}:${pad(mi)}:${pad(s ?? "0")}`,
  };
}

/** 让出主线程一次 */
function yieldToHost(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * 执行历史盘面重算
 *
 * 若当前没有触发标记且 force=false，则直接跳过（避免每次启动都跑）。
 * 调用方（app 启动 hook、设置面板按钮）均可传 force=true 强制重跑。
 */
export async function repairLiurenRecords(options: { force?: boolean } = {}): Promise<void> {
  if (progress.running) {
    console.warn("[daliurenRepair] 已有迁移任务在跑，忽略重复触发");
    return;
  }

  // 无触发标记且非强制 → 跳过
  if (!options.force) {
    let trigger: string | null = null;
    try {
      trigger = localStorage.getItem(LIUREN_REPAIR_TRIGGER_KEY);
    } catch {
      /* ignore */
    }
    if (!trigger) return;
  }

  setProgress({ running: true, total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 });

  try {
    // 拉取所有记录；algorithmVersion >= CURRENT 的直接跳过
    const all: LiurenRecord[] = await db.liurenRecords.toArray();
    const needRepair = all.filter(r => {
      const v = (r.result as DaLiuRenResult | undefined)?.algorithmVersion;
      return v == null || v < CURRENT_ALGORITHM_VERSION;
    });

    setProgress({ total: needRepair.length });

    if (needRepair.length === 0) {
      // 没有需要重算的，直接清掉触发标记
      clearTrigger();
      setProgress({ running: false });
      return;
    }

    console.log(`[daliurenRepair] 开始后台重算 ${needRepair.length}/${all.length} 条大六壬记录`);

    for (const record of needRepair) {
      try {
        const parsed = parseCalculationTime(record.calculationTime);
        if (!parsed || record.id == null) {
          setProgress({
            processed: progress.processed + 1,
            failed: progress.failed + 1,
          });
          continue;
        }

        // fateInput 来自关联人物；找不到 person 也按无 fateInput 重算（至少三传等能修正）
        const person = await getPerson(record.personId);
        const fateInput = person
          ? { birthYear: extractBirthYear(person.date), gender: person.gender }
          : undefined;

        const newResult = calculateDaLiuRen(parsed.date, parsed.time, fateInput);

        // 保留用户编辑的元信息；只覆盖 result
        await db.liurenRecords.update(record.id, { result: newResult });

        setProgress({
          processed: progress.processed + 1,
          succeeded: progress.succeeded + 1,
        });
      } catch (err) {
        console.warn(`[daliurenRepair] 记录 ${record.id} 重算失败`, err);
        setProgress({
          processed: progress.processed + 1,
          failed: progress.failed + 1,
        });
      }

      // 每 BATCH_SIZE 条让出主线程一次
      if (progress.processed % BATCH_SIZE === 0) {
        await yieldToHost();
      }
    }

    clearTrigger();
    console.log(`[daliurenRepair] 完成：成功 ${progress.succeeded}，失败 ${progress.failed}`);
  } finally {
    setProgress({ running: false });
  }
}

/** 从 birthDate 字符串提取年份（NaN 返回当前年份兜底） */
function extractBirthYear(birthDate: string): number {
  const y = parseInt(birthDate.slice(0, 4), 10);
  return isNaN(y) ? new Date().getFullYear() : y;
}

function clearTrigger() {
  try {
    localStorage.removeItem(LIUREN_REPAIR_TRIGGER_KEY);
  } catch {
    /* ignore */
  }
}
