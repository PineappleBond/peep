/** 八字模块类型定义 */

// 运限类型统一从共享模块导出，避免重复定义
export type {
  DaYun,
  LiuNian,
  LiuYue,
  LiuRi,
  LiuShi,
} from "@/modules/shared/horoscope";

export interface BaziInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender?: "male" | "female";
  /** 年分界：立春节气（主流）或正月初一 */
  yearDivide?: "lichun" | "zhengyue";
}

export interface Pillar {
  tianGan: string;
  diZhi: string;
  wuXing: string;
  shiShen?: string;
  cangGan?: string[];
}

export interface BaziAnalysis {
  wuXingBalance: string;
  shiShenAnalysis: string;
  geJu?: string;
  yongShen?: string;
  jiShen?: string;
  teDian?: string[];
}

export interface BaziResult {
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar;
  dayMaster: string;
  dayMasterWuXing: string;
  wuXingCount: Record<string, number>;
  shiShenCount: Record<string, number>;
  wangShuai: string;
  analysis: BaziAnalysis;
}

/** 神煞 */
export interface ShenSha {
  name: string;
  type: "ji" | "xiong";
  description: string;
  pillar: "year" | "month" | "day" | "hour";
}


