import { calculateFourPillars } from "./calendar";
import type { BaziInput, BaziResult, Pillar } from "../types";
import { HIDDEN_STEMS, WU_XING_SHENG, WU_XING_KE } from "./domainConstants";

// 从共享模块导入运限计算函数和常量（统一入口，避免重复 import）
import {
  calculateDaYun as calculateDaYunShared,
  TIAN_GAN,
  DI_ZHI,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  SHI_SHEN,
  calculateLiuNian,
  calculateLiuYue,
  calculateLiuRi,
  calculateLiuShi,
  yearGanZhi,
  monthGanZhi,
  hourGanZhi,
} from "@/modules/shared/horoscope";

// 透传给 bazi/core/index.ts 的消费者
export {
  TIAN_GAN,
  DI_ZHI,
  TIAN_GAN_WU_XING,
  DI_ZHI_WU_XING,
  SHI_SHEN,
  calculateLiuNian,
  calculateLiuYue,
  calculateLiuRi,
  calculateLiuShi,
  yearGanZhi,
  monthGanZhi,
  hourGanZhi,
};

// 地支藏干 —— 统一从 domainConstants 引用，避免多处定义导致数据不一致
const DI_ZHI_CANG_GAN = HIDDEN_STEMS;

// 月柱地支（从立春开始）
export const MONTH_DI_ZHI = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];

// 时柱地支
export const HOUR_DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 五行相生相克 —— 统一从 domainConstants 引用，避免多处定义导致数据不一致

// 纳音表
export const NA_YIN: Record<string, string> = {
  甲子: "海中金", 乙丑: "海中金", 丙寅: "炉中火", 丁卯: "炉中火",
  戊辰: "大林木", 己巳: "大林木", 庚午: "路旁土", 辛未: "路旁土",
  壬申: "剑锋金", 癸酉: "剑锋金", 甲戌: "山头火", 乙亥: "山头火",
  丙子: "涧下水", 丁丑: "涧下水", 戊寅: "城头土", 己卯: "城头土",
  庚辰: "白蜡金", 辛巳: "白蜡金", 壬午: "杨柳木", 癸未: "杨柳木",
  甲申: "泉中水", 乙酉: "泉中水", 丙戌: "屋上土", 丁亥: "屋上土",
  戊子: "霹雳火", 己丑: "霹雳火", 庚寅: "松柏木", 辛卯: "松柏木",
  壬辰: "长流水", 癸巳: "长流水", 甲午: "砂石金", 乙未: "砂石金",
  丙申: "山下火", 丁酉: "山下火", 戊戌: "平地木", 己亥: "平地木",
  庚子: "壁上土", 辛丑: "壁上土", 壬寅: "金箔金", 癸卯: "金箔金",
  甲辰: "覆灯火", 乙巳: "覆灯火", 丙午: "天河水", 丁未: "天河水",
  戊申: "大驿土", 己酉: "大驿土", 庚戌: "钗钏金", 辛亥: "钗钏金",
  壬子: "桑柘木", 癸丑: "桑柘木", 甲寅: "大溪水", 乙卯: "大溪水",
  丙辰: "沙中土", 丁巳: "沙中土", 戊午: "天上火", 己未: "天上火",
  庚申: "石榴木", 辛酉: "石榴木", 壬戌: "大海水", 癸亥: "大海水",
};

const NA_YIN_WU_XING: Record<string, string> = {
  海中金: "金", 炉中火: "火", 大林木: "木", 路旁土: "土", 剑锋金: "金",
  山头火: "火", 涧下水: "水", 城头土: "土", 白蜡金: "金", 杨柳木: "木",
  泉中水: "水", 屋上土: "土", 霹雳火: "火", 松柏木: "木", 长流水: "水",
  砂石金: "金", 山下火: "火", 平地木: "木", 壁上土: "土", 金箔金: "金",
  覆灯火: "火", 天河水: "水", 大驿土: "土", 钗钏金: "金", 桑柘木: "木",
  大溪水: "水", 沙中土: "土", 天上火: "火", 石榴木: "木", 大海水: "水",
};

/**
 * 计算五行数量
 */
function calculateWuXingCount(pillars: Pillar[]): Record<string, number> {
  const count: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  pillars.forEach((pillar) => {
    const tgWx = TIAN_GAN_WU_XING[pillar.tianGan];
    if (tgWx) count[tgWx]++;

    const dzWx = DI_ZHI_WU_XING[pillar.diZhi];
    if (dzWx) count[dzWx]++;

    if (pillar.cangGan) {
      pillar.cangGan.forEach((cg) => {
        const cgWx = TIAN_GAN_WU_XING[cg];
        if (cgWx) count[cgWx] += 0.3;
      });
    }
  });

  Object.keys(count).forEach((wx) => {
    count[wx] = Math.round(count[wx] * 10) / 10;
  });

  return count;
}

