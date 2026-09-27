/**
 * 六爻核心模块导出
 */

// 类型定义
export type {
  Stem,
  Branch,
  Element,
  Relative,
  SixGod,
  Palace,
  HexType,
  LineValue,
  SixLines,
  KongState,
  VigorState,
  ChartLine,
  ChangedLine,
  ChartJSON,
  ChartInput,
  YongShen,
  YongTarget,
} from "./types";

// 常量
export {
  STEMS,
  BRANCHES,
  BRANCH_ELEM,
  ELEM_GEN,
  ELEM_OVERCOME,
  BRANCH_HE,
  BRANCH_CHONG,
  ELEM_TOMB,
  TRIGRAMS,
  PALACE_ELEM,
  NAJIA,
  HEX_NAMES,
  SIX_GODS,
  sixGodStart,
  relativeOf,
} from "./constants";

// 日历工具
export { julianDayNumber, dayGanzhi, xunKong, monthBranch, localDateISO } from "./calendar";

// 八宫逻辑
export {
  bitsKey,
  trigramOf,
  hexName,
  palaceInfo,
  bitsOfName,
  ALL_HEX_NAMES,
  type Bits,
  type PalaceInfo,
} from "./palace";

// 排盘核心
export { buildChart, tossLine, tossHexagram, locateYong } from "./chart";

// 旺衰计算
export { vigorOf, type VigorState as VigorStateType } from "./vigor";
