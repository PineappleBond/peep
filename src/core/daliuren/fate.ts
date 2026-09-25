/**
 * 命宫行年（本命与行年）
 *
 * 依《观月经》：
 * - 男命行年：一岁起丙寅（甲子序号 2），顺行
 * - 女命行年：一岁起壬申（甲子序号 8），逆行
 *
 * 本命地支 = 生年地支（以年支为命宫）
 * 行年地支 = 以生年为起点，按性别顺逆行至当前年的地支
 */

import { JIAZI_OFFSET } from "./constants";

/** 命宫行年信息 */
export interface FateInfo {
  /** 命宫地支（即生年地支） */
  mingGong: number;
  /** 行年地支 */
  xingNian: number;
  /** 行年天干 */
  xingNianStem: number;
  /** 行年六十甲子序号 */
  xingNianIndex: number;
  /** 虚岁（当前年 - 生年 + 1） */
  age: number;
}

/**
 * 计算命宫与行年。
 *
 * @param birthYear 出生年份（公历）
 * @param gender 性别："男" 或 "女"
 * @param currentYear 当前年份（公历）
 * @returns 命宫行年信息
 */
export function calculateFate(
  birthYear: number,
  gender: "男" | "女",
  currentYear: number
): FateInfo {
  // 虚岁 = 当前年 - 生年 + 1
  const age = currentYear - birthYear + 1;

  // 计算生年和当前年的六十甲子序号（简化：以立春分界，此处用公历年近似）
  // 甲子年如 1984 = (1984 - JIAZI_OFFSET) % 60 = 0
  // JIAZI_OFFSET = 4（公元 4 年为甲子年）
  const birthYearStem = ((birthYear - JIAZI_OFFSET) % 10 + 10) % 10;
  const birthYearBranch = ((birthYear - JIAZI_OFFSET) % 12 + 12) % 12;
  const currentYearStem = ((currentYear - JIAZI_OFFSET) % 10 + 10) % 10;
  const currentYearBranch = ((currentYear - JIAZI_OFFSET) % 12 + 12) % 12;

  // 六十甲子序号
  const birthYearIndex = ((6 * birthYearStem - 5 * birthYearBranch) % 60 + 60) % 60;
  const currentYearIndex = ((6 * currentYearStem - 5 * currentYearBranch) % 60 + 60) % 60;

  // 行年偏移量（以六十甲子步数计）
  const delta = (currentYearIndex - birthYearIndex + 60) % 60;

  // 行年六十甲子序号
  let xingNianIndex: number;
  if (gender === "男") {
    // 男命：一岁起丙寅（索引 2），顺行
    xingNianIndex = (2 + delta) % 60;
  } else {
    // 女命：一岁起壬申（索引 8），逆行
    xingNianIndex = ((8 - delta) % 60 + 60) % 60;
  }

  // 命宫地支 = 生年地支
  const mingGong = birthYearBranch;

  // 行年地支、天干
  const xingNian = xingNianIndex % 12;
  const xingNianStem = xingNianIndex % 10;

  return {
    mingGong,
    xingNian,
    xingNianStem,
    xingNianIndex,
    age,
  };
}
