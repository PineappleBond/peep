/**
 * 调试 API - 系统级接口
 *
 * 包含：version, env, health, help, getCacheStats, clearCaches, getInternalPeepApi, initDebugApi
 */

import type { Person } from "./types";
import type { ApiMetadata } from "./types";
import { API_VERSION } from "./types";
import { VALID_SCOPES } from "./validate";
import { listPersons, getDefaultPerson } from "../personDb";
import { clearHbarCaches } from "../hbar";
import { getAllCacheStats, clearAllCaches, type CacheStats } from "../cache";
import { getChartDataForScope } from "../analysis";
import { log } from "./logger";
import { getCallbacksReady, resetCallbacks } from "./callbacks";
import { resetLogLevel, getLogLevel } from "./logger";
import { dumpStateToConsole, getAllStateSnapshots } from "../stateDebug";
import {
  enableRenderTracker,
  getRenderRecords,
  getRenderSummary,
  clearRenderRecords,
  isRenderTrackerEnabled,
} from "../renderTracker";
import {
  enableStateWatch,
  getStateChanges,
  getStateChangesByName,
  getStateChangeSummary,
  clearStateChanges,
  isStateWatchEnabled,
  dumpStateChanges,
} from "../stateWatch";
import { setLastAction } from "../errorTracking";
import {
  clearAstrolabeCache,
  computeAstrolabe,
  ZiWei,
  computeZiWeiData,
  computeScopeData,
  GetScopeData,
} from "./ziwei";
import {
  DaLiuRen,
  computeDaLiuRenData,
  DaLiuRenCreate,
  DaLiuRenList,
  DaLiuRenView,
} from "./daliuren";
import { WikiList, WikiCreate, WikiView } from "./wiki";
import { PersonList, PersonGet, PersonCreate, PersonUpdate, PersonDelete } from "./person";
import type { LogLevel } from "./logger";

/**
 * 公开调试 API 说明：自动枚举 window.peep 时的签名/说明描述。
 * 新增 API 时：只需在此表追加一行；version() 会自动从 window.peep 枚举并过滤内部方法。
 * 内部方法（resetDebugApi/setLogLevel/getCacheStats/clearCaches/version）不在此表，自动被过滤。
 */