/**
 * 计算十神
 */
function calculateShiShen(dayMaster: string, pillars: Pillar[]): Pillar[] {
  return pillars.map((pillar) => ({
    ...pillar,
    shiShen: SHI_SHEN[dayMaster]?.[pillar.tianGan] || "",
  }));
}

/**
 * 计算十神数量
 */
function calculateShiShenCount(pillars: Pillar[]): Record<string, number> {
  const count: Record<string, number> = {};
  pillars.forEach((pillar) => {
    if (pillar.shiShen) {
      count[pillar.shiShen] = (count[pillar.shiShen] || 0) + 1;
    }
  });
  return count;
}

/**
 * 分析旺衰
 */
function analyzeWangShuai(dayMasterWuXing: string, wuXingCount: Record<string, number>, monthPillar: Pillar): string {
  const monthWuXing = DI_ZHI_WU_XING[monthPillar.diZhi];

  const deLing = monthWuXing === dayMasterWuXing || WU_XING_SHENG[monthWuXing as keyof typeof WU_XING_SHENG] === dayMasterWuXing;
  const sameWuXing = wuXingCount[dayMasterWuXing] || 0;
  const deShi = sameWuXing >= 3;

  if (deLing && deShi) return "旺";
  if (deLing || deShi) return "相";

  const keWuXing = WU_XING_KE[dayMasterWuXing as keyof typeof WU_XING_KE];
  const keCount = wuXingCount[keWuXing] || 0;
  if (keCount >= 3) return "死";
  if (keCount >= 2) return "囚";

  return "休";
}

/**
 * 分析五行平衡
 */
function analyzeWuXingBalance(wuXingCount: Record<string, number>): string {
  const values = Object.values(wuXingCount);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const diff = max - min;

  if (diff <= 1) return "五行相对平衡";
  if (diff <= 2) return "五行略有偏颇";
  if (diff <= 3) return "五行明显失衡";
  return "五行严重失衡";
}

/**
 * 分析十神
 */
function analyzeShiShen(shiShenCount: Record<string, number>): string {
  const items = Object.entries(shiShenCount).sort((a, b) => b[1] - a[1]);
  if (items.length === 0) return "十神分布均匀";

  const top = items[0];
  return `以${top[0]}为主（${top[1]}个），${items.slice(1, 3).map(([name, count]) => `${name}${count}个`).join("、")}`;
}

/**
 * 判断格局
 */
function analyzeGeJu(
  wangShuai: string,
  shiShenCount: Record<string, number>
): string {
  if (shiShenCount["正官"] >= 2) return "正官格：官星透干，贵气显现，主清正廉洁，适合公职";
  if (shiShenCount["七杀"] >= 2) return "七杀格：杀星当权，威势显赫，主魄力过人，宜制化";
  if (shiShenCount["正财"] >= 2) return "正财格：财星得用，主财源稳定，善于理财";
  if (shiShenCount["偏财"] >= 2) return "偏财格：偏财透干，主财路广阔，善于投资";
  if (shiShenCount["食神"] >= 2) return "食神格：食神生财，主才华横溢，适合创意行业";
  if (shiShenCount["伤官"] >= 2) return "伤官格：伤官配印，主才华出众，需有制化";
  if (shiShenCount["正印"] >= 2 || shiShenCount["偏印"] >= 2) return "印绶格：印星当权，主学业有成，智慧超群";
  if (shiShenCount["比肩"] >= 2 || shiShenCount["劫财"] >= 2) return "比劫格：比劫帮身，主朋友众多，需防破财";

  if (wangShuai === "旺") return "身旺格：日主得令得地，气势强盛，宜泄宜耗";
  if (wangShuai === "死" || wangShuai === "囚") return "身弱格：日主失令失地，气势衰弱，宜生宜扶";

  return "普通格局：五行流通，十神均衡";
}

/**
 * 分析用神
 */
function analyzeYongShen(dayMasterWuXing: string, wangShuai: string): string {
  if (wangShuai === "旺" || wangShuai === "相") {
    const ke = WU_XING_KE[dayMasterWuXing] || "";
    const xie = WU_XING_SHENG[dayMasterWuXing] || "";
    return `身旺用${ke}、${xie}，以克泄耗为用`;
  } else {
    const sheng = Object.keys(WU_XING_SHENG).find((k) => WU_XING_SHENG[k] === dayMasterWuXing) || "";
    return `身弱用${sheng}、${dayMasterWuXing}，以生扶为用`;
  }
}

