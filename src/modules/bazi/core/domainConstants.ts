/**
 * 八字模块共享领域常量
 *
 * 将散布在多个文件中的重复常量统一收归此处，消除数据不一致风险。
 * 引用方应从本模块 import，而非本地重新定义。
 */

import nayinRows from "../data/nayin.json";

/* ── 天干 ─────────────────────────────────────────── */

/** 十天干（按序） */
export const STEMS_LIST = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

/** 天干 → 五行 */
export const STEM_ELEMENT: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

/** 天干 → 阴阳 */
export const STEM_YIN_YANG: Record<string, string> = {
  甲: "阳", 乙: "阴", 丙: "阳", 丁: "阴", 戊: "阳",
  己: "阴", 庚: "阳", 辛: "阴", 壬: "阳", 癸: "阴",
};

/* ── 地支 ─────────────────────────────────────────── */

/** 十二地支（按序） */
export const BRANCHES_LIST = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

/** 地支 → 五行 */
export const BRANCH_ELEMENT: Record<string, string> = {
  寅: "木", 卯: "木", 巳: "火", 午: "火",
  辰: "土", 戌: "土", 丑: "土", 未: "土",
  申: "金", 酉: "金", 亥: "水", 子: "水",
};

/** 地支藏干（按本气/中气/余气排序） */
export const HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "戊", "庚"], 午: ["丁", "己"],
  未: ["己", "丁", "乙"], 申: ["庚", "壬", "戊"], 酉: ["辛"],
  戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
};

/* ── 五行 ─────────────────────────────────────────── */

/** 五行 → 图标 emoji */
export const WX_ICON: Record<string, string> = {
  wood: "🌿", fire: "🔥", earth: "⛰️", metal: "🪙", water: "💧",
};

/** 五行 → 中文名 */
export const WX_NAME: Record<string, string> = {
  wood: "木", fire: "火", earth: "土", metal: "金", water: "水",
};

/** 五行相生 */
export const WU_XING_SHENG: Record<string, string> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

/** 五行相克 */
export const WU_XING_KE: Record<string, string> = {
  木: "土", 火: "金", 土: "水", 金: "木", 水: "火",
};

/* ── 十二长生 ─────────────────────────────────────── */

/** 十二长生（日干 → 地支 → 阶段名） */
export const TWELVE_STAGES: Record<string, Record<string, string>> = {
  甲: { 亥: "长生", 子: "沐浴", 丑: "冠带", 寅: "临官", 卯: "帝旺", 辰: "衰", 巳: "病", 午: "死", 未: "墓", 申: "绝", 酉: "胎", 戌: "养" },
  乙: { 午: "长生", 巳: "沐浴", 辰: "冠带", 卯: "临官", 寅: "帝旺", 丑: "衰", 子: "病", 亥: "死", 戌: "墓", 酉: "绝", 申: "胎", 未: "养" },
  丙: { 寅: "长生", 卯: "沐浴", 辰: "冠带", 巳: "临官", 午: "帝旺", 未: "衰", 申: "病", 酉: "死", 戌: "墓", 亥: "绝", 子: "胎", 丑: "养" },
  丁: { 酉: "长生", 申: "沐浴", 未: "冠带", 午: "临官", 巳: "帝旺", 辰: "衰", 卯: "病", 寅: "死", 丑: "墓", 子: "绝", 亥: "胎", 戌: "养" },
  戊: { 寅: "长生", 卯: "沐浴", 辰: "冠带", 巳: "临官", 午: "帝旺", 未: "衰", 申: "病", 酉: "死", 戌: "墓", 亥: "绝", 子: "胎", 丑: "养" },
  己: { 酉: "长生", 申: "沐浴", 未: "冠带", 午: "临官", 巳: "帝旺", 辰: "衰", 卯: "病", 寅: "死", 丑: "墓", 子: "绝", 亥: "胎", 戌: "养" },
  庚: { 巳: "长生", 午: "沐浴", 未: "冠带", 申: "临官", 酉: "帝旺", 戌: "衰", 亥: "病", 子: "死", 丑: "墓", 寅: "绝", 卯: "胎", 辰: "养" },
  辛: { 子: "长生", 亥: "沐浴", 戌: "冠带", 酉: "临官", 申: "帝旺", 未: "衰", 午: "病", 巳: "死", 辰: "墓", 卯: "绝", 寅: "胎", 丑: "养" },
  壬: { 申: "长生", 酉: "沐浴", 戌: "冠带", 亥: "临官", 子: "帝旺", 丑: "衰", 寅: "病", 卯: "死", 辰: "墓", 巳: "绝", 午: "胎", 未: "养" },
  癸: { 卯: "长生", 寅: "沐浴", 丑: "冠带", 子: "临官", 亥: "帝旺", 戌: "衰", 酉: "病", 申: "死", 未: "墓", 午: "绝", 巳: "胎", 辰: "养" },
};

