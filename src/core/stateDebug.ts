/**
 * 状态调试工具（仅开发环境）：
 * 提供运行时状态检查接口，便于在控制台诊断状态管理问题。
 * 生产环境自动禁用，不输出任何内容。
 */
import { useEffect, useRef } from "react";

/** 状态检查项：记录一个状态的名称、当前值快照、来源说明 */
export interface StateInspectEntry {
  /** 状态名称（如 "pick"、"dialogState"、"theme"） */
  name: string;
  /** 当前值（JSON 可序列化的快照） */
  value: unknown;
  /** 来源说明（如 "ZwdsContext"、"AppContext"、"useReducer"） */
  source: string;
  /** 最后更新时间戳（毫秒，仅当可获取时） */
  updatedAt?: number;
}

/** 检查器注册表 */
const inspectors = new Map<string, () => StateInspectEntry | null>();

/**
 * 注册一个状态检查器（仅 DEV 环境生效）。
 * 检查器是一个返回 StateInspectEntry 的函数，调用时获取最新快照。
 *
 * @param id 检查器唯一 ID（通常用 "模块名.状态名"）
 * @param inspector 检查器函数
 * @returns 清理函数（组件卸载时调用）
 */
export function registerStateInspector(
  id: string,
  inspector: () => StateInspectEntry | null,
): () => void {
  if (import.meta.env.DEV) {
    inspectors.set(id, inspector);
    return () => {
      inspectors.delete(id);
    };
  }
  return () => {};
}

/**
 * 获取所有已注册状态的快照（仅 DEV）。
 * 供 DevDashboard / window.peep.state 调用。
 */
export function getAllStateSnapshots(): StateInspectEntry[] {
  if (!import.meta.env.DEV) return [];
  const result: StateInspectEntry[] = [];
  for (const [, inspector] of inspectors) {
    const entry = inspector();
    if (entry) result.push(entry);
  }
  return result;
}

/**
 * 打印当前所有状态到控制台（仅 DEV）。
 * 可通过 window.peep.dumpState() 调用。
 */
export function dumpStateToConsole(): void {
  if (!import.meta.env.DEV) return;
  const snapshots = getAllStateSnapshots();
  if (snapshots.length === 0) {
     
    console.warn("[peep] 无已注册的状态检查器");
    return;
  }
   
  console.warn(`[peep] 状态快照（${snapshots.length} 项）`);
  for (const entry of snapshots) {
     
    console.warn(`${entry.name} (${entry.source})`, entry.value);
  }
}

/**
 * 状态调试 Hook：在 DEV 环境注册组件状态检查器。
 * 生产环境为 no-op，不产生任何副作用。
 *
 * @example
 * useDebugState("ZiweiPage.pick", z.pick, "ZwdsContext");
 */
export function useDebugState(name: string, value: unknown, source: string = "component"): void {
  const valueRef = useRef(value);
  valueRef.current = value;
  const updatedAtRef = useRef(Date.now());
  updatedAtRef.current = Date.now();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return registerStateInspector(name, () => ({
      name,
      value: valueRef.current,
      source,
      updatedAt: updatedAtRef.current,
    }));
  }, [name, source]);
}
