/**
 * 调试 API 统一导出入口
 *
 * 将分散在子模块中的 API 统一导出，保持向后兼容。
 * 外部代码可直接从 debugApi 导入所有公开接口。
 *
 * @version 1.0.0
 */

// 类型导出
export type {
  ZiWeiComputedData,
  ZiWeiResult,
  ZiWeiOptions,
  DaLiuRenComputedData,
  DaLiuRenOptions,
  DaLiuRenViewResult,
  LiuyaoComputedData,
  LiuyaoOptions,
  LiuyaoViewResult,
  WikiOptions,
  WikiViewResult,
  Scope,
  Zwds,
  BirthInput,
  Person,
  LiurenRecord,
  LiuyaoRecord,
  WikiDocument,
  HbarData,
  DaLiuRenResult,
  LiurenListFilters,
  LiurenListResult,
  LiuyaoListFilters,
  LiuyaoListResult,
  WikiListFilters,
  WikiListResult,
  // 统一参数类型（新增）
  DaLiuRenListParams,
  DaLiuRenCreateParams,
  DaLiuRenViewParams,
  LiuyaoListParams,
  LiuyaoCreateParams,
  LiuyaoViewParams,
  WikiListParams,
  WikiCreateParams,
  WikiUpdateParams,
  WikiViewParams,
  WikiLinkParams,
  // API 元数据类型
  ApiMetadata,
  // 六爻核心类型
  ChartJSON,
  SixLines,
  YongShen,
  YongTarget,
  LiuyaoHbarData,
  LiuyaoHbarVisible,
  LiuyaoHbarPick,
  VigorColumnData,
} from "./types";

// API 版本常量
export { API_VERSION } from "./types";

// 错误类导出
export {
  BaseDebugError,
  ZiWeiError,
  ParseDateError,
  ComputeScopeError,
  DaLiuRenError,
  LiuyaoError,
  WikiError,
  wrapError,
  // 错误代码（新增）
  ApiErrorCode,
} from "./errors";
export type { ApiErrorCodeType } from "./errors";

// 参数验证工具导出（新增）
export {
  validatePersonId,
  validateScope,
  validateRecordId,
  validateDocId,
  validateNonEmptyString,
  validatePagination,
  validateTags,
  validateIdArray,
  VALID_SCOPES,
} from "./validate";

// 日志工具导出
export { log, timer, setLogLevel, getLogLevel, resetLogLevel } from "./logger";
export type { LogLevel } from "./logger";

// 回调注册导出
export {
  registerDebugApi,
  registerZiWeiCallbacks,
  registerDaLiuRenCallbacks,
  registerLiuyaoCallbacks,
  registerWikiCallbacks,
  unregisterPageCallbacks,
  resetCallbacks,
  waitForCallbacks,
  // Getter 函数
  getSelectPerson,
  getGetZwds,
  getGetPerson,
  getNavigate,
  getGetDaLiuRenList,
  getSetListFilters,
  getOpenCreateDialog,
  getFillCreateForm,
  getSubmitCreateForm,
  getSelectRecord,
  getGetSelectedRecord,
  getGetLiuyaoList,
  getSetLiuyaoListFilters,
  getOpenLiuyaoCreateDialog,
  getFillLiuyaoCreateForm,
  getSubmitLiuyaoCreateForm,
  getSelectLiuyaoRecord,
  getGetSelectedLiuyaoRecord,
  getSetLiuyaoHbarVisibility,
  getPickLiuyaoTime,
  getGetLiuyaoHbarState,
  getGetWikiList,
  getSetWikiListFilters,
  getOpenWikiEditor,
  getSaveWikiDoc,
  getSelectWikiDoc,
  getGetSelectedWikiDoc,
  getCallbacksReady,
} from "./callbacks";

// Person CRUD 导出
export {
  resolvePersonId,
  PersonList,
  PersonGet,
  PersonCreate,
  PersonUpdate,
  PersonDelete,
} from "./person";

// 紫微斗数导出
export {
  computeAstrolabe,
  clearAstrolabeCache,
  parseDate,
  _setHoroscopeTime,
  setHoroscopeTimeWithRetry,
  computeZiWeiData,
  ZiWei,
  computeScopeData,
  GetScopeData,
  resetZiWeiState,
} from "./ziwei";

// 大六壬导出
export {
  computeDaLiuRenData,
  DaLiuRen,
  DaLiuRenCreate,
  DaLiuRenList,
  DaLiuRenView,
  DaLiuRenDelete,
} from "./daliuren";

// 六爻导出
export {
  computeLiuyaoData,
  LiuYao,
  LiuYaoCreate,
  LiuYaoList,
  LiuYaoView,
  LiuYaoDelete,
} from "./liuyao";

// Wiki 导出
export { WikiList, WikiCreate, WikiUpdate, WikiView, WikiLink, WikiDelete } from "./wiki";

// 辅助函数导出
export {
  nextFrame,
  waitForPageLoad,
  waitForStateUpdate,
  waitForPersonMatch,
  waitForAstrolabeStable,
  waitForPickReset,
  waitForPickMatch,
  navigateToPage,
  selectPersonAndWait,
  waitForDialogReady,
  waitForDaLiuRenCallbacks,
  waitForLiuyaoCallbacks,
  waitForRecordSaved,
  waitForWikiCallbacks,
  waitForDocSaved,
  isDialogOpen,
  // UI 状态追踪（性能优化）
  getUiState,
  updateUiState,
} from "./helpers";

// 系统 API 导出
export {
  version,
  env,
  health,
  help,
  getCacheStats,
  clearCaches,
  resetDebugApi,
  getInternalPeepApi,
  initDebugApi,
  getApiMetadata,
  // 开发者体验改进 API
  renderStats,
  stateChanges,
  profile,
} from "./system";

// 渲染追踪工具导出
export {
  enableRenderTracker,
  setSlowRenderThreshold,
  useRenderTracker,
  getRenderRecords,
  getRenderSummary,
  clearRenderRecords,
  isRenderTrackerEnabled,
} from "../renderTracker";
export type { RenderRecord } from "../renderTracker";

// 状态变更追踪工具导出
export {
  enableStateWatch,
  recordStateChange,
  subscribeStateChange,
  getStateChanges,
  getStateChangesByName,
  getStateChangeSummary,
  clearStateChanges,
  isStateWatchEnabled,
  dumpStateChanges,
} from "../stateWatch";
export type { StateChangeRecord } from "../stateWatch";

// 用户操作记录（来自 errorTracking）
export { setLastAction } from "../errorTracking";

// 从 analysis.ts 重新导出 getChartDataForScope（供 window.peep 使用）
export { getChartDataForScope, type ScopeChartData } from "../analysis";