const API_DESCRIPTIONS: Record<string, { 方法: string; 说明: string }> = {
  PersonList: { 方法: "PersonList()", 说明: "人物列表" },
  PersonGet: { 方法: "PersonGet(personId?)", 说明: "获取人物详情（不传返回默认）" },
  PersonCreate: { 方法: "PersonCreate(input)", 说明: "创建人物" },
  PersonUpdate: { 方法: "PersonUpdate(personId, input)", 说明: "更新人物" },
  PersonDelete: { 方法: "PersonDelete(personId)", 说明: "删除人物" },
  ZiWei: { 方法: "ZiWei(personId?, scope?, time?)", 说明: "紫微斗数排盘+运限操控" },
  GetScopeData: { 方法: "GetScopeData(solarDate, personId?)", 说明: "获取运限数据（纯计算）" },
  computeScopeData: {
    方法: "computeScopeData(person, solarDate)",
    说明: "计算运限数据（纯计算，同步）",
  },
  computeZiWeiData: {
    方法: "computeZiWeiData(z, scope?)",
    说明: "从 Zwds 状态提取 hbar/chart 数据（纯计算）",
  },
  DaLiuRen: { 方法: "DaLiuRen(date, time, fateInput?)", 说明: "大六壬纯计算排盘（向后兼容）" },
  computeDaLiuRenData: {
    方法: "computeDaLiuRenData(date, time, fateInput?)",
    说明: "大六壬纯计算排盘（推荐）",
  },
  DaLiuRenCreate: {
    方法: "DaLiuRenCreate(params, options?)",
    说明: "大六壬起课（创建记录；options.skipUI 仅供调试）",
  },
  DaLiuRenList: {
    方法: "DaLiuRenList(params, options?)",
    说明: "大六壬起课列表（options.skipUI 仅供调试）",
  },
  DaLiuRenView: {
    方法: "DaLiuRenView(params, options?)",
    说明: "大六壬起课详情（options.skipUI 仅供调试）",
  },
  WikiCreate: {
    方法: "WikiCreate(params, options?)",
    说明: "Wiki 文档创建（options.skipUI 仅供调试）",
  },
  WikiList: {
    方法: "WikiList(params, options?)",
    说明: "Wiki 文档列表（options.skipUI 仅供调试）",
  },
  WikiView: {
    方法: "WikiView(params, options?)",
    说明: "Wiki 文档详情（options.skipUI 仅供调试）",
  },
  getChartDataForScope: {
    方法: "getChartDataForScope(opts)",
    说明: "获取指定 scope 的运限盘面数据",
  },
  getApiMetadata: {
    方法: "getApiMetadata()",
    说明: "获取 API 元数据（版本、可用函数、支持的运限级别）",
  },
  dumpState: {
    方法: "dumpState()",
    说明: "打印当前所有已注册的状态快照到控制台（仅 DEV）",
  },
  getStateSnapshots: {
    方法: "getStateSnapshots()",
    说明: "获取当前所有已注册的状态快照数组（仅 DEV）",
  },
  renderStats: {
    方法: "renderStats(enable?)",
    说明: "组件渲染追踪：传入 true/false 控制开关，不传查看统计（仅 DEV）",
  },
  stateChanges: {
    方法: "stateChanges(arg?)",
    说明: "状态变更追踪：true/false 控制开关，字符串按状态名过滤，不传查看全部（仅 DEV）",
  },
  profile: {
    方法: "profile(enable?)",
    说明: "综合性能分析开关（渲染追踪 + 状态追踪），不传查看当前状态（仅 DEV）",
  },
  setLastAction: {
    方法: "setLastAction(action)",
    说明: "记录最近用户操作（供错误上下文使用，5 秒后自动清除）",
  },
  dumpStateChanges: {
    方法: "dumpStateChanges(limit?)",
    说明: "打印最近状态变更到控制台（默认 20 条）",
  },
};

/** 内部方法：version() 自动枚举时过滤掉，不展示给普通用户 */
const INTERNAL_METHODS = new Set([
  "resetDebugApi",
  "setLogLevel",
  "getCacheStats",
  "clearCaches",
  "version",
  "env",
  "health",
  "help",
]);

/* ── 开发者体验改进 API ── */

/**
 * 渲染追踪控制：启用/禁用组件渲染追踪，或查看渲染统计。
 *
 * @example
 * ```js
 * peep.renderStats(true);   // 启用追踪
 * peep.renderStats();       // 查看统计
 * peep.renderStats(false);  // 关闭
 * ```
 */
export function renderStats(enable?: boolean): unknown {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，renderStats() 不可用", "color:#f44336", "");
    return undefined;
  }

  if (typeof enable === "boolean") {
    enableRenderTracker(enable);
    return undefined;
  }

  const summary = getRenderSummary();
  const records = getRenderRecords();
  const isEnabled = isRenderTrackerEnabled();

  // eslint-disable-next-line no-console
  console.group(
    `%c[peep] 渲染统计%c（${isEnabled ? "已启用" : "已禁用"}）`,
    "color:#2196f3;font-weight:bold",
    "",
  );

  if (Object.keys(summary).length === 0) {
    // eslint-disable-next-line no-console
    console.log("暂无渲染记录。" + (isEnabled ? "" : "调用 renderStats(true) 启用追踪。"));
  } else {
    // eslint-disable-next-line no-console
    console.table(
      Object.entries(summary).map(([name, s]) => ({
        组件: name,
        渲染次数: s.count,
        平均耗时: `${s.avgDuration.toFixed(2)}ms`,
        最大耗时: `${s.maxDuration.toFixed(2)}ms`,
      })),
    );

    const slowRenders = records.filter(r => r.duration > 16);
    if (slowRenders.length > 0) {
       
      console.warn(`%c慢渲染（>16ms）: ${slowRenders.length} 次`, "color:#ff9800;font-weight:bold");
      // eslint-disable-next-line no-console
      console.table(
        slowRenders.slice(-10).map(r => ({
          组件: r.component,
          耗时: `${r.duration.toFixed(2)}ms`,
          props变更: r.propsChanged ? r.propsDiff : "-",
          时间: new Date(r.timestamp).toLocaleTimeString(),
        })),
      );
    }

    const highFreq = Object.entries(summary).filter(([, s]) => s.count > 10);
    if (highFreq.length > 0) {
       
      console.warn(
        `%c高频渲染（>10次）: ${highFreq.length} 个组件`,
        "color:#ff9800;font-weight:bold",
      );
    }
  }

  // eslint-disable-next-line no-console
  console.groupEnd();

  return { summary, enabled: isEnabled, totalRecords: records.length };
}

