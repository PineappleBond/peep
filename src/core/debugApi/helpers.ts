/**
 * 调试 API 辅助函数
 *
 * 提供等待页面加载、状态验证等辅助工具
 */

import type { Zwds } from "../useZwds";
import { log } from "./logger";
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

/** 等待下一帧（确保 useEffect commit 阶段执行完成）
 *  兼容非浏览器环境（SSR/Node.js）：requestAnimationFrame 不可用时降级为 setTimeout(16ms)
 */
export function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "undefined") {
    return new Promise(r => requestAnimationFrame(_ts => r()));
  }
  // 降级：约 60fps（1000ms / 60 ≈ 16ms）
  return new Promise(r => setTimeout(r, 16));
}

/**
 * 辅助函数：等待页面加载。
 * 改进：轮询验证回调就绪状态（而非盲等 200ms），但保留最小延时确保 DOM 初次渲染完成。
 */
export async function waitForPageLoad(): Promise<void> {
  // 最小延时：确保 React 完成初次渲染（DOM 挂载、useEffect 执行）
  await new Promise(r => setTimeout(r, 50));

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
    await new Promise(r => setTimeout(r, 20));
  }
  // 超时但不抛错——某些页面可能不注册回调（如纯展示页）
  log("warn", "wait", "页面加载等待超时，继续执行", { maxWait });
}

/**
 * 辅助函数：等待状态更新。
 * 改进：双 rAF 确保 React 渲染完成，再轮询验证 pick 稳定（最多 300ms）。
 * 要求 pick 连续 3 次采样相同才认为已稳定，避免振荡场景误判。
 *
 * 每次迭代重新调用 getZwds() 获取最新状态，避免使用过期快照。
 */
