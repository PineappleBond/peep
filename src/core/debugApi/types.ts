/**
 * 调试 API 类型定义
 * 统一管理所有导出类型，避免循环依赖
 */

import type { Scope } from "../utils";
import type { Zwds, BirthInput } from "../useZwds";
import type { Person, LiurenRecord, LiuyaoRecord, WikiDocument } from "../personDb";
import type { HbarData } from "../hbar";
import type { DaLiuRenResult } from "../daliuren/types";
import type { LiurenListFilters, LiurenListResult } from "../daliurenDb";
import type { LiuyaoListFilters, LiuyaoListResult } from "../liuyaoDb";
import type { WikiListFilters, WikiListResult } from "../wikiDb";
import type { ScopeChartData } from "../analysis";
import type { ChartJSON, SixLines, YongShen, YongTarget } from "../liuyao/core/types";
import type { LiuyaoHbarData, LiuyaoHbarVisible, LiuyaoHbarPick } from "../liuyao/hbar";
import type { VigorColumnData } from "../liuyao/vigorColumns";

/* ── API 版本与元数据 ── */

/**
 * 调试 API 版本号——遵循语义化版本（Semantic Versioning）。
 * 主版本号.次版本号.修订号：
 * - 主版本号：不兼容的 API 变更
 * - 次版本号：向后兼容的功能新增
 * - 修订号：向后兼容的缺陷修复
 */
export const API_VERSION = "1.0.0" as const;

/**
 * API 元数据——提供版本和能力信息。
 * 用于 AI 判断 API 兼容性，以及前端根据版本做条件逻辑。
 */
export interface ApiMetadata {
  /** API 版本号 */
  version: typeof API_VERSION;
  /** 支持的 Function 名称列表 */
  availableFunctions: string[];
  /** 支持的运限级别 */
  supportedScopes: Scope[];
}

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
   *
   * ⚠️ 仅供调试 / 测试使用。RTC Agent handler 不应使用此选项——
   * Agent 必须像人类一样操控 UI，保证用户看到的数据与 Agent 返回的数据一致。
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
   * 等价于纯计算路径，可在任意上下文调用（自动化测试、控制台调试）。
   *
   * ⚠️ 仅供调试 / 测试使用。RTC Agent handler 不应使用此选项——
   * Agent 必须像人类一样操控 UI，保证用户看到的数据与 Agent 返回的数据一致。
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
   * 等价于纯 DB 路径，可在任意上下文调用（自动化测试、控制台调试）。
   *
   * ⚠️ 仅供调试 / 测试使用。RTC Agent handler 不应使用此选项——
   * Agent 必须像人类一样操控 UI，保证用户看到的数据与 Agent 返回的数据一致。
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

/* ── 六爻类型 ── */

/** Liuyao 计算返回数据 */
export type LiuyaoComputedData = {
  /** 起卦时间（ISO 格式） */
  divinationTime: string;
  /** 完整卦象 */
  chart: ChartJSON;
  /** 用神定位结果 */
  yong: YongShen;
  /** 关联人物（可能为 null） */
  person: Person | null;
  /** hbar 完整数据（基于起卦时间生成） */
  hbarData: LiuyaoHbarData | null;
  /** 旺衰列数据（默认 visible=all, pick=起卦时间） */
  vigorColumns: VigorColumnData | null;
};

/** Liuyao 接口选项 */
export type LiuyaoOptions = {
  /**
   * 为 true 时跳过 UI 操控（导航、切换人物、打开 Dialog 等），
   * 仅执行纯计算或直接查询数据库。
   * 等价于纯计算路径，可在任意上下文调用（自动化测试、控制台调试）。
   *
   * ⚠️ 仅供调试 / 测试使用。RTC Agent handler 不应使用此选项——
   * Agent 必须像人类一样操控 UI，保证用户看到的数据与 Agent 返回的数据一致。
   */
  skipUI?: boolean;
};

/** LiuyaoView 返回数据：记录 + 计算数据 */
export type LiuyaoViewResult = LiuyaoRecord & {
  /** 纯计算数据（skipUI=true 时包含，skipUI=false 时也包含以便 RTC Agent 使用） */
  computed?: LiuyaoComputedData;
};

