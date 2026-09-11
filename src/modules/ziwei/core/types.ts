/** 紫微斗数：类型定义 */
import type { astro } from "iztro";
import type { MutagenTableKey, Scope } from "./utils";

export type Astrolabe = ReturnType<typeof astro.bySolar>;
export type Horoscope = ReturnType<Astrolabe["horoscope"]>;
export type PalaceData = Astrolabe["palaces"][number];

export type BirthInput = {
  name: string;
  gender: "男" | "女";
  calendar: "solar" | "lunar";
  /** YYYY-MM-DD（阳历，或农历年月日数字） */
  date: string;
  /** 0~12（早子~晚子） */
  timeIndex: number;
  isLeapMonth: boolean;
  /** 精确出生时刻 HH:mm（真太阳时启用时使用） */
  exactTime: string;
  /** 按真太阳时排盘（勾选后展开时刻与出生地区） */
  useTrueSolar: boolean;
  /** 出生地模式：中国城市（省市区经度表+东八区）/ 海外（IANA 时区） */
  placeMode: "china" | "overseas";
  /** 出生地区（省/市/区三级，经度由此查表） */
  province: string;
  city: string;
  district: string;
  /** 海外出生时区（IANA 名，如 Asia/Tokyo；默认取浏览器系统时区） */
  timezone: string;
  /** 安星流派：通行版（南派）/ 中州派 */
  algorithm: "default" | "zhongzhou";
  /** 年分界：正月初一 / 立春（同时作用于运限分界）；随流派自动预设，可手动覆盖 */
  yearDivide: "normal" | "exact";
  /** 十干四化表：通行 / 中州（庚壬天府化科）；随流派自动预设，可手动覆盖 */
  mutagenTable: MutagenTableKey;
  /** 晚子时归日：forward=归次日（通行默认）/ current=归当日 */
  dayDivide: "forward" | "current";
  /** 盘型（中州派特有）：天盘 / 地盘（身宫起局重排）/ 人盘（福德宫起局重排） */
  astroType: "heaven" | "earth" | "human";
  /** 常居住地（可选，不参与排盘，随导出供 AI 做地域/方位参考） */
  residence: string;
};

/**
 * 起盘参数的中性默认值：新字段随版本增加，localStorage 主输入与多盘档案里的
 * 旧存档缺这些字段，读取侧必须以本默认值补齐——否则 undefined 会渗入排盘配置
 * （iztro 全局配置粘性，mutagens: undefined 不清除残留，会静默沿用上一张盘的四化表）。
 */
export const DEFAULT_BIRTH_INPUT: BirthInput = {
  name: "",
  gender: "男",
  calendar: "solar",
  date: "2000-01-01",
  timeIndex: 0,
  isLeapMonth: false,
  exactTime: "",
  useTrueSolar: false,
  placeMode: "china",
  province: "北京",
  city: "北京",
  district: "市区",
  timezone: "",
  algorithm: "zhongzhou",  // 强制中州派
  yearDivide: "exact",      // 强制立春分界
  mutagenTable: "zhongzhou", // 强制中州派四化表
  dayDivide: "forward",
  astroType: "heaven",
  residence: "",
};

export type TrueSolarInfo = {
  clockDate: string;
  clockTime: string;
  trueDate: string;
  trueTime: string;
  timeIndex: number;
  offsetMinutes: number;
  eotMinutes: number;
  longitude: number;
  /** 钟表基准偏移（分钟）：中国=480（东八）；海外=出生时刻该时区实际 UTC 偏移（含夏令时） */
  clockOffsetMinutes: number;
  /** 出生地标签（省市区，或 IANA 时区+UTC 偏移） */
  place: string;
};

export type PickState = { year: number; month: number; day: number; hour: number; leap: boolean };
export type ScopeVisible = Record<Scope, boolean>;

export type DecadeInfo = {
  palaceIndex: number;
  range: [number, number];
  heavenlyStem: string;
  earthlyBranch: string;
  startYear: number;
  endYear: number;
};

export type CellYear = { year: number; gz: string; age: number };
export type CellMonth = { month: number; leap: boolean; label: string; gz: string };
export type CellDay = { day: number; label: string; gz: string };
export type CellHour = { hour: number; label: string; gz: string };

export type EffectiveBirth = {
  calendar: "solar" | "lunar";
  dateStr: string;
  timeIndex: number;
  trueSolar: TrueSolarInfo | null;
};