/**
 * 状态变更追踪：查看状态变更记录或控制追踪开关。
 *
 * @example
 * ```js
 * peep.stateChanges(true);       // 启用追踪
 * peep.stateChanges();           // 查看全部变更
 * peep.stateChanges("pick");     // 按状态名过滤
 * peep.stateChanges(false);      // 关闭
 * ```
 */
export function stateChanges(arg?: boolean | string): unknown {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，stateChanges() 不可用", "color:#f44336", "");
    return undefined;
  }

  if (typeof arg === "boolean") {
    enableStateWatch(arg);
    return undefined;
  }

  const isEnabled = isStateWatchEnabled();

  // eslint-disable-next-line no-console
  console.group(
    `%c[peep] 状态变更追踪%c（${isEnabled ? "已启用" : "已禁用"}）`,
    "color:#2196f3;font-weight:bold",
    "",
  );

  if (typeof arg === "string") {
    const changes = getStateChangesByName(arg);
    if (changes.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        `无 "${arg}" 相关的变更记录。` + (isEnabled ? "" : "调用 stateChanges(true) 启用。"),
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`"${arg}" 共 ${changes.length} 次变更：`);
      // eslint-disable-next-line no-console
      console.table(
        changes.map(c => ({
          来源: c.source,
          时间: new Date(c.timestamp).toLocaleTimeString(),
          前值: c.prevValue,
          后值: c.nextValue,
          原因: c.reason ?? "-",
        })),
      );
    }
  } else {
    const summary = getStateChangeSummary();
    const changes = getStateChanges();

    if (Object.keys(summary).length === 0) {
      // eslint-disable-next-line no-console
      console.log("暂无状态变更记录。" + (isEnabled ? "" : "调用 stateChanges(true) 启用。"));
    } else {
      // eslint-disable-next-line no-console
      console.log("变更摘要：");
      // eslint-disable-next-line no-console
      console.table(
        Object.entries(summary).map(([name, s]) => ({
          状态: name,
          变更次数: s.count,
          最近来源: s.lastSource,
          最近时间: new Date(s.lastChange).toLocaleTimeString(),
        })),
      );

      // eslint-disable-next-line no-console
      console.log(`最近 ${Math.min(changes.length, 10)} 条详情：`);
      // eslint-disable-next-line no-console
      console.table(
        changes.slice(-10).map(c => ({
          状态: c.name,
          来源: c.source,
          时间: new Date(c.timestamp).toLocaleTimeString(),
          前值: c.prevValue,
          后值: c.nextValue,
        })),
      );
    }
  }

  // eslint-disable-next-line no-console
  console.groupEnd();

  return {
    summary: getStateChangeSummary(),
    enabled: isEnabled,
    totalChanges: getStateChanges().length,
  };
}

/**
 * 综合性能分析开关——同时启用渲染追踪 + 状态追踪。
 *
 * @example
 * ```js
 * peep.profile(true);   // 启用全面性能分析
 * peep.profile(false);  // 关闭
 * peep.profile();       // 查看当前状态与统计
 * ```
 */
