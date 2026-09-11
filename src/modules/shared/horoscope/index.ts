/**
 * 统一运限计算模块
 * 八字和紫微斗数共用，以立春为年界
 */

import { Solar, EightChar } from "lunar-typescript";

// 天干数组
export const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

// 地支数组
export const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 天干五行
export const TIAN_GAN_WU_XING: Record<string, string> = {
  甲: "木", 乙: "木",
  丙: "火", 丁: "火",
  戊: "土", 己: "土",
  庚: "金", 辛: "金",
  壬: "水", 癸: "水",
};

// 地支五行（本气）
export const DI_ZHI_WU_XING: Record<string, string> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木",
  辰: "土", 巳: "火", 午: "火", 未: "土",
  申: "金", 酉: "金", 戌: "土", 亥: "水",
};

// 十神对照表（以日干为基准）
export const SHI_SHEN: Record<string, Record<string, string>> = {
  甲: { 甲: "比肩", 乙: "劫财", 丙: "食神", 丁: "伤官", 戊: "偏财", 己: "正财", 庚: "七杀", 辛: "正官", 壬: "偏印", 癸: "正印" },
  乙: { 甲: "劫财", 乙: "比肩", 丙: "伤官", 丁: "食神", 戊: "正财", 己: "偏财", 庚: "正官", 辛: "七杀", 壬: "正印", 癸: "偏印" },
  丙: { 甲: "偏印", 乙: "正印", 丙: "比肩", 丁: "劫财", 戊: "食神", 己: "伤官", 庚: "偏财", 辛: "正财", 壬: "七杀", 癸: "正官" },
  丁: { 甲: "正印", 乙: "偏印", 丙: "劫财", 丁: "比肩", 戊: "伤官", 己: "食神", 庚: "正财", 辛: "偏财", 壬: "正官", 癸: "七杀" },
  戊: { 甲: "七杀", 乙: "正官", 丙: "偏印", 丁: "正印", 戊: "比肩", 己: "劫财", 庚: "食神", 辛: "伤官", 壬: "偏财", 癸: "正财" },
  己: { 甲: "正官", 乙: "七杀", 丙: "正印", 丁: "偏印", 戊: "劫财", 己: "比肩", 庚: "伤官", 辛: "食神", 壬: "正财", 癸: "偏财" },
  庚: { 甲: "偏财", 乙: "正财", 丙: "七杀", 丁: "正官", 戊: "偏印", 己: "正印", 庚: "比肩", 辛: "劫财", 壬: "食神", 癸: "伤官" },
  辛: { 甲: "正财", 乙: "偏财", 丙: "正官", 丁: "七杀", 戊: "正印", 己: "偏印", 庚: "劫财", 辛: "比肩", 壬: "伤官", 癸: "食神" },
  壬: { 甲: "食神", 乙: "伤官", 丙: "偏财", 丁: "正财", 戊: "七杀", 己: "正官", 庚: "偏印", 辛: "正印", 壬: "比肩", 癸: "劫财" },
  癸: { 甲: "伤官", 乙: "食神", 丙: "正财", 丁: "偏财", 戊: "正官", 己: "七杀", 庚: "正印", 辛: "偏印", 壬: "劫财", 癸: "比肩" },
};

/** 取模（负数安全） */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** 年干支（以立春为界，公历年份） */
export function yearGanZhi(lunarYear: number): string {
  return TIAN_GAN[mod(lunarYear - 4, 10)] + DI_ZHI[mod(lunarYear - 4, 12)];
}

/** 年干索引 */
export function yearStemIndex(lunarYear: number): number {
  return mod(lunarYear - 4, 10);
}

/** 五虎遁：由年干起正月天干；农历 m 月（1~12，正月建寅）干支 */
export function monthGanZhi(lunarYear: number, month: number): string {
  const ys = yearStemIndex(lunarYear);
  const start = [2, 4, 6, 8, 0][ys % 5]; // 甲己丙作首 乙庚戊为头 丙辛庚上起 丁壬壬位流 戊癸甲好求
  const stem = TIAN_GAN[mod(start + month - 1, 10)];
  const branch = DI_ZHI[mod(month + 1, 12)]; // 正月=寅
  return stem + branch;
}

