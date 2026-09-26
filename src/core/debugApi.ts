/**
 * 调试 API 统一管理：window.peep 接口
 * 供自动化测试和控制台调试使用
 */
import { getChartDataForScope, type ScopeChartData } from "./analysis";
import type { Scope } from "./utils";
import type { Zwds } from "./useZwds";
import type { Person, LiurenRecord, WikiDocument } from "./personDb";
import { buildHbarData, type HbarData } from "./hbar";
import { calculateDaLiuRen } from "./daliuren/calculator";
import type { DaLiuRenResult } from "./daliuren/types";
import type { LiurenListFilters, LiurenListResult } from "./daliurenDb";
import { getWikiLinks, type WikiListFilters, type WikiListResult } from "./wikiDb";

/**
 * 运限级别（已统一使用 utils.Scope，此处为向后兼容保留别名）。
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

/** React 回调注册：从 App.tsx 注入 */
let _selectPerson: ((personId: number) => Promise<void>) | null = null;
let _getZwds: (() => Zwds | null) | null = null;
let _getPerson: (() => Person | null) | null = null;
let _navigate: ((path: string) => void) | null = null;

/** 大六壬 React 回调注册：从 DaLiuRenPage.tsx 注入 */
let _getDaLiuRenList: ((filters: LiurenListFilters) => Promise<LiurenListResult>) | null = null;
let _setListFilters: ((filters: { searchText?: string; tags?: string[]; page?: number }) => void) | null = null;
let _openCreateDialog: (() => void) | null = null;
let _fillCreateForm: ((data: { question: string; note?: string; background?: string; tags?: string[] }) => void) | null = null;
let _submitCreateForm: (() => Promise<LiurenRecord>) | null = null;
let _selectRecord: ((recordId: number) => Promise<LiurenRecord | null>) | null = null;
let _getSelectedRecord: (() => LiurenRecord | null) | null = null;

/** Wiki React 回调注册：从 WikiPage.tsx 注入 */
let _getWikiList: ((filters: WikiListFilters) => Promise<WikiListResult>) | null = null;
let _setWikiListFilters: ((filters: { searchText?: string; tags?: string[]; page?: number }) => void) | null = null;
let _openWikiEditor: (() => void) | null = null;
let _saveWikiDoc: ((doc: WikiDocument, linkTargetIds: number[]) => Promise<WikiDocument>) | null = null;
let _selectWikiDoc: ((docId: number) => Promise<WikiDocument | null>) | null = null;
let _getSelectedWikiDoc: (() => WikiDocument | null) | null = null;