export async function waitForStateUpdate(): Promise<void> {
  // 双 rAF 确保 React commit 阶段完成（使用 nextFrame 兼容非浏览器环境）
  await nextFrame();
  await nextFrame();

  // 轮询验证 pick 稳定（如果在 ZiWei 上下文中）
  const getZwds = getGetZwds();
  if (!getZwds) return;
  const initialZ = getZwds();
  if (!initialZ) return;

  const start = Date.now();
  let lastPick = JSON.stringify(initialZ.pick);
  let stableCount = 0;
  const requiredStable = 3; // 连续 3 次采样相同才认为已稳定（防止振荡误判）
  const maxWait = 300;
  // 安全保护：最大迭代次数，防止超时判断延迟导致无限循环
  const maxIterations = Math.ceil(maxWait / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 20));
    // 每次迭代重新获取最新 Zwds 状态，避免快照过期
    const freshZ = getZwds();
    if (!freshZ) continue;
    const currentPick = JSON.stringify(freshZ.pick);
    if (currentPick === lastPick) {
      stableCount++;
      if (stableCount >= requiredStable) {
        // pick 连续 N 次采样相同，认为已稳定
        return;
      }
    } else {
      lastPick = currentPick;
      stableCount = 0; // 重置计数
    }
  }
  log("warn", "wait", "状态更新等待超时", { maxWait });
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
  // 安全保护：最大迭代次数，防止超时判断延迟导致无限循环
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    const person = getPerson();
    if (person && person.id === expectedId) {
      log("debug", "wait", "人物匹配成功", {
        expectedId,
        elapsed: Date.now() - start,
      });
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  log("warn", "wait", "人物匹配等待超时", { expectedId, timeout });
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
  // 首次获取 astrolabe（优先使用最新快照，回退到 getZwds）
  let lastAstrolabe = _z.astrolabe ? JSON.stringify(_z.astrolabe.rawDates) : null;
  let stableCount = 0;
  const requiredStable = 3;
  // 安全保护：最大迭代次数
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 20));
    // 每次迭代重新获取最新 Zwds 状态，避免快照过期
    const freshZ = getZwds?.() ?? _z;
    const currentAstrolabe = freshZ.astrolabe ? JSON.stringify(freshZ.astrolabe.rawDates) : null;
    if (currentAstrolabe === lastAstrolabe && currentAstrolabe !== null) {
      stableCount++;
      if (stableCount >= requiredStable) {
        log("debug", "wait", "本命盘稳定", { elapsed: Date.now() - start });
        return;
      }
    } else {
      lastAstrolabe = currentAstrolabe;
      stableCount = 0;
    }
  }
  log("warn", "wait", "本命盘稳定等待超时", { timeout });
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
  // 安全保护：最大迭代次数
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    // 每次迭代重新获取最新 Zwds 状态，避免快照过期
    const freshZ = getZwds?.() ?? _z;
    if (
      freshZ.pick.year === todayYear &&
      freshZ.pick.month === todayMonth &&
      freshZ.pick.day === todayDay
    ) {
      log("debug", "wait", "pick 已重置为今天", { elapsed: Date.now() - start });
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  const freshZ = getZwds?.() ?? _z;
  log("warn", "wait", "pick 重置等待超时", { timeout, currentPick: freshZ.pick });
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
  const start = Date.now();
  // 安全保护：最大迭代次数
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (++iterations <= maxIterations && Date.now() - start < timeout) {
    // 每次迭代重新获取最新 Zwds 状态，避免快照过期
    const freshZ = getZwds?.() ?? _z;
    if (
      freshZ.pick.year === expected.year &&
      freshZ.pick.month === expected.month &&
      freshZ.pick.day === expected.day &&
      freshZ.pick.hour === expected.hour
    ) {
      return true;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  return false;
}

/**
 * 导航到指定页面并等待回调注册。
 * 统一处理页面跳转和回调等待逻辑。
 */
export async function navigateToPage(
  path: string,
  page: "ziwei" | "daliuren" | "liuyao" | "wiki",
): Promise<void> {
  const navigate = getNavigate();
  if (navigate) {
    navigate(path);
  }
  await waitForPageLoad();
  // 等待对应页面的回调注册完成
  const callbacksReady = getCallbacksReady();
  const start = Date.now();
  while (!callbacksReady[page]) {
    if (Date.now() - start > 1000) {
      log("warn", "wait", `${page} 页面回调注册等待超时`, { path });
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/**
 * 选择人物并等待状态更新完成。
 * 统一处理人物切换和状态验证逻辑。
 */
export async function selectPersonAndWait(personId: number): Promise<void> {
  const selectPerson = getSelectPerson();
  if (!selectPerson) {
    throw new Error("selectPerson 回调未注册");
  }
  await selectPerson(personId);
  await waitForPersonMatch(personId, 2000);
  const getZwds = getGetZwds();
  if (getZwds) {
    const z = getZwds();
    if (z) {
      await waitForAstrolabeStable(z, 2000);
    }
  }
  await nextFrame();
}

/** 等待 Dialog 准备就绪（DOM 渲染完成） */
export async function waitForDialogReady(): Promise<void> {
  // 双 rAF 确保 Dialog 动画/渲染完成
  await nextFrame();
  await nextFrame();
  // 额外等待 50ms 确保 Dialog 完全就绪
  await new Promise(r => setTimeout(r, 50));
}

/** 等待大六壬回调注册完成 */
export async function waitForDaLiuRenCallbacks(timeout = 1000): Promise<void> {
  const start = Date.now();
  const callbacksReady = getCallbacksReady();
  while (!callbacksReady.daliuren) {
    if (Date.now() - start > timeout) {
      log("warn", "wait", "大六壬回调注册等待超时", { timeout });
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/** 等待六爻回调注册完成 */
export async function waitForLiuyaoCallbacks(timeout = 1000): Promise<void> {
  const start = Date.now();
  const callbacksReady = getCallbacksReady();
  while (!callbacksReady.liuyao) {
    if (Date.now() - start > timeout) {
      log("warn", "wait", "六爻回调注册等待超时", { timeout });
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/** 等待记录保存完成（通过验证记录 ID 存在） */
export async function waitForRecordSaved(
  recordId: number | undefined,
  timeout = 2000,
): Promise<void> {
  if (recordId == null) return;
  // 简单延时等待 DB 写入完成
  await new Promise(r => setTimeout(r, Math.min(timeout, 100)));
  log("debug", "wait", "记录保存等待完成", { recordId });
}

/** 等待 Wiki 回调注册完成 */
export async function waitForWikiCallbacks(timeout = 1000): Promise<void> {
  const start = Date.now();
  const callbacksReady = getCallbacksReady();
  while (!callbacksReady.wiki) {
    if (Date.now() - start > timeout) {
      log("warn", "wait", "Wiki 回调注册等待超时", { timeout });
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/** 等待文档保存完成 */
export async function waitForDocSaved(docId: number | undefined, timeout = 2000): Promise<void> {
  if (docId == null) return;
  // 简单延时等待 DB 写入完成
  await new Promise(r => setTimeout(r, Math.min(timeout, 100)));
  log("debug", "wait", "文档保存等待完成", { docId });
}

/**
 * 检查 Dialog 是否已打开（通过检查 openCreateDialog/openLiuyaoCreateDialog/openWikiEditor 回调）
 */
export function isDialogOpen(type: "daliuren" | "liuyao" | "wiki"): boolean {
  if (type === "daliuren") {
    return !!getOpenCreateDialog();
  }
  if (type === "liuyao") {
    return !!getOpenLiuyaoCreateDialog();
  }
  return !!getOpenWikiEditor();
}
