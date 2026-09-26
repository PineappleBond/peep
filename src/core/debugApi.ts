/**
 * 调试 API 统一管理：window.peep 接口
 * 供自动化测试和控制台调试使用
 */
import { getChartDataForScope, type ScopeChartData } from "./analysis";
import type { Scope } from "./utils";
import type { Zwds } from "./useZwds";
import type { Person, LiurenRecord, WikiDocument } from "./personDb";
import { listPersons, getPerson, savePerson, deletePerson, getDefaultPerson } from "./personDb";
import { buildHbarData, type HbarData } from "./hbar";
import { calculateDaLiuRen } from "./daliuren/calculator";
import type { DaLiuRenResult } from "./daliuren/types";
import type { LiurenListFilters, LiurenListResult } from "./daliurenDb";
import { getWikiLinks, type WikiListFilters, type WikiListResult } from "./wikiDb";
import { globalEvents } from "./events";
import type { BirthInput } from "./useZwds";
import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import { MUTAGEN_TABLES } from "./utils";

/**
 * 运限级别（已统一使用 utils/Scope，此处为向后兼容保留别名）。
 * @deprecated 请使用 `Scope`
 */
export type ScopeName = Scope;

/**
 * computeZiWeiData 返回数据：hbar 运限拨盘 + chart 运限盘面
 */
export type ZiWeiComputedData = {
  /** 运限拨盘完整数据（含大运/流年/流月/流日/流时列表及可见性）；拨盘计算失败时为 null */
  hbar: (HbarData & { visible: Record<Scope, boolean> }) | null;
  /** 运限盘面数据；scope 未传或无 horoscope 时为 null */
  chart: ScopeChartData | null;
};

/** ZiWei 返回数据 */
export type ZiWeiResult = {
  person: Person | null;
  /** 运限拨盘完整数据（含大运/流年/流月/流日/流时列表）；拨盘计算失败时为 null */
  hbar: (HbarData & { visible: Record<Scope, boolean> }) | null;
  chart: ScopeChartData | null;
};

/** ZiWei 接口选项 */
export type ZiWeiOptions = {
  /**
   * 为 true 时跳过 UI 操控（导航、切换人物、设置时间、设置运限级别），
   * 仅根据当前 Zwds 状态计算并返回 hbar/chart 数据。
   * 等价于纯计算路径，可在任意上下文调用。
   */
  skipUI?: boolean;
};

/* ============================================================
 * 自定义错误类——带上下文信息、错误链、恢复建议。
 * 生产环境通过 import.meta.env.DEV 控制是否输出敏感细节。
 * ============================================================ */

/**
 * 紫微斗数基础错误类：所有 debugApi 自定义错误的基类。
 * 包含上下文信息（输入参数、中间状态）和恢复建议。
 */
export class ZiWeiError extends Error {
  /** 错误来源标签（如 "ZiWei"、"computeScopeData"） */
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
    this.name = "ZiWeiError";
    this.source = source;
    this.context = options?.context ?? {};
    this.suggestion = options?.suggestion;
    this.cause = options?.cause;
    // 确保堆栈追踪可用（V8 引擎）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ErrCtor = Error as any;
    if (typeof ErrCtor.captureStackTrace === "function") {
      ErrCtor.captureStackTrace(this, new.target);
    }
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

/**
 * 核心日志函数——仅在 import.meta.env.DEV 下输出。
 * 生产构建会被 tree-shaken 掉，零运行时开销。
 */
function log(level: LogLevel, category: string, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) return;

  const ts = new Date().toLocaleTimeString();
  const prefix = `[peep ${ts}][${category}]`;
  const method = level === "debug" ? "debug" : level === "info" ? "log" : level;

  // 带 CSS 样式的 console 输出（浏览器支持 %c 占位符）
  if (data !== undefined) {
    (console as unknown as Record<string, (...a: unknown[]) => void>)[method](
      `%c${prefix}%c ${message}`,
      LEVEL_STYLES[level],
      "",
      data,
    );
  } else {
    (console as unknown as Record<string, (...a: unknown[]) => void>)[method](
      `%c${prefix}%c ${message}`,
      LEVEL_STYLES[level],
      "",
    );
  }
}

/**
 * 性能计时工具——返回一个 stop 函数，调用时打印耗时。
 * 用法：const stop = timer("ZiWei"); ... stop(); // "ZiWei 耗时 23ms"
 */
