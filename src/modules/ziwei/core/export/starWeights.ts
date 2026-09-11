/** 导出层：星耀权重定义与序列化辅助 */

type AnyStar = {
  name: string;
  type?: string;
  scope?: string;
  brightness?: string;
  mutagen?: string;
};

export function serializeStar(star: AnyStar) {
  return {
    name: star.name,
    type: star.type,
    scope: star.scope,
    ...(star.brightness ? { brightness: star.brightness } : {}),
    ...(star.mutagen ? { mutagen: star.mutagen } : {}),
  };
}

/**
 * 杂耀·中权重名单（乙级辅曜，可参与断事）：桃花四曜、刑姚巫月煞、台座光贵、辅诰池阁、华盖孤寡。
 * 未列入的杂耀为低权重，仅作叠加参考。
 */
export const ADJ_MID_WEIGHT = new Set([
  "红鸾", "天喜", "天姚", "咸池",
  "天刑", "天巫", "天月", "阴煞",
  "三台", "八座", "恩光", "天贵",
  "台辅", "封诰", "龙池", "凤阁",
  "华盖", "孤辰", "寡宿",
]);

/** 星耀权重口径（写入 meta 与 MD，供 AI 按权重取舍） */
export const STAR_WEIGHT_NOTE =
  "星耀权重三档：主星（majorStars）＞辅星（minorStars，六吉六煞禄存天马）＞杂耀（adjectiveStars）。" +
  "杂耀再分两档——中权重（可参与断事）：红鸾天喜天姚咸池·天刑天巫天月阴煞·三台八座恩光天贵·台辅封诰龙池凤阁·华盖孤辰寡宿；" +
  "其余为低权重，仅在与主辅星同宫时作叠加参考，切勿以低权重杂耀独立断大事。";

export function serializeAdjStar(star: AnyStar) {
  return { ...serializeStar(star), weight: ADJ_MID_WEIGHT.has(star.name) ? "中" : "低" };
}

/** 小限口径备注（防 AI 把小限与流年两套年系统混同） */
export const AGE_NOTE =
  "小限为辅助年系统（生年支三合起、男顺女逆），与流年并行；论某年吉凶以流年四化引动为主，小限仅作叠加参考——勿把小限宫当作流年命宫，勿以小限单独断吉凶。";

export type { AnyStar };