/* ── 纳音 ─────────────────────────────────────────── */

/** 纳音（从 nayin.json 提取 name 字段） */
export const NAYIN: Record<string, string> = Object.fromEntries(
  Object.entries(nayinRows as unknown as Record<string, [string, number, number]>).map(([pillar, row]) => [pillar, row[0]])
);

/* ── 十神 ─────────────────────────────────────────── */

/** 十神缩写 → 全称 */
export const SHI_SHEN_FULL: Record<string, string> = {
  比: "比肩", 劫: "劫财", 食: "食神", 伤: "伤官", 财: "偏财",
  才: "正财", 杀: "七杀", 官: "正官", 枭: "偏印", 印: "正印",
};

/**
 * 根据日干与他干计算十神关系
 */
export function getShiShen(dayStem: string, otherStem: string): string {
  if (dayStem === otherStem) return "比肩";
  const dayElement = STEM_ELEMENT[dayStem];
  const otherElement = STEM_ELEMENT[otherStem];
  if (!dayElement || !otherElement) return "";
  const isSamePolarity = (STEMS_LIST.indexOf(dayStem) % 2) === (STEMS_LIST.indexOf(otherStem) % 2);
  if (dayElement === otherElement) return isSamePolarity ? "比肩" : "劫财";
  if (WU_XING_SHENG[dayElement] === otherElement) return isSamePolarity ? "食神" : "伤官";
  if (WU_XING_SHENG[otherElement] === dayElement) return isSamePolarity ? "偏印" : "正印";
  if (WU_XING_KE[dayElement] === otherElement) return isSamePolarity ? "偏财" : "正财";
  if (WU_XING_KE[otherElement] === dayElement) return isSamePolarity ? "七杀" : "正官";
  return "";
}

/* ── 空亡 ─────────────────────────────────────────── */

/**
 * 根据柱（天干+地支）计算空亡
 *
 * 算法：从地支位置减去天干位置，确定旬首，然后取旬首后两位
 */
export function calcKongWang(pillar: string): string {
  const chars = Array.from(pillar);
  if (chars.length < 2) return "";
  const si = STEMS_LIST.indexOf(chars[0] as typeof STEMS_LIST[number]);
  const bi = BRANCHES_LIST.indexOf(chars[1] as typeof BRANCHES_LIST[number]);
  if (si < 0 || bi < 0) return "";
  const start = (bi - si + 12) % 12;
  return BRANCHES_LIST[(start + 10) % 12] + BRANCHES_LIST[(start + 11) % 12];
}

/* ── 辅助：获取五行属性 ─────────────────────────── */

/**
 * 天干/地支 → 五行英文名（"wood" | "fire" | "earth" | "metal" | "water"）
 *
 * WX_ICON / WX_NAME 使用英文 key，所以 elementOf 返回英文值。
 * 中文五行关系（WU_XING_SHENG / WU_XING_KE）使用中文 key，由 STEM_ELEMENT 服务。
 */
export const STEM_TO_EN: Record<string, string> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth",
  己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
};

export const BRANCH_TO_EN: Record<string, string> = {
  寅: "wood", 卯: "wood", 巳: "fire", 午: "fire",
  辰: "earth", 戌: "earth", 丑: "earth", 未: "earth",
  申: "metal", 酉: "metal", 亥: "water", 子: "water",
};

/** 天干或地支 → 五行英文名（"wood" | "fire" | ...） */
export function elementOf(ganOrZhi: string): string {
  return STEM_TO_EN[ganOrZhi] ?? BRANCH_TO_EN[ganOrZhi] ?? "";
}

/** 天干或地支 → 对应 emoji 图标 */
export function elementGlyph(ganOrZhi: string): string {
  const wx = elementOf(ganOrZhi);
  return wx ? (WX_ICON[wx] ?? "") : "";
}

/** 天干或地支 → 五行中文名 */
export function elementName(ganOrZhi: string): string {
  const wx = elementOf(ganOrZhi);
  return wx ? (WX_NAME[wx] ?? "") : "";
}