/**
 * 分析忌神
 */
function analyzeJiShen(dayMasterWuXing: string, wangShuai: string): string {
  if (wangShuai === "旺" || wangShuai === "相") {
    const sheng = Object.keys(WU_XING_SHENG).find((k) => WU_XING_SHENG[k] === dayMasterWuXing) || "";
    return `忌${sheng}、${dayMasterWuXing}，生扶为忌`;
  } else {
    const ke = WU_XING_KE[dayMasterWuXing] || "";
    const xie = WU_XING_SHENG[dayMasterWuXing] || "";
    return `忌${ke}、${xie}，克泄耗为忌`;
  }
}

/**
 * 分析特点
 */
function analyzeTeDian(
  dayMaster: string,
  pillars: Pillar[],
  wangShuai: string,
  shiShenCount: Record<string, number>
): string[] {
  const teDian: string[] = [];

  if (wangShuai === "旺") teDian.push("日主得令，气势强盛");
  else if (wangShuai === "弱" || wangShuai === "死") teDian.push("日主失令，需生扶");

  if (shiShenCount["正官"] > 0) teDian.push("正官透干，贵气显现");
  if (shiShenCount["七杀"] > 0) teDian.push("七杀当权，威势过人");
  if (shiShenCount["正财"] > 0 || shiShenCount["偏财"] > 0) teDian.push("财星得用，财源广进");
  if (shiShenCount["食神"] > 0 || shiShenCount["伤官"] > 0) teDian.push("食伤泄秀，才华横溢");
  if (shiShenCount["正印"] > 0 || shiShenCount["偏印"] > 0) teDian.push("印绶护身，智慧超群");

  if (pillars[0].tianGan === dayMaster) teDian.push("年干透日主，祖上显贵");
  if (pillars[2].diZhi === pillars[3].diZhi) teDian.push("日时同支，根基深厚");

  return teDian.length > 0 ? teDian : ["格局清纯，五行流通"];
}

/**
 * 获取纳音
 */
export function getNaYin(tianGan: string, diZhi: string): { naYin: string; naYinWuXing: string } {
  const key = `${tianGan}${diZhi}`;
  const naYinName = NA_YIN[key] || "未知";
  return {
    naYin: naYinName,
    naYinWuXing: NA_YIN_WU_XING[naYinName] || "未知",
  };
}

/**
 * 计算大运（八字封装版本）
 */
export function calculateDaYun(input: BaziInput, result: BaziResult): import("../types").DaYun[] {
  const gender = input.gender || "male";

  // 调用共享模块的 calculateDaYun
  return calculateDaYunShared(
    input.year,
    input.month,
    input.day,
    input.hour,
    gender,
    result.dayMaster
  );
}

// calculateLiuNian, calculateLiuYue, calculateLiuRi 现在从共享模块导入
// 见文件顶部的 export 语句

/**
 * 计算神煞（简化版）
 */