function timer(category: string): () => void {
  if (!import.meta.env.DEV) return () => {};
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

/** 注册 React 回调（App.tsx 初始化时调用） */
export function registerDebugApi(opts: {
  selectPerson?: (personId: number) => Promise<void>;
  getZwds?: () => Zwds | null;
  getPerson?: () => Person | null;
  navigate?: (path: string) => void;
  getDaLiuRenList?: (filters: LiurenListFilters) => Promise<LiurenListResult>;
  setListFilters?: (filters: { searchText?: string; tags?: string[]; page?: number }) => void;
  openCreateDialog?: () => void;
  fillCreateForm?: (data: {
    question: string;
    note?: string;
    background?: string;
    tags?: string[];
  }) => void;
  submitCreateForm?: () => Promise<LiurenRecord>;
  selectRecord?: (recordId: number) => Promise<LiurenRecord | null>;
  getSelectedRecord?: () => LiurenRecord | null;
}) {
  if (opts.selectPerson) _selectPerson = opts.selectPerson;
  if (opts.getZwds) _getZwds = opts.getZwds;
  if (opts.getPerson) _getPerson = opts.getPerson;
  if (opts.navigate) _navigate = opts.navigate;
  if (opts.getDaLiuRenList) _getDaLiuRenList = opts.getDaLiuRenList;
  if (opts.setListFilters) _setListFilters = opts.setListFilters;
  if (opts.openCreateDialog) _openCreateDialog = opts.openCreateDialog;
  if (opts.fillCreateForm) _fillCreateForm = opts.fillCreateForm;
  if (opts.submitCreateForm) _submitCreateForm = opts.submitCreateForm;
  if (opts.selectRecord) _selectRecord = opts.selectRecord;
  if (opts.getSelectedRecord) _getSelectedRecord = opts.getSelectedRecord;
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

/** 等待页面回调注册完成 */
async function waitForCallbacks(
  page: "ziwei" | "daliuren" | "wiki",
  timeout = 3000,
): Promise<void> {
  const start = Date.now();
  while (!_callbacksReady[page]) {
    if (Date.now() - start > timeout) {
      const err = new ZiWeiError(
        `${page} 页面的调试 API 回调注册超时（${timeout}ms）`,
        "waitForCallbacks",
        {
          context: { page, timeout, callbacksReady: _callbacksReady },
          suggestion: `请确认 ${page} 页面组件已正确挂载并注册回调`,
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
    throw wrapDebugError("PersonList", err);
  }
}

/**
 * 获取人物详情：按 ID 查询，不传则返回默认人物。
 * 纯 DB 操作，无 UI 交互。
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
    throw wrapDebugError("PersonGet", err);
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
    throw wrapDebugError("PersonCreate", err);
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
    throw wrapDebugError("PersonUpdate", err);
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
    throw wrapDebugError("PersonDelete", err);
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
 */
export function computeZiWeiData(z: Zwds, scope?: Scope): ZiWeiComputedData {
  // 构建 hbar：运限拨盘数据（大运/流年/流月/流日/流时列表）
  const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
  const hbar = hbarBase ? { ...hbarBase, visible: { ...z.visible } } : null;

  // 构建 chart：指定 scope 的运限盘面数据
  let chart: ScopeChartData | null = null;
  if (scope && z.astrolabe && z.horoscope) {
    chart = getChartDataForScope({
      astrolabe: z.astrolabe,
      horoscope: z.horoscope,
      scope,
    });
  }

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
        throw wrapDebugError("ZiWei", err);
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
      throw wrapDebugError("ZiWei", err);
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
function parseDate(time: Date | number | string): Date {
  const attemptedFormats: string[] = [];

  // Date 实例直接返回
  if (time instanceof Date) {
    if (isNaN(time.getTime())) {
      throw new ParseDateError(time, ["Date 实例"], "Date 实例的值为 Invalid Date");
    }
    return time;
  }

  // 数字：时间戳（毫秒或秒）
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

  // 字符串解析
  let str = String(time).trim();
  if (!str) {
    throw new ParseDateError(time, [], "输入为空字符串");
  }

  // 尝试 1：纯数字字符串 → 当作时间戳
  if (/^\d+$/.test(str)) {
    attemptedFormats.push("纯数字字符串 (时间戳)");
    const num = Number(str);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "时间戳字符串解析成功", { input: str, result: d.toISOString() });
      return d;
    }
  }

  // 尝试 2：YYYY-MM-DD HH（补全分钟和秒）
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}$/.test(str)) {
    attemptedFormats.push("YYYY-MM-DD HH → YYYY-MM-DD HH:00:00");
    str += ":00:00";
  }

  // 尝试 3：YYYY-MM-DD（补全时间部分）
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    attemptedFormats.push("YYYY-MM-DD → YYYY-MM-DD 00:00:00");
    str += " 00:00:00";
  }

  // 尝试 4：ISO 8601 或浏览器原生解析
  attemptedFormats.push("ISO 8601 / 浏览器原生 Date.parse");
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    log("debug", "parseDate", "字符串解析成功", {
      input: time,
      format: attemptedFormats[attemptedFormats.length - 1],
      result: d.toISOString(),
    });
    return d;
  }

  // 所有格式均失败
  throw new ParseDateError(time, attemptedFormats, "所有尝试的格式均无法解析为有效日期");
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
function computeAstrolabe(person: Person) {
  try {
    return astro.withOptions({
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
 */
export function computeScopeData(person: Person, solarDate: Date | string): HbarData | null {
  const stop = timer("computeScopeData");
  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        attempt: attempt + 1,
      });
      stop();
      return result;
    } catch (err) {
      lastError = err;

      // 自定义错误（ComputeScopeError / ParseDateError）：不重试，直接抛出
      if (err instanceof ZiWeiError) {
        log("error", "computeScopeData", "计算失败（不重试）", {
          personId: person.id,
          attempt: attempt + 1,
        });
        stop();
        throw err;
      }

      // 其他意外错误：记录并重试（可能是临时性引擎异常）
      log("warn", "computeScopeData", `计算出现意外错误，第 ${attempt + 1} 次尝试`, {
        personId: person.id,
        error: err instanceof Error ? err.message : String(err),
      });

      if (attempt < maxRetries) {
        // 短暂延迟后重试
        const delayMs = 10 * (attempt + 1);
        const waitUntil = Date.now() + delayMs;
        while (Date.now() < waitUntil) {
          /* busy wait (同步函数无法用 setTimeout) */
        }
      }
    }
  }

  // 所有重试均失败
  stop();
  throw new ComputeScopeError(`运限计算重试 ${maxRetries} 次后仍失败`, {
    personId: person.id,
    personName: person.name,
    solarDate: String(solarDate),
    suggestion: "请检查人物数据完整性和日期格式。如问题持续，请排查 iztro 引擎版本",
    cause: lastError,
  });
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
 * @returns 运限拨盘完整数据
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
    throw wrapDebugError("GetScopeData", err);
  }
}

