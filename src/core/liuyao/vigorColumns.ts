/**
 * 六爻旺衰列计算模块
 * 计算 8 列旺衰数据（左侧 4 列 + 右侧 4 列镜像），每列 6 个爻位的 VigorState
 *
 * 列结构（从左到右）：
 * 左侧 4 列（上级时间对 6 爻的影响）：
 *   [0] 太岁（年支）  → 对应 yearly visible
 *   [1] 流月（月建）  → 对应 monthly visible
 *   [2] 流日（日辰）  → 对应 daily visible
 *   [3] 流时（时支）  → 对应 hourly visible
 * 右侧 4 列（反向，镜像布局）：
 *   [4] 流时  [5] 流日  [6] 流月  [7] 太岁
 */
import type { ChartJSON, Branch, Element } from "./core/types";
import { BRANCH_ELEM } from "./core/constants";
import { vigorOf, type VigorState } from "./core/vigor";
import type { LiuyaoHbarVisible, LiuyaoHbarPick } from "./hbar";
import { monthBranch, dayGanzhi } from "./core/calendar";

/* ─────────────── 类型定义 ─────────────── */

/** 旺衰列数据 */
export type VigorColumnData = {
  /** 8 列的旺衰数据，索引 0-7 */
  columns: VigorState[][];
  /** 每列的地支标签（用于表头） */
  columnBranches: Branch[];
  /** 每列的角色标签（太岁/月建/日辰/时辰） */
  columnRoles: string[];
  /** 各级时间是否可见（从 hbarState.visible 透传） */
  visible: LiuyaoHbarVisible;
};

/* ─────────────── 纯函数计算 ─────────────── */

/**
 * 计算单个时间层级对 6 爻的旺衰
 * @param chart 完整卦象（从中提取每爻的五行）
 * @param timeBranch 时间地支（月建/日辰/流年支/流月支/流日支/流时支）
 * @returns 6 个 VigorState，索引 0-5 对应爻位 1-6
 */
function computeLineVigors(chart: ChartJSON, timeBranch: Branch): VigorState[] {
  const timeElem: Element = BRANCH_ELEM[timeBranch];
  return chart.lines.map(line => {
    const lineElem: Element = BRANCH_ELEM[line.branch];
    return vigorOf(timeElem, lineElem);
  });
}

/**
 * 推算太岁（年支）
 * @param year 阳历年份
 */
function getYearBranch(year: number): Branch {
  // 地支序号：(year - 4) % 12，0=子，1=丑，...
  const BRANCHES: Branch[] = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ];
  const idx = (year - 4) % 12;
  return BRANCHES[idx];
}

/**
 * 推算时辰地支
 * @param hour 时辰索引（0-11，对应子时~亥时）
 */
function getHourBranch(hour: number): Branch {
  const BRANCHES: Branch[] = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥",
  ];
  return BRANCHES[hour % 12];
}

/**
 * 计算完整旺衰列数据
 *
 * @param chart 完整卦象
 * @param visible 4 级可见性状态
 * @param pick 当前选择的时间点（用于推算各级时间地支）
 * @returns 8 列，每列 6 个 VigorState；不可见列仍计算但 UI 隐藏
 */
export function computeVigorColumns(
  chart: ChartJSON,
  visible: LiuyaoHbarVisible,
  pick: LiuyaoHbarPick,
): VigorColumnData {
  // 1. 太岁（年支）
  const yearBranch = getYearBranch(pick.year);

  // 2. 月建：需要日（d）参数，用 15 日作为月中代表
  const monthBr = monthBranch(pick.year, pick.month, 15);

  // 3. 日辰：从阳历日期推算
  const dayGz = dayGanzhi(pick.year, pick.month, pick.day);
  const dayBranch = dayGz.branch;

  // 4. 时支
  const hourBranch = getHourBranch(pick.hour);

  // 计算 4 列旺衰（左侧）
  const col0 = computeLineVigors(chart, yearBranch); // 太岁
  const col1 = computeLineVigors(chart, monthBr); // 月建
  const col2 = computeLineVigors(chart, dayBranch); // 日辰
  const col3 = computeLineVigors(chart, hourBranch); // 时辰

  // 右侧 4 列（镜像）
  const columns = [col0, col1, col2, col3, col3, col2, col1, col0];
  const columnBranches = [
    yearBranch,
    monthBr,
    dayBranch,
    hourBranch,
    hourBranch,
    dayBranch,
    monthBr,
    yearBranch,
  ];
  const columnRoles = ["太岁", "月建", "日辰", "时辰", "时辰", "日辰", "月建", "太岁"];

  return {
    columns,
    columnBranches,
    columnRoles,
    visible,
  };
}
