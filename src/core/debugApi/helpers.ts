/**
 * 调试 API 辅助函数
 *
 * 提供等待页面加载、状态验证等辅助工具
 */

import type { Zwds } from "../useZwds";
import { log, timer, nextFrame } from "./logger";
import type { BaseDebugError } from "./errors";
import { wrapError } from "./errors";
import type { ErrorConstructor } from "./errors";
import {
  getGetZwds,
  getGetPerson,
  getSelectPerson,
  getNavigate,
  getCallbacksReady,
  getOpenCreateDialog,
  getOpenLiuyaoCreateDialog,
  getOpenWikiEditor,
} from "./callbacks";

// 重新导出 nextFrame，保持向后兼容（外部模块仍可从 helpers 导入）
export { nextFrame };

/**
 * UI 状态追踪：记录当前页面和选中的人物 ID，用于跳过冗余的导航和选择操作。
 * 这是"像人类一样操作 UI"的核心——人类不会在已打开的页面上重新导航，
 * 不会在已选择的人物上重新选择。API 应该智能判断"是否需要操作"。
 *
 * 扩展：追踪各页面当前选中的记录/文档 ID，支持批量操作优化。
 */
const uiState = {
  currentPage: null as string | null,
  currentPersonId: null as number | null,
  // 各页面当前选中的记录/文档 ID
  currentWikiDocId: null as number | null,
  currentDaLiuRenRecordId: null as number | null,
  currentLiuyaoRecordId: null as number | null,
};

/**
 * 更新 UI 状态追踪（供外部调用）
 */
export function updateUiState(opts: {
  page?: string;
  personId?: number;
  wikiDocId?: number;
  daliurenRecordId?: number;
  liuyaoRecordId?: number;
}): void {
  if (opts.page !== undefined) uiState.currentPage = opts.page;
  if (opts.personId !== undefined) uiState.currentPersonId = opts.personId;
  if (opts.wikiDocId !== undefined) uiState.currentWikiDocId = opts.wikiDocId;
  if (opts.daliurenRecordId !== undefined) uiState.currentDaLiuRenRecordId = opts.daliurenRecordId;
  if (opts.liuyaoRecordId !== undefined) uiState.currentLiuyaoRecordId = opts.liuyaoRecordId;
}

/**
 * 获取当前 UI 状态（供调试用）
 */
export function getUiState(): {
  currentPage: string | null;
  currentPersonId: number | null;
  currentWikiDocId: number | null;
  currentDaLiuRenRecordId: number | null;
  currentLiuyaoRecordId: number | null;
} {
  return { ...uiState };
}

/**
 * 重置 UI 状态追踪（供测试使用）
 * 将所有 UI 状态追踪字段恢复为初始值。
 */
export function resetUiState(): void {
  uiState.currentPage = null;
  uiState.currentPersonId = null;
  uiState.currentWikiDocId = null;
  uiState.currentDaLiuRenRecordId = null;
  uiState.currentLiuyaoRecordId = null;
}

/**
 * 通用轮询工具——消除 waitForPersonMatch / waitForPickReset / waitForPickMatch
 * 等函数中重复的「超时检查 + 迭代计数 + 定时休眠」模式。
 *
 * 设计要点：
 * - 安全保护：最大迭代次数防止超时判断延迟导致无限循环
 * - 参数可配：间隔、超时均可自定义，默认 20ms / 2000ms
 * - 返回布尔值：调用方决定是否抛错或仅记录日志
 *
 * @param condition 每轮调用的条件函数，返回 true 表示满足
 * @param options 超时（ms）、轮询间隔（ms）、日志标签（用于超时警告）
 * @returns 是否在超时前满足条件
 */
export async function pollUntil(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number; label?: string } = {},
): Promise<boolean> {
  const { timeout = 2000, interval = 20, label = "pollUntil" } = options;
  const start = Date.now();
  const maxIterations = Math.ceil(timeout / interval) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  log("warn", "wait", `${label}等待超时`, { timeout });
  return false;
}

/**
 * 辅助函数：等待页面加载。
 * 使用 requestAnimationFrame 与 React 渲染周期对齐，避免 setTimeout 的额外延迟。
 */
