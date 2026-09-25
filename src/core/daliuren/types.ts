/**
 * 大六壬类型定义
 *
 * 所有地支、天干索引均为 0-based：
 * 天干：甲=0 乙=1 ... 癸=9
 * 地支：子=0 丑=1 ... 亥=11
 */

/** 四柱（年月日时干支），用索引表示 */
export interface FourPillars {
  /** 年干索引（0-9） */
  yearStem: number;
  /** 年支索引（0-11） */
  yearBranch: number;
  /** 月干索引（0-9） */
  monthStem: number;
  /** 月支索引（0-11） */
  monthBranch: number;
  /** 日干索引（0-9） */
  dayStem: number;
  /** 日支索引（0-11） */
  dayBranch: number;
  /** 时干索引（0-9） */
  hourStem: number;
  /** 时支索引（0-11） */
  hourBranch: number;
  /** 年柱字符串（如"甲子"） */
  yearPillar: string;
  /** 月柱字符串 */
  monthPillar: string;
  /** 日柱字符串 */
  dayPillar: string;
  /** 时柱字符串 */
  hourPillar: string;
}

/** 月将（含地支与名称） */
export interface MonthGeneral {
  /** 月将地支索引（0-11） */
  branch: number;
  /** 月将名称（如"登明"） */
  name: string;
}

/**
 * 天地盘
 *
 * earth[i] 与 heaven[i] 同一下标代表同一地盘宫位；
 * earth 始终为 [0,1,2,...,11]（子至亥），heaven 为月将加时后的天盘支。
 */
export interface HeavenEarthBoards {
  /** 地盘 12 支索引（恒为 0..11） */
  earth: number[];
  /** 天盘 12 支索引（月将加时结果） */
  heaven: number[];
}

/**
 * 四课
 *
 * 大六壬以日干/日支为基，通过天盘推得四层上下关系：
 * - 第一课：日干 → 干上神（日干寄宫上的天盘支）
 * - 第二课：干上神 → 上神再临地盘所见天盘支
 * - 第三课：日支 → 支上神（日支上的天盘支）
 * - 第四课：支上神 → 上神再临地盘所见天盘支
 *
 * upper / lower 均为地支索引（0-11）。
 */
export interface FourLesson {
  /** 上课（天盘侧）地支索引 */
  upper: number;
  /** 下课（地盘侧）地支索引 */
  lower: number;
  /** 下课类型：stem=日干寄宫，branch=日支本位或上神传递 */
  lowerType: "stem" | "branch";
}

/** 三传（初/中/末传） */
export interface ThreeTransmissions {
  /** 初传地支索引 */
  initial: number;
  /** 中传地支索引 */
  middle: number;
  /** 末传地支索引 */
  final: number;
}

/** 旬空（两旬空） */
export interface XunKong {
  /** 旬首地支索引（如甲子旬为子） */
  xunHead: number;
  /** 空亡地支 1 */
  void1: number;
  /** 空亡地支 2 */
  void2: number;
}

/** 大六壬最终返回结构（阶段一：基础数据） */
export interface DaLiuRenResult {
  /** 起课时间字符串（YYYY-MM-DD HH:mm:ss） */
  calculationTime: string;
  /** 四柱 */
  fourPillars: FourPillars;
  /** 月将 */
  monthGeneral: MonthGeneral;
  /** 地盘 */
  earthBoard: number[];
  /** 天盘 */
  heavenBoard: number[];
  /** 四课 */
  fourLessons: FourLesson[];
  /** 旬空 */
  xunKong: XunKong;
}
