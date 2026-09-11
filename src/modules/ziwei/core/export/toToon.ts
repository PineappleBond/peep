/**
 * AI 导出 · TOON 格式：Token-Oriented Object Notation，面向 LLM 的紧凑编码。
 * 与 JSON 同一数据、表格化数组（均匀数组转表头+行）。
 */
import { encode as toonEncode } from "@toon-format/toon";
import type { Zwds } from "../useZwds";
import { RULEBOOK_MD, STAR_MUTAGEN_MD, topicGuidesMd } from "../knowledge";
import { buildExportData, type ExportOptions } from "./serialize";

/** TOON 场景下的推理指引（字段路径版，替代 MD 的章节号引用） */
const TOON_GUIDE = `# 紫微斗数命盘（AI 分析用 · TOON 数据 + 知识附录）

> 本文件依次为：①推理指引 ②TOON 结构化命盘数据 ③附录A规则速查 / 附录C星情要诀 / 附录D主题指引。
> TOON 为面向 LLM 的紧凑编码：\`键[N]{字段}:\` 表头后逐行为对应值，缩进表层级。

请以严谨的紫微斗数分析师身份，严格依据数据推理：
1. 先复述盘面骨架（basic 基本信息 + analysis.patterns 已检出格局 + 生年四化落宫），确认无误再分析；
2. 三方四正、格局、飞宫四化、夹宫、借星均已确定性算好——直接引用 analysis.sanfang / analysis.patterns / analysis.flyMatrix / analysis.jiaGong / analysis.borrowed 与 horoscope.horoscopePatterns（运限格局），不要自行重算宫位关系；若需推衍未列关系，按 palaces[].index 环形计算（0=寅，对宫=+6，三合=±4）；
3. 推理次序：本命（性格/禀赋/格局）→ 大限（horoscope.decadal 大限运限）→ 流年（horoscope.yearly + horoscope.horoscopePatterns.yearly 运限格局）→ 流月（horoscope.monthlyOfCurrentYear 逐月四化与格局，定应期）；
4. 每个论断注明依据（引用具体字段），区分「结构必然 / 大概率 / 倾向参考」三档确定度；
5. 口径以 meta 为准（meta.mutagenTableDetail 为实际生效四化全表），推理框架遵循下方附录A，星情与四化事象遵循附录C，按提问主题取用附录D对应小节；
6. 星耀权重按 meta.starWeightNote 与 palaces[].adjectiveStars[].weight 取舍——低权重杂耀仅叠加参考，勿独立断大事；小限（horoscope.age 与 palaces[].ages）为辅助年系统，勿与流年混同（口径见 horoscope.age.note）；
7. 如需切换为飞宫四化视角（以四化流向为主轴论盘），直接引用 analysis.flyMatrix 与 analysis.mutagenChains——忌链看压力/亏欠流向，禄链看资源/情义流向，勿自行重飞。`;

/** 由现成 TOON 文本组装 AI 载荷（底部导出面板已持有 TOON 时复用，避免重复构建） */
export function assembleAiPayload(toon: string): string {
  return [
    TOON_GUIDE,
    "```toon",
    toon,
    "```",
    RULEBOOK_MD,
    STAR_MUTAGEN_MD,
    topicGuidesMd(),
  ].join("\n\n");
}

/**
 * 「复制给 AI」的完整载荷：TOON 数据 + 推理指引 + 知识附录（A规则/C星情/D主题）。
 * 比 MD 全文省 token，又不丢失知识层。
 */
export function buildExportAiText(z: Zwds, opts: ExportOptions = {}): string | null {
  const toon = buildExportToon(z, opts);
  if (!toon) return null;
  return assembleAiPayload(toon);
}

/**
 * TOON 导出（Token-Oriented Object Notation，https://github.com/toon-format/toon）：
 * 与 JSON 同一数据、面向 LLM 的紧凑表格化编码（均匀数组转表头+行）。
 * 长篇知识附录（规则速查/星情要诀/主题指引）为 Markdown 文本，剥离并注明见 MD 导出。
 */
export function buildExportToon(z: Zwds, opts: ExportOptions = {}): string | null {
  const data = buildExportData(z, opts);
  if (!data) return null;
  const { rulebook, starEssentials, topicGuides, ...rest } = data;
  void rulebook;
  void starEssentials;
  void topicGuides;
  const meta = {
    ...rest.meta,
    format: "TOON v2（表格化数组：字段头+逐行值）",
    note: `${rest.meta.note} 知识附录（推理规则速查/星情要诀/主题指引）未随 TOON 携带，见 Markdown 导出附录A/C/D。`,
  };
  return toonEncode({ ...rest, meta });
}
