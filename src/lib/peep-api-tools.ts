/**
 * peep 工具代理：将第三方库与项目内部工具统一聚合成四个 API 命名对象，
 * 供 AI 代理 / 外部脚本一次性取用，而不必了解模块分布。
 *
 * - iztroAPI   : iztro 紫微斗数库的完整 namespace 代理
 * - lunarAPI   : lunar-lite + lunar-typescript + 项目 lunar 封装
 * - calendarAPI: 共享历法/运限计算（八字与紫微共用，立春为年界）
 * - utilsAPI   : 通用工具（真太阳时、干支关系表、常量）
 */

/* ── iztro ── */
import { astro, util, star } from "iztro";
import iztroPkg from "iztro/package.json";

const iztroVersion: string = iztroPkg.version;

export const iztroAPI = {
  astro,
  util,
  star,
  version: iztroVersion,
};

/* ── lunar-lite / lunar-typescript / 项目封装 ── */
import {
  solar2lunar,
  lunar2solar,
} from "lunar-lite";
import { LunarYear, LunarMonth } from "lunar-typescript";

import {
  leapMonthOf,
  daysInLunarMonth,
  todayLunar,
  dayGanZhi,
  lunarToSolarStr,
  lunarStrToSolarStr,
  fmtSolar,
} from "@/modules/ziwei/core/lunar";

import {
  yearGanZhi as lunarYearGanZhi,
  monthGanZhi as lunarMonthGanZhi,
  hourGanZhi as lunarHourGanZhi,
  TIME_OPTIONS,
} from "@/modules/ziwei/core/utils";

export const lunarAPI = {
  // 农历⇄公历
  solar2lunar,
  lunar2solar,
  lunarToSolarStr,
  lunarStrToSolarStr,
  fmtSolar,
  // 干支
  dayGanZhi,
  yearGanZhi: lunarYearGanZhi,
  monthGanZhi: lunarMonthGanZhi,
  hourGanZhi: lunarHourGanZhi,
  // 月信息
  leapMonthOf,
  daysInLunarMonth,
  todayLunar,
  // 时辰
  timeOptions: TIME_OPTIONS,
  // lunar-typescript 底层
  LunarYear,
  LunarMonth,
} as const;

/* ── 共享历法/运限（八字 & 紫微共用） ── */
import {
  TIAN_GAN,
  DI_ZHI,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  SHI_SHEN,
  calculateDaYun,
  calculateLiuNian,
  calculateLiuYue,
  calculateLiuRi,
  calculateLiuShi,
  yearGanZhi as calendarYearGanZhi,
  monthGanZhi as calendarMonthGanZhi,
  hourGanZhi as calendarHourGanZhi,
} from "@/modules/shared/horoscope";

export const calendarAPI = {
  // 运限计算
  calculateDaYun,
  calculateLiuNian,
  calculateLiuYue,
  calculateLiuRi,
  calculateLiuShi,
  // 干支（立春为界版本）
  yearGanZhi: calendarYearGanZhi,
  monthGanZhi: calendarMonthGanZhi,
  hourGanZhi: calendarHourGanZhi,
  // 常量表
  TIAN_GAN,
  DI_ZHI,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  SHI_SHEN,
} as const;

/* ── 通用工具 ── */
import { resolveBirthPlace } from "@/modules/ziwei/core/place";

import {
  STEMS,
  BRANCHES,
  LUNAR_MONTHS,
  LUNAR_DAYS,
  TIME_OPTIONS as UTILS_TIME_OPTIONS,
  BRANCH_CHONG,
  BRANCH_LIUHE,
  BRANCH_SANHE_GROUP,
  BRANCH_HAI,
  BRANCH_XING,
  BRANCH_SELF_XING,
  branchRelation,
  mod,
  fixIndex,
  isYangStem,
  timeIndexFromClock,
  equationOfTime,
  applyTrueSolar,
  MUTAGEN_CHARS,
  SCOPES,
  SCOPE_META,
  SCHOOL_YEAR_DIVIDE,
  MUTAGEN_TABLES,
  SCHOOL_MUTAGEN_TABLE,
  MUTAGEN_TABLE_LABEL,
} from "@/modules/ziwei/core/utils";

export const utilsAPI = {
  // 真太阳时
  resolveBirthPlace,
  applyTrueSolar,
  timeIndexFromClock,
  equationOfTime,
  // 干支关系
  branchChong: BRANCH_CHONG,
  branchLiuHe: BRANCH_LIUHE,
  branchSanHe: BRANCH_SANHE_GROUP,
  branchHai: BRANCH_HAI,
  branchXing: BRANCH_XING,
  branchSelfXing: BRANCH_SELF_XING,
  branchRelation,
  // 常量
  STEMS,
  BRANCHES,
  LUNAR_MONTHS,
  LUNAR_DAYS,
  TIME_OPTIONS: UTILS_TIME_OPTIONS,
  MUTAGEN_CHARS,
  // 工具函数
  mod,
  fixIndex,
  isYangStem,
  // 斗数配置
  SCOPES,
  SCOPE_META,
  SCHOOL_YEAR_DIVIDE,
  MUTAGEN_TABLES,
  SCHOOL_MUTAGEN_TABLE,
  MUTAGEN_TABLE_LABEL,
} as const;
