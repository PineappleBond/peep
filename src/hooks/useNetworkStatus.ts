/**
 * 网络状态 React Hook
 *
 * 通过 useSyncExternalStore 订阅 networkStatus 模块的状态，
 * 实现在 React 组件中响应式消费在线/离线状态。
 *
 * 使用：
 *   const online = useNetworkStatus();
 *   return <span>{online ? "在线" : "离线"}</span>;
 */
import { useSyncExternalStore } from "react";
import { subscribeNetwork, getNetworkSnapshot, type NetworkState } from "../core/networkStatus";

/**
 * 返回当前在线状态（boolean）
 */
export function useNetworkStatus(): boolean {
  const state = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getNetworkSnapshot);
  return state.online;
}

/**
 * 返回完整网络状态（含 lastChangedAt、offlineCount）
 */
export function useNetworkState(): NetworkState {
  return useSyncExternalStore(subscribeNetwork, getNetworkSnapshot, getNetworkSnapshot);
}