export function calculateShenSha(result: BaziResult): import("../types").ShenSha[] {
  const shenshas: import("../types").ShenSha[] = [];
  const dayZhi = result.dayPillar.diZhi;
  const yearZhi = result.yearPillar.diZhi;

  // 天乙贵人
  const tianYiTable: Record<string, string[]> = {
    甲: ["丑", "未"], 戊: ["丑", "未"],
    乙: ["子", "申"], 己: ["子", "申"],
    丙: ["亥", "酉"], 丁: ["亥", "酉"],
    庚: ["丑", "未"], 辛: ["寅", "午"],
    壬: ["卯", "巳"], 癸: ["卯", "巳"],
  };

  const tianYi = tianYiTable[result.dayMaster] || [];
  if (tianYi.includes(yearZhi)) {
    shenshas.push({ name: "天乙贵人", type: "ji", description: "逢凶化吉，贵人相助", pillar: "year" });
  }
  if (tianYi.includes(dayZhi)) {
    shenshas.push({ name: "天乙贵人", type: "ji", description: "逢凶化吉，贵人相助", pillar: "day" });
  }

  // 文昌贵人
  const wenChangTable: Record<string, string> = {
    甲: "巳", 乙: "午", 丙: "申", 丁: "酉",
    戊: "申", 己: "酉", 庚: "亥", 辛: "子",
    壬: "寅", 癸: "卯",
  };

  const wenChang = wenChangTable[result.dayMaster];
  const allDiZhi = [result.yearPillar.diZhi, result.monthPillar.diZhi, result.dayPillar.diZhi, result.hourPillar.diZhi];
  if (wenChang && (wenChang === yearZhi || allDiZhi.includes(wenChang))) {
    shenshas.push({ name: "文昌贵人", type: "ji", description: "聪明好学，利于考试", pillar: "year" });
  }

  // 驿马
  const yiMaTable: Record<string, string> = {
    子: "寅", 丑: "亥", 寅: "申", 卯: "巳",
    辰: "寅", 巳: "亥", 午: "申", 未: "巳",
    申: "寅", 酉: "亥", 戌: "申", 亥: "巳",
  };

  const yiMa = yiMaTable[yearZhi];
  if (yiMa && result.hourPillar.diZhi === yiMa) {
    shenshas.push({ name: "驿马", type: "ji", description: "主奔波驿马，利于出行", pillar: "hour" });
  }

  // 桃花
  const taoHuaTable: Record<string, string> = {
    子: "酉", 丑: "午", 寅: "卯", 卯: "子",
    辰: "酉", 巳: "午", 午: "卯", 未: "子",
    申: "酉", 酉: "午", 戌: "卯", 亥: "子",
  };

  const taoHua = taoHuaTable[yearZhi];
  if (taoHua && result.hourPillar.diZhi === taoHua) {
    shenshas.push({ name: "桃花", type: "xiong", description: "主异性缘佳，感情丰富", pillar: "hour" });
  }

  // 华盖
  const huaGaiTable: Record<string, string> = {
    子: "辰", 丑: "丑", 寅: "戌", 卯: "未",
    辰: "辰", 巳: "丑", 午: "戌", 未: "未",
    申: "辰", 酉: "丑", 戌: "戌", 亥: "未",
  };

  const huaGai = huaGaiTable[yearZhi];
  if (huaGai && result.hourPillar.diZhi === huaGai) {
    shenshas.push({ name: "华盖", type: "xiong", description: "主孤独、聪明、好文艺", pillar: "hour" });
  }

  return shenshas;
}

/**
 * 主函数：计算八字
 */
export function calculateBazi(input: BaziInput): BaziResult {
  const minute = input.minute || 0;
  const yearDivide = input.yearDivide || "lichun";

  // 使用 calculateFourPillars 获取精确的四柱（使用 lunar-typescript）
  const fourPillars = calculateFourPillars(input.year, input.month, input.day, input.hour, minute, yearDivide);

  // 构建四柱对象
  const yearPillar = createPillar(fourPillars.year[0], fourPillars.year[1]);
  const monthPillar = createPillar(fourPillars.month[0], fourPillars.month[1]);
  const dayPillar = createPillar(fourPillars.day[0], fourPillars.day[1]);
  const hourPillar = createPillar(fourPillars.hour[0], fourPillars.hour[1]);

  const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];
  const dayMaster = dayPillar.tianGan;
  const dayMasterWuXing = TIAN_GAN_WU_XING[dayMaster];

  const pillarsWithShiShen = calculateShiShen(dayMaster, pillars);
  const wuXingCount = calculateWuXingCount(pillars);
  const shiShenCount = calculateShiShenCount(pillarsWithShiShen);
  const wangShuai = analyzeWangShuai(dayMasterWuXing, wuXingCount, monthPillar);

  const analysis = {
    wuXingBalance: analyzeWuXingBalance(wuXingCount),
    shiShenAnalysis: analyzeShiShen(shiShenCount),
    geJu: analyzeGeJu(wangShuai, shiShenCount),
    yongShen: analyzeYongShen(dayMasterWuXing, wangShuai),
    jiShen: analyzeJiShen(dayMasterWuXing, wangShuai),
    teDian: analyzeTeDian(dayMaster, pillars, wangShuai, shiShenCount),
  };

  return {
    yearPillar: pillarsWithShiShen[0],
    monthPillar: pillarsWithShiShen[1],
    dayPillar: pillarsWithShiShen[2],
    hourPillar: pillarsWithShiShen[3],
    dayMaster,
    dayMasterWuXing,
    wuXingCount,
    shiShenCount,
    wangShuai,
    analysis,
  };
}

/**
 * 辅助函数：根据天干地支创建 Pillar 对象
 */
function createPillar(tianGan: string, diZhi: string): Pillar {
  return {
    tianGan,
    diZhi,
    wuXing: `${TIAN_GAN_WU_XING[tianGan]}${DI_ZHI_WU_XING[diZhi]}`,
    cangGan: DI_ZHI_CANG_GAN[diZhi],
  };
}
