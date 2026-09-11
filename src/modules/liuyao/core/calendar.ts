import type { Branch, Stem } from './types';
import { BRANCHES, STEMS } from './constants';

/** 公曆日期 → 儒略日數（正午起算的整數 JDN） */
export function julianDayNumber(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

/** 日柱干支。校準點：2000-01-01 = 戊午（§8 案例 C） */
export function dayGanzhi(y: number, m: number, d: number): { stem: Stem; branch: Branch } {
  const idx = (julianDayNumber(y, m, d) + 49) % 60;
  return { stem: STEMS[idx % 10], branch: BRANCHES[idx % 12] };
}

/** 旬空：由日柱推所在旬缺的兩支。甲子旬空戌亥。 */
export function xunKong(stem: Stem, branch: Branch): [Branch, Branch] {
  const s = STEMS.indexOf(stem);
  const b = BRANCHES.indexOf(branch);
  let n = 0;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) { n = i; break; }
  }
  const xunStartBranch = (n - (n % 10)) % 12;
  return [BRANCHES[(xunStartBranch + 10) % 12], BRANCHES[(xunStartBranch + 11) % 12]];
}

/**
 * 十二節的近似日期（壽星公式，21 世紀常數）。
 * 節氣邊界日誤差可能 ±1 日 —— 依 §7 風險，邊界日以使用者手動覆寫為準。
 */
const TERM_C21: { month: number; c: number; branch: Branch }[] = [
  { month: 1, c: 5.4055, branch: '丑' },  // 小寒
  { month: 2, c: 3.87, branch: '寅' },    // 立春
  { month: 3, c: 5.63, branch: '卯' },    // 驚蟄
  { month: 4, c: 4.81, branch: '辰' },    // 清明
  { month: 5, c: 5.52, branch: '巳' },    // 立夏
  { month: 6, c: 5.678, branch: '午' },   // 芒種
  { month: 7, c: 7.108, branch: '未' },   // 小暑
  { month: 8, c: 7.5, branch: '申' },     // 立秋
  { month: 9, c: 7.646, branch: '酉' },   // 白露
  { month: 10, c: 8.318, branch: '戌' },  // 寒露
  { month: 11, c: 7.438, branch: '亥' },  // 立冬
  { month: 12, c: 7.18, branch: '子' },   // 大雪
];

function termDay(year: number, month: number): number {
  const def = TERM_C21[month - 1];
  const y = year % 100;
  return Math.floor(y * 0.2422 + def.c) - Math.floor(y / 4);
}

/** 月建（自動推算）：當月節前屬上月建 */
export function monthBranch(y: number, m: number, d: number): Branch {
  const def = TERM_C21[m - 1];
  if (d >= termDay(y, m)) return def.branch;
  const prev = m === 1 ? TERM_C21[11] : TERM_C21[m - 2];
  return prev.branch;
}
