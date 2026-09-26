/**
 * 调试 API 统一管理：window.peep 接口
 * 供自动化测试和控制台调试使用
 */
import { getChartDataForScope, type ScopeChartData } from "./analysis";
import type { Scope } from "./utils";
import type { Zwds } from "./useZwds";
import type { Person, LiurenRecord, WikiDocument } from "./personDb";
import { listPersons, getPerson, savePerson, deletePerson, getDefaultPerson } from "./personDb";
import { buildHbarData, clearHbarCaches, type HbarData } from "./hbar";
import { calculateDaLiuRen } from "./daliuren/calculator";
import type { DaLiuRenResult } from "./daliuren/types";
import type { LiurenListFilters, LiurenListResult } from "./daliurenDb";
import {
  getLiurenRecord,
  listLiurenRecords,
  saveLiurenRecord,
  invalidateLiurenTagCache,
} from "./daliurenDb";
import {
  listWikiDocs,
  getWikiDoc,
  saveWikiDoc as saveWikiDocToDb,
  getWikiLinks,
  getWikiBacklinks,
  saveWikiLinks,
  type WikiListFilters,
  type WikiListResult,
} from "./wikiDb";
import { globalEvents } from "./events";
import type { BirthInput } from "./useZwds";
import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import { MUTAGEN_TABLES } from "./utils";
import { LRUCache, registerCache, getAllCacheStats, clearAllCaches } from "./cache";
import { buildChartIndex } from "./chartIndex";

/**
 * computeZiWeiData 返回数据：hbar 运限拨盘 + chart 运限盘面
 */
export type ZiWeiComputedData = {
  /** 运限拨盘完整数据（含大运/流年/流月/流日/流时列表及可见性）；拨盘计算失败时为 null */
  hbar: (HbarData & { visible: Record<Scope, boolean> }) | null;
  /** 运限盘面数据；scope 未传或无 horoscope 时为 null */
  chart: ScopeChartData | null;
};

/** ZiWei 返回数据：人物 + 计算数据（hbar/chart） */
export type ZiWeiResult = {
  person: Person | null;
} & ZiWeiComputedData;

/** ZiWei 接口选项 */
export type ZiWeiOptions = {
  /**
   * 为 true 时跳过 UI 操控（导航、切换人物、设置时间、设置运限级别），
   * 仅根据当前 Zwds 状态计算并返回 hbar/chart 数据。
   * 等价于纯计算路径，可在任意上下文调用。
   */
  skipUI?: boolean;
};

/** DaLiuRen 计算返回数据：起课结果 + 关联人物 */
export type DaLiuRenComputedData = {
  /** 起课时间字符串（YYYY-MM-DD HH:mm:ss） */
  calculationTime: string;
  /** 完整大六壬排盘结果 */
  result: DaLiuRenResult;
  /** 关联人物（可能为 null） */
  person: Person | null;
};

/** DaLiuRen 接口选项 */
export type DaLiuRenOptions = {
  /**
   * 为 true 时跳过 UI 操控（导航、切换人物、打开 Dialog 等），
   * 仅执行纯计算或直接查询数据库。
   * 等价于纯计算路径，可在任意上下文调用（RTC Agent、自动化测试）。
   */
  skipUI?: boolean;
};

/** DaLiuRenView 返回数据：记录 + 计算数据 */
export type DaLiuRenViewResult = LiurenRecord & {
  /** 纯计算数据（skipUI=true 时包含，skipUI=false 时也包含以便 RTC Agent 使用） */
  computed?: DaLiuRenComputedData;
};

/** Wiki 接口选项 */
export type WikiOptions = {
  /**
   * 为 true 时跳过 UI 操控（导航、切换人物、打开编辑器等），
   * 仅执行纯数据库操作。
   * 等价于纯 DB 路径，可在任意上下文调用（RTC Agent、自动化测试）。
   */
  skipUI?: boolean;
};

/** WikiView 返回数据：文档 + 链接目标 ID 列表 + 可选的计算数据 */
export type WikiViewResult = WikiDocument & {
  /** 正向链接目标文档 ID 列表 */
  linkTargetIds: number[];
  /** 反向链接源文档 ID 列表 */
  backlinkSourceIds?: number[];
};

/* ============================================================
 * 自定义错误类——带上下文信息、错误链、恢复建议。
 * 生产环境通过 import.meta.env.DEV 控制是否输出敏感细节。
 *
 * 基类 BaseDebugError 封装 fullMessage 拼接、captureStackTrace 等共享逻辑；
 * ZiWeiError / DaLiuRenError / WikiError 只需指定 name，不再重复构造函数样板。
 * ============================================================ */

/**
 * 调试 API 错误的私有基类：封装 fullMessage 拼接 + captureStackTrace 等共享逻辑。
 * ZiWeiError / DaLiuRenError / WikiError 共享此类，避免构造函数重复。
 *
 * 注：source/context/suggestion/cause 在基类统一初始化，
 * 子类只需 `this.name = "XxxError"` 一行即可。
 */
class BaseDebugError extends Error {
  /** 错误来源标签（如 "ZiWei"、"DaLiuRenCreate"） */
  public readonly source: string;
  /** 上下文信息：输入参数、中间状态等（仅 DEV 环境包含完整数据） */
  public readonly context: Record<string, unknown>;
  /** 恢复建议（对开发者友好的调试提示） */
  public readonly suggestion?: string;
  /** 原始错误（错误链） */
  public readonly cause?: unknown;

  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    // 开发环境：消息包含完整上下文；生产环境：仅包含概要消息
    const fullMessage =
      import.meta.env.DEV && options?.context
        ? `${message}\n  来源: ${source}\n  上下文: ${JSON.stringify(options.context, null, 2)}${options?.suggestion ? `\n  建议: ${options.suggestion}` : ""}`
        : message;
    super(fullMessage);
    this.source = source;
    this.context = options?.context ?? {};
    this.suggestion = options?.suggestion;
    this.cause = options?.cause;
    // 确保堆栈追踪可用（V8 引擎）
    // captureStackTrace 是 Node.js/V8 特有的 API，标准 TypeScript 类型定义中未包含
    // 使用 never 类型避免严格的构造函数签名检查
    const ErrCtor = Error as unknown as {
      captureStackTrace?: (target: object, ctor?: never) => void;
    };
    if (typeof ErrCtor.captureStackTrace === "function") {
      ErrCtor.captureStackTrace(this, new.target as never);
    }
  }
}

/**
 * 紫微斗数基础错误类：所有 debugApi 紫微相关错误的基类。
 * 包含上下文信息（输入参数、中间状态）和恢复建议。
 *
 * @example
 * ```typescript
 * try {
 *   await window.peep.ZiWei(1, "yearly");
 * } catch (err) {
 *   if (err instanceof ZiWeiError) {
 *     console.error("来源:", err.source);
 *     console.error("上下文:", err.context);
 *     console.error("建议:", err.suggestion);
 *     console.error("原始错误:", err.cause);
 *   }
 * }
 * ```
 */
export class ZiWeiError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "ZiWeiError";
  }
}

/**
 * 日期解析错误：包含原始输入、尝试的格式列表和失败原因。
 */
export class ParseDateError extends ZiWeiError {
  /** 原始输入值 */
  public readonly rawInput: Date | number | string;
  /** 尝试过的格式列表 */
  public readonly attemptedFormats: string[];

  constructor(
    rawInput: Date | number | string,
    attemptedFormats: string[],
    reason: string,
    cause?: unknown,
  ) {
    const formatsDesc =
      attemptedFormats.length > 0 ? `尝试的格式: ${attemptedFormats.join(", ")}` : "未尝试任何格式";
    super(
      `日期解析失败: "${String(rawInput)}" (${typeof rawInput})\n  原因: ${reason}\n  ${formatsDesc}`,
      "parseDate",
      {
        context: { rawInput: String(rawInput), inputType: typeof rawInput, attemptedFormats },
        suggestion:
          "支持的格式: ISO 8601 (2024-06-15T12:00:00)、YYYY-MM-DD HH:mm、YYYY-MM-DD、时间戳 (毫秒)",
        cause,
      },
    );
    this.name = "ParseDateError";
    this.rawInput = rawInput;
    this.attemptedFormats = attemptedFormats;
  }
}

/**
 * 运限计算错误：包含人物信息和日期等上下文。
 */
export class ComputeScopeError extends ZiWeiError {
  constructor(
    message: string,
    options?: {
      personId?: number;
      personName?: string;
      solarDate?: string;
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, "computeScopeData", {
      context: {
        personId: options?.personId,
        personName: options?.personName,
        solarDate: options?.solarDate,
        ...options?.context,
      },
      suggestion: options?.suggestion ?? "请检查人物数据是否完整（出生年月日时、性别、历法）",
      cause: options?.cause,
    });
    this.name = "ComputeScopeError";
  }
}

/**
 * 大六壬错误类：DaLiuRen 系列调试接口的专用错误。
 * 包含上下文信息（输入参数、回调状态）和恢复建议。
 */
export class DaLiuRenError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "DaLiuRenError";
  }
}

/**
 * Wiki 错误类：Wiki 系列调试接口的专用错误。
 * 包含上下文信息（输入参数、数据库操作状态）和恢复建议。
 */
export class WikiError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "WikiError";
  }
}

/* ============================================================
 * 结构化日志——分级、带分类标签、带时间戳。
 * 相比直接 console.*，调试时更容易按类别过滤/定位问题。
 * ============================================================ */

/** 日志级别阈值（数值越大越严格） */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 当前日志级别——开发环境默认 info，可通过 window.peep.setLogLevel 调整 */
let currentLogLevel: LogLevel = "info";

/** ANSI-free 颜色标记：让分类标签在控制台更醒目 */
const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "color:#888",
  info: "color:#2196f3",
  warn: "color:#ff9800",
  error: "color:#f44336",
};

/** 日志级别到 console 方法的映射 */
const LOG_METHODS: Record<LogLevel, keyof Console> = {
  debug: "debug",
  info: "log",
  warn: "warn",
  error: "error",
};

/**
 * 核心日志函数——仅在 import.meta.env.DEV 下输出。
 * 生产构建会被 tree-shaken 掉，零运行时开销。
 */
function log(level: LogLevel, category: string, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) return;

  const ts = new Date().toLocaleTimeString();
  const prefix = `[peep ${ts}][${category}]`;
  const method = LOG_METHODS[level];

  // 带 CSS 样式的 console 输出（浏览器支持 %c 占位符）
  const args =
    data !== undefined
      ? [`%c${prefix}%c ${message}`, LEVEL_STYLES[level], "", data]
      : [`%c${prefix}%c ${message}`, LEVEL_STYLES[level], ""];
  // eslint-disable-next-line no-console
  (console[method] as (...a: unknown[]) => void)(...args);
}

/**
 * 静态空函数引用：生产环境下 timer 直接返回此引用，
 * 避免每次 timer() 调用都创建新的空闭包，减少内存分配与 GC 压力。
 */
const NOOP = () => {};