/** 五鼠遁：由日干起子时天干；hourIdx 0~11（子~亥） */
export function hourGanZhi(dayStem: string, hourIdx: number): string {
  const ds = TIAN_GAN.indexOf(dayStem);
  if (ds < 0) return DI_ZHI[mod(hourIdx, 12)] ?? "";
  const start = [0, 2, 4, 6, 8][ds % 5]; // 甲己还加甲 乙庚丙作初 丙辛从戊起 丁壬庚子居 戊癸何方发壬子是真途
  return TIAN_GAN[mod(start + hourIdx, 10)] + DI_ZHI[mod(hourIdx, 12)];
}

/** 运限层级 */
export type Scope = "decadal" | "yearly" | "monthly" | "daily" | "hourly";

/** 大运信息 */
export interface DaYun {
  startAge: number;
  tianGan: string;
  diZhi: string;
  wuXing: string;
  shiShen?: string;
  startYear: number;
  endYear: number;
}

/** 流年信息 */
export interface LiuNian {
  year: number;
  tianGan: string;
  diZhi: string;
  wuXing: string;
  shiShen?: string;
  age: number;
}

/** 流月信息 */
export interface LiuYue {
  month: number;
  tianGan: string;
  diZhi: string;
  wuXing: string;
  shiShen?: string;
}

/** 流日信息 */
export interface LiuRi {
  day: number;
  tianGan: string;
  diZhi: string;
  wuXing: string;
}

/** 流时信息 */
export interface LiuShi {
  hour: number;
  label: string;
  tianGan: string;
  diZhi: string;
  wuXing: string;
}

/**
 * 获取八字年份（以立春为界）
 *
 * 使用 lunar-typescript 的 EightChar 计算精确的立春时刻（精确到分钟），
 * 而非硬编码 2 月 4 日（立春可能落在 2/3~2/5）。
 * 与 bazi/core/calendar.ts 中的实现保持一致。
 *
 * @param yearDivide - "lichun" 以立春节气为年分界（主流），"zhengyue" 以正月初一为年分界
 */
export function getBaziYear(year: number, month: number, day: number, yearDivide: "lichun" | "zhengyue" = "lichun"): number {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  if (yearDivide === "zhengyue") {
    return lunar.getYear();
  }

  // 默认：立春节气为年分界（精确到立春的准确时刻）
  // 通过年柱天干反推八字年份
  const ec = EightChar.fromLunar(lunar);
  const yearGan = ec.getYearGan();
  const ganIndex = TIAN_GAN.indexOf(yearGan);
  const baseYear = 1900;
  const baseGanIndex = 6; // 1900年天干庚
  let yearDiff = ganIndex - baseGanIndex;
  if (yearDiff < 0) yearDiff += 10;
  // 找到最接近公历年份的匹配（考虑前后浮动）
  let baziYear = baseYear + yearDiff;
  const solarYear = solar.getYear();
  while (baziYear + 10 <= solarYear + 1) {
    baziYear += 10;
  }
  while (baziYear > solarYear + 1) {
    baziYear -= 10;
  }
  return baziYear;
}

/**
 * 计算大运（以立春为界）
 * @param birthYear 出生年（公历）
 * @param birthMonth 出生月（公历）
 * @param birthDay 出生日（公历）
 * @param birthHour 出生时（0-23）
 * @param gender 性别
 * @param dayMaster 日主天干（用于计算十神）
 */
