/**
 * 時間樓層工具：為六爻卦象產生「撲克牌式」時間維度樓層。
 *
 * 三層粒度：
 *   - year   → 每一層 = 一個月（節氣起算）
 *   - month  → 每一層 = 一日
 *   - day    → 每一層 = 一個時辰
 *
 * 每層同時提供：
 *   - upperTime：上一級時間的影響（column 2）
 *   - thisTime ：本層時間的影響 （column 3）
 */

import type { Branch, ChartJSON, Element, Stem } from './types';
import { dayGanzhi, monthBranch } from './calendar';
import { BRANCH_ELEM, BRANCHES, ELEM_GEN, ELEM_OVERCOME, STEMS } from './constants';

export type Granularity = 'year' | 'month' | 'day';

export interface TimeInfluence {
  /** 干支字串，如「丁酉」 */
  label: string;
  /** 角色，如「月建」「日辰」「太歲」「時辰」 */
  role: string;
  /** 地支 */
  branch: Branch;
  /** 五行 */
  elem: Element;
}

export interface TimeFloor {
  /** 樓層顯示標題，如「2026年9月」「9月10日」「午時」 */
  title: string;
  /** 用於 buildChart 的 yyyy-mm-dd */
  date: string;
  /** 月建覆寫（若此層為月粒度則為本月建） */
  monthBranchOverride?: Branch;
  /** 日柱覆寫（若此層為日/時粒度則需覆寫日柱） */
  dayGanzhiOverride?: string;
  /** 上一級時間 */
  upperTime: TimeInfluence;
  /** 本層時間 */
  thisTime: TimeInfluence;
  /** 索引，用於動畫/鍵 */
  index: number;
}

/** 五行對應的「旺相休囚死」狀態 */
export type VigorState = '旺' | '相' | '休' | '囚' | '死';

/**
 * 根據時間五行與爻五行，計算旺相休囚死：
 *   旺：時間五行與爻五行相同（同我者）
 *   相：時間生爻（生我者）
 *   休：爻生時間（我生者）
 *   囚：爻克時間（我克者）
 *   死：時間克爻（克我者）
 */
export function vigorOf(timeElem: Element, lineElem: Element): VigorState {
  if (timeElem === lineElem) return '旺';
  if (ELEM_GEN[timeElem] === lineElem) return '相'; // 時間生爻
  if (ELEM_GEN[lineElem] === timeElem) return '休'; // 爻生時間
  if (ELEM_OVERCOME[lineElem] === timeElem) return '囚'; // 爻克時間
  return '死'; // 時間克爻
}

/** 天干地支合併字串 */
function gz(stem: Stem, branch: Branch): string {
  return `${stem}${branch}`;
}

/**
 * 年上起月：根據年干推算正月（寅月）的天干
 * 甲己之年丙作首，乙庚之歲戊為頭，丙辛之年尋庚上，丁壬壬位順行流，戊癸之年甲寅求
 */
function firstMonthStemOf(yearStem: Stem): Stem {
  const stemIdx = STEMS.indexOf(yearStem);
  // 正月天干索引：甲己→丙(2)，乙庚→戊(4)，丙辛→庚(6)，丁壬→壬(8)，戊癸→甲(0)
  const firstMonthStemIdx = ((stemIdx % 5) * 2 + 2) % 10;
  return STEMS[firstMonthStemIdx];
}

/**
 * 計算月柱：根據年干和月支計算月干
 */
function monthGanzhi(yearStem: Stem, monthBranch: Branch): { stem: Stem; branch: Branch } {
  const firstMonthStem = firstMonthStemOf(yearStem);
  const firstMonthStemIdx = STEMS.indexOf(firstMonthStem);
  // 正月是寅月，計算當前月份與正月的偏移
  const monthOffset = monthBranch === '寅' ? 0 : (BRANCHES.indexOf(monthBranch) - 2 + 12) % 12;
  const monthStem = STEMS[(firstMonthStemIdx + monthOffset) % 10];
  return { stem: monthStem, branch: monthBranch };
}

/**
 * 日上起時：給定日干，推算子時的天干。
 *   甲己→甲，乙庚→丙，丙辛→戊，丁壬→庚，戊癸→壬
 */
function ziStemOf(dayStem: Stem): Stem {
  const idx = STEMS.indexOf(dayStem);
  return STEMS[(idx % 5) * 2];
}

/**
 * 計算某日的時辰干支序列（12 個）。
 * 返回以地支為索引的陣列。
 */
function shichenGanzhiOf(dayStem: Stem): { stem: Stem; branch: Branch }[] {
  const startStemIdx = STEMS.indexOf(ziStemOf(dayStem));
  return BRANCHES.map((branch, i) => ({
    stem: STEMS[(startStemIdx + i) % 10],
    branch,
  }));
}

const ZODIAC_ANIMALS: Record<Branch, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龍', 巳: '蛇',
  午: '馬', 未: '羊', 申: '猴', 酉: '雞', 戌: '狗', 亥: '豬',
};

const SHICHEN_RANGES: Record<Branch, string> = {
  子: '23–01', 丑: '01–03', 寅: '03–05', 卯: '05–07',
  辰: '07–09', 巳: '09–11', 午: '11–13', 未: '13–15',
  申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23',
};

