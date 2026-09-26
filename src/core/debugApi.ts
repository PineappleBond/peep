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
import { solar2lunar } from "lunar-lite";
import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import { MUTAGEN_TABLES } from "./utils";

/**
 * 运限级别（已统一使用 utils/Scope，此处为向后兼容保留别名）。
 * @deprecated 请使用 `Scope`
 */
export type ScopeName = Scope;

/** ZiWei 返回数据 */
export type ZiWeiResult = {
  person: Person | null;
  /** 运限拨盘完整数据（含大运/流年/流月/流日/流时列表）；拨盘计算失败时为 null */
  hbar: (HbarData & { visible: Record<Scope, boolean> }) | null;
  chart: ScopeChartData | null;
};

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
      const err = new Error(`${page} 页面的调试 API 回调注册超时（${timeout}ms）`);
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
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据
 *
 * 执行顺序：
 * 1. 切换人物（等待 astrolabe 重新计算完成）
 * 2. 设置时间（在 pick 被 useEffect 重置为"今天"之后）
 * 3. 设置运限级别（只显示目标 scope）
 * 4. 等待所有状态更新完成
 *
 * @param personId 人物 ID（可选，不传则使用默认人物）
 * @param scope 运限级别（decadal/yearly/monthly/daily/hourly）
 * @param time 可选时间参数（Date 或时间戳），用于设置运限时间
 */
export async function ZiWei(
  personId?: number,
  scope?: Scope,
  time?: Date | number | string,
): Promise<ZiWeiResult> {
  const stop = timer("ZiWei");
  try {
    // 解析人物 ID（不传则用默认）
    const resolvedId = await resolvePersonId(personId);
    // 输入校验
    if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
      throw new Error(`personId 无效：${resolvedId}，需为正整数`);
    }
    if (scope && !["decadal", "yearly", "monthly", "daily", "hourly"].includes(scope)) {
      throw new Error(`scope 无效：${scope}，需为 decadal/yearly/monthly/daily/hourly 之一`);
    }

    log("info", "ZiWei", "开始执行", { personId, scope, time });

    // 跳转到 / 页面（紫微斗数）并等待回调注册
    await navigateToPage("/", "ziwei");

    if (!_selectPerson || !_getZwds || !_getPerson) {
      throw new Error("调试 API 未初始化，请确认 App 已加载");
    }

    // 1. 切换人物（操控 UI）
    await _selectPerson(resolvedId);

    // 等待 astrolabe 重新计算 + useEffect 重置 pick 完成
    await new Promise(r => setTimeout(r, 100));

    const z = _getZwds();
    if (!z) {
      throw new Error("排盘数据未就绪");
    }

    // 2. 设置时间（在 useEffect 重置之后）
    if (time) {
      const date = parseDate(time);
      if (isNaN(date.getTime())) {
        throw new Error(`无法解析时间：${time}`);
      }
      setHoroscopeTime(z, date);
    }

    // 3. 设置运限级别（只显示目标 scope，其他全部关闭）
    if (scope) {
      z.actions.showScope(scope);
    }

    // 4. 等待所有状态更新完成（双 rAF 确保渲染完成）
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // 5. 获取数据
    const person = _getPerson();
    const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
    const hbar = hbarBase ? { ...hbarBase, visible: { ...z.visible } } : null;

    let chart: ScopeChartData | null = null;
    if (scope && z.astrolabe && z.horoscope) {
      chart = getChartDataForScope({
        astrolabe: z.astrolabe,
        horoscope: z.horoscope,
        scope,
      });
    }

    log("info", "ZiWei", "执行成功", { personId: person?.id, scope, hasChart: !!chart });
    stop();
    return { person, hbar, chart };
  } catch (err) {
    log("error", "ZiWei", "执行失败", err);
    throw wrapDebugError("ZiWei", err);
  }
}

/** 解析时间：支持 Date/数字/字符串（含 "2024-06-15 12" 这种简写） */
function parseDate(time: Date | number | string): Date {
  if (time instanceof Date) return time;
  if (typeof time === "number") return new Date(time);
  // 字符串：尝试补全时间部分
  let str = time.trim();
  // "2024-06-15 12" → "2024-06-15 12:00:00"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}$/.test(str)) {
    str += ":00:00";
  }
  // "2024-06-15" → "2024-06-15 00:00:00"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str += " 00:00:00";
  }
  return new Date(str);
}

/** 设置运限时间：根据 Date 设置年月日时 */
function setHoroscopeTime(z: Zwds, date: Date): void {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 转换为时辰索引（0-11）
  const hourIdx = Math.floor(((hour + 1) % 24) / 2);

  // 公历转农历
  let lunarYear = year;
  let lunarMonth = month;
  let lunarDay = day;
  let isLeap = false;

  try {
    const lunar = solar2lunar(date);
    lunarYear = lunar.lunarYear;
    lunarMonth = lunar.lunarMonth;
    lunarDay = lunar.lunarDay;
    isLeap = lunar.isLeap;
  } catch {
    // 转换失败时使用公历值（兜底）
    console.warn("[debugApi] 公历转农历失败，使用公历值");
  }

  z.actions.pickYear(lunarYear);
  z.actions.pickMonth(lunarMonth, isLeap);
  z.actions.pickDay(lunarDay);
  z.actions.pickHour(hourIdx);
}

/**
 * 纯函数：从 Person 数据计算紫微斗数本命盘（不依赖 React 状态）
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @returns iztro 本命盘对象，计算失败返回 null
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
    return null;
  }
}

/**
 * 纯函数：根据阳历日期获取人物的运限数据（大运/流年/流月/流日/流时）
 *
 * 不依赖 React 状态，可在任意上下文调用（调试 API、RTC Agent 等）。
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @param solarDate 阳历日期（Date 对象或 YYYY-MM-DD 格式字符串）
 * @returns 运限拨盘完整数据，计算失败返回 null
 */
export function computeScopeData(person: Person, solarDate: Date | string): HbarData | null {
  const stop = timer("computeScopeData");
  try {
    const astrolabe = computeAstrolabe(person);
    if (!astrolabe) {
      log("error", "computeScopeData", "本命盘计算失败");
      return null;
    }

    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;
    const d = typeof solarDate === "string" ? new Date(solarDate) : solarDate;
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
      birthLunarYear,
      pick,
      hasResult: !!result,
    });
    stop();
    return result;
  } catch (err) {
    log("error", "computeScopeData", "计算失败", err);
    return null;
  }
}

/**
 * 调试接口：根据阳历日期 + 人物 ID 获取运限数据（大运/流年/流月/流日/流时）
 *
 * 纯计算接口，不操控 UI，可在任意上下文调用。
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

/** 辅助函数：等待页面加载 */
function waitForPageLoad(): Promise<void> {
  return new Promise(r => setTimeout(r, 200));
}

/** 辅助函数：等待状态更新 */
function waitForStateUpdate(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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
    throw new Error("调试 API 未初始化：selectPerson 回调未注册");
  }
  await _selectPerson(personId);
  await waitForStateUpdate();
}

/**
 * 错误包装：保证调试 API 抛出的错误始终是 Error 实例，
 * 且消息包含来源标签便于排查。
 */
function wrapDebugError(label: string, err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(`${label} 执行失败：${String(err)}`);
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