export async function waitForPageLoad(): Promise<void> {
  // 等待两帧：确保 React 完成初次渲染（DOM 挂载、useEffect 执行）
  await nextFrame();
  await nextFrame();

  // 轮询验证：等待回调注册完成（最多 500ms）
  const start = Date.now();
  const maxWait = 500;
  const callbacksReady = getCallbacksReady();
  while (Date.now() - start < maxWait) {
    // 只要有任一回调查询接口就绪，认为页面已加载
    if (
      callbacksReady.ziwei ||
      callbacksReady.daliuren ||
      callbacksReady.liuyao ||
      callbacksReady.wiki
    ) {
      log("debug", "wait", "页面加载完成", { elapsed: Date.now() - start });
      return;
    }
    await nextFrame();
  }
  // 超时但不抛错——某些页面可能不注册回调（如纯展示页）
  log("warn", "wait", "页面加载等待超时，继续执行", { maxWait });
}

/**
 * 通用「值稳定」轮询工具——消除 waitForStateUpdate / waitForAstrolabeStable
 * 中重复的「连续 N 次采样相同才认为稳定」模式。
 *
 * 设计要点：
 * - 采样函数每次返回当前快照值（字符串比较）
 * - 连续 requiredStable 次采样相同才认为稳定
 * - 安全保护：最大迭代次数防止无限循环
 *
 * @param getValue 每轮调用的采样函数，返回当前值的字符串表示（null 表示尚未就绪）
 * @param timeout 超时毫秒数
 * @param requiredStable 连续稳定次数阈值（默认 3）
 * @param label 日志标签
 * @returns 是否成功稳定
 */
async function waitForStableValue(
  getValue: () => string | null,
  timeout: number,
  requiredStable = 3,
  label = "值稳定",
): Promise<boolean> {
  const start = Date.now();
  let lastValue = getValue();
  let stableCount = 0;
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 20));
    const currentValue = getValue();
    if (currentValue !== null && currentValue === lastValue) {
      stableCount++;
      if (stableCount >= requiredStable) return true;
    } else {
      lastValue = currentValue;
      stableCount = 0;
    }
  }
  log("warn", "wait", `${label}等待超时`, { timeout });
  return false;
}

/**
 * 辅助函数：等待状态更新。
 * 双 rAF 确保 React 渲染完成，再轮询验证 pick 稳定（最多 300ms）。
 * 要求 pick 连续 3 次采样相同才认为已稳定，避免振荡场景误判。
 *
 * 每次迭代重新调用 getZwds() 获取最新状态，避免使用过期快照。
 */
export async function waitForStateUpdate(): Promise<void> {
  await nextFrame();
  await nextFrame();

  const getZwds = getGetZwds();
  if (!getZwds) return;
  const initialZ = getZwds();
  if (!initialZ) return;

  await waitForStableValue(
    () => {
      const freshZ = getZwds();
      return freshZ ? JSON.stringify(freshZ.pick) : null;
    },
    300,
    3,
    "状态更新",
  );
}

/**
 * 等待人物匹配：轮询验证当前选中人物的 ID 是否符合预期。
 * 替代盲等 100ms，通过检测 _getPerson() 的实际值判断切换是否完成。
 */
export async function waitForPersonMatch(expectedId: number, timeout = 2000): Promise<void> {
  const getPerson = getGetPerson();
  if (!getPerson) {
    log("warn", "wait", "getPerson 回调未注册，跳过人物验证");
    return;
  }
  const start = Date.now();
  const matched = await pollUntil(
    () => {
      const person = getPerson();
      return !!(person && person.id === expectedId);
    },
    { timeout, label: "人物匹配" },
  );
  if (matched) {
    log("debug", "wait", "人物匹配成功", { expectedId, elapsed: Date.now() - start });
  } else {
    log("warn", "wait", "人物匹配等待超时", { expectedId, timeout });
  }
}

/**
 * 等待本命盘稳定：轮询验证 astrolabe 是否已完成更新。
 * 替代盲等 200ms，通过检测 astrolabe 的 rawDates 是否变化判断排盘是否完成。
 *
 * 每次迭代重新调用 getZwds() 获取最新状态，避免使用过期快照。
 */