/**
 * 大六壬排盘调试接口
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
  log("info", "DaLiuRen", "纯计算排盘", { date, time, fateInput });
  return calculateDaLiuRen(date, time, fateInput);
}

/**
 * 大六壬起课调试接口
 * 跳转到 /liuren 页面，选择人物，打开新建 Dialog，填写表单，提交
 */
export async function DaLiuRenCreate(params: {
  personId?: number;
  question: string;
  note?: string;
  background?: string;
  tags?: string[];
}): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenCreate");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenCreate", "开始创建起课", {
      personId,
      question: params.question,
    });

    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_openCreateDialog || !_fillCreateForm || !_submitCreateForm) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 填写表单（在打开 Dialog 之前设置初始数据）
    _fillCreateForm({
      question: params.question,
      note: params.note || "",
      background: params.background || "",
      tags: params.tags || [],
    });
    await waitForFormFill();

    // 4. 打开新建 Dialog（Dialog 打开时会读取已设置的初始数据）
    _openCreateDialog();
    await waitForDialogOpen();

    // 5. 提交表单
    const record = await _submitCreateForm();
    await waitForSaveComplete();

    log("info", "DaLiuRenCreate", "创建成功", { recordId: record.id });
    stop();
    return record;
  } catch (err) {
    log("error", "DaLiuRenCreate", "执行失败", err);
    throw wrapDebugError("DaLiuRenCreate", err);
  }
}

/**
 * 大六壬起课列表调试接口
 * 跳转到 /liuren 页面，选择人物，设置过滤条件，返回列表
 */
export async function DaLiuRenList(params: {
  personId?: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ records: LiurenRecord[]; total: number }> {
  const stop = timer("DaLiuRenList");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenList", "查询列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
    });

    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_getDaLiuRenList) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (_setListFilters && (params.searchText || params.tags || params.page)) {
      _setListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      await waitForStateUpdate();
    }

    // 4. 获取列表
    const filters: LiurenListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };
    const result = await _getDaLiuRenList(filters);

    log("info", "DaLiuRenList", "查询成功", {
      total: result.total,
      returned: result.records.length,
    });
    stop();
    return { records: result.records, total: result.total };
  } catch (err) {
    log("error", "DaLiuRenList", "执行失败", err);
    throw wrapDebugError("DaLiuRenList", err);
  }
}

/**
 * 大六壬起课详情调试接口
 * 跳转到 /liuren 页面，选择人物，点击某条记录，返回详情
 */
