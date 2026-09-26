/**
 * 建除十二直（建除十二神）
 *
 * 择日术常用：以月建（月支）起"建"，顺排十二宫：
 * 月建=建、次一位=除、再次=满、平、定、执、破、危、成、收、开、闭
 *
 * 用途：判断某地支在当月属于何种"直"，用于择日断吉凶。
 */

/** 建除十二直类型 */
export type JianChuType =
  "建" | "除" | "满" | "平" | "定" | "执" | "破" | "危" | "成" | "收" | "开" | "闭";

/** 十二直顺序（从月建起） */
const JIAN_CHU_ORDER: readonly JianChuType[] = [
  "建",
  "除",
  "满",
  "平",
  "定",
  "执",
  "破",
  "危",
  "成",
  "收",
  "开",
  "闭",
];

/**
 * 计算目标地支在当月的建除类型。
 *
 * @param monthBranch 月建（月支）索引（0-11）
 * @param targetBranch 目标地支索引（0-11）
 * @returns 建除类型
 */
export function getJianChu(monthBranch: number, targetBranch: number): JianChuType {
  // 从月建起"建"，顺排：目标与月建的偏移决定第几个直
  const offset = (((targetBranch - monthBranch) % 12) + 12) % 12;
  return JIAN_CHU_ORDER[offset];
}

/**
 * 计算当月十二地支的建除类型。
 *
 * @param monthBranch 月建（月支）索引
 * @returns Record<number, JianChuType>，key 为地支索引，value 为建除类型
 */
export function getMonthJianChu(monthBranch: number): Record<number, JianChuType> {
  const result: Record<number, JianChuType> = {};
  for (let i = 0; i < 12; i++) {
    result[i] = getJianChu(monthBranch, i);
  }
  return result;
}
