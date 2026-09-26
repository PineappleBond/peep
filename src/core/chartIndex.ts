/**
 * 盘面索引原语：星→宫映射、三方四正、星文本——结构分析（analysis）与
 * 格局检测（patterns）共用的底层。整盘只建一次索引，向下传参复用。
 *
 * 性能优化：buildChartIndex 按 astrolabe 弱引用缓存（WeakMap），
 * 同一张盘多次调用时直接返回已建索引，避免重复遍历十二宫。
 */
import { util } from "iztro";
import type { Astrolabe } from "./useZwds";
import { MUTAGEN_CHARS, fixIndex } from "./utils";

/** 六吉星+禄马（用于三方四正会照判断） */
export const AUSPICIOUS_MINORS = ["左辅", "右弼", "天魁", "天钺", "文昌", "文曲", "禄存", "天马"];
/** 六煞星（用于三方四正会煞判断） */
export const SHA_STARS = ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"];

/**
 * 盘面共享索引：星名→宫位映射、亮度、生年四化等。
 * 整盘只建一次，向下传参复用给 analysis / patterns / lifeKline 等模块。
 */
export type ChartIndex = {
  a: Astrolabe;
  soulIdx: number;
  /** 星名 → 宫索引（主星+辅星+杂耀） */
  pos: Map<string, number>;
  /** 星名 → 亮度（有则填） */
  bright: Map<string, string>;
  /** 生年四化星 [禄,权,科,忌] */
  natal: string[];
  yearStem: string;
  yearBranch: string;
};

/**
 * 获取某宫全部星耀名称（主星+辅星+杂耀）。
 * @param a - 本命盘对象
 * @param i - 宫位索引（自动 mod 12）
 */
export function starNamesAt(a: Astrolabe, i: number): string[] {
  const p = a.palaces[fixIndex(i)];
  return [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map(s => s.name as string);
}

/**
 * 构建盘面共享索引：遍历全部宫位建立星名→宫位映射、亮度表、生年四化。
 * 按 astrolabe 对象弱引用缓存（WeakMap），同一张盘多次调用直接返回已建索引。
 * astrolabe 被回收时缓存自动清理，无内存泄漏。
 *
 * @param a - 本命盘对象
 * @returns 共享索引，供后续分析函数使用
 */

/** buildChartIndex 按 astrolabe 弱引用缓存 */
const chartIndexCache = new WeakMap<Astrolabe, ChartIndex>();

export function buildChartIndex(a: Astrolabe): ChartIndex {
  const cached = chartIndexCache.get(a);
  if (cached) return cached;

  const pos = new Map<string, number>();
  const bright = new Map<string, string>();
  for (const p of a.palaces) {
    for (const s of [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]) {
      pos.set(s.name as string, p.index);
      if (s.brightness) bright.set(s.name as string, s.brightness as string);
    }
  }
  const gz = a.chineseDate.split(" ")[0] ?? "";
  const yearStem = gz.charAt(0);
  const yearBranch = gz.charAt(1);
  const natal = yearStem ? (util.getMutagensByHeavenlyStem(yearStem as never) as string[]) : [];
  const result = {
    a,
    soulIdx: a.palaces.findIndex(p => p.name === "命宫"),
    pos,
    bright,
    natal,
    yearStem,
    yearBranch,
  };
  chartIndexCache.set(a, result);
  return result;
}

/** P 的三方四正索引：[本宫, 对宫, 三合, 三合] */
export const sanfangIdx = (P: number) => [
  fixIndex(P),
  fixIndex(P + 6),
  fixIndex(P + 4),
  fixIndex(P - 4),
];

/**
 * 指定天干对应的四化星命中：返回每颗四化星所在的宫索引、
 * 化类序号（0=禄 1=权 2=科 3=忌）与星名。未命中（星不在盘面）的化类不包含在结果中。
 * 用于 analysis / lifeKline / patterns 等多个模块的统一四化定位。
 */
export function mutagenHits(
  ix: ChartIndex,
  stem: string,
): { idx: number; k: number; star: string }[] {
  if (!stem) return [];
  const stars = util.getMutagensByHeavenlyStem(stem as never) as string[];
  const hits: { idx: number; k: number; star: string }[] = [];
  stars.forEach((star, k) => {
    const idx = ix.pos.get(star);
    if (idx !== undefined) hits.push({ idx, k, star });
  });
  return hits;
}

export const SEAT_ROLES = ["本宫", "对宫", "三合", "三合"] as const;

/** 星名带亮度与生年四化标记 */
export const starTxt = (ix: ChartIndex, name: string) => {
  const b = ix.bright.get(name);
  const k = ix.natal.indexOf(name);
  return `${name}${b ? `(${b})` : ""}${k >= 0 ? `【生年${MUTAGEN_CHARS[k]}】` : ""}`;
};