export async function DaLiuRenView(params: {
  personId?: number;
  recordId: number;
}): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenView");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenView", "查看详情", {
      personId,
      recordId: params.recordId,
    });

    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_selectRecord || !_getSelectedRecord) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 点击某条记录（selectRecord 直接返回记录数据）
    const record = await _selectRecord(params.recordId);
    await waitForStateUpdate();

    // 4. 获取详情（优先使用 selectRecord 返回值，回退到 getSelectedRecord）
    const selectedRecord = record ?? _getSelectedRecord();
    if (!selectedRecord) {
      throw new Error(`记录 ${params.recordId} 未找到或加载失败`);
    }

    log("info", "DaLiuRenView", "查看成功", { recordId: selectedRecord.id });
    stop();
    return selectedRecord;
  } catch (err) {
    log("error", "DaLiuRenView", "执行失败", err);
    throw wrapDebugError("DaLiuRenView", err);
  }
}

/**
 * Wiki 文档列表调试接口
 * 跳转到 /wiki 页面，选择人物，设置过滤条件，返回列表
 */
export async function WikiList(params: {
  personId?: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ docs: WikiDocument[]; total: number }> {
  const stop = timer("WikiList");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiList", "查询文档列表", {
      personId,
      searchText: params.searchText,
    });

    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_getWikiList) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (_setWikiListFilters && (params.searchText || params.tags || params.page)) {
      _setWikiListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      await waitForStateUpdate();
    }

    // 4. 获取列表
    const filters: WikiListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };
    const result = await _getWikiList(filters);

    log("info", "WikiList", "查询成功", { total: result.total, returned: result.docs.length });
    stop();
    return { docs: result.docs, total: result.total };
  } catch (err) {
    log("error", "WikiList", "执行失败", err);
    throw wrapDebugError("WikiList", err);
  }
}

/**
 * Wiki 文档创建调试接口
 * 跳转到 /wiki 页面，选择人物，打开编辑器，保存文档
 */
export async function WikiCreate(params: {
  personId?: number;
  title: string;
  content: string;
  tags?: string[];
  linkTargetIds?: number[];
}): Promise<WikiDocument> {
  const stop = timer("WikiCreate");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiCreate", "创建文档", { personId, title: params.title });

    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_openWikiEditor || !_saveWikiDoc) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 打开编辑器
    _openWikiEditor();
    await waitForDialogOpen();

    // 4. 构造文档并保存
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
    await waitForSaveComplete();

    log("info", "WikiCreate", "创建成功", { docId: saved.id });
    stop();
    return saved;
  } catch (err) {
    log("error", "WikiCreate", "执行失败", err);
    throw wrapDebugError("WikiCreate", err);
  }
}

/**
 * Wiki 文档详情调试接口
 * 跳转到 /wiki 页面，选择人物，打开指定文档，返回详情
 */
export async function WikiView(params: {
  personId?: number;
  docId: number;
}): Promise<WikiDocument & { linkTargetIds: number[] }> {
  const stop = timer("WikiView");
  try {
    const personId = await resolvePersonId(params.personId);
    log("info", "WikiView", "查看文档", { personId, docId: params.docId });

    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_selectWikiDoc || !_getSelectedWikiDoc) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(personId);

    // 3. 打开指定文档（selectWikiDoc 直接返回文档数据）
    const doc = await _selectWikiDoc(params.docId);
    await waitForStateUpdate();

    // 4. 获取详情（优先使用 selectWikiDoc 返回值，回退到 getSelectedWikiDoc）
    const selectedDoc = doc ?? _getSelectedWikiDoc();
    if (!selectedDoc) {
      throw new Error(`文档 ${params.docId} 未找到或加载失败`);
    }

    // 5. 查询正向链接目标 ID，附加到返回结果
    const linkTargetIds = selectedDoc.id ? await getWikiLinks(selectedDoc.id) : [];

    log("info", "WikiView", "查看成功", { docId: selectedDoc.id, links: linkTargetIds.length });
    stop();
    return { ...selectedDoc, linkTargetIds };
  } catch (err) {
    log("error", "WikiView", "执行失败", err);
    throw wrapDebugError("WikiView", err);
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
 */
async function waitForStateUpdate(): Promise<void> {
  // 双 rAF 确保 React commit 阶段完成
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  // 轮询验证 pick 稳定（如果在 ZiWei 上下文中）
  if (!_getZwds) return;
  const z = _getZwds();
  if (!z) return;

  const start = Date.now();
  let lastPick = JSON.stringify(z.pick);
  const maxWait = 300;
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 20));
    const currentPick = JSON.stringify(z.pick);
    if (currentPick === lastPick) {
      // pick 连续两次采样相同，认为已稳定
      return;
    }
    lastPick = currentPick;
  }
  log("warn", "wait", "状态更新等待超时", { maxWait });
}