export function calculateDaYun(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  birthHour: number,
  gender: "male" | "female",
  dayMaster?: string
): DaYun[] {
  // lunar-typescript 的 getYun 约定: 1=男, 0=女
  const genderNum = gender === "male" ? 1 : 0;

  // 使用 lunar-typescript 的 EightChar 和 Yun 计算精确的大运
  const solar = Solar.fromYmdHms(birthYear, birthMonth, birthDay, birthHour, 0, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  const yun = ec.getYun(genderNum);

  const dayunList = yun.getDaYun(8);
  const baziBirthYear = getBaziYear(birthYear, birthMonth, birthDay);

  return dayunList
    .filter(dy => dy.getIndex() > 0) // 跳过第1运（童限）
    .slice(0, 8)
    .map((dy) => {
      const ganZhi = dy.getGanZhi();
      const tg = ganZhi.charAt(0);
      const dz = ganZhi.charAt(1);
      const startAge = dy.getStartAge();

      return {
        startAge,
        tianGan: tg,
        diZhi: dz,
        wuXing: `${TIAN_GAN_WU_XING[tg]}${DI_ZHI_WU_XING[dz]}`,
        shiShen: dayMaster ? (SHI_SHEN[dayMaster]?.[tg] || "") : undefined,
        startYear: baziBirthYear + startAge,
        endYear: baziBirthYear + startAge + 9,
      };
    });
}

/**
 * 计算流年（以立春为界）
 * @param dayMaster 日主天干（用于计算十神）
 * @param birthYear 出生年份（公历，以立春为界，用于计算年龄）
 */
export function calculateLiuNian(dayMaster: string, birthYear: number): LiuNian[] {
  const liuNian: LiuNian[] = [];
  const currentYear = new Date().getFullYear();

  for (let y = currentYear - 5; y <= currentYear + 15; y++) {
    // 使用立春年份计算干支
    const tg = TIAN_GAN[mod(y - 4, 10)];
    const dz = DI_ZHI[mod(y - 4, 12)];

    // 计算年龄：流年 - 出生年（调用者应传入以立春为界的出生年）
    const age = y - birthYear;

    liuNian.push({
      year: y,
      tianGan: tg,
      diZhi: dz,
      wuXing: `${TIAN_GAN_WU_XING[tg] ?? ""}${DI_ZHI_WU_XING[dz] ?? ""}`,
      shiShen: dayMaster ? (SHI_SHEN[dayMaster]?.[tg] || "") : undefined,
      age,
    });
  }

  return liuNian;
}

/**
 * 计算流月（基于流年干支，用五虎遁起月法）
 * @param liuNianTianGan 流年天干
 */
export function calculateLiuYue(liuNianTianGan: string): LiuYue[] {
  const liuYue: LiuYue[] = [];

  // 五虎遁起月法：年干决定寅月天干
  const yinMonthTgMap: Record<string, number> = {
    甲: 2, 己: 2, // 甲己之年丙作首（丙=index 2）
    乙: 4, 庚: 4, // 乙庚之岁戊为头（戊=index 4）
    丙: 6, 辛: 6, // 丙辛之年寻庚上（庚=index 6）
    丁: 8, 壬: 8, // 丁壬壬寅顺水流（壬=index 8）
    戊: 0, 癸: 0, // 戊癸甲寅好追求（甲=index 0）
  };

  const startTgIndex = yinMonthTgMap[liuNianTianGan] ?? 2;

  // 流月地支固定从寅月开始（寅=2），顺排12个月
  for (let i = 0; i < 12; i++) {
    const tgIndex = (startTgIndex + i) % 10;
    const dzIndex = (2 + i) % 12; // 寅(2)开始
    const tg = TIAN_GAN[tgIndex];
    const dz = DI_ZHI[dzIndex];

    liuYue.push({
      month: i + 1,
      tianGan: tg,
      diZhi: dz,
      wuXing: `${TIAN_GAN_WU_XING[tg]}${DI_ZHI_WU_XING[dz]}`,
    });
  }

  return liuYue;
}

/**
 * 计算流日（指定月份的每日干支）
 * @param year 年份（公历）
 * @param month 月份（1-12）
 */
export function calculateLiuRi(year: number, month: number): LiuRi[] {
  const liuRi: LiuRi[] = [];

  // 获取该月的天数
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    // 使用 lunar-typescript 计算日干支
    const solar = Solar.fromYmdHms(year, month, day, 12, 0, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    const dayGanZhi = ec.getDay();
    const tg = dayGanZhi.charAt(0);
    const dz = dayGanZhi.charAt(1);

    liuRi.push({
      day,
      tianGan: tg,
      diZhi: dz,
      wuXing: `${TIAN_GAN_WU_XING[tg]}${DI_ZHI_WU_XING[dz]}`,
    });
  }

  return liuRi;
}

/**
 * 计算流时（基于日干，用五鼠遁起时法）
 * @param dayStem 日干
 */
export function calculateLiuShi(dayStem: string): LiuShi[] {
  const liuShi: LiuShi[] = [];

  for (let i = 0; i < 12; i++) {
    const ganZhi = hourGanZhi(dayStem, i);
    const tg = ganZhi.charAt(0);
    const dz = ganZhi.charAt(1);

    liuShi.push({
      hour: i,
      label: `${dz}时`,
      tianGan: tg,
      diZhi: dz,
      wuXing: `${TIAN_GAN_WU_XING[tg]}${DI_ZHI_WU_XING[dz]}`,
    });
  }

  return liuShi;
}