/** Liuyao 创建参数 */
export interface LiuyaoCreateParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 所占问题——要占卜的核心问题，要具体明确 */
  question: string;
  /** 背景信息——问题的上下文 */
  background?: string;
  /** 备注——补充说明 */
  note?: string;
  /** 标签——用于分类检索 */
  tags?: string[];
  /** 六爻原始值（0=老阴,1=少阳,2=少阴,3=老阳），省略则自动摇卦 */
  lines?: SixLines;
  /** 求测对象——决定用神选取，默认"自占" */
  yongTarget?: YongTarget;
  /** 可选：自定义起卦时间（ISO 格式或 YYYY-MM-DD HH:mm:ss），不传则使用当前时间 */
  divinationTime?: string;
}

/** Liuyao 列表查询参数 */
export interface LiuyaoListParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 搜索关键字——匹配问题、备注、背景 */
  searchText?: string;
  /** 按标签过滤 */
  tags?: string[];
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（1-100，默认 20） */
  pageSize?: number;
}

/** Liuyao 查看详情参数 */
export interface LiuyaoViewParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 起卦记录 ID——从 LiuYaoList 返回的 records 中获取 */
  recordId: number;
}

// 重新导出外部类型，供其他子模块使用
export type {
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
  ScopeChartData,
  ChartJSON,
  SixLines,
  YongShen,
  YongTarget,
  LiuyaoHbarData,
  LiuyaoHbarVisible,
  LiuyaoHbarPick,
  VigorColumnData,
};

/* ── 统一列表查询参数类型 ── */

/**
 * 大六壬列表查询参数——统一 DaLiuRenList 的输入类型。
 * 所有字段可选，不传则使用默认值。
 */
export interface DaLiuRenListParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 搜索关键字——匹配问题、备注、背景 */
  searchText?: string;
  /** 按标签过滤 */
  tags?: string[];
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（1-100，默认 20） */
  pageSize?: number;
}

/**
 * Wiki 列表查询参数——统一 WikiList 的输入类型。
 * 所有字段可选，不传则使用默认值。
 */
export interface WikiListParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 搜索关键字——匹配标题或正文 */
  searchText?: string;
  /** 按标签过滤 */
  tags?: string[];
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（1-100，默认 20） */
  pageSize?: number;
}

/**
 * 大六壬起课参数——统一 DaLiuRenCreate 的输入类型。
 */
export interface DaLiuRenCreateParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 所占问题——要占卜的核心问题，要具体明确 */
  question: string;
  /** 备注——补充说明 */
  note?: string;
  /** 背景信息——问题的上下文 */
  background?: string;
  /** 标签——用于分类检索 */
  tags?: string[];
  /** 可选：自定义起课时间（YYYY-MM-DD HH:mm:ss），不传则使用当前时间 */
  calculationTime?: string;
}

/**
 * Wiki 创建参数——统一 WikiCreate 的输入类型。
 */
export interface WikiCreateParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 文档标题 */
  title: string;
  /** Markdown 正文 */
  content: string;
  /** 标签——用于分类检索 */
  tags?: string[];
  /** 关联文档 ID 列表——建立文档间的链接关系 */
  linkTargetIds?: number[];
}

/**
 * 大六壬查看详情参数——统一 DaLiuRenView 的输入类型。
 */
export interface DaLiuRenViewParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 起课记录 ID——从 DaLiuRenList 返回的 records 中获取 */
  recordId: number;
}

/**
 * Wiki 查看详情参数——统一 WikiView 的输入类型。
 */
export interface WikiViewParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 文档 ID——从 WikiList 返回的 docs 中获取 */
  docId: number;
  /** 是否查询反向链接（谁链接到了本文档） */
  includeBacklinks?: boolean;
}

/**
 * Wiki 关联管理参数——统一 WikiLink 的输入类型。
 */
export interface WikiLinkParams {
  /** 命主 ID（可选，不传则使用默认人物） */
  personId?: number;
  /** 源文档 ID */
  sourceDocId: number;
  /** 目标文档 ID 列表——建立从源文档到目标文档的链接 */
  targetDocIds: number[];
  /** 是否追加模式（true=追加链接，false=替换链接，默认 false） */
  append?: boolean;
}