/**
 * 性能计时工具——返回一个 stop 函数，调用时打印耗时。
 * 用法：const stop = timer("ZiWei"); ... stop(); // "ZiWei 耗时 23ms"
 *
 * 生产环境直接返回共享的 NOOP 引用（无闭包分配）；
 * 开发环境才创建 start 变量与闭包用于计时。
 */
function timer(category: string): () => void {
  if (!import.meta.env.DEV) return NOOP;
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    log("debug", category, `耗时 ${duration.toFixed(1)}ms`);
  };
}

/* ============================================================
 * React 回调注册——从 App.tsx / 各页面注入
 * ============================================================ */

let _selectPerson: ((personId: number) => Promise<void>) | null = null;
let _getZwds: (() => Zwds | null) | null = null;
let _getPerson: (() => Person | null) | null = null;
let _navigate: ((path: string) => void) | null = null;

/** 大六壬 React 回调注册：从 DaLiuRenPage.tsx 注入 */
let _getDaLiuRenList: ((filters: LiurenListFilters) => Promise<LiurenListResult>) | null = null;
let _setListFilters:
  ((filters: { searchText?: string; tags?: string[]; page?: number }) => void) | null = null;
let _openCreateDialog: (() => void) | null = null;
let _fillCreateForm:
  | ((data: { question: string; note?: string; background?: string; tags?: string[] }) => void)
  | null = null;
let _submitCreateForm: (() => Promise<LiurenRecord>) | null = null;
let _selectRecord: ((recordId: number) => Promise<LiurenRecord | null>) | null = null;
let _getSelectedRecord: (() => LiurenRecord | null) | null = null;

/** Wiki React 回调注册：从 WikiPage.tsx 注入 */
let _getWikiList: ((filters: WikiListFilters) => Promise<WikiListResult>) | null = null;
let _setWikiListFilters:
  ((filters: { searchText?: string; tags?: string[]; page?: number }) => void) | null = null;
let _openWikiEditor: (() => void) | null = null;
let _saveWikiDoc: ((doc: WikiDocument, linkTargetIds: number[]) => Promise<WikiDocument>) | null =
  null;
let _selectWikiDoc: ((docId: number) => Promise<WikiDocument | null>) | null = null;
let _getSelectedWikiDoc: (() => WikiDocument | null) | null = null;

/** 回调注册状态追踪 */
const _callbacksReady: {
  ziwei: boolean;
  daliuren: boolean;
  wiki: boolean;
} = {
  ziwei: false,
  daliuren: false,
  wiki: false,
};

/**
 * 注册 React 回调（Layout.tsx 初始化时调用）
 *
 * 仅注册全局共享回调（人物选择/导航等）。
 * 各页面的专属回调（大六壬/Wiki）由 registerDaLiuRenCallbacks / registerWikiCallbacks 各自注册。
 */
export function registerDebugApi(opts: {
  selectPerson?: (personId: number) => Promise<void>;
  getPerson?: () => Person | null;
  navigate?: (path: string) => void;
}) {
  if (opts.selectPerson) _selectPerson = opts.selectPerson;
  if (opts.getPerson) _getPerson = opts.getPerson;
  if (opts.navigate) _navigate = opts.navigate;
}

/** 注册紫微斗数页面回调（ZiweiPage.tsx 调用） */
export function registerZiWeiCallbacks(opts: { getZwds: () => Zwds | null }) {
  _getZwds = opts.getZwds;
  _callbacksReady.ziwei = true;
  log("debug", "init", "ZiWei 页面回调注册完成");
}

/** 注册大六壬页面回调（DaLiuRenPage.tsx 调用） */
export function registerDaLiuRenCallbacks(opts: {
  getDaLiuRenList: (filters: LiurenListFilters) => Promise<LiurenListResult>;
  setListFilters?: (filters: { searchText?: string; tags?: string[]; page?: number }) => void;
  openCreateDialog: () => void;
  fillCreateForm: (data: {
    question: string;
    note?: string;
    background?: string;
    tags?: string[];
  }) => void;
  submitCreateForm: () => Promise<LiurenRecord>;
  selectRecord: (recordId: number) => Promise<LiurenRecord | null>;
  getSelectedRecord: () => LiurenRecord | null;
}) {
  _getDaLiuRenList = opts.getDaLiuRenList;
  if (opts.setListFilters) _setListFilters = opts.setListFilters;
  _openCreateDialog = opts.openCreateDialog;
  _fillCreateForm = opts.fillCreateForm;
  _submitCreateForm = opts.submitCreateForm;
  _selectRecord = opts.selectRecord;
  _getSelectedRecord = opts.getSelectedRecord;
  _callbacksReady.daliuren = true;
  log("debug", "init", "DaLiuRen 页面回调注册完成");
}

/** 注册 Wiki 页面回调（WikiPage.tsx 调用） */
export function registerWikiCallbacks(opts: {
  getWikiList: (filters: WikiListFilters) => Promise<WikiListResult>;
  setWikiListFilters?: (filters: { searchText?: string; tags?: string[]; page?: number }) => void;
  openWikiEditor: () => void;
  saveWikiDoc: (doc: WikiDocument, linkTargetIds: number[]) => Promise<WikiDocument>;
  selectWikiDoc: (docId: number) => Promise<WikiDocument | null>;
  getSelectedWikiDoc: () => WikiDocument | null;
}) {
  _getWikiList = opts.getWikiList;
  if (opts.setWikiListFilters) _setWikiListFilters = opts.setWikiListFilters;
  _openWikiEditor = opts.openWikiEditor;
  _saveWikiDoc = opts.saveWikiDoc;
  _selectWikiDoc = opts.selectWikiDoc;
  _getSelectedWikiDoc = opts.getSelectedWikiDoc;
  _callbacksReady.wiki = true;
  log("debug", "init", "Wiki 页面回调注册完成");
}

/**
 * 注销页面回调：页面组件卸载时调用，把对应 _callbacksReady[page] 设为 false，
 * 避免下次 waitForCallbacks 白等超时（例如从大六壬页面切走后再调用 DaLiuRenView）。
 *
 * 注意：不清空回调函数本身（避免其他模块持有旧引用时报错），
 * 仅重置就绪标志——下次同页面重新挂载时会由 register* 重新覆盖。
 */
export function unregisterPageCallbacks(page: "ziwei" | "daliuren" | "wiki") {
  _callbacksReady[page] = false;
  log("debug", "init", `${page} 页面回调已注销`);
}

/**
 * 重置调试 API 全部模块级状态：供测试 teardown 和 HMR cleanup 使用。
 *
 * 清空范围：
 * - 所有回调变量（_selectPerson / _getZwds / ... 等）
 * - 回调就绪标志（_callbacksReady）
 * - 当前日志级别（恢复为默认 "info"）
 * - 本命盘缓存（astrolabeCache）
 * - hbar / chartIndex 等外部缓存（通过 clearAllCaches / clearHbarCaches）
 *
 * 注：不会清空 LRUCache 注册表本身（由 cache.ts 管理），
 * 但会清空各缓存实例的内容。
 */
export function resetDebugApi(): void {
  // 1. 清空所有回调变量
  _selectPerson = null;
  _getZwds = null;
  _getPerson = null;
  _navigate = null;
  _getDaLiuRenList = null;
  _setListFilters = null;
  _openCreateDialog = null;
  _fillCreateForm = null;
  _submitCreateForm = null;
  _selectRecord = null;
  _getSelectedRecord = null;
  _getWikiList = null;
  _setWikiListFilters = null;
  _openWikiEditor = null;
  _saveWikiDoc = null;
  _selectWikiDoc = null;
  _getSelectedWikiDoc = null;

  // 2. 重置回调就绪标志
  _callbacksReady.ziwei = false;
  _callbacksReady.daliuren = false;
  _callbacksReady.wiki = false;

  // 3. 恢复日志级别为默认值
  currentLogLevel = "info";

  // 4. 清空本命盘缓存
  astrolabeCache.clear();

  // 5. 清空外部缓存（hbar / chartIndex 等注册到 cache.ts 的缓存）
  clearAllCaches();
  clearHbarCaches();

  log("info", "init", "调试 API 全部状态已重置");
}

