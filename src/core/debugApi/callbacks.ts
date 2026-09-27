/**
 * 调试 API 回调注册和状态管理
 *
 * React 回调注册：从 App.tsx / 各页面注入
 * 用于在调试 API 中操控 UI 状态
 */

import type { Zwds } from "../useZwds";
import type { Person, LiurenRecord, WikiDocument } from "../personDb";
import type { LiurenListFilters, LiurenListResult } from "../daliurenDb";
import type { WikiListFilters, WikiListResult } from "../wikiDb";
import { log } from "./logger";
import { ZiWeiError, DaLiuRenError, WikiError } from "./errors";

/* ============================================================
 * React 回调注册——从 App.tsx / 各页面注入
 * ============================================================ */

/** 全局回调变量 */
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
 *
 * 注：日志级别重置由 logger.ts 的 resetLogLevel 处理；
 * 缓存清空由各模块自行处理。
 */
export function resetCallbacks(): void {
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

  log("info", "init", "回调状态已重置");
}

/** 等待页面回调注册完成 */
export async function waitForCallbacks(
  page: "ziwei" | "daliuren" | "wiki",
  timeout = 1000,
): Promise<void> {
  const start = Date.now();
  // 安全保护：最大迭代次数，防止超时判断延迟导致无限循环
  const maxIterations = Math.ceil(timeout / 20) + 10;
  let iterations = 0;
  while (!_callbacksReady[page]) {
    if (++iterations > maxIterations || Date.now() - start > timeout) {
      const ErrorClass =
        page === "ziwei" ? ZiWeiError : page === "daliuren" ? DaLiuRenError : WikiError;
      const err = new ErrorClass(
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

// ============ Getter 函数（供其他子模块访问回调） ============

export const getSelectPerson = () => _selectPerson;
export const getGetZwds = () => _getZwds;
export const getGetPerson = () => _getPerson;
export const getNavigate = () => _navigate;
export const getGetDaLiuRenList = () => _getDaLiuRenList;
export const getSetListFilters = () => _setListFilters;
export const getOpenCreateDialog = () => _openCreateDialog;
export const getFillCreateForm = () => _fillCreateForm;
export const getSubmitCreateForm = () => _submitCreateForm;
export const getSelectRecord = () => _selectRecord;
export const getGetSelectedRecord = () => _getSelectedRecord;
export const getGetWikiList = () => _getWikiList;
export const getSetWikiListFilters = () => _setWikiListFilters;
export const getOpenWikiEditor = () => _openWikiEditor;
export const getSaveWikiDoc = () => _saveWikiDoc;
export const getSelectWikiDoc = () => _selectWikiDoc;
export const getGetSelectedWikiDoc = () => _getSelectedWikiDoc;
export const getCallbacksReady = () => _callbacksReady;