export async function waitForAstrolabeStable(_z: Zwds, timeout = 2000): Promise<void> {
  const getZwds = getGetZwds();
  const start = Date.now();
  const stable = await waitForStableValue(
    () => {
      const freshZ = getZwds?.() ?? _z;
      return freshZ.astrolabe ? JSON.stringify(freshZ.astrolabe.rawDates) : null;
    },
    timeout,
    3,
    "本命盘稳定",
  );
  if (stable) {
    log("debug", "wait", "本命盘稳定", { elapsed: Date.now() - start });
  }
}

/**
 * 等待 pick 重置：轮询验证 pick 是否已被 useEffect 重置为"今天"。
 * 替代盲等 100ms，通过检测 pick.year/month/day 是否匹配当前日期判断重置是否完成。
 *
 * 每次迭代重新调用 getZwds() 获取最新状态，避免使用过期快照。
 */
export async function waitForPickReset(_z: Zwds, timeout = 1000): Promise<void> {
  const getZwds = getGetZwds();
  const start = Date.now();
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const matched = await pollUntil(
    () => {
      const freshZ = getZwds?.() ?? _z;
      return (
        freshZ.pick.year === todayYear &&
        freshZ.pick.month === todayMonth &&
        freshZ.pick.day === todayDay
      );
    },
    { timeout, label: "pick 重置" },
  );
  if (matched) {
    log("debug", "wait", "pick 已重置为今天", { elapsed: Date.now() - start });
  } else {
    const freshZ = getZwds?.() ?? _z;
    log("warn", "wait", "pick 重置等待超时", { timeout, currentPick: freshZ.pick });
  }
}

/**
 * 等待 pick 匹配预期值（包含版本号校验）。
 * 用于 setHoroscopeTime 后验证 pick 是否成功设置。
 *
 * 每次迭代重新调用 getZwds() 获取最新状态，避免使用过期快照。
 */
export async function waitForPickMatch(
  _z: Zwds,
  expected: { year: number; month: number; day: number; hour: number },
  timeout = 300,
): Promise<boolean> {
  const getZwds = getGetZwds();
  return pollUntil(
    () => {
      const freshZ = getZwds?.() ?? _z;
      return (
        freshZ.pick.year === expected.year &&
        freshZ.pick.month === expected.month &&
        freshZ.pick.day === expected.day &&
        freshZ.pick.hour === expected.hour
      );
    },
    { timeout, label: "pick 匹配" },
  );
}

/**
 * 导航到指定页面并等待回调注册。
 * 统一处理页面跳转和回调等待逻辑。
 *
 * 性能优化：如果已在目标页面，跳过导航和等待。
 * 这是"像人类一样操作 UI"的核心——人类不会在已打开的页面上重新导航。
 */
export async function navigateToPage(
  path: string,
  page: "ziwei" | "daliuren" | "liuyao" | "wiki",
): Promise<void> {
  // 性能优化：如果已在目标页面，跳过导航
  if (uiState.currentPage === path) {
    log("debug", "navigateToPage", "已在目标页面，跳过导航", { path });
    return;
  }

  const navigate = getNavigate();
  if (navigate) {
    navigate(path);
  }

  // 等待页面加载（最小延时 + 回调就绪检查）
  await waitForPageLoad();

  // 等待对应页面的回调注册完成
  // 使用 requestAnimationFrame 与 React 渲染周期对齐，避免 setTimeout 的额外延迟
  const callbacksReady = getCallbacksReady();
  const start = Date.now();
  const maxWait = 1000;

  while (!callbacksReady[page]) {
    if (Date.now() - start > maxWait) {
      log("warn", "wait", `${page} 页面回调注册等待超时`, { path });
      break;
    }
    // 使用 nextFrame 与浏览器渲染周期对齐
    await nextFrame();
  }

  // 更新 UI 状态追踪
  uiState.currentPage = path;
  // 页面切换后，人物和记录选择状态失效
  uiState.currentPersonId = null;
  uiState.currentWikiDocId = null;
  uiState.currentDaLiuRenRecordId = null;
  uiState.currentLiuyaoRecordId = null;
}

/**
 * 选择人物并等待状态更新完成。
 * 统一处理人物切换和状态验证逻辑。
 *
 * selectPerson 回调使用 flushSync 强制同步渲染，
 * 因此 await selectPerson() 返回时，React 状态已更新完成，无需轮询。
 */