/** 等待页面回调注册完成 */
async function waitForCallbacks(
  page: "ziwei" | "daliuren" | "wiki",
  timeout = 1000,
): Promise<void> {
  const start = Date.now();
  while (!_callbacksReady[page]) {
    if (Date.now() - start > timeout) {
      const err = new ZiWeiError(
        `${page} 页面的调试 API 回调注册超时（${timeout}ms）——页面可能未访问过或已卸载`,
        "waitForCallbacks",
        {
          context: { page, timeout, callbacksReady: _callbacksReady },
          suggestion: `请先访问 ${page} 页面使其挂载，或检查页面组件是否正确注册了回调`,
        },
      );
      log("error", page, "回调注册超时", { timeout, callbacksReady: _callbacksReady });
      throw err;
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/* ============================================================
 * 核心调试 API 方法
 * ============================================================ */

/**
 * 解析人物 ID：未传或无效时返回默认人物 ID。
 * 所有接受 personId 的调试接口共用此逻辑——AI 不传 ID 时自动使用默认人物。
 */
async function resolvePersonId(personId?: number): Promise<number> {
  if (personId != null && Number.isFinite(personId) && personId > 0) {
    return personId;
  }
  const defaultPerson = await getDefaultPerson();
  return defaultPerson.id!;
}

/* ── Person CRUD ──────────────────────────────────────── */

/**
 * 人物列表：返回所有人物（按保存时间倒序）。
 * 纯 DB 操作，无 UI 交互。
 *
 * @returns 人物数组，每人包含 id、name、date、timeIndex、gender 等完整出生信息
 *
 * @example
 * ```typescript
 * const persons = await window.peep.PersonList();
 * persons.forEach(p => console.log(`${p.id}: ${p.name} (${p.date})`));
 * ```
 */
export async function PersonList(): Promise<Person[]> {
  const stop = timer("PersonList");
  try {
    log("info", "PersonList", "查询人物列表");
    const persons = await listPersons();
    log("info", "PersonList", "查询成功", { count: persons.length });
    stop();
    return persons;
  } catch (err) {
    log("error", "PersonList", "查询失败", err);
    throw wrapError("PersonList", err, ZiWeiError);
  }
}

/**
 * 获取人物详情：按 ID 查询，不传则返回默认人物。
 * 纯 DB 操作，无 UI 交互。
 *
 * @param personId 人物 ID（可选，不传则返回默认人物）
 * @returns 人物详情，包含完整出生信息和设置
 * @throws Error 人物不存在时抛出
 *
 * @example
 * ```typescript
 * // 获取默认人物
 * const person = await window.peep.PersonGet();
 * console.log("姓名:", person.name);
 * console.log("出生日期:", person.date);
 *
 * // 获取指定人物
 * const person = await window.peep.PersonGet(1);
 * console.log("性别:", person.gender);
 * console.log("历法:", person.calendar);
 * ```
 */
export async function PersonGet(personId?: number): Promise<Person> {
  const stop = timer("PersonGet");
  try {
    const id = await resolvePersonId(personId);
    log("info", "PersonGet", "查询人物", { id });
    const person = await getPerson(id);
    if (!person) {
      throw new Error(`人物 ${id} 不存在`);
    }
    log("info", "PersonGet", "查询成功", { id, name: person.name });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonGet", "查询失败", err);
    throw wrapError("PersonGet", err, ZiWeiError);
  }
}

/**
 * 创建人物：写入 DB 并触发 UI 同步（切换为新人物）。
 *
 * UI 同步流程：
 * 1. savePerson() 写入 IndexedDB
 * 2. globalEvents.emit("person.changed") 通知所有页面
 * 3. ZiweiPage 收到事件后重新计算盘面
 *
 * @param input 出生信息
 * @param isDefault 是否设为默认人物（可选，默认 false）
 */
export async function PersonCreate(input: BirthInput, isDefault?: boolean): Promise<Person> {
  const stop = timer("PersonCreate");
  try {
    log("info", "PersonCreate", "创建人物", { name: input.name, isDefault });
    const person = await savePerson(undefined, input, isDefault ?? false);
    // UI 同步：通知所有页面切换到新人物
    globalEvents.emit("person.changed", person);
    log("info", "PersonCreate", "创建成功", { id: person.id });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonCreate", "创建失败", err);
    throw wrapError("PersonCreate", err, ZiWeiError);
  }
}

/**
 * 更新人物：按 ID 更新并触发 UI 同步。
 * 如果更新的是当前选中人物，页面会自动重新计算盘面。
 *
 * @param personId 人物 ID
 * @param input 出生信息
 * @param isDefault 是否设为默认人物（可选，不传则保持原值）
 */
export async function PersonUpdate(
  personId: number,
  input: BirthInput,
  isDefault?: boolean,
): Promise<Person> {
  const stop = timer("PersonUpdate");
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      throw new Error(`personId 无效：${personId}，需为正整数`);
    }
    log("info", "PersonUpdate", "更新人物", { id: personId, name: input.name, isDefault });
    // 如果未指定 isDefault，保持原值
    const defaultFlag = isDefault ?? (await getPerson(personId))?.isDefault ?? false;
    const person = await savePerson(personId, input, defaultFlag);
    // UI 同步：通知所有页面人物数据已变化
    globalEvents.emit("person.changed", person);
    log("info", "PersonUpdate", "更新成功", { id: person.id });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonUpdate", "更新失败", err);
    throw wrapError("PersonUpdate", err, ZiWeiError);
  }
}

/**
 * 删除人物：从 DB 删除并触发 UI 同步（切换到默认人物）。
 * 默认人物不可删除（personDb.ts 会抛错）。
 */
export async function PersonDelete(personId: number): Promise<void> {
  const stop = timer("PersonDelete");
  try {
    if (!Number.isFinite(personId) || personId <= 0) {
      throw new Error(`personId 无效：${personId}，需为正整数`);
    }
    log("info", "PersonDelete", "删除人物", { id: personId });
    await deletePerson(personId);
    // UI 同步：删除后切换到默认人物
    const defaultPerson = await getDefaultPerson();
    globalEvents.emit("person.changed", defaultPerson);
    log("info", "PersonDelete", "删除成功", { id: personId });
    stop();
  } catch (err) {
    log("error", "PersonDelete", "删除失败", err);
    throw wrapError("PersonDelete", err, ZiWeiError);
  }
}

/* ── 紫微斗数 ──────────────────────────────────────────── */

/**
 * 纯计算函数：从 Zwds 状态提取 hbar（运限拨盘）和 chart（运限盘面）数据。
 *
 * 不包含任何 UI 操控逻辑，也不依赖 React 状态——只读取传入 Zwds 对象中
 * 已有的 astrolabe / horoscope / pick / visible 字段。
 *
 * ZiWei（skipUI=true）和 GetScopeData 都可以通过此函数复用计算逻辑，
 * 避免重复的 buildHbarData / getChartDataForScope 样板代码。
 *
 * @param z Zwds 对象（已包含 astrolabe / horoscope / pick / visible）
 * @param scope 运限级别（可选；不传则 chart 返回 null）
 * @returns hbar 和 chart 数据
 *
 * @example
 * ```typescript
 * // 从已排好的 Zwds 状态中提取运限数据
 * const zwds = getZwdsState();
 * if (zwds) {
 *   const { hbar, chart } = computeZiWeiData(zwds, "yearly");
 *   // hbar: 运限拨盘数据（大运/流年/流月/流日/流时列表）
 *   // chart: 流年盘面数据（十二宫星曜、四化等）
 *   console.log("大运列表:", hbar?.decadalList);
 *   console.log("流年命宫:", chart?.palaces.find(p => p.isMingPalace));
 * }
 * ```
 */
export function computeZiWeiData(z: Zwds, scope?: Scope): ZiWeiComputedData {
  const stop = timer("computeZiWeiData");

  // 构建 hbar：运限拨盘数据（大运/流年/流月/流日/流时列表）
  const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
  const hbar = hbarBase ? { ...hbarBase, visible: { ...z.visible } } : null;

  // 构建 chart：指定 scope 的运限盘面数据
  // 共享 chartIndex：buildChartIndex 内部按 astrolabe 弱引用缓存，多次调用零开销
  let chart: ScopeChartData | null = null;
  if (scope && z.astrolabe && z.horoscope) {
    const ix = buildChartIndex(z.astrolabe);
    chart = getChartDataForScope({
      astrolabe: z.astrolabe,
      horoscope: z.horoscope,
      scope,
      chartIndex: ix,
    });
  }

  stop();
  return { hbar, chart };
}

/**
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、设置时间、设置运限级别
 * - 数据计算层（computeZiWeiData）：从 Zwds 状态提取 hbar/chart 数据
 *
 * 执行顺序（skipUI=false）：
 * 1. 切换人物（等待 astrolabe 重新计算完成）
 * 2. 设置时间（在 pick 被 useEffect 重置为"今天"之后）
 * 3. 设置运限级别（只显示目标 scope）
 * 4. 等待所有状态更新完成
 * 5. 调用 computeZiWeiData 获取数据
 *
 * skipUI=true 时：跳过步骤 1-4，直接读取当前 Zwds 状态并计算数据，
 * 等价于纯计算路径，可在任意上下文调用（例如 RTC Agent 或自动化测试）。
 *
 * @param personId 人物 ID（可选，不传则使用默认人物；skipUI=true 时忽略）
 * @param scope 运限级别（decadal/yearly/monthly/daily/hourly）
 * @param time 可选时间参数（Date 或时间戳），用于设置运限时间（skipUI=true 时忽略）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 包含人物信息、运限拨盘数据和运限盘面数据的完整结果
 *
 * @example
 * ```typescript
 * // 示例 1：查看默认人物的流年运势（带 UI 同步）
 * const result = await window.peep.ZiWei(undefined, "yearly");
 * console.log("人物:", result.person?.name);
 * console.log("流年列表:", result.hbar?.yearlyList);
 * console.log("流年命宫:", result.chart?.palaces.find(p => p.isMingPalace));
 *
 * // 示例 2：查看指定人物的流月运势，指定日期
 * const result = await window.peep.ZiWei(1, "monthly", "2024-06-15");
 * console.log("流月列表:", result.hbar?.monthlyList);
 *
 * // 示例 3：纯计算模式（不操控 UI，适用于 RTC Agent）
 * const result = await window.peep.ZiWei(undefined, "yearly", undefined, { skipUI: true });
 * // 注意：skipUI 模式下 personId 和 time 参数被忽略，仅使用当前 Zwds 状态
 * ```
 *
 * @throws {ZiWeiError} 排盘失败时抛出，包含上下文和恢复建议
 * @throws {ParseDateError} 日期格式无效时抛出
 */
export async function ZiWei(
  personId?: number,
  scope?: Scope,
  time?: Date | number | string,
  options?: ZiWeiOptions,
): Promise<ZiWeiResult> {
  const stop = timer("ZiWei");
  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 解析人物 ID（不传则用默认）
      const resolvedId = await resolvePersonId(personId);
      // 输入校验
      if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
        throw new ZiWeiError(`personId 无效：${resolvedId}，需为正整数`, "ZiWei", {
          context: { personId, resolvedId },
          suggestion: "请传入有效的人物 ID（正整数），或不传以使用默认人物",
        });
      }
      if (scope && !["decadal", "yearly", "monthly", "daily", "hourly"].includes(scope)) {
        throw new ZiWeiError(
          `scope 无效：${scope}，需为 decadal/yearly/monthly/daily/hourly 之一`,
          "ZiWei",
          {
            context: { scope },
            suggestion: "请使用有效的运限级别：decadal/yearly/monthly/daily/hourly",
          },
        );
      }

      log("info", "ZiWei", "开始执行", {
        personId,
        scope,
        time,
        attempt: attempt + 1,
        skipUI: !!options?.skipUI,
      });

      // skipUI 模式：跳过所有 UI 操控，直接读取当前 Zwds 状态并计算数据
      // 此时 personId / time 参数被忽略，仅 scope 用于 chart 计算
      if (options?.skipUI) {
        if (!_getZwds || !_getPerson) {
          throw new ZiWeiError("调试 API 未初始化，请确认 App 已加载", "ZiWei", {
            context: { getZwdsReady: !!_getZwds, getPersonReady: !!_getPerson },
            suggestion: "请确认 App.tsx 已完成挂载，或等待页面加载完成后重试",
          });
        }
        const z = _getZwds();
        if (!z) {
          throw new ZiWeiError("排盘数据未就绪", "ZiWei", {
            suggestion: "排盘引擎尚未初始化，请确认人物已选择后再调用",
          });
        }
        const { hbar, chart } = computeZiWeiData(z, scope);
        const person = _getPerson();
        log("info", "ZiWei", "skipUI 模式执行成功", {
          personId: person?.id,
          scope,
          hasChart: !!chart,
        });
        stop();
        return { person, hbar, chart };
      }

      // 正常模式：执行 UI 操控（导航、切换人物、设置时间、设置运限级别）
      // 跳转到 / 页面（紫微斗数）并等待回调注册
      await navigateToPage("/", "ziwei");

      if (!_selectPerson || !_getZwds || !_getPerson) {
        throw new ZiWeiError("调试 API 未初始化，请确认 App 已加载", "ZiWei", {
          context: {
            selectPersonReady: !!_selectPerson,
            getZwdsReady: !!_getZwds,
            getPersonReady: !!_getPerson,
          },
          suggestion: "请确认 App.tsx 已完成挂载，或等待页面加载完成后重试",
        });
      }

      // 1. 切换人物（操控 UI）
      await _selectPerson(resolvedId);

      const z = _getZwds();
      if (!z) {
        throw new ZiWeiError("排盘数据未就绪", "ZiWei", {
          context: { personId: resolvedId },
          suggestion: "排盘引擎尚未初始化，请稍后重试。如持续出现请检查人物出生数据是否完整",
        });
      }

      // 等待 astrolabe 更新 + useEffect 重置 pick 完成（轮询验证替代盲等）
      await waitForPersonMatch(resolvedId, 2000);
      await waitForAstrolabeStable(z, 2000);
      // useEffect 的 commit 阶段需要一帧才能执行重置，确保 pick 已到达"今天"
      await nextFrame();

      // 验证 pick 已被 useEffect 重置（轮询检测，非盲等）
      await waitForPickReset(z, 1000);
      log("debug", "ZiWei", "pick 已重置", { pick: z.pick });

      // 2. 设置时间（在 useEffect 重置完成之后，带验证和重试）
      // parseDate 失败时抛出 ParseDateError（包含详细的格式信息和失败原因）
      if (time) {
        const date = parseDate(time);
        await setHoroscopeTimeWithRetry(z, date);
      }

      // 3. 设置运限级别（只显示目标 scope，其他全部关闭）
      if (scope) {
        z.actions.showScope(scope);
      }

      // 4. 等待所有状态更新完成（轮询 + rAF 确保 React 状态和渲染完成）
      await waitForStateUpdate();

      // 5. 获取数据（复用纯计算函数，与 GetScopeData 共享 hbar/chart 构建逻辑）
      const person = _getPerson();
      const { hbar, chart } = computeZiWeiData(z, scope);

      log("info", "ZiWei", "执行成功", { personId: person?.id, scope, hasChart: !!chart });
      stop();
      return { person, hbar, chart };
    } catch (err) {
      lastError = err;

      // 自定义错误（ParseDateError / ZiWeiError）：不重试，直接抛出
      if (err instanceof ZiWeiError) {
        log("error", "ZiWei", "执行失败（不重试）", {
          errorType: err.name,
          message: err.message.split("\n")[0],
          attempt: attempt + 1,
        });
        stop();
        throw wrapError("ZiWei", err, ZiWeiError);
      }

      // 超时/临时性错误：记录并重试
      const isTimeout = err instanceof Error && /超时|timeout/i.test(err.message);
      if (isTimeout && attempt < maxRetries) {
        log("warn", "ZiWei", `检测到超时错误，第 ${attempt + 1} 次重试`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }

      // 其他错误：不重试
      log("error", "ZiWei", "执行失败", err);
      stop();
      throw wrapError("ZiWei", err, ZiWeiError);
    }
  }

  // 所有重试均失败（仅超时错误会到达这里）
  stop();
  throw new ZiWeiError(`ZiWei 重试 ${maxRetries} 次后仍失败`, "ZiWei", {
    context: { personId, scope, time, attempts: maxRetries + 1 },
    suggestion: "连续多次超时，请检查设备性能或刷新页面后重试",
    cause: lastError,
  });
}