export function profile(enable?: boolean): unknown {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，profile() 不可用", "color:#f44336", "");
    return undefined;
  }

  if (typeof enable === "boolean") {
    enableRenderTracker(enable);
    enableStateWatch(enable);
    // eslint-disable-next-line no-console
    console.log(
      `%c[peep]%c 性能分析${enable ? "已全部启用（渲染追踪 + 状态追踪）" : "已关闭"}`,
      "color:#4caf50;font-weight:bold",
      "",
    );
    return undefined;
  }

  // eslint-disable-next-line no-console
  console.group("%c[peep] 性能分析状态", "color:#2196f3;font-weight:bold");
  // eslint-disable-next-line no-console
  console.log("渲染追踪:", isRenderTrackerEnabled() ? "✓ 启用" : "✗ 禁用");
  // eslint-disable-next-line no-console
  console.log("状态追踪:", isStateWatchEnabled() ? "✓ 启用" : "✗ 禁用");
  // eslint-disable-next-line no-console
  console.log(
    "提示: 调用 profile(true) 启用全部追踪，或分别使用 renderStats(true) / stateChanges(true)",
  );
  // eslint-disable-next-line no-console
  console.groupEnd();

  return {
    renderTracker: isRenderTrackerEnabled(),
    stateWatch: isStateWatchEnabled(),
  };
}

/**
 * 获取 API 元数据——版本、可用函数列表、支持的运限级别。
 * 供 AI 判断 API 兼容性和能力边界。
 *
 * @returns API 元数据对象
 *
 * @example
 * ```typescript
 * const meta = window.peep.getApiMetadata();
 * console.log("API 版本:", meta.version);
 * console.log("可用函数:", meta.availableFunctions);
 * ```
 */
export function getApiMetadata(): ApiMetadata {
  return {
    version: API_VERSION,
    availableFunctions: Object.keys(API_DESCRIPTIONS),
    supportedScopes: [...VALID_SCOPES],
  };
}

/**
 * 版本信息打印——在控制台快速查看当前部署版本/构建时间/可用 API。
 * 启动调试时的第一个调用建议。
 *
 * 改进：从 window.peep 自动枚举公开 API key，过滤内部方法，
 * 避免新增 API 时忘记更新此列表导致文档与实际不一致。
 */
export function version(): void {
  // eslint-disable-next-line no-console
  console.log(
    `%c[peep]%c 版本 ${__PEEP_VERSION__}  构建于 ${__PEEP_BUILD_TIME__}`,
    "color:#2196f3;font-weight:bold",
    "",
  );
  // eslint-disable-next-line no-console
  console.log("%c[peep]%c 可用调试 API:", "color:#2196f3;font-weight:bold", "");

  const peep = window.peep;
  if (!peep) return;

  // 自动枚举 window.peep 的 key，过滤内部方法，从 API_DESCRIPTIONS 取说明
  const table = Object.keys(peep)
    .filter(key => !INTERNAL_METHODS.has(key))
    .map(key => API_DESCRIPTIONS[key] ?? { 方法: `${key}(...)`, 说明: "（请查阅源码）" });

  // eslint-disable-next-line no-console
  console.table(table);
}

/**
 * 环境信息：快速查看当前运行环境、配置、状态。
 * 用于排查"为什么我的代码不生效""是不是部署错了"等环境问题。
 */