export async function selectPersonAndWait(personId: number): Promise<void> {
  // 性能优化：如果已选中目标人物，跳过选择
  if (uiState.currentPersonId === personId) {
    log("debug", "selectPersonAndWait", "已选中目标人物，跳过选择", { personId });
    return;
  }

  const selectPerson = getSelectPerson();
  if (!selectPerson) {
    throw new Error("selectPerson 回调未注册");
  }

  // selectPerson 使用 flushSync，返回时 React 状态已同步更新
  await selectPerson(personId);

  // 等待一帧确保所有 useEffect 和事件监听器已执行
  await nextFrame();

  // 更新 UI 状态追踪
  uiState.currentPersonId = personId;
}

/** 等待 Dialog 准备就绪（DOM 渲染完成） */
export async function waitForDialogReady(): Promise<void> {
  // 双 rAF 确保 Dialog 动画/渲染完成
  await nextFrame();
  await nextFrame();
  // 额外等待 50ms 确保 Dialog 完全就绪
  await new Promise(r => setTimeout(r, 50));
}

/**
 * 等待指定页面回调注册完成的通用实现。
 * 统一三个页面专属等待函数的轮询逻辑，用 nextFrame 替代 setTimeout(50ms) 减少延迟。
 */
async function waitPageCallbacks(
  page: "daliuren" | "liuyao" | "wiki",
  label: string,
  timeout: number,
): Promise<void> {
  const start = Date.now();
  const callbacksReady = getCallbacksReady();
  while (!callbacksReady[page]) {
    if (Date.now() - start > timeout) {
      log("warn", "wait", `${label}回调注册等待超时`, { timeout });
      break;
    }
    await nextFrame();
  }
}

/** 等待大六壬回调注册完成 */
export function waitForDaLiuRenCallbacks(timeout = 1000): Promise<void> {
  return waitPageCallbacks("daliuren", "大六壬", timeout);
}

/** 等待六爻回调注册完成 */
export function waitForLiuyaoCallbacks(timeout = 1000): Promise<void> {
  return waitPageCallbacks("liuyao", "六爻", timeout);
}

/**
 * 等待持久化操作完成——通用延时等待 DB 写入。
 *
 * 提取 waitForRecordSaved / waitForDocSaved 的公共逻辑：
 * 两者仅差一个日志标签和 ID 字段名，合并后消除重复代码。
 *
 * @param id 记录/文档 ID（null/undefined 时跳过等待）
 * @param label 日志标签（如 "记录" / "文档"）
 * @param idKey 日志中 ID 字段的键名（如 "recordId" / "docId"）
 * @param timeout 超时上限（实际等待取 min(timeout, 100ms)）
 */
async function waitForPersist(
  id: number | undefined,
  label: string,
  idKey: string,
  timeout = 2000,
): Promise<void> {
  if (id == null) return;
  await new Promise(r => setTimeout(r, Math.min(timeout, 100)));
  log("debug", "wait", `${label}保存等待完成`, { [idKey]: id });
}

/** 等待记录保存完成（大六壬/六爻起课记录） */
export function waitForRecordSaved(recordId: number | undefined, timeout = 2000): Promise<void> {
  return waitForPersist(recordId, "记录", "recordId", timeout);
}

/** 等待 Wiki 回调注册完成 */
export function waitForWikiCallbacks(timeout = 1000): Promise<void> {
  return waitPageCallbacks("wiki", "Wiki", timeout);
}

/** 等待文档保存完成（Wiki 文档） */
export function waitForDocSaved(docId: number | undefined, timeout = 2000): Promise<void> {
  return waitForPersist(docId, "文档", "docId", timeout);
}

/**
 * 检查 Dialog 是否已打开（通过检查对应回调是否存在）。
 *
 * 使用查找表替代 if/else 链——新增页面类型只需扩展 map，无需改动函数体。
 */
const _dialogGetters: Record<"daliuren" | "liuyao" | "wiki", () => unknown> = {
  daliuren: () => getOpenCreateDialog(),
  liuyao: () => getOpenLiuyaoCreateDialog(),
  wiki: () => getOpenWikiEditor(),
};

export function isDialogOpen(type: "daliuren" | "liuyao" | "wiki"): boolean {
  return !!_dialogGetters[type]();
}

