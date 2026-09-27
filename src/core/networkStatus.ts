/**
 * 网络状态检测模块
 *
 * 设计：
 * - 单例模式：全局唯一状态源，避免多处监听造成浪费
 * - 发布/订阅：与 toast 模块一致的 subscribe/getSnapshot 接口，
 *   便于 React 组件通过 useSyncExternalStore 消费
 * - 离线感知：通过 navigator.onLine 与 online/offline 事件监听
 * - 启动时立即捕获初始状态，避免首屏错误判断为在线
 *
 * 使用：
 *   import { isOnline, subscribeNetwork, getNetworkSnapshot } from "./networkStatus";
 *   if (isOnline()) { ... }
 *   const online = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot);
 */

/* ─────────────── 类型与状态 ─────────────── */

export type NetworkState = {
  /** 当前是否在线 */
  online: boolean;
  /** 上次状态变化时间戳（ms）；初始化为启动时间 */
  lastChangedAt: number;
  /** 累计离线次数（用于统计/诊断） */
  offlineCount: number;
};

type Listener = (state: NetworkState) => void;

/** 缓存快照：仅在状态变化时更新引用，useSyncExternalStore 才不会无限循环 */
let cachedSnapshot: NetworkState;
const listeners = new Set<Listener>();

/** 初始化状态 */
function getInitialOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

cachedSnapshot = {
  online: getInitialOnline(),
  lastChangedAt: Date.now(),
  offlineCount: 0,
};

/* ─────────────── 事件处理 ─────────────── */

function setOnline(online: boolean) {
  if (cachedSnapshot.online === online) return;
  cachedSnapshot = {
    online,
    lastChangedAt: Date.now(),
    offlineCount: cachedSnapshot.offlineCount + (online ? 0 : 1),
  };
  for (const l of listeners) {
    try {
      l(cachedSnapshot);
    } catch (err) {
      console.error("[networkStatus] 监听器异常", err);
    }
  }
}

function handleOnline() {
  setOnline(true);
}
function handleOffline() {
  setOnline(false);
}

/* ─────────────── 注册/注销事件（惰性，首次订阅时挂载） ─────────────── */

let registered = false;

function ensureRegistered() {
  if (registered) return;
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  registered = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  // 校正启动状态：部分浏览器 onLine 初始值可能滞后
  setOnline(navigator.onLine !== false);
}

/* ─────────────── 对外 API ─────────────── */

/** 当前是否在线（同步读取） */
export function isOnline(): boolean {
  ensureRegistered();
  return cachedSnapshot.online;
}

/** 获取当前网络状态快照 */
export function getNetworkSnapshot(): NetworkState {
  ensureRegistered();
  return cachedSnapshot;
}

/** 订阅网络状态变化（适配 useSyncExternalStore） */
export function subscribeNetwork(listener: Listener): () => void {
  ensureRegistered();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 手动刷新状态（测试或外部触发使用，正常流程无需调用） */
export function refreshNetworkStatus(): void {
  if (typeof navigator === "undefined") return;
  setOnline(navigator.onLine !== false);
}

/** 重置模块状态（仅测试使用） */
export function __resetNetworkStatusForTest(): void {
  listeners.clear();
  registered = false;
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }
  cachedSnapshot = {
    online: getInitialOnline(),
    lastChangedAt: Date.now(),
    offlineCount: 0,
  };
}