export function env(): void {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，env() 不可用", "color:#f44336", "");
    return;
  }

  // eslint-disable-next-line no-console
  console.group("%c[peep] 环境信息", "color:#2196f3;font-weight:bold");

  // 基础信息
  // eslint-disable-next-line no-console
  console.log(
    "%c版本/构建:%c",
    "color:#ff9800;font-weight:bold",
    "",
    `${__PEEP_VERSION__} @ ${__PEEP_BUILD_TIME__}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    "%c运行模式:%c",
    "color:#ff9800;font-weight:bold",
    "",
    `${import.meta.env.MODE} (DEV=${import.meta.env.DEV}, PROD=${import.meta.env.PROD})`,
  );
  // eslint-disable-next-line no-console
  console.log("%cBase URL:%c", "color:#ff9800;font-weight:bold", "", import.meta.env.BASE_URL);
  // eslint-disable-next-line no-console
  console.log("%c当前 URL:%c", "color:#ff9800;font-weight:bold", "", window.location.href);
  // eslint-disable-next-line no-console
  console.log("%cUser Agent:%c", "color:#ff9800;font-weight:bold", "", navigator.userAgent);

  // 回调状态
  // eslint-disable-next-line no-console
  console.log("%c回调就绪状态:%c", "color:#ff9800;font-weight:bold", "", {
    ...getCallbacksReady(),
  });

  // 日志级别
  // eslint-disable-next-line no-console
  console.log("%c当前日志级别:%c", "color:#ff9800;font-weight:bold", "", getLogLevel());

  // IndexedDB 状态（异步检测）
  if (typeof indexedDB !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("%cIndexedDB:%c", "color:#ff9800;font-weight:bold", "", "可用");
  } else {
    // eslint-disable-next-line no-console
    console.log("%cIndexedDB:%c", "color:#f44336;font-weight:bold", "", "不可用（隐私模式？）");
  }

  // 内存信息（如果浏览器支持）
  if (
    (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } })
      .memory
  ) {
    const mem = (
      performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }
    ).memory;
    // eslint-disable-next-line no-console
    console.log(
      "%c内存使用:%c",
      "color:#ff9800;font-weight:bold",
      "",
      `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
    );
  }

  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * 健康检查：快速验证核心功能是否正常。
 * 用于调试"为什么排盘失败""数据库是不是挂了"等问题。
 *
 * @returns 检查结果对象（开发模式下也会打印到控制台）
 */
export async function health(): Promise<{
  ok: boolean;
  checks: Record<string, { status: "ok" | "warn" | "fail"; message: string }>;
}> {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，health() 不可用", "color:#f44336", "");
    return { ok: false, checks: {} };
  }

  const checks: Record<string, { status: "ok" | "warn" | "fail"; message: string }> = {};
  let allOk = true;

  // 1. 检查回调注册
  const callbacksReady = getCallbacksReady();
  if (callbacksReady.ziwei && callbacksReady.daliuren && callbacksReady.wiki) {
    checks["回调注册"] = { status: "ok", message: "全部页面回调已就绪" };
  } else {
    checks["回调注册"] = {
      status: "warn",
      message: `部分页面未访问：${Object.entries(callbacksReady)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")}`,
    };
    allOk = false;
  }

  // 2. 检查 IndexedDB 可用性
  try {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB 不可用");
    }
    const dbs = await indexedDB.databases();
    checks["IndexedDB"] = {
      status: "ok",
      message: `已连接，数据库: ${dbs.map(d => d.name).join(", ") || "（空）"}`,
    };
  } catch (err) {
    checks["IndexedDB"] = {
      status: "fail",
      message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
    };
    allOk = false;
  }

  // 3. 检查人物数据
  try {
    const persons = await listPersons();
    if (persons.length === 0) {
      checks["人物数据"] = { status: "warn", message: "数据库为空，请先创建人物" };
    } else {
      const defaultPerson = await getDefaultPerson();
      checks["人物数据"] = {
        status: "ok",
        message: `${persons.length} 个人物，默认人物: ${defaultPerson.name} (ID=${defaultPerson.id})`,
      };
    }
  } catch (err) {
    checks["人物数据"] = {
      status: "fail",
      message: `查询失败: ${err instanceof Error ? err.message : String(err)}`,
    };
    allOk = false;
  }

  // 4. 检查 iztro 引擎
  try {
    const testPerson: Person = {
      id: -1,
      name: "测试",
      date: "2000-01-01",
      timeIndex: 0,
      gender: "男",
      calendar: "solar",
      isLeapMonth: false,
      exactTime: "",
      useTrueSolar: false,
      placeMode: "china",
      province: "北京",
      city: "北京",
      district: "市区",
      timezone: "",
      algorithm: "default",
      yearDivide: "normal",
      mutagenTable: "default",
      dayDivide: "forward",
      astroType: "heaven",
      residence: "",
      savedAt: Date.now(),
      isDefault: false,
    };
    computeAstrolabe(testPerson);
    checks["iztro 引擎"] = { status: "ok", message: "本命盘计算正常" };
    // 注：测试条目留在缓存中（health check 一次性开销，不值得清缓存）
  } catch (err) {
    checks["iztro 引擎"] = {
      status: "fail",
      message: `计算失败: ${err instanceof Error ? err.message : String(err)}`,
    };
    allOk = false;
  }

  // 5. 检查缓存状态
  const cacheStats = getAllCacheStats();
  const totalHits = Object.values(cacheStats).reduce((sum, s) => sum + s.hits, 0);
  checks["缓存系统"] = {
    status: "ok",
    message: `${Object.keys(cacheStats).length} 个缓存，总命中 ${totalHits} 次`,
  };

  // 打印结果
  // eslint-disable-next-line no-console
  console.group(
    `%c[peep] 健康检查 ${allOk ? "✓ 全部通过" : "⚠ 存在问题"}`,
    `color:${allOk ? "#4caf50" : "#ff9800"};font-weight:bold`,
  );
  for (const [name, result] of Object.entries(checks)) {
    const color =
      result.status === "ok" ? "#4caf50" : result.status === "warn" ? "#ff9800" : "#f44336";
    const icon = result.status === "ok" ? "✓" : result.status === "warn" ? "⚠" : "✗";
    // eslint-disable-next-line no-console
    console.log(`%c${icon} ${name}:%c ${result.message}`, `color:${color};font-weight:bold`, "");
  }
  // eslint-disable-next-line no-console
  console.groupEnd();

  return { ok: allOk, checks };
}