/**
 * 通用元数据更新辅助函数——提取 UpdateTags/UpdateNote 的公共逻辑。
 *
 * 设计原则：
 * - 单一职责：仅处理「获取记录 → 验证存在性 → 更新字段 → 保存 → 失效缓存」的通用流程
 * - 泛型支持：适用于大六壬（LiurenRecord）和六爻（LiuyaoRecord）
 * - 错误处理统一：记录不存在时抛出 NOT_FOUND 错误
 * - 参数收敛：7 个位置参数合并为 recordId + options 对象，消除 max-params 警告
 */
export async function updateRecordMetadata<T extends { id?: number }>(
  recordId: number,
  options: {
    getRecord: (id: number) => Promise<T | null | undefined>;
    saveRecord: (record: T) => Promise<unknown>;
    updateFn: (record: T) => T;
    invalidateCache?: () => void;
    ErrorClass?: ErrorConstructor;
    source?: string;
  },
): Promise<T> {
  const {
    getRecord,
    saveRecord,
    updateFn,
    invalidateCache,
    ErrorClass,
    source = "updateRecordMetadata",
  } = options;
  // 获取记录
  const record = await getRecord(recordId);
  if (!record) {
    const errMsg = `记录 ${recordId} 不存在`;
    const suggestion = "请检查记录 ID 是否正确。可调用对应的 List 接口查看可用记录";
    if (ErrorClass) {
      throw new ErrorClass(errMsg, source, {
        context: { recordId },
        suggestion,
        errorCode: "NOT_FOUND",
      });
    }
    throw new Error(errMsg);
  }

  // 更新字段并保存
  const updated = updateFn(record);
  await saveRecord(updated);

  // 失效缓存（如果提供）
  if (invalidateCache) {
    invalidateCache();
  }

  log("info", source, "元数据更新成功", { recordId });
  return updated;
}

/**
 * 统一错误处理包装器——消除 debugApi 函数中重复的 try/catch/stop/wrapError 样板代码。
 *
 * 使用前后对比：
 * ```ts
 * // 使用前（每个函数都重复此模式）
 * export async function Foo(params) {
 *   const stop = timer("Foo");
 *   try {
 *     // ... 业务逻辑
 *     stop();
 *     return result;
 *   } catch (err) {
 *     if (err instanceof FooError) { stop(); throw err; }
 *     stop();
 *     throw wrapError("Foo", err, FooError);
 *   }
 * }
 *
 * // 使用后
 * export function Foo(params) {
 *   return withErrorHandling("Foo", FooError, () => {
 *     // ... 业务逻辑
 *     return result;
 *   });
 * }
 * ```
 *
 * 职责：
 * - 自动启动/停止计时器
 * - 已是指定错误类子类时直接抛出（保留原始上下文）
 * - 其他错误统一用 wrapError 包装
 *
 * @param label 来源标签（用于计时和错误消息）
 * @param ErrorClass 错误类构造函数
 * @param fn 业务逻辑（同步或异步）
 * @returns fn 的返回值
 */
export async function withErrorHandling<T, E extends BaseDebugError>(
  label: string,
  ErrorClass: ErrorConstructor<E>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const stop = timer(label);
  try {
    const result = await fn();
    stop();
    return result;
  } catch (err) {
    stop();
    if (err instanceof ErrorClass) throw err;
    throw wrapError(label, err, ErrorClass);
  }
}

/**
 * 同步版错误处理包装器——用于纯计算等同步函数。
 *
 * 与 withErrorHandling 语义相同，但不引入 Promise 开销，
 * 保持调用签名为同步（如 computeDaLiuRenData 等纯计算接口）。
 *
 * @param label 来源标签
 * @param ErrorClass 错误类构造函数
 * @param fn 同步业务逻辑
 * @returns fn 的返回值
 */
export function withErrorHandlingSync<T, E extends BaseDebugError>(
  label: string,
  ErrorClass: ErrorConstructor<E>,
  fn: () => T,
): T {
  const stop = timer(label);
  try {
    const result = fn();
    stop();
    return result;
  } catch (err) {
    stop();
    if (err instanceof ErrorClass) throw err;
    throw wrapError(label, err, ErrorClass);
  }
}
