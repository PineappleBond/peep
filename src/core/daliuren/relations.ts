/**
 * 刑冲破害标注
 *
 * 检测一组地支之间的刑、冲、破、害、合关系。
 */
import { DI_ZHI } from "./constants";

// ─── 关系表 ────────────────────────────────────────────

/** 六冲对 */
const LIU_CHONG_PAIRS: [number, number][] = [
  [0, 6], // 子午
  [1, 7], // 丑未
  [2, 8], // 寅申
  [3, 9], // 卯酉
  [4, 10], // 辰戌
  [5, 11], // 巳亥
];

/** 三刑 */
// 寅巳申（无恩之刑）、丑戌未（恃势之刑）、子卯（无礼之刑）、辰午酉亥（自刑）
const XING_CHAINS: number[][] = [
  [2, 5, 8], // 寅→巳→申→寅
  [1, 10, 7], // 丑→戌→未→丑
  [0, 3], // 子→卯
  [4, 6, 9, 11], // 辰午酉亥（自刑）
];

/** 六破对 */
const LIU_PO_PAIRS: [number, number][] = [
  [0, 9], // 子酉
  [6, 3], // 午卯
  [8, 5], // 申巳
  [2, 11], // 寅亥
  [4, 1], // 辰丑
  [10, 7], // 戌未
];

/** 六害对 */
const LIU_HAI_PAIRS: [number, number][] = [
  [0, 7], // 子未
  [1, 6], // 丑午
  [2, 5], // 寅巳
  [3, 4], // 卯辰
  [8, 11], // 申亥
  [9, 10], // 酉戌
];

/** 六合对 */
const LIU_HE_PAIRS: [number, number][] = [
  [0, 1], // 子丑
  [2, 11], // 寅亥
  [3, 10], // 卯戌
  [4, 9], // 辰酉
  [5, 8], // 巳申
  [6, 7], // 午未
];

// ─── 辅助 ────────────────────────────────────────────

export interface BranchRelation {
  type: "冲" | "刑" | "破" | "害" | "合";
  branches: [number, number];
  description: string;
}

/** 检查两个地支是否在某个对中 */
function pairMatch(
  pairs: [number, number][],
  a: number,
  b: number
): boolean {
  return pairs.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a)
  );
}

/** 刑的检测（含三刑链和自刑） */
function checkXing(a: number, b: number): string | null {
  // 自刑：辰辰、午午、酉酉、亥亥
  if (a === b && [4, 6, 9, 11].includes(a)) {
    return `${DI_ZHI[a]}${DI_ZHI[b]}自刑`;
  }
  // 寅巳申（无恩之刑）
  const wuen = [2, 5, 8];
  if (wuen.includes(a) && wuen.includes(b) && a !== b) {
    return `${DI_ZHI[a]}${DI_ZHI[b]}无恩之刑`;
  }
  // 丑戌未（恃势之刑）
  const chixu = [1, 10, 7];
  if (chixu.includes(a) && chixu.includes(b) && a !== b) {
    return `${DI_ZHI[a]}${DI_ZHI[b]}恃势之刑`;
  }
  // 子卯（无礼之刑）
  if ((a === 0 && b === 3) || (a === 3 && b === 0)) {
    return `${DI_ZHI[a]}${DI_ZHI[b]}无礼之刑`;
  }
  return null;
}

// ─── 主函数 ────────────────────────────────────────────

/**
 * 检查给定地支列表中所有两两组合的刑冲破害合关系
 *
 * @param branches 要检查的地支列表（可含重复，如四课/三传中的地支）
 * @returns 所有检测到的关系列表
 */
export function findBranchRelations(
  branches: number[]
): BranchRelation[] {
  const relations: BranchRelation[] = [];
  // 去重
  const unique = [...new Set(branches)];

  // 两两配对
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i];
      const b = unique[j];

      // 冲
      if (pairMatch(LIU_CHONG_PAIRS, a, b)) {
        relations.push({
          type: "冲",
          branches: [a, b],
          description: `${DI_ZHI[a]}${DI_ZHI[b]}相冲`,
        });
      }

      // 刑
      const xingDesc = checkXing(a, b);
      if (xingDesc) {
        relations.push({
          type: "刑",
          branches: [a, b],
          description: xingDesc,
        });
      }

      // 破
      if (pairMatch(LIU_PO_PAIRS, a, b)) {
        relations.push({
          type: "破",
          branches: [a, b],
          description: `${DI_ZHI[a]}${DI_ZHI[b]}相破`,
        });
      }

      // 害
      if (pairMatch(LIU_HAI_PAIRS, a, b)) {
        relations.push({
          type: "害",
          branches: [a, b],
          description: `${DI_ZHI[a]}${DI_ZHI[b]}相害`,
        });
      }

      // 合
      if (pairMatch(LIU_HE_PAIRS, a, b)) {
        relations.push({
          type: "合",
          branches: [a, b],
          description: `${DI_ZHI[a]}${DI_ZHI[b]}六合`,
        });
      }
    }
  }

  // 自刑（单支重复出现的情况）：如果原始列表有重复，也算自刑
  const counts: Record<number, number> = {};
  for (const b of branches) {
    counts[b] = (counts[b] || 0) + 1;
  }
  for (const b of Object.keys(counts).map(Number)) {
    if (counts[b] >= 2 && [4, 6, 9, 11].includes(b)) {
      // 检查是否已经作为自刑添加过（unique 列表中不含重复，所以这里单独处理）
      const alreadyHas = relations.some(
        (r) => r.type === "刑" && r.branches[0] === b && r.branches[1] === b
      );
      if (!alreadyHas) {
        relations.push({
          type: "刑",
          branches: [b, b],
          description: `${DI_ZHI[b]}${DI_ZHI[b]}自刑`,
        });
      }
    }
  }

  return relations;
}