/**
 * 快速帮助：在控制台显示常用命令和示例。
 * 比 version() 更面向新手，包含实际可运行的代码片段。
 */
export function help(): void {
  if (!import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("%c[peep]%c 生产环境，help() 不可用", "color:#f44336", "");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `%c[peep] 调试 API 快速帮助%c\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `入门:\n` +
      `  peep.version()      查看版本和可用 API\n` +
      `  peep.env()          查看环境信息\n` +
      `  peep.health()       健康检查（验证核心功能）\n` +
      `  peep.setLogLevel("debug")  开启详细日志\n` +
      `\n` +
      `紫微斗数:\n` +
      `  await peep.ZiWei()                          默认人物，今天，无运限\n` +
      `  await peep.ZiWei(1, "yearly", "2024-06-15")  指定人物+运限+日期\n` +
      `  await peep.GetScopeData("2024-06-15")        纯计算运限数据\n` +
      `\n` +
      `大六壬:\n` +
      `  peep.computeDaLiuRenData("2024-06-15", "14:30")  纯计算排盘\n` +
      `  await peep.DaLiuRenCreate({ question: "测试" })  创建起课记录\n` +
      `\n` +
      `人物管理:\n` +
      `  await peep.PersonList()                    列出所有人物\n` +
      `  await peep.PersonCreate({ name: "张三", ... })  创建人物\n` +
      `\n` +
      `性能/缓存:\n` +
      `  peep.getCacheStats()    查看缓存命中率\n` +
      `  peep.clearCaches()      清空全部缓存\n` +
      `\n` +
      `开发者体验（v0.1.0+ 新增）:\n` +
      `  peep.profile(true)      启用全面性能分析（渲染+状态追踪）\n` +
      `  peep.renderStats()      查看组件渲染统计\n` +
      `  peep.stateChanges()     查看状态变更记录\n` +
      `  peep.stateChanges("pick")  查看指定状态变更历史\n` +
      `  peep.dumpState()        打印所有状态快照\n` +
      `  peep.dumpStateChanges() 打印最近状态变更\n` +
      `\n` +
      `更多: 查看 docs/debug-api.md 和 docs/dev-guide.md`,
    "color:#2196f3;font-weight:bold",
    "color:#888",
  );
}

/**
 * 性能监控：获取全部缓存统计（命中率/大小/淘汰数）。
 * 开发环境用于定位性能瓶颈；生产环境可用于调试。
 */
export function getCacheStats(): Record<string, CacheStats> {
  return getAllCacheStats();
}

/**
 * 清空全部缓存：调试用，验证缓存是否影响结果正确性。
 * 清空后下次调用会重新计算全部缓存。
 */
export function clearCaches(): void {
  clearAllCaches();
  clearHbarCaches();
  clearAstrolabeCache();
  log("info", "cache", "全部缓存已清空");
}

/**
 * 重置调试 API 全部模块级状态：供测试 teardown 和 HMR cleanup 使用。
 *
 * 清空范围：
 * - 所有回调变量和就绪标志
 * - 当前日志级别（恢复为默认 "info"）
 * - 本命盘缓存
 * - hbar / chartIndex 等外部缓存
 * - 渲染追踪记录
 * - 状态变更记录
 */
export function resetDebugApi(): void {
  // 1. 重置回调状态
  resetCallbacks();

  // 2. 恢复日志级别为默认值
  resetLogLevel();

  // 3. 清空本命盘缓存
  clearAstrolabeCache();

  // 4. 清空外部缓存（hbar / chartIndex 等注册到 cache.ts 的缓存）
  clearAllCaches();
  clearHbarCaches();

  // 5. 清空渲染追踪与状态变更记录（保留开关状态）
  clearRenderRecords();
  clearStateChanges();

  log("info", "init", "调试 API 全部状态已重置");
}

/**
 * 内部 API 通道：供 RTC Agent Function handler 使用，不走 window 全局变量。
 * 包含全部方法（含写操作），生产环境也不暴露到 window.peep。
 */
let _internalPeepApi: NonNullable<Window["peep"]> | null = null;

/**
 * 获取内部 API 入口——RTC Agent handler 调用此函数获取 peep 方法。
 * 优先使用内部通道（_internalPeepApi），降级到 window.peep（开发环境）。
 */
export function getInternalPeepApi(): NonNullable<Window["peep"]> {
  if (_internalPeepApi) return _internalPeepApi;
  if (typeof window !== "undefined" && window.peep) {
    return window.peep as NonNullable<Window["peep"]>;
  }
  throw new Error("调试 API 未初始化：既无内部通道，window.peep 也不存在");
}

/**
 * 初始化调试 API：构建 window.peep 对象。
 * 由 App.tsx 在启动时调用。
 */
export function initDebugApi() {
  if (typeof window === "undefined") return;

  const peepApi: NonNullable<Window["peep"]> = {
    // Person CRUD
    PersonList,
    PersonGet,
    PersonCreate,
    PersonUpdate,
    PersonDelete,

    // 紫微斗数
    ZiWei,
    computeZiWeiData,
    computeScopeData,
    GetScopeData,

    // 大六壬
    DaLiuRen,
    computeDaLiuRenData,
    DaLiuRenCreate,
    DaLiuRenList,
    DaLiuRenView,

    // Wiki
    WikiList,
    WikiCreate,
    WikiView,

    // 从 analysis.ts 导入
    getChartDataForScope,

    // 系统工具
    version,
    env,
    health,
    help,
    getApiMetadata,
    setLogLevel: (level: LogLevel) => {
      // 延迟导入 logger
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setLogLevel: setLevel } = require("./logger");
      setLevel(level);
    },
    getCacheStats,
    clearCaches,
    resetDebugApi,
    // 状态调试工具（仅 DEV）
    dumpState: dumpStateToConsole,
    getStateSnapshots: getAllStateSnapshots,
    // 开发者体验改进 API（仅 DEV）
    renderStats,
    stateChanges,
    profile,
    setLastAction,
    dumpStateChanges,
  };

  window.peep = peepApi;
  _internalPeepApi = peepApi;

  log("info", "init", "调试 API 已初始化");
}