/** 等待下一帧（确保 useEffect commit 阶段执行完成） */
function nextFrame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(_ts => r()));
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
 * 错误包装：保证调试 API 抛出的错误始终是 Error 实例，
 * 且消息包含来源标签、上下文信息和堆栈追踪。
 *
 * 对于自定义错误类（ZiWeiError 及其子类），直接返回（不重复包装）。
 * 对于原生 Error，附加来源标签。
 * 对于非 Error 值，包装为 ZiWeiError 并保留原始值作为 cause。
 */
function wrapDebugError(label: string, err: unknown): Error {
  // 已经是自定义错误，直接返回
  if (err instanceof ZiWeiError) {
    return err;
  }

  // 原生 Error：附加来源标签，保留原始堆栈
  if (err instanceof Error) {
    // 在消息前加上来源标签（如果还没有）
    if (!err.message.startsWith(`[${label}]`)) {
      err.message = `[${label}] ${err.message}`;
    }
    return err;
  }

  // 非 Error 值（string、number、object 等）：包装为 ZiWeiError
  return new ZiWeiError(`${label} 执行失败：${String(err)}`, label, {
    context: { rawError: typeof err === "object" ? JSON.stringify(err) : String(err) },
    suggestion: "此错误不是标准 Error 实例，请检查是否有地方 throw 了非 Error 值",
    cause: err,
  });
}

/** 辅助函数：等待 Dialog 打开 */
function waitForDialogOpen(): Promise<void> {
  return new Promise(r => setTimeout(r, 100));
}

/** 辅助函数：等待表单填写 */
function waitForFormFill(): Promise<void> {
  return new Promise(r => setTimeout(r, 50));
}

/** 辅助函数：等待保存完成 */
function waitForSaveComplete(): Promise<void> {
  return new Promise(r => setTimeout(r, 150));
}

/* ============================================================
 * window.peep 暴露 + 辅助控制台工具
 * ============================================================ */

/**
 * 版本信息打印——在控制台快速查看当前部署版本/构建时间/可用 API。
 * 启动调试时的第一个调用建议。
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
  // eslint-disable-next-line no-console
  console.table([
    { 方法: "PersonList()", 说明: "人物列表" },
    { 方法: "PersonGet(personId?)", 说明: "获取人物详情（不传返回默认）" },
    { 方法: "PersonCreate(input)", 说明: "创建人物" },
    { 方法: "PersonUpdate(personId, input)", 说明: "更新人物" },
    { 方法: "PersonDelete(personId)", 说明: "删除人物" },
    { 方法: "ZiWei(personId?, scope?, time?)", 说明: "紫微斗数排盘+运限操控" },
    { 方法: "DaLiuRen(date, time, fateInput?)", 说明: "大六壬纯计算排盘" },
    { 方法: "DaLiuRenCreate(params)", 说明: "大六壬起课（创建记录）" },
    { 方法: "DaLiuRenList(params)", 说明: "大六壬起课列表" },
    { 方法: "DaLiuRenView(params)", 说明: "大六壬起课详情" },
    { 方法: "WikiCreate(params)", 说明: "Wiki 文档创建" },
    { 方法: "WikiList(params)", 说明: "Wiki 文档列表" },
    { 方法: "WikiView(params)", 说明: "Wiki 文档详情" },
    { 方法: "setLogLevel(level)", 说明: "调整日志级别：debug/info/warn/error" },
  ]);
}

/** 调整日志级别（调试时动态开启/关闭详细输出） */
function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log("info", "logger", `日志级别调整为 ${level}`);
}

/** 初始化 window.peep（开发/生产均暴露，供 RTC Agent Function 调用） */
export function initDebugApi() {
  if (typeof window === "undefined") return;
  // 注：原本有 import.meta.env.DEV 守卫，但 RTC Agent Function 在生产环境也需要
  // 通过 window.peep 调用排盘/起课/Wiki 能力，故移除。日志函数内部的 DEV 守卫保留，
  // 避免生产控制台输出调试信息。

  window.peep = {
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
    DaLiuRenCreate,
    DaLiuRenList,
    DaLiuRenView,
    WikiCreate,
    WikiList,
    WikiView,
    getChartDataForScope,
    version,
    setLogLevel,
  };

  log("info", "init", "调试 API 已初始化——输入 peep.version() 查看可用方法");
}
