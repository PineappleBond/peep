/**
 * 调试 API 类型定义
 * 统一管理所有导出类型，避免循环依赖
 */

import type { Scope } from "../utils";
import type { Zwds, BirthInput } from "../useZwds";
import type { Person, LiurenRecord, WikiDocument } from "../personDb";
import type { HbarData } from "../hbar";
import type { DaLiuRenResult } from "../daliuren/types";
import type { LiurenListFilters, LiurenListResult } from "../daliurenDb";
import type { WikiListFilters, WikiListResult } from "../wikiDb";
import type { ScopeChartData } from "../analysis";

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

// 重新导出外部类型，供其他子模块使用
export type {
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
  ScopeChartData,
};
