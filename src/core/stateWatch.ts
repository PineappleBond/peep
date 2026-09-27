/**
 * 状态变更追踪工具（仅开发环境）
 *
 * 提供"状态变更日志"，记录每次状态更新的时间、来源、前后值。
 * 便于排查"谁改了这个状态""为什么变了"等调试问题。
 *
 * 设计原则：
 *  - 生产环境完全禁用（所有导出为空操作）
 *  - 环形缓冲，最大 100 条，避免内存增长
 *  - 不影响状态更新性能（记录在更新后同步执行，不 await 异步操作）
 */

/* ── 类型定义 ── */

/** 单条状态变更记录 */
export interface StateChangeRecord {
  /** 状态名称（如 "pick"、"dialogState"、"theme"） */
  name: string;
  /** 来源（如 "ZwdsContext.setPick"、"ThemeEditor.toggle"） */
  source: string;
  /** 变更前值（可能为 undefined 表示初始） */
  prevValue: unknown;
  /** 变更后值 */
  nextValue: unknown;
  /** 变更时间戳 */
  timestamp: number;
  /** 可选：变更原因/备注 */
  reason?: string;
}

/* ── 模块状态 ── */

/** 环形缓冲上限 */
const MAX_CHANGES = 100;
const changes: StateChangeRecord[] = [];

/** 是否启用状态追踪 */
let enabled = false;

/** 监听器：每次变更时通知（如 DevDashboard 实时刷新） */
type ChangeListener = (record: StateChangeRecord) => void;
const listeners = new Set<ChangeListener>();

/* ── 公开 API ── */

/**
 * 启用/禁用状态追踪
 */
export function enableStateWatch(value: boolean): void {
  if (!import.meta.env.DEV) return;
  enabled = value;
  // eslint-disable-next-line no-console
  console.log(
    `%c[peep]%c 状态追踪${value ? "已启用" : "已禁用"}`,
    "color:#2196f3;font-weight:bold",
    "",
  );
}

/**
 * 记录一次状态变更。
 * 业务代码在 setState 时调用此函数记录变更。
 *
 * @example
 * ```ts
 * function setPick(p) {
 *   const prev = state.pick;
 *   state.pick = p;
 *   recordStateChange("pick", "ZwdsContext.setPick", prev, p);
 * }
 * ```
 */
export function recordStateChange(
  name: string,
  source: string,
  prevValue: unknown,
  nextValue: unknown,
  reason?: string,
): void {
  if (!import.meta.env.DEV || !enabled) return;

  const record: StateChangeRecord = {
    name,
    source,
    prevValue,
    nextValue,
    timestamp: Date.now(),
    reason,
  };

  if (changes.length >= MAX_CHANGES) {
    changes.shift();
  }
  changes.push(record);

  // 通知监听器
  for (const fn of listeners) {
    try {
      fn(record);
    } catch (err) {
      console.error("[stateWatch] 监听器执行失败", err);
    }
  }
}

/**
 * 订阅状态变更事件
 * @returns 取消订阅函数
 */
export function subscribeStateChange(fn: ChangeListener): () => void {
  if (!import.meta.env.DEV) return () => {};
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * 获取所有变更记录（只读副本）
 */
export function getStateChanges(): StateChangeRecord[] {
  if (!import.meta.env.DEV) return [];
  return [...changes];
}

/**
 * 按状态名过滤变更记录
 */
export function getStateChangesByName(name: string): StateChangeRecord[] {
  if (!import.meta.env.DEV) return [];
  return changes.filter(c => c.name === name);
}

/**
 * 获取每个状态的变更统计
 */
export function getStateChangeSummary(): Record<
  string,
  { count: number; lastSource: string; lastChange: number }
> {
  if (!import.meta.env.DEV) return {};

  const result: Record<string, { count: number; lastSource: string; lastChange: number }> = {};
  for (const c of changes) {
    const existing = result[c.name];
    if (existing) {
      existing.count++;
      existing.lastSource = c.source;
      existing.lastChange = c.timestamp;
    } else {
      result[c.name] = {
        count: 1,
        lastSource: c.source,
        lastChange: c.timestamp,
      };
    }
  }
  return result;
}

/**
 * 清除所有变更记录（测试用）
 */
export function clearStateChanges(): void {
  changes.length = 0;
}

/**
 * 检查状态追踪是否启用
 */
export function isStateWatchEnabled(): boolean {
  return enabled;
}

/**
 * 打印最近的状态变更到控制台
 */
export function dumpStateChanges(limit = 20): void {
  if (!import.meta.env.DEV) return;
  const recent = changes.slice(-limit);
  if (recent.length === 0) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 暂无状态变更记录", "color:#2196f3;font-weight:bold", "");
    return;
  }
  // eslint-disable-next-line no-console
  console.group(`%c[peep] 最近 ${recent.length} 条状态变更`, "color:#2196f3;font-weight:bold");
  for (const c of recent) {
    // eslint-disable-next-line no-console
    console.log(
      `%c${new Date(c.timestamp).toLocaleTimeString()}%c ${c.name} %c← ${c.source}%c${c.reason ? ` (${c.reason})` : ""}`,
      "color:#888",
      "color:#fff;font-weight:bold",
      "color:#ff9800",
      "",
      { prev: c.prevValue, next: c.nextValue },
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}
