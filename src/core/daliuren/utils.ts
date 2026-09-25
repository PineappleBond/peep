/**
 * 大六壬公共工具函数
 *
 * 提取多个模块共享的五行生克判断、六十甲子计算、盘面查询等逻辑，
 * 避免在 sanchuan / kejing / bifa / dungan 等文件中重复定义。
 */

import { BRANCH_ELEMENT, STEM_ELEMENT, STEM_LODGING } from "./constants";
import type { DaLiuRenResult } from "./types";

// ─── 五行生克 ────────────────────────────────────────────

/** 取地支五行（索引 0-4 对应木火土金水） */
export function elemB(b: number): number {
  return BRANCH_ELEMENT[b];
}

/** 取天干五行 */
export function elemS(s: number): number {
  return STEM_ELEMENT[s];
}

/**
 * 五行 A 克 B
 *
 * 五行顺序：木(0) 火(1) 土(2) 金(3) 水(4)
 * 克：木→土→水→火→金→木（(x+2)%5 为被克者）
 */
export function keOf(a: number): number {
  return (a + 2) % 5;
}

/**
 * 五行 A 生 B
 *
 * 生：木→火→土→金→水→木（(x+1)%5 为被生者）
 */
export function shengOf(a: number): number {
  return (a + 1) % 5;
}

// ─── 六十甲子 ────────────────────────────────────────────

/**
 * 由天干索引与地支索引计算六十甲子序号（0-59）。
 *
 * 六十甲子中，天干与地支满足：n ≡ stem (mod 10)，n ≡ branch (mod 12)。
 * 由 CRT（中国剩余定理）可得：n = (6 * stem - 5 * branch + 60) % 60。
 */
export function sexagenaryIndex(stem: number, branch: number): number {
  return ((6 * stem - 5 * branch) % 60 + 60) % 60;
}

// ─── 十干寄宫 ────────────────────────────────────────────

/** 日干寄宫所在支 */
export function stemLodgingBranch(stem: number): number {
  return STEM_LODGING[stem];
}

// ─── 盘面查询 ────────────────────────────────────────────

/** 天地盘是否伏吟（重合） */
export function isFuyin(r: DaLiuRenResult): boolean {
  return r.heavenBoard[0] === 0;
}

/** 天地盘是否返吟（对冲） */
export function isFanyin(r: DaLiuRenResult): boolean {
  return r.heavenBoard[0] === 6;
}

/** 天盘某支是否在四课的上课中出现 */
export function inFourLessons(branch: number, r: DaLiuRenResult): boolean {
  return r.fourLessons.some((l) => l.upper === branch);
}

/**
 * 获取天盘某支所乘天将编号（-1 表示未找到）
 *
 * 先找天盘支在地盘的宫位，再查该宫的天将。
 */
export function getGeneralRidingBranch(
  branch: number,
  r: DaLiuRenResult
): number {
  const ground = r.heavenBoard.indexOf(branch);
  if (ground === -1) return -1;
  const g = r.twelveGenerals.find((g) => g.position === ground);
  return g ? g.general : -1;
}

/** 找某天将所在地盘宫位（-1 表示不存在） */
export function findGeneralPosition(
  generalName: string,
  r: DaLiuRenResult
): number {
  const g = r.twelveGenerals.find((g) => g.name === generalName);
  return g ? g.position : -1;
}