/** 某年某月的天數 */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 產生「年」粒度樓層：以立春為年界，產生 12 個月的樓層 */
export function buildYearFloors(
  anchorY: number,
  anchorM: number,
  _anchorD: number,
): TimeFloor[] {
  // 年干支：以立春為界，立春前屬上一年
  // 簡化處理：使用 anchorY 作為基準年
  const yearGzIdx = ((anchorY - 4) % 60 + 60) % 60;
  const yearStem = STEMS[yearGzIdx % 10];
  const yearBranch = BRANCHES[yearGzIdx % 12];
  const yearElem = BRANCH_ELEM[yearBranch];

  const floors: TimeFloor[] = [];
  // 以立春為年界：從公曆 2 月（立春所在月）開始，到次年 1 月
  // 農曆月份：正月（寅月，立春後）到十二月（丑月，小寒後）
  for (let i = 0; i < 12; i++) {
    // 從 2 月開始循環
    const m = ((anchorM - 2 + i + 12) % 12) + 1;
    // 確定顯示的年份：如果月份 < 2，顯示次年
    const displayYear = m < 2 ? anchorY + 1 : anchorY;

    // 用本月節氣日推算月建；取月中一日以取得穩定月建
    const midDay = Math.min(15, daysInMonth(displayYear, m));
    const mBranch = monthBranch(displayYear, m, midDay);
    const mElem = BRANCH_ELEM[mBranch];
    // 月柱：使用年上起月規則計算
    const monthGz = monthGanzhi(yearStem, mBranch);

    // 計算農曆月份名稱
    const lunarMonthNames = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
    const lunarMonthIdx = (mBranch === '寅' ? 0 : (BRANCHES.indexOf(mBranch) - 2 + 12) % 12);
    const lunarMonthName = lunarMonthNames[lunarMonthIdx];

    floors.push({
      title: `${displayYear}年${lunarMonthName}月`,
      date: `${displayYear}-${String(m).padStart(2, '0')}-${String(midDay).padStart(2, '0')}`,
      monthBranchOverride: mBranch,
      index: floors.length,
      upperTime: {
        label: `${yearStem}${yearBranch}年`,
        role: '太歲',
        branch: yearBranch,
        elem: yearElem,
      },
      thisTime: {
        label: gz(monthGz.stem, monthGz.branch) + '月',
        role: '月建',
        branch: mBranch,
        elem: mElem,
      },
    });
  }
  return floors;
}

/** 產生「月」粒度樓層：錨點月份的所有日 */
export function buildMonthFloors(
  anchorY: number,
  anchorM: number,
  anchorD: number,
): TimeFloor[] {
  // 上層：月建（以錨點月月建為準）
  const midDay = Math.min(15, daysInMonth(anchorY, anchorM));
  const mBranch = monthBranch(anchorY, anchorM, midDay);
  const mElem = BRANCH_ELEM[mBranch];
  // 月柱：使用年上起月規則計算
  const yearGzIdx = ((anchorY - 4) % 60 + 60) % 60;
  const yearStem = STEMS[yearGzIdx % 10];
  const monthGz = monthGanzhi(yearStem, mBranch);

  const days = daysInMonth(anchorY, anchorM);
  const floors: TimeFloor[] = [];
  for (let d = anchorD; d <= days; d++) {
    const day = dayGanzhi(anchorY, anchorM, d);
    floors.push({
      title: `${anchorM}月${d}日`,
      date: `${anchorY}-${String(anchorM).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayGanzhiOverride: gz(day.stem, day.branch),
      monthBranchOverride: mBranch,
      index: floors.length,
      upperTime: {
        label: gz(monthGz.stem, monthGz.branch) + '月',
        role: '月建',
        branch: mBranch,
        elem: mElem,
      },
      thisTime: {
        label: gz(day.stem, day.branch) + '日',
        role: '日辰',
        branch: day.branch,
        elem: BRANCH_ELEM[day.branch],
      },
    });
  }
  return floors;
}

/** 產生「日」粒度樓層：錨點日的所有時辰 */
export function buildDayFloors(
  anchorY: number,
  anchorM: number,
  anchorD: number,
): TimeFloor[] {
  const day = dayGanzhi(anchorY, anchorM, anchorD);
  const dayElem = BRANCH_ELEM[day.branch];
  const mBranch = monthBranch(anchorY, anchorM, anchorD);

  const shichenList = shichenGanzhiOf(day.stem);
  // 固定顯示全部 12 時辰
  const floors: TimeFloor[] = shichenList.map((sc, i) => ({
    title: `${sc.branch}時`,
    date: `${anchorY}-${String(anchorM).padStart(2, '0')}-${String(anchorD).padStart(2, '0')}`,
    dayGanzhiOverride: gz(day.stem, day.branch),
    monthBranchOverride: mBranch,
    index: i,
    upperTime: {
      label: gz(day.stem, day.branch) + '日',
      role: '日辰',
      branch: day.branch,
      elem: dayElem,
    },
    thisTime: {
      label: gz(sc.stem, sc.branch) + '時',
      role: '時辰',
      branch: sc.branch,
      elem: BRANCH_ELEM[sc.branch],
    },
  }));
  return floors;
}

/**
 * 給定 granularity 與錨點日期，產生樓層列表。
 */
export function buildTimeFloors(
  anchor: Date,
  granularity: Granularity,
): TimeFloor[] {
  const y = anchor.getFullYear();
  const m = anchor.getMonth() + 1;
  const d = anchor.getDate();
  switch (granularity) {
    case 'year': return buildYearFloors(y, m, d);
    case 'month': return buildMonthFloors(y, m, d);
    case 'day': return buildDayFloors(y, m, d);
  }
}

/** 為每個爻位計算兩列影響力 */
export interface LineVigor {
  upper: VigorState;
  this: VigorState;
}

export function computeVigors(
  chart: ChartJSON,
  upperElem: Element,
  thisElem: Element,
): LineVigor[] {
  return chart.lines.map((line) => ({
    upper: vigorOf(upperElem, line.elem),
    this: vigorOf(thisElem, line.elem),
  }));
}

export { shichenGanzhiOf, SHICHEN_RANGES, ZODIAC_ANIMALS };