/** 回调注册状态追踪 */
let _callbacksReady: {
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
  fillCreateForm?: (data: { question: string; note?: string; background?: string; tags?: string[] }) => void;
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
export function registerZiWeiCallbacks(opts: {
  getZwds: () => Zwds | null;
}) {
  _getZwds = opts.getZwds;
  _callbacksReady.ziwei = true;
}

/** 注册大六壬页面回调（DaLiuRenPage.tsx 调用） */
export function registerDaLiuRenCallbacks(opts: {
  getDaLiuRenList: (filters: LiurenListFilters) => Promise<LiurenListResult>;
  setListFilters?: (filters: { searchText?: string; tags?: string[]; page?: number }) => void;
  openCreateDialog: () => void;
  fillCreateForm: (data: { question: string; note?: string; background?: string; tags?: string[] }) => void;
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
}

/** 等待页面回调注册完成 */
async function waitForCallbacks(page: "ziwei" | "daliuren" | "wiki", timeout = 3000): Promise<void> {
  const start = Date.now();
  while (!_callbacksReady[page]) {
    if (Date.now() - start > timeout) {
      throw new Error(`${page} 页面的调试 API 回调注册超时（${timeout}ms）`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据
 *
 * 执行顺序：
 * 1. 切换人物（等待 astrolabe 重新计算完成）
 * 2. 设置时间（在 pick 被 useEffect 重置为"今天"之后）
 * 3. 设置运限级别（只显示目标 scope）
 * 4. 等待所有状态更新完成
 *
 * @param personId 人物 ID
 * @param scope 运限级别（decadal/yearly/monthly/daily/hourly）
 * @param time 可选时间参数（Date 或时间戳），用于设置运限时间
 */
export async function ZiWei(
  personId: number,
  scope?: Scope,
  time?: Date | number | string
): Promise<ZiWeiResult> {
  // 输入校验
  if (!Number.isFinite(personId) || personId <= 0) {
    throw new Error(`personId 无效：${personId}，需为正整数`);
  }
  if (scope && !["decadal", "yearly", "monthly", "daily", "hourly"].includes(scope)) {
    throw new Error(`scope 无效：${scope}，需为 decadal/yearly/monthly/daily/hourly 之一`);
  }
  try {
    // 跳转到 / 页面（紫微斗数）并等待回调注册
    await navigateToPage("/", "ziwei");

    if (!_selectPerson || !_getZwds || !_getPerson) {
      throw new Error("调试 API 未初始化，请确认 App 已加载");
    }

    // 1. 切换人物（操控 UI）
    await _selectPerson(personId);

    // 等待 astrolabe 重新计算 + useEffect 重置 pick 完成
    await new Promise((r) => setTimeout(r, 100));

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
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // 5. 获取数据
    const person = _getPerson();
    const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
    const hbar = hbarBase
      ? { ...hbarBase, visible: { ...z.visible } }
      : null;

    let chart: ScopeChartData | null = null;
    if (scope && z.astrolabe && z.horoscope) {
      chart = getChartDataForScope({
        astrolabe: z.astrolabe,
        horoscope: z.horoscope,
        scope,
      });
    }

    return { person, hbar, chart };
  } catch (err) {
    console.error("[debugApi] ZiWei 执行失败", err);
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

  z.actions.pickYear(year);
  z.actions.pickMonth(month, false);
  z.actions.pickDay(day);
  z.actions.pickHour(hourIdx);
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
  fateInput?: { birthYear: number; gender: "男" | "女" }
): DaLiuRenResult {
  return calculateDaLiuRen(date, time, fateInput);
}

/**
 * 大六壬起课调试接口
 * 跳转到 /liuren 页面，选择人物，打开新建 Dialog，填写表单，提交
 */
export async function DaLiuRenCreate(params: {
  personId: number;
  question: string;
  note?: string;
  background?: string;
  tags?: string[];
}): Promise<LiurenRecord> {
  try {
    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_openCreateDialog || !_fillCreateForm || !_submitCreateForm) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

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

    return record;
  } catch (err) {
    console.error("[debugApi] DaLiuRenCreate 执行失败", err);
    throw wrapDebugError("DaLiuRenCreate", err);
  }
}

/**
 * 大六壬起课列表调试接口
 * 跳转到 /liuren 页面，选择人物，设置过滤条件，返回列表
 */
export async function DaLiuRenList(params: {
  personId: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ records: LiurenRecord[]; total: number }> {
  try {
    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_getDaLiuRenList) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

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

    return { records: result.records, total: result.total };
  } catch (err) {
    console.error("[debugApi] DaLiuRenList 执行失败", err);
    throw wrapDebugError("DaLiuRenList", err);
  }
}

/**
 * 大六壬起课详情调试接口
 * 跳转到 /liuren 页面，选择人物，点击某条记录，返回详情
 */
export async function DaLiuRenView(params: {
  personId: number;
  recordId: number;
}): Promise<LiurenRecord> {
  try {
    // 1. 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");

    if (!_selectPerson || !_selectRecord || !_getSelectedRecord) {
      throw new Error("大六壬调试 API 未初始化，请确认 DaLiuRenPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

    // 3. 点击某条记录（selectRecord 直接返回记录数据）
    const record = await _selectRecord(params.recordId);
    await waitForStateUpdate();

    // 4. 获取详情（优先使用 selectRecord 返回值，回退到 getSelectedRecord）
    const selectedRecord = record ?? _getSelectedRecord();
    if (!selectedRecord) {
      throw new Error(`记录 ${params.recordId} 未找到或加载失败`);
    }

    return selectedRecord;
  } catch (err) {
    console.error("[debugApi] DaLiuRenView 执行失败", err);
    throw wrapDebugError("DaLiuRenView", err);
  }
}

/**
 * Wiki 文档列表调试接口
 * 跳转到 /wiki 页面，选择人物，设置过滤条件，返回列表
 */
export async function WikiList(params: {
  personId: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ docs: WikiDocument[]; total: number }> {
  try {
    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_getWikiList) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

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

    return { docs: result.docs, total: result.total };
  } catch (err) {
    console.error("[debugApi] WikiList 执行失败", err);
    throw wrapDebugError("WikiList", err);
  }
}

/**
 * Wiki 文档创建调试接口
 * 跳转到 /wiki 页面，选择人物，打开编辑器，保存文档
 */
export async function WikiCreate(params: {
  personId: number;
  title: string;
  content: string;
  tags?: string[];
  linkTargetIds?: number[];
}): Promise<WikiDocument> {
  try {
    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_openWikiEditor || !_saveWikiDoc) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

    // 3. 打开编辑器
    _openWikiEditor();
    await waitForDialogOpen();

    // 4. 构造文档并保存
    const now = Date.now();
    const doc: WikiDocument = {
      personId: params.personId,
      title: params.title,
      content: params.content,
      tags: params.tags || [],
      savedAt: now,
      updatedAt: now,
    };

    const saved = await _saveWikiDoc(doc, params.linkTargetIds || []);
    await waitForSaveComplete();

    return saved;
  } catch (err) {
    console.error("[debugApi] WikiCreate 执行失败", err);
    throw wrapDebugError("WikiCreate", err);
  }
}

/**
 * Wiki 文档详情调试接口
 * 跳转到 /wiki 页面，选择人物，打开指定文档，返回详情
 */
export async function WikiView(params: {
  personId: number;
  docId: number;
}): Promise<WikiDocument & { linkTargetIds: number[] }> {
  try {
    // 1. 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");

    if (!_selectPerson || !_selectWikiDoc || !_getSelectedWikiDoc) {
      throw new Error("Wiki 调试 API 未初始化，请确认 WikiPage 已加载");
    }

    // 2. 选择人物
    await selectPersonAndWait(params.personId);

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
    return { ...selectedDoc, linkTargetIds };
  } catch (err) {
    console.error("[debugApi] WikiView 执行失败", err);
    throw wrapDebugError("WikiView", err);
  }
}

/** 辅助函数：等待页面加载 */
function waitForPageLoad(): Promise<void> {
  return new Promise((r) => setTimeout(r, 200));
}

/** 辅助函数：等待状态更新 */
function waitForStateUpdate(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/**
 * 导航到指定页面并等待回调注册完成。
 * 消除 ZiWei / DaLiuRen* / Wiki* 共用的 navigate + waitForCallbacks + waitForPageLoad 样板。
 */
async function navigateToPage(
  path: string,
  page: "ziwei" | "daliuren" | "wiki"
): Promise<void> {
  if (_navigate) {
    _navigate(path);
  } else {
    window.location.href = path;
  }
  await waitForCallbacks(page);
  await waitForPageLoad();
}

/**
 * 统一选择人物并等待状态更新。
 * 消除多个调试 API 函数共用的 _selectPerson + waitForStateUpdate 样板。
 */
async function selectPersonAndWait(personId: number): Promise<void> {
  await _selectPerson!(personId);
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
  return new Promise((r) => setTimeout(r, 100));
}

/** 辅助函数：等待表单填写 */
function waitForFormFill(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50));
}

/** 辅助函数：等待保存完成 */
function waitForSaveComplete(): Promise<void> {
  return new Promise((r) => setTimeout(r, 150));
}

/** 初始化 window.peep（仅在开发环境） */
export function initDebugApi() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;

  window.peep = {
    ZiWei,
    DaLiuRen,
    DaLiuRenCreate,
    DaLiuRenList,
    DaLiuRenView,
    WikiCreate,
    WikiList,
    WikiView,
    getChartDataForScope,
  };
}
