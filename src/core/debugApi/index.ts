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
  WikiOptions,
  WikiViewResult,
  Scope,
  Zwds,
  BirthInput,
  Person,
  LiurenRecord,
  WikiDocument,
  HbarData,
  DaLiuRenResult,
  LiurenListFilters,
  LiurenListResult,
  WikiListFilters,
  WikiListResult,
  // 统一参数类型（新增）
  DaLiuRenListParams,
  DaLiuRenCreateParams,
  DaLiuRenViewParams,
  WikiListParams,
  WikiCreateParams,
  WikiViewParams,
  // API 元数据类型
  ApiMetadata,
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
} from "./daliuren";

// Wiki 导出
export { WikiList, WikiCreate, WikiView } from "./wiki";

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
  waitForRecordSaved,
  waitForWikiCallbacks,
  waitForDocSaved,
  isDialogOpen,
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
} from "./system";

// 从 analysis.ts 重新导出 getChartDataForScope（供 window.peep 使用）
export { getChartDataForScope, type ScopeChartData } from "../analysis";