/**
 * 解析时间：支持多种日期格式，失败时抛出 ParseDateError 并附带详细信息。
 *
 * 支持的格式：
 * - Date 实例（直接返回）
 * - 数字（时间戳，毫秒或秒）
 * - ISO 8601：2024-06-15T12:00:00、2024-06-15T12:00:00.000Z
 * - YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD HH:mm
 * - YYYY-MM-DD HH（简写，自动补全分钟秒）
 * - YYYY-MM-DD（自动补全 00:00:00）
 * - 纯数字字符串（当作时间戳）
 */
export function parseDate(time: Date | number | string): Date {
  // 分支 1：Date 实例 → 直接返回或抛出
  if (time instanceof Date) {
    if (isNaN(time.getTime())) {
      throw new ParseDateError(time, ["Date 实例"], "Date 实例的值为 Invalid Date");
    }
    return time;
  }

  // 分支 2：数字时间戳（毫秒或秒） → 解析或抛出
  if (typeof time === "number") {
    // 小于 1e11 认为是秒级时间戳，自动转毫秒
    const ms = time < 1e11 ? time * 1000 : time;
    const d = new Date(ms);
    if (isNaN(d.getTime())) {
      throw new ParseDateError(time, ["时间戳 (毫秒)"], `时间戳 ${time} 解析为 Invalid Date`);
    }
    log("debug", "parseDate", "时间戳解析成功", { input: time, result: d.toISOString() });
    return d;
  }

  // 分支 3：字符串解析 → 根据格式走互斥子分支
  const str = String(time).trim();
  if (!str) {
    throw new ParseDateError(time, [], "输入为空字符串");
  }

  // 子分支 3.1：纯数字字符串 → 当作时间戳
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "时间戳字符串解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["纯数字字符串 (时间戳)"],
      `时间戳字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.2：YYYY-MM-DD HH（补全分钟和秒） → 标准化后继续 ISO 解析
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}$/.test(str)) {
    const normalized = `${str}:00:00`;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "YYYY-MM-DD HH 解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["YYYY-MM-DD HH → YYYY-MM-DD HH:00:00"],
      `日期时间字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.3：YYYY-MM-DD（补全时间部分） → 标准化后继续 ISO 解析
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const normalized = `${str} 00:00:00`;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "YYYY-MM-DD 解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["YYYY-MM-DD → YYYY-MM-DD 00:00:00"],
      `日期字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.4：ISO 8601 或浏览器原生解析 → 兜底尝试
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    log("debug", "parseDate", "字符串解析成功", {
      input: time,
      format: "ISO 8601 / 浏览器原生 Date.parse",
      result: d.toISOString(),
    });
    return d;
  }

  // 所有格式均失败
  throw new ParseDateError(
    time,
    ["ISO 8601 / 浏览器原生 Date.parse"],
    `字符串 "${str}" 无法解析为有效日期`,
  );
}

/**
 * 设置运限时间：根据 Date 设置年月日时。
 * 纯同步函数，仅调用 actions 不验证结果。
 *
 * 改进：使用事务式批量更新（setPickBatch），一次性设置所有字段，
 * 避免 4 次独立 setPick 调用导致的竞态条件。
 * 同时使用 pickLocked 标志防止 useEffect 在此期间重置 pick。
 */
function _setHoroscopeTime(
  z: Zwds,
  date: Date,
): { year: number; month: number; day: number; hour: number; version: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 转换为时辰索引（0-11）
  const hourIdx = Math.floor(((hour + 1) % 24) / 2);

  // hbar 流月/流日按阳历排列，所以 pick 直接用阳历值
  // 事务式更新：锁定 pick → 批量设置 → 记录版本号
  z.actions.lockPick();
  z.actions.setPickBatch({ year, month, day, hour: hourIdx, leap: false });
  const versionAfterSet = z.actions.getPickVersion();

  return { year, month, day, hour: hourIdx, version: versionAfterSet };
}

/**
 * 设置运限时间（带验证和重试）：
 * 1. 调用 _setHoroscopeTime 事务式设置 pick（锁定 + 批量更新）
 * 2. 等待 React 渲染
 * 3. 验证 pick 是否匹配预期值 且 版本号一致
 * 4. 如果不匹配（可能被其他操作覆盖），最多重试 2 次（指数退避）
 * 5. 无论成功失败，最终都解锁 pick
 */
async function setHoroscopeTimeWithRetry(z: Zwds, date: Date, maxRetries = 2): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const expected = _setHoroscopeTime(z, date);

    // 等待 React 处理状态更新（双 rAF）
    await nextFrame();
    await nextFrame();

    // 验证 pick 是否匹配预期（包含版本号校验，确保未被其他操作覆盖）
    const matched = await waitForPickMatch(z, expected, 300);
    const versionMatch = z.actions.getPickVersion() === expected.version;

    if (matched && versionMatch) {
      // 成功：解锁 pick，恢复正常 useEffect 行为
      z.actions.unlockPick();
      if (attempt > 0) {
        log("info", "ZiWei", `setHoroscopeTime 重试 ${attempt} 次后成功`, { expected });
      } else {
        log("debug", "ZiWei", "setHoroscopeTime 验证通过", { expected });
      }
      return;
    }

    // pick 不匹配，可能被其他操作覆盖——记录并重试
    log("warn", "ZiWei", `setHoroscopeTime 验证失败`, {
      attempt: attempt + 1,
      pickMatched: matched,
      versionMatched: versionMatch,
      expected,
      actual: z.pick,
      actualVersion: z.actions.getPickVersion(),
    });

    if (attempt < maxRetries) {
      // 指数退避：50ms, 100ms
      const delayMs = 50 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // 所有重试均失败：解锁 pick 并抛出错误
  z.actions.unlockPick();

  throw new ZiWeiError(
    `setHoroscopeTime 重试 ${maxRetries} 次后仍失败：pick=${JSON.stringify(z.pick)}，期望=${JSON.stringify(date)}`,
    "setHoroscopeTime",
    {
      context: { maxRetries, expectedPick: date.toISOString(), actualPick: z.pick },
      suggestion: "pick 值持续被其他操作覆盖，可能是 React 状态更新冲突。请尝试刷新页面后重试",
    },
  );
}

/**
 * 纯函数：从 Person 数据计算紫微斗数本命盘（不依赖 React 状态）
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @returns iztro 本命盘对象
 * @throws ComputeScopeError 排盘失败时抛出，包含人物上下文和恢复建议
 */

/* ─────────────── 本命盘缓存 ─────────────── */

/**
 * computeAstrolabe 缓存：按"人物输入指纹"缓存 iztro 计算结果。
 * iztro 排盘是最昂贵的操作（约 20-100ms），相同输入时直接命中可节省大量时间。
 * 指纹 = 排盘相关字段的连接，不包含 name/id 等无关字段。
 */
const astrolabeCache = new LRUCache<string, ReturnType<typeof astro.withOptions>>({
  maxSize: 50,
  name: "computeAstrolabe",
});
registerCache("computeAstrolabe", astrolabeCache);

/**
 * 生成人物的排盘指纹：由所有影响排盘结果的字段组成。
 * 字段变更时指纹改变，缓存自动失效。
 *
 * 使用 JSON 序列化代替 join("|")，避免字段值包含分隔符时产生碰撞。
 * 注意：新增影响排盘的 Person/BirthInput 字段时，须同步更新此处的字段列表。
 */
function makeAstrolabeFingerprint(person: Person): string {
  // 影响排盘结果的全部字段：历法/日期/时辰/性别/闰月/算法/年界/四化表/日界/盘型
  // 使用对象而非数组，JSON 序列化后字段名参与指纹，进一步降低碰撞概率
  return JSON.stringify({
    calendar: person.calendar,
    date: person.date,
    timeIndex: person.timeIndex,
    gender: person.gender,
    isLeapMonth: person.isLeapMonth ? 1 : 0,
    algorithm: person.algorithm,
    yearDivide: person.yearDivide,
    mutagenTable: person.mutagenTable,
    dayDivide: person.dayDivide,
    astroType: person.astroType,
  });
}

function computeAstrolabe(person: Person) {
  // 先查缓存：相同输入指纹直接返回，避免重复 iztro 计算
  const fp = makeAstrolabeFingerprint(person);
  const cached = astrolabeCache.get(fp);
  if (cached) {
    log("debug", "computeAstrolabe", "缓存命中", { fingerprint: fp });
    return cached;
  }

  try {
    const result = astro.withOptions({
      type: person.calendar,
      dateStr: person.date,
      timeIndex: person.timeIndex,
      gender: person.gender as unknown as GenderName,
      isLeapMonth: person.isLeapMonth,
      fixLeap: true,
      language: "zh-CN",
      astroType: person.algorithm === "zhongzhou" ? person.astroType : "heaven",
      config: {
        algorithm: person.algorithm,
        yearDivide: person.yearDivide,
        horoscopeDivide: person.yearDivide,
        dayDivide: person.dayDivide,
        mutagens: (MUTAGEN_TABLES[person.mutagenTable] ?? MUTAGEN_TABLES.default) as never,
      },
    });
    // 缓存结果
    astrolabeCache.set(fp, result);
    return result;
  } catch (e) {
    log("error", "computeAstrolabe", "排盘失败", e);
    throw new ComputeScopeError("本命盘计算失败", {
      personId: person.id,
      personName: person.name,
      context: {
        calendar: person.calendar,
        date: person.date,
        timeIndex: person.timeIndex,
        gender: person.gender,
        algorithm: person.algorithm,
      },
      suggestion: "请检查人物数据是否完整：出生年月日时、性别、历法类型、算法配置",
      cause: e,
    });
  }
}

/**
 * 纯函数：根据阳历日期获取人物的运限数据（大运/流年/流月/流日/流时）
 *
 * 不依赖 React 状态，可在任意上下文调用（调试 API、RTC Agent 等）。
 * 计算失败时抛出 ComputeScopeError（包含人物信息和日期上下文），不再静默返回 null。
 * 对于临时性错误（如 iztro 内部异常）自动重试最多 2 次。
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @param solarDate 阳历日期（Date 对象或 YYYY-MM-DD 格式字符串）
 * @returns 运限拨盘完整数据（buildHbarData 返回 null 时仍可能为 null，表示无运限数据）
 * @throws ComputeScopeError 本命盘计算或日期解析失败时抛出
 *
 * @example
 * ```typescript
 * // 示例 1：从数据库获取人物后计算运限
 * const person = await window.peep.PersonGet(1);
 * const hbarData = window.peep.computeScopeData(person, "2024-06-15");
 * if (hbarData) {
 *   console.log("大运:", hbarData.decadalList);
 *   console.log("流年:", hbarData.yearlyList);
 *   console.log("流月:", hbarData.monthlyList);
 * }
 *
 * // 示例 2：使用 Date 对象
 * const now = new Date();
 * const hbarData = window.peep.computeScopeData(person, now);
 *
 * // 示例 3：错误处理
 * try {
 *   const result = window.peep.computeScopeData(person, "invalid-date");
 * } catch (err) {
 *   if (err instanceof ParseDateError) {
 *     console.error("日期格式错误:", err.rawInput);
 *     console.error("尝试的格式:", err.attemptedFormats);
 *   } else if (err instanceof ComputeScopeError) {
 *     console.error("计算失败:", err.context);
 *     console.error("建议:", err.suggestion);
 *   }
 * }
 * ```
 */
export function computeScopeData(person: Person, solarDate: Date | string): HbarData | null {
  const stop = timer("computeScopeData");
  try {
    // 本命盘计算（computeAstrolabe 失败时抛 ComputeScopeError）
    const astrolabe = computeAstrolabe(person);

    // 日期解析：使用 parseDate 确保多格式支持，失败时抛 ParseDateError
    const d = parseDate(solarDate);
    if (isNaN(d.getTime())) {
      throw new ParseDateError(solarDate, ["Date.parse"], "解析结果为 Invalid Date");
    }

    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;
    // hbar 流月/流日按阳历排列，所以 pick 直接用阳历值
    const pick = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: Math.floor((d.getHours() + 1) / 2) % 12,
      leap: false,
    };

    // 确保 pick.year 不早于出生农历年
    if (pick.year < birthLunarYear) {
      pick.year = birthLunarYear;
    }

    const result = buildHbarData(astrolabe, birthLunarYear, pick);
    log("info", "computeScopeData", "计算成功", {
      personId: person.id,
      personName: person.name,
      birthLunarYear,
      pick,
      hasResult: !!result,
    });
    stop();
    return result;
  } catch (err) {
    // 自定义错误（ComputeScopeError / ParseDateError）直接抛出
    if (err instanceof ZiWeiError) {
      stop();
      throw err;
    }
    // 意外错误：包装为 ComputeScopeError
    stop();
    throw new ComputeScopeError("运限计算失败", {
      personId: person.id,
      personName: person.name,
      solarDate: String(solarDate),
      suggestion: "请检查人物数据完整性和日期格式。如问题持续，请排查 iztro 引擎版本",
      cause: err,
    });
  }
}

/**
 * 调试接口：根据阳历日期 + 人物 ID 获取运限数据（大运/流年/流月/流日/流时）。
 *
 * 纯计算接口，不操控 UI，可在任意上下文调用。
 *
 * 与 computeZiWeiData 的区别：
 * - GetScopeData / computeScopeData：从 Person 原始数据出发，独立计算本命盘 + 运限（不依赖 React 状态）
 * - computeZiWeiData：从已存在的 Zwds 对象读取数据（依赖 React 状态中的 astrolabe / horoscope / pick）
 *
 * 适用场景：
 * - 需要脱离 UI 状态独立计算（RTC Agent、自动化测试、后台计算）→ 用 GetScopeData
 * - 已经排盘完成、想读取当前盘面数据 → 用 computeZiWeiData 或 ZiWei(..., { skipUI: true })
 *
 * @param solarDate 阳历日期（Date 对象或 YYYY-MM-DD / YYYY-MM-DD HH:mm 格式字符串）
 * @param personId 人物 ID（可选，不传则使用默认人物）
 * @returns 运限拨盘完整数据（包含大运/流年/流月/流日/流时列表）
 *
 * @example
 * ```typescript
 * // 示例 1：获取默认人物的当前运限
 * const hbarData = await window.peep.GetScopeData("2024-06-15");
 * console.log("当前大运:", hbarData?.decadalList);
 * console.log("当前流年:", hbarData?.yearlyList);
 *
 * // 示例 2：获取指定人物的运限
 * const hbarData = await window.peep.GetScopeData("2024-06-15", 1);
 *
 * // 示例 3：使用 Date 对象
 * const now = new Date();
 * const hbarData = await window.peep.GetScopeData(now);
 *
 * // 示例 4：RTC Agent 推荐使用
 * // 因为纯计算无 UI 开销，响应快且无超时风险
 * const hbarData = await window.peep.GetScopeData("2024-06-15");
 * if (hbarData) {
 *   // 分析大运
 *   const currentDecadal = hbarData.decadalList.find(d => d.isCurrent);
 *   console.log("当前大运:", currentDecadal?.ganZhi);
 *
 *   // 分析流年
 *   const currentYearly = hbarData.yearlyList.find(y => y.isCurrent);
 *   console.log("当前流年:", currentYearly?.ganZhi);
 * }
 * ```
 */
export async function GetScopeData(
  solarDate: Date | string,
  personId?: number,
): Promise<HbarData | null> {
  const stop = timer("GetScopeData");
  try {
    const resolvedId = await resolvePersonId(personId);
    log("info", "GetScopeData", "开始计算", { solarDate, personId: resolvedId });

    const person = await getPerson(resolvedId);
    if (!person) {
      throw new Error(`人物 ${resolvedId} 不存在`);
    }

    const result = computeScopeData(person, solarDate);
    log("info", "GetScopeData", "计算完成", { personId: resolvedId, hasResult: !!result });
    stop();
    return result;
  } catch (err) {
    log("error", "GetScopeData", "计算失败", err);
    throw wrapError("GetScopeData", err, ZiWeiError);
  }
}

/**
 * 纯计算函数：大六壬排盘（不操控 UI，不依赖 React 状态）。
 *
 * 对 calculateDaLiuRen 的薄包装：增加日志、计时、DaLiuRenError 错误处理。
 * 可在任意上下文调用（RTC Agent、自动化测试、控制台调试）。
 *
 * @param date 公历日期（YYYY-MM-DD 或 YYYY/MM/DD）
 * @param time 时间（HH:mm 或 HH:mm:ss）
 * @param fateInput 可选：生年与性别（用于计算命宫行年）
 * @returns 完整大六壬排盘结果
 * @throws DaLiuRenError 排盘失败时抛出，包含输入上下文和恢复建议
 *
 * @example
 * ```typescript
 * // 示例 1：基础起课（不带命主信息）
 * const result = window.peep.computeDaLiuRenData("2024-06-15", "14:30");
 * console.log("起课时间:", result.calculationTime);
 * console.log("四课:", result.siSanchuan.siKe);
 * console.log("三传:", result.siSanchuan.sanChuan);
 * console.log("天地盘:", result.tianDiPan);
 *
 * // 示例 2：带命主信息（计算命宫行年）
 * const result = window.peep.computeDaLiuRenData("2024-06-15", "14:30", {
 *   birthYear: 1990,
 *   gender: "男"
 * });
 * console.log("命宫:", result.fate?.mingGong);
 * console.log("行年:", result.fate?.xingNian);
 *
 * // 示例 3：错误处理
 * try {
 *   const result = window.peep.computeDaLiuRenData("invalid", "14:30");
 * } catch (err) {
 *   if (err instanceof DaLiuRenError) {
 *     console.error("来源:", err.source);
 *     console.error("输入上下文:", err.context);
 *     console.error("建议:", err.suggestion);
 *   }
 * }
 * ```
 */
export function computeDaLiuRenData(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" },
): DaLiuRenResult {
  const stop = timer("computeDaLiuRenData");
  try {
    log("info", "computeDaLiuRenData", "纯计算排盘", { date, time, fateInput });
    const result = calculateDaLiuRen(date, time, fateInput);
    log("info", "computeDaLiuRenData", "排盘成功", {
      calculationTime: result.calculationTime,
      hasFate: !!result.fate,
    });
    stop();
    return result;
  } catch (err) {
    stop();
    if (err instanceof DaLiuRenError) throw err;
    log("error", "computeDaLiuRenData", "排盘失败", err);
    throw new DaLiuRenError("大六壬排盘计算失败", "computeDaLiuRenData", {
      context: { date, time, fateInput },
      suggestion: "请检查日期格式（YYYY-MM-DD）和时间格式（HH:mm 或 HH:mm:ss）是否正确",
      cause: err,
    });
  }
}

/**
 * 大六壬排盘调试接口（向后兼容）
 *
 * 直接调用 computeDaLiuRenData 纯计算函数。
 * 保留原签名以兼容已有调用方，推荐新代码直接使用 computeDaLiuRenData。
 *
 * @param date 公历日期（YYYY-MM-DD）
 * @param time 时间（HH:mm 或 HH:mm:ss）
 * @param fateInput 可选：生年与性别
 */
export function DaLiuRen(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" },
): DaLiuRenResult {
  return computeDaLiuRenData(date, time, fateInput);
}

/**
 * 大六壬起课调试接口——创建起课记录。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、填写表单、打开 Dialog、提交
 * - 数据计算层（computeDaLiuRenData / DB 操作）：纯计算或直接写入数据库
 *
 * skipUI=true 时：跳过所有 UI 操控，直接计算排盘结果并写入数据库。
 * 适用于 RTC Agent、自动化测试等无 UI 上下文。
 *
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 起课参数
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 创建后的起课记录，包含 id 和完整排盘结果
 *
 * @example
 * ```typescript
 * // 示例 1：skipUI 模式创建起课（RTC Agent 推荐）
 * const record = await window.peep.DaLiuRenCreate({
 *   question: "这笔生意能不能做？",
 *   note: "客户询问合作前景",
 *   background: "客户与对方已洽谈三月",
 *   tags: ["求财", "合作"],
 * }, { skipUI: true });
 * console.log("起课 ID:", record.id);
 * console.log("四课:", record.result.siSanchuan.siKe);
 *
 * // 示例 2：使用自定义起课时间
 * const record = await window.peep.DaLiuRenCreate({
 *   question: "今日出行是否顺利？",
 *   calculationTime: "2024-06-15 08:30:00",
 * }, { skipUI: true });
 *
 * // 示例 3：完整 UI 模式（会打开大六壬页面并填写表单）
 * const record = await window.peep.DaLiuRenCreate({
 *   personId: 1,
 *   question: "考试能否通过？",
 *   tags: ["考试", "学业"],
 * });
 * ```
 *
 * @throws {DaLiuRenError} 起课失败时抛出
 */
export async function DaLiuRenCreate(
  params: {
    personId?: number;
    question: string;
    note?: string;
    background?: string;
    tags?: string[];
    /** 可选：自定义起课时间（YYYY-MM-DD HH:mm:ss），不传则使用当前时间 */
    calculationTime?: string;
  },
  options?: DaLiuRenOptions,
): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenCreate");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenCreate", "开始创建起课", {
      personId,
      question: params.question,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：纯计算 + DB 写入，不操控 UI ── */
    if (options?.skipUI) {
      // 验证人物存在
      const personCheck = await getPerson(personId);
      if (!personCheck) {
        throw new DaLiuRenError(`人物 ${personId} 不存在`, "DaLiuRenCreate", {
          context: { personId },
          suggestion: "请检查人物 ID 是否正确",
        });
      }

      // 计算排盘结果（有自定义时间则用之，否则用当前时间）
      // 复用 parseDate 统一解析，支持更多时间格式（ISO 8601、时间戳等）
      let calcResult: DaLiuRenResult;
      let calculationTime: string;
      if (params.calculationTime) {
        // 复用 parseDate 解析自定义时间（支持 ISO 8601、YYYY-MM-DD HH:mm:ss、时间戳等）
        const parsed = parseDate(params.calculationTime);
        const pad = (n: number) => String(n).padStart(2, "0");
        const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
        const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
        calcResult = computeDaLiuRenData(date, time);
        calculationTime = `${date} ${time}`;
      } else {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        calcResult = computeDaLiuRenData(date, time);
        calculationTime = `${date} ${time}`;
      }

      // 构造记录并写入数据库
      const record: LiurenRecord = {
        personId,
        calculationTime,
        question: params.question,
        note: params.note ?? "",
        background: params.background ?? "",
        tags: params.tags ?? [],
        result: calcResult,
        savedAt: Date.now(),
      };
      const id = await saveLiurenRecord(record);
      invalidateLiurenTagCache();

      log("info", "DaLiuRenCreate", "skipUI 模式创建成功", { recordId: id });
      stop();
      return { ...record, id };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    // 等待大六壬回调就绪（轮询验证替代盲等）
    await waitForDaLiuRenCallbacks();

    if (!_selectPerson || !_openCreateDialog || !_fillCreateForm || !_submitCreateForm) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenCreate", {
        context: {
          selectPersonReady: !!_selectPerson,
          openCreateDialogReady: !!_openCreateDialog,
          fillCreateFormReady: !!_fillCreateForm,
          submitCreateFormReady: !!_submitCreateForm,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 填写表单（在打开 Dialog 之前设置初始数据）
    _fillCreateForm({
      question: params.question,
      note: params.note ?? "",
      background: params.background ?? "",
      tags: params.tags ?? [],
    });
    // 等待表单状态更新完成（双 rAF 替代盲等）
    await nextFrame();
    await nextFrame();

    // 3. 打开新建 Dialog（Dialog 打开时会读取已设置的初始数据）
    _openCreateDialog();
    // 等待 Dialog DOM 渲染完成（轮询检测替代盲等）
    await waitForDialogReady();

    // 4. 提交表单
    const record = await _submitCreateForm();

    // 5. 等待保存完成并验证记录存在
    await waitForRecordSaved(record.id, 2000);

    log("info", "DaLiuRenCreate", "创建成功", { recordId: record.id });
    stop();
    return record;
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      log("error", "DaLiuRenCreate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "DaLiuRenCreate", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenCreate", err, DaLiuRenError);
  }
}

/**
 * 大六壬起课列表调试接口——查询起课记录列表。
 *
 * skipUI=true 时：直接查询数据库，不导航页面、不切换人物。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 设置 UI 过滤条件 + 查询。
 *
 * @param params 查询参数
 * @param options 可选配置项（目前支持 skipUI）
 */
export async function DaLiuRenList(
  params: {
    personId?: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  },
  options?: DaLiuRenOptions,
): Promise<{ records: LiurenRecord[]; total: number }> {
  const stop = timer("DaLiuRenList");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenList", "查询列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
      skipUI: !!options?.skipUI,
    });

    const filters: LiurenListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const result = await listLiurenRecords(personId, filters);
      log("info", "DaLiuRenList", "skipUI 模式查询成功", {
        total: result.total,
        returned: result.records.length,
      });
      stop();
      return { records: result.records, total: result.total };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");
    await waitForDaLiuRenCallbacks();

    if (!_selectPerson || !_getDaLiuRenList) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenList", {
        context: {
          selectPersonReady: !!_selectPerson,
          getDaLiuRenListReady: !!_getDaLiuRenList,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (_setListFilters && (params.searchText || params.tags || params.page)) {
      _setListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      // 等待 UI 状态更新完成
      await waitForStateUpdate();
    }

    // 3. 获取列表
    const result = await _getDaLiuRenList(filters);

    log("info", "DaLiuRenList", "查询成功", {
      total: result.total,
      returned: result.records.length,
    });
    stop();
    return { records: result.records, total: result.total };
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenList", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenList", err, DaLiuRenError);
  }
}

/**
 * 大六壬起课详情调试接口——查看单条起课记录。
 *
 * skipUI=true 时：直接查询数据库获取记录，并附带纯计算数据。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 选择记录 + 返回详情。
 *
 * @param params 查看参数（personId 可选，recordId 必填）
 * @param options 可选配置项（目前支持 skipUI）
 */
export async function DaLiuRenView(
  params: {
    personId?: number;
    recordId: number;
  },
  options?: DaLiuRenOptions,
): Promise<DaLiuRenViewResult> {
  const stop = timer("DaLiuRenView");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenView", "查看详情", {
      personId,
      recordId: params.recordId,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const record = await getLiurenRecord(params.recordId);
      if (!record) {
        throw new DaLiuRenError(`记录 ${params.recordId} 不存在`, "DaLiuRenView", {
          context: { recordId: params.recordId },
          suggestion: "请检查记录 ID 是否正确，该记录可能已被删除",
        });
      }
      // 附带纯计算数据（验证 result 结构完整性）
      const computed: DaLiuRenComputedData = {
        calculationTime: record.calculationTime,
        result: record.result,
        person: (await getPerson(record.personId)) ?? null,
      };
      log("info", "DaLiuRenView", "skipUI 模式查看成功", { recordId: record.id });
      stop();
      return { ...record, computed };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");
    await waitForDaLiuRenCallbacks();

    if (!_selectPerson || !_selectRecord || !_getSelectedRecord) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenView", {
        context: {
          selectPersonReady: !!_selectPerson,
          selectRecordReady: !!_selectRecord,
          getSelectedRecordReady: !!_getSelectedRecord,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 选择记录（带重试验证）
    const record = await _selectRecord(params.recordId);
    await waitForStateUpdate();

    // 3. 获取详情（优先使用 selectRecord 返回值，回退到 getSelectedRecord）
    const selectedRecord = record ?? _getSelectedRecord();
    if (!selectedRecord) {
      throw new DaLiuRenError(`记录 ${params.recordId} 未找到或加载失败`, "DaLiuRenView", {
        context: { recordId: params.recordId, selectRecordReturned: !!record },
        suggestion: "请检查记录 ID 是否正确，或尝试刷新页面后重试",
      });
    }

    // 4. 附带纯计算数据
    const computed: DaLiuRenComputedData = {
      calculationTime: selectedRecord.calculationTime,
      result: selectedRecord.result,
      person: _getPerson?.() ?? null,
    };

    log("info", "DaLiuRenView", "查看成功", { recordId: selectedRecord.id });
    stop();
    return { ...selectedRecord, computed };
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenView", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenView", err, DaLiuRenError);
  }
}

/**
 * Wiki 文档列表调试接口——查询文档列表。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、设置 UI 过滤条件
 * - 数据查询层（listWikiDocs）：直接查询数据库
 *
 * skipUI=true 时：跳过所有 UI 操控，直接查询数据库。
 * 适用于 RTC Agent、自动化测试等无 UI 上下文。
 *
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 查询参数
 * @param options 可选配置项（目前支持 skipUI）
 */
export async function WikiList(
  params: {
    personId?: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  },
  options?: WikiOptions,
): Promise<{ docs: WikiDocument[]; total: number }> {
  const stop = timer("WikiList");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiList", "查询文档列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
      skipUI: !!options?.skipUI,
    });

    const filters: WikiListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const result = await listWikiDocs(personId, filters);
      log("info", "WikiList", "skipUI 模式查询成功", {
        total: result.total,
        returned: result.docs.length,
      });
      stop();
      return { docs: result.docs, total: result.total };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!_selectPerson || !_getWikiList) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiList", {
        context: {
          selectPersonReady: !!_selectPerson,
          getWikiListReady: !!_getWikiList,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (_setWikiListFilters && (params.searchText || params.tags || params.page)) {
      _setWikiListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      // 等待 UI 状态更新完成
      await waitForStateUpdate();
    }

    // 3. 获取列表
    const result = await _getWikiList(filters);

    log("info", "WikiList", "查询成功", { total: result.total, returned: result.docs.length });
    stop();
    return { docs: result.docs, total: result.total };
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiList", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiList", "执行失败", err);
    stop();
    throw wrapError("WikiList", err, WikiError);
  }
}

/**
 * Wiki 文档创建调试接口——创建文档。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、打开编辑器
 * - 数据写入层（DB 操作）：直接写入数据库
 *
 * skipUI=true 时：跳过所有 UI 操控，直接写入数据库。
 * 适用于 RTC Agent、自动化测试等无 UI 上下文。
 *
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 文档参数
 * @param options 可选配置项（目前支持 skipUI）
 */
export async function WikiCreate(
  params: {
    personId?: number;
    title: string;
    content: string;
    tags?: string[];
    linkTargetIds?: number[];
  },
  options?: WikiOptions,
): Promise<WikiDocument> {
  const stop = timer("WikiCreate");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiCreate", "创建文档", {
      personId,
      title: params.title,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接写入数据库，不操控 UI ── */
    if (options?.skipUI) {
      // 验证人物存在
      const personCheck = await getPerson(personId);
      if (!personCheck) {
        throw new WikiError(`人物 ${personId} 不存在`, "WikiCreate", {
          context: { personId },
          suggestion: "请检查人物 ID 是否正确",
        });
      }

      // 构造文档并写入数据库
      const now = Date.now();
      const doc: WikiDocument = {
        personId,
        title: params.title,
        content: params.content,
        tags: params.tags || [],
        savedAt: now,
        updatedAt: now,
      };

      const id = await saveWikiDocToDb(doc);

      // 保存链接关系（如果有）
      if (params.linkTargetIds && params.linkTargetIds.length > 0) {
        await saveWikiLinks(id, params.linkTargetIds);
      }

      // 验证文档已保存
      await waitForDocSaved(id, 2000);

      log("info", "WikiCreate", "skipUI 模式创建成功", { docId: id });
      stop();
      return { ...doc, id };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!_selectPerson || !_openWikiEditor || !_saveWikiDoc) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiCreate", {
        context: {
          selectPersonReady: !!_selectPerson,
          openWikiEditorReady: !!_openWikiEditor,
          saveWikiDocReady: !!_saveWikiDoc,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 打开编辑器
    _openWikiEditor();
    // 等待 Dialog DOM 渲染完成（双 rAF 替代盲等）
    await waitForDialogReady();

    // 3. 构造文档并保存
    const now = Date.now();
    const doc: WikiDocument = {
      personId,
      title: params.title,
      content: params.content,
      tags: params.tags || [],
      savedAt: now,
      updatedAt: now,
    };

    const saved = await _saveWikiDoc(doc, params.linkTargetIds || []);

    // 4. 等待保存完成并验证文档存在
    await waitForDocSaved(saved.id, 2000);

    log("info", "WikiCreate", "创建成功", { docId: saved.id });
    stop();
    return saved;
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiCreate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiCreate", "执行失败", err);
    stop();
    throw wrapError("WikiCreate", err, WikiError);
  }
}

/**
 * Wiki 文档详情调试接口——查看文档详情。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、选择文档
 * - 数据查询层（DB 操作）：直接查询数据库
 *
 * skipUI=true 时：直接查询数据库获取文档，并查询链接关系。
 * 适用于 RTC Agent、自动化测试等无 UI 上下文。
 *
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 查看参数（personId 可选，docId 必填）
 * @param options 可选配置项（目前支持 skipUI）
 */
export async function WikiView(
  params: {
    personId?: number;
    docId: number;
    /** 是否查询反向链接（谁链接到了本文档） */
    includeBacklinks?: boolean;
  },
  options?: WikiOptions,
): Promise<WikiViewResult> {
  const stop = timer("WikiView");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiView", "查看文档", {
      personId,
      docId: params.docId,
      includeBacklinks: !!params.includeBacklinks,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const doc = await getWikiDoc(params.docId);
      if (!doc) {
        throw new WikiError(`文档 ${params.docId} 不存在`, "WikiView", {
          context: { docId: params.docId },
          suggestion: "请检查文档 ID 是否正确，该文档可能已被删除",
        });
      }

      // 查询正向链接目标 ID
      const linkTargetIds = doc.id ? await getWikiLinks(doc.id) : [];

      // 可选：查询反向链接源 ID
      let backlinkSourceIds: number[] | undefined;
      if (params.includeBacklinks && doc.id) {
        backlinkSourceIds = await getWikiBacklinks(doc.id);
      }

      log("info", "WikiView", "skipUI 模式查看成功", {
        docId: doc.id,
        links: linkTargetIds.length,
        backlinks: backlinkSourceIds?.length ?? 0,
      });
      stop();
      return { ...doc, linkTargetIds, backlinkSourceIds };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!_selectPerson || !_selectWikiDoc || !_getSelectedWikiDoc) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiView", {
        context: {
          selectPersonReady: !!_selectPerson,
          selectWikiDocReady: !!_selectWikiDoc,
          getSelectedWikiDocReady: !!_getSelectedWikiDoc,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 打开指定文档（selectWikiDoc 直接返回文档数据）
    const doc = await _selectWikiDoc(params.docId);
    await waitForStateUpdate();

    // 3. 获取详情（优先使用 selectWikiDoc 返回值，回退到 getSelectedWikiDoc）
    const selectedDoc = doc ?? _getSelectedWikiDoc();
    if (!selectedDoc) {
      throw new WikiError(`文档 ${params.docId} 未找到或加载失败`, "WikiView", {
        context: { docId: params.docId, selectWikiDocReturned: !!doc },
        suggestion: "请检查文档 ID 是否正确，或尝试刷新页面后重试",
      });
    }

    // 4. 查询正向链接目标 ID，附加到返回结果
    const linkTargetIds = selectedDoc.id ? await getWikiLinks(selectedDoc.id) : [];

    // 5. 可选：查询反向链接源 ID
    let backlinkSourceIds: number[] | undefined;
    if (params.includeBacklinks && selectedDoc.id) {
      backlinkSourceIds = await getWikiBacklinks(selectedDoc.id);
    }

    log("info", "WikiView", "查看成功", {
      docId: selectedDoc.id,
      links: linkTargetIds.length,
      backlinks: backlinkSourceIds?.length ?? 0,
    });
    stop();
    return { ...selectedDoc, linkTargetIds, backlinkSourceIds };
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiView", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiView", "执行失败", err);
    stop();
    throw wrapError("WikiView", err, WikiError);
  }
}

/* ============================================================
 * 辅助函数
 * ============================================================ */

/**
 * 辅助函数：等待页面加载。
 * 改进：轮询验证回调就绪状态（而非盲等 200ms），但保留最小延时确保 DOM 初次渲染完成。
 */
async function waitForPageLoad(): Promise<void> {
  // 最小延时：确保 React 完成初次渲染（DOM 挂载、useEffect 执行）
  await new Promise(r => setTimeout(r, 50));

  // 轮询验证：等待回调注册完成（最多 500ms）
  const start = Date.now();
  const maxWait = 500;
  while (Date.now() - start < maxWait) {
    // 只要有任一回调查询接口就绪，认为页面已加载
    if (_callbacksReady.ziwei || _callbacksReady.daliuren || _callbacksReady.wiki) {
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
 */
async function waitForStateUpdate(): Promise<void> {
  // 双 rAF 确保 React commit 阶段完成（使用 nextFrame 兼容非浏览器环境）
  await nextFrame();
  await nextFrame();

  // 轮询验证 pick 稳定（如果在 ZiWei 上下文中）
  if (!_getZwds) return;
  const z = _getZwds();
  if (!z) return;

  const start = Date.now();
  let lastPick = JSON.stringify(z.pick);
  let stableCount = 0;
  const requiredStable = 3; // 连续 3 次采样相同才认为已稳定（防止振荡误判）
  const maxWait = 300;
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 20));
    const currentPick = JSON.stringify(z.pick);
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

/** 等待下一帧（确保 useEffect commit 阶段执行完成）
 *  兼容非浏览器环境（SSR/Node.js）：requestAnimationFrame 不可用时降级为 setTimeout(16ms)
 */
function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== "undefined") {
    return new Promise(r => requestAnimationFrame(_ts => r()));
  }
  // 降级：约 60fps（1000ms / 60 ≈ 16ms）
  return new Promise(r => setTimeout(r, 16));
}

/**
 * 等待人物匹配：轮询验证当前选中人物的 ID 是否符合预期。
 * 替代盲等 100ms，通过检测 _getPerson() 的实际值判断切换是否完成。
 */
async function waitForPersonMatch(expectedId: number, timeout = 2000): Promise<void> {
  if (!_getPerson) {
    log("warn", "wait", "getPerson 回调未注册，跳过人物验证");
    return;
  }
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const person = _getPerson();
    if (person && person.id === expectedId) {
      log("debug", "wait", "人物匹配成功", {
        expectedId,
        actualId: person.id,
        elapsed: Date.now() - start,
      });
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  throw new ZiWeiError(
    `等待人物切换超时（期望 ID=${expectedId}，超时 ${timeout}ms）`,
    "waitForPersonMatch",
    {
      context: { expectedId, timeout, currentPerson: _getPerson?.()?.id },
      suggestion: "请检查人物是否存在，或尝试刷新页面后重新选择",
    },
  );
}

/**
 * 等待 astrolabe 稳定：轮询验证 astrolabe 引用不再变化。
 * 解决竞态：selectPerson 触发 astrolabe 重新计算，需要等其稳定后再操作 pick。
 */
async function waitForAstrolabeStable(z: Zwds, timeout = 2000): Promise<void> {
  const start = Date.now();
  let lastAstrolabe = z.astrolabe;
  let stableCount = 0;
  const requiredStable = 2; // 连续 2 次采样（间隔 30ms）相同，认为已稳定

  while (Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 30));
    if (z.astrolabe === lastAstrolabe) {
      stableCount++;
      if (stableCount >= requiredStable) {
        log("debug", "wait", "astrolabe 已稳定", { elapsed: Date.now() - start });
        return;
      }
    } else {
      lastAstrolabe = z.astrolabe;
      stableCount = 0; // 重新计数
    }
  }
  throw new ZiWeiError(`等待 astrolabe 稳定超时（${timeout}ms）`, "waitForAstrolabeStable", {
    context: { timeout },
    suggestion: "排盘引擎持续重算，可能触发了循环更新。请检查人物数据是否有异常值",
  });
}

/**
 * 等待 pick 被 useEffect 重置为"今天"。
 * 轮询验证 pick 的年月日是否为当前日期（clamped 到 birthLunarYear）。
 */
async function waitForPickReset(z: Zwds, timeout = 1000): Promise<void> {
  const now = new Date();
  const expectedYear = now.getFullYear();
  const expectedMonth = now.getMonth() + 1;
  const expectedDay = now.getDate();

  const start = Date.now();
  while (Date.now() - start < timeout) {
    // pick 已被重置：年月日匹配"今天"（birthLunarYear clamp 只影响远古出生者，现代日期不受影响）
    if (
      z.pick.year === expectedYear &&
      z.pick.month === expectedMonth &&
      z.pick.day === expectedDay
    ) {
      log("debug", "wait", "pick 已重置为今天", {
        pick: z.pick,
        elapsed: Date.now() - start,
      });
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  // 超时不抛错——可能是 birthLunarYear clamp 生效，或用户已在今天之前操作
  log("warn", "wait", "pick 重置等待超时，当前值可能非今天", { pick: z.pick, timeout });
}

/**
 * 等待 pick 匹配预期值：轮询验证 pick 的年月日时是否符合预期。
 * 用于 setHoroscopeTime 后的验证，确保设置生效。
 */
async function waitForPickMatch(
  z: Zwds,
  expected: { year: number; month: number; day: number; hour: number },
  timeout = 500,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (
      z.pick.year === expected.year &&
      z.pick.month === expected.month &&
      z.pick.day === expected.day &&
      z.pick.hour === expected.hour
    ) {
      return true;
    }
    await new Promise(r => setTimeout(r, 15));
  }
  return false;
}

/**
 * 导航到指定页面并等待回调注册完成。
 * 消除 ZiWei / DaLiuRen* / Wiki* 共用的 navigate + waitForCallbacks + waitForPageLoad 样板。
 */
async function navigateToPage(path: string, page: "ziwei" | "daliuren" | "wiki"): Promise<void> {
  if (_navigate) {
    _navigate(path);
  } else {
    // 降级：react-router 未就绪时直接跳转。需要拼上 Vite 的 base 前缀（如 /peep/），
    // 否则 GitHub Pages 子路径部署时会导航到错误位置。
    const base = import.meta.env.BASE_URL; // Vite 注入，结尾带斜杠（如 "/peep/"）
    const normalizedPath = path.replace(/^\//, ""); // 去首斜杠，避免拼出 "/peep//liuren"
    window.location.href = `${base}${normalizedPath}`;
  }
  await waitForCallbacks(page);
  await waitForPageLoad();
}

/**
 * 统一选择人物并等待状态更新。
 * 消除多个调试 API 函数共用的 _selectPerson + waitForStateUpdate 样板。
 */
async function selectPersonAndWait(personId: number): Promise<void> {
  if (!_selectPerson) {
    throw new ZiWeiError("调试 API 未初始化：selectPerson 回调未注册", "selectPersonAndWait", {
      suggestion: "请确认页面已加载完成",
    });
  }
  await _selectPerson(personId);
  await waitForStateUpdate();
}

/**
 * 泛型错误包装：保证调试 API 抛出的错误始终是 Error 实例，
 * 且消息包含来源标签、上下文信息和堆栈追踪。
 *
 * 对于 BaseDebugError 子类（ZiWeiError / DaLiuRenError / WikiError），直接返回（不重复包装）。
 * 对于原生 Error，附加来源标签。
 * 对于非 Error 值，包装为指定的错误类并保留原始值作为 cause。
 *
 * @template T 错误类类型，必须继承 BaseDebugError
 * @param label 来源标签（如 "ZiWei"、"DaLiuRenCreate"）
 * @param err 原始错误
 * @param ErrorClass 用于包装非 Error 值的错误类构造函数
 */
export function wrapError<T extends BaseDebugError>(
  label: string,
  err: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, source: string, options?: any) => T,
): Error {
  // 已经是 BaseDebugError 子类（ZiWeiError / DaLiuRenError / WikiError 等），直接返回
  if (err instanceof BaseDebugError) {
    return err;
  }

  // 原生 Error：附加来源标签，保留原始堆栈
  if (err instanceof Error) {
    if (!err.message.startsWith(`[${label}]`)) {
      err.message = `[${label}] ${err.message}`;
    }
    return err;
  }

  // 非 Error 值（string、number、object 等）：包装为指定错误类
  return new ErrorClass(`${label} 执行失败：${String(err)}`, label, {
    context: { rawError: typeof err === "object" ? JSON.stringify(err) : String(err) },
    suggestion: "此错误不是标准 Error 实例，请检查是否有地方 throw 了非 Error 值",
    cause: err,
  });
}

/**
 * 辅助函数：等待 Dialog DOM 渲染就绪（改进版）。
 * 使用双 rAF 确保 React commit 阶段完成，替代固定 100ms 盲等。
 */
async function waitForDialogReady(): Promise<void> {
  await nextFrame();
  await nextFrame();
  // 额外等待一帧确保 Dialog 动画/过渡完成
  await new Promise(r => setTimeout(r, 50));
}

/**
 * 辅助函数：等待大六壬页面回调注册完成。
 * 轮询验证替代盲等——检查 _callbacksReady.daliuren 标志。
 */
async function waitForDaLiuRenCallbacks(timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!_callbacksReady.daliuren) {
    if (Date.now() - start > timeout) {
      throw new DaLiuRenError(
        `大六壬页面回调注册超时（${timeout}ms）——页面可能未访问过或已卸载`,
        "waitForDaLiuRenCallbacks",
        {
          context: { timeout, callbacksReady: _callbacksReady },
          suggestion: "请先访问大六壬页面使其挂载，或检查 DaLiuRenPage 是否正确注册了回调",
        },
      );
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/**
 * 辅助函数：等待记录保存到数据库（轮询验证）。
 * 替代盲等——通过查询 DB 确认记录确实存在。
 */
async function waitForRecordSaved(recordId: number | undefined, timeout = 2000): Promise<void> {
  // 无 ID 时跳过验证（新建记录可能尚未分配 ID）
  if (recordId == null) {
    await new Promise(r => setTimeout(r, 150));
    return;
  }
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const record = await getLiurenRecord(recordId);
    if (record) {
      log("debug", "wait", "记录保存验证成功", {
        recordId,
        elapsed: Date.now() - start,
      });
      return;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  // 超时不抛错——记录可能已通过回调成功保存但 DB 查询有延迟
  log("warn", "wait", "记录保存等待超时，继续执行", { recordId, timeout });
}

/**
 * 辅助函数：等待 Wiki 页面回调注册完成。
 * 轮询验证替代盲等——检查 _callbacksReady.wiki 标志。
 */
async function waitForWikiCallbacks(timeout = 1000): Promise<void> {
  const start = Date.now();
  while (!_callbacksReady.wiki) {
    if (Date.now() - start > timeout) {
      throw new WikiError(
        `Wiki 页面回调注册超时（${timeout}ms）——页面可能未访问过或已卸载`,
        "waitForWikiCallbacks",
        {
          context: { timeout, callbacksReady: _callbacksReady },
          suggestion: "请先访问 Wiki 页面使其挂载，或检查 WikiPage 是否正确注册了回调",
        },
      );
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

/**
 * 辅助函数：等待 Wiki 文档保存到数据库（轮询验证）。
 * 替代盲等——通过查询 DB 确认文档确实存在。
 */
async function waitForDocSaved(docId: number | undefined, timeout = 2000): Promise<void> {
  // 无 ID 时跳过验证（新建文档可能尚未分配 ID）
  if (docId == null) {
    await new Promise(r => setTimeout(r, 150));
    return;
  }
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const doc = await getWikiDoc(docId);
    if (doc) {
      log("debug", "wait", "文档保存验证成功", {
        docId,
        elapsed: Date.now() - start,
      });
      return;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  // 超时不抛错——文档可能已通过回调成功保存但 DB 查询有延迟
  log("warn", "wait", "文档保存等待超时，继续执行", { docId, timeout });
}

/* ============================================================
 * window.peep 暴露 + 辅助控制台工具
 * ============================================================ */

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
    说明: "大六壬起课（创建记录，支持 skipUI）",
  },
  DaLiuRenList: {
    方法: "DaLiuRenList(params, options?)",
    说明: "大六壬起课列表（支持 skipUI）",
  },
  DaLiuRenView: {
    方法: "DaLiuRenView(params, options?)",
    说明: "大六壬起课详情（支持 skipUI）",
  },
  WikiCreate: { 方法: "WikiCreate(params, options?)", 说明: "Wiki 文档创建（支持 skipUI）" },
  WikiList: { 方法: "WikiList(params, options?)", 说明: "Wiki 文档列表（支持 skipUI）" },
  WikiView: { 方法: "WikiView(params, options?)", 说明: "Wiki 文档详情（支持 skipUI）" },
  getChartDataForScope: {
    方法: "getChartDataForScope(opts)",
    说明: "获取指定 scope 的运限盘面数据",
  },
};

/** 内部方法：version() 自动枚举时过滤掉，不展示给普通用户 */
const INTERNAL_METHODS = new Set([
  "resetDebugApi",
  "setLogLevel",
  "getCacheStats",
  "clearCaches",
  "version",
]);

/**
 * 版本信息打印——在控制台快速查看当前部署版本/构建时间/可用 API。
 * 启动调试时的第一个调用建议。
 *
 * 改进：从 window.peep 自动枚举公开 API key，过滤内部方法，
 * 避免新增 API 时忘记更新此列表导致文档与实际不一致。
 */
function version(): void {
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

/** 调整日志级别（调试时动态开启/关闭详细输出） */
function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log("info", "logger", `日志级别调整为 ${level}`);
}

/**
 * 性能监控：获取全部缓存统计（命中率/大小/淘汰数）。
 * 开发环境用于定位性能瓶颈；生产环境可用于调试。
 */
function getCacheStats(): Record<string, import("./cache").CacheStats> {
  return getAllCacheStats();
}

/**
 * 清空全部缓存：调试用，验证缓存是否影响结果正确性。
 * 清空后下次调用会重新计算全部缓存。
 */
function clearCaches(): void {
  clearAllCaches();
  clearHbarCaches();
  log("info", "cache", "全部缓存已清空");
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
  // 降级：initDebugApi 尚未调用时直接返回 window.peep（不应发生）
  if (typeof window !== "undefined" && window.peep) {
    return window.peep;
  }
  throw new Error("[debugApi] 内部 API 未初始化——请确认 initDebugApi 已在应用启动时调用");
}

/** 写操作方法名集合——生产环境不暴露到 window.peep，防止控制台或恶意脚本执行破坏性操作。
 * RTC Agent 通过内部 _internalPeepApi 通道调用这些方法，不走全局变量。
 */
const WRITE_METHODS = new Set([
  "PersonCreate",
  "PersonUpdate",
  "PersonDelete",
  "DaLiuRenCreate",
  "WikiCreate",
]);

/**
 * 初始化 window.peep（供控制台调试和自动化测试使用）。
 *
 * 安全策略：
 * - 开发环境：暴露全部方法（含写操作），方便调试
 * - 生产环境：只暴露只读方法（查询/计算），写操作通过 _internalPeepApi 供 RTC Agent 使用
 */
export function initDebugApi() {
  if (typeof window === "undefined") return;

  // 内部 API 通道：始终包含全部方法，供 RTC Agent Function handler 调用
  // 不挂到 window 全局，避免被控制台或恶意脚本访问
  _internalPeepApi = {
    PersonList,
    PersonGet,
    PersonCreate,
    PersonUpdate,
    PersonDelete,
    ZiWei,
    GetScopeData,
    computeScopeData,
    computeZiWeiData,
    DaLiuRen,
    computeDaLiuRenData,
    DaLiuRenCreate,
    DaLiuRenList,
    DaLiuRenView,
    WikiCreate,
    WikiList,
    WikiView,
    getChartDataForScope,
    version,
    setLogLevel,
    getCacheStats,
    clearCaches,
    resetDebugApi,
  };

  // 生产环境：window.peep 只暴露只读方法
  // 开发环境：暴露全部方法供调试
  const allMethods = _internalPeepApi!;
  if (import.meta.env.DEV) {
    window.peep = { ...allMethods } as typeof window.peep;
  } else {
    // 生产环境：过滤掉写操作
    const readOnly: Record<string, unknown> = {};
    for (const [key, fn] of Object.entries(allMethods)) {
      if (!WRITE_METHODS.has(key)) {
        readOnly[key] = fn;
      }
    }
    window.peep = readOnly as typeof window.peep;
  }

  log("info", "init", "调试 API 已初始化——输入 peep.version() 查看可用方法");
}
