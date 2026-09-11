import type { Branch, Element, Palace, Relative, SixGod, Stem } from './types';

export const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

export const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const BRANCH_ELEM: Record<Branch, Element> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 生：金→水→木→火→土→金 */
export const ELEM_GEN: Record<Element, Element> = {
  金: '水', 水: '木', 木: '火', 火: '土', 土: '金',
};

/** 剋：金→木→土→水→火→金 */
export const ELEM_OVERCOME: Record<Element, Element> = {
  金: '木', 木: '土', 土: '水', 水: '火', 火: '金',
};

/** 六合：子丑 寅亥 卯戌 辰酉 巳申 午未 */
export const BRANCH_HE: Record<Branch, Branch> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};

/** 六沖：子午 丑未 寅申 卯酉 辰戌 巳亥 */
export const BRANCH_CHONG: Record<Branch, Branch> = {
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
  卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
};

/** 墓庫：火墓戌、木墓未、金墓丑、水墓辰、土隨水墓於辰（卜筮正宗） */
export const ELEM_TOMB: Record<Element, Branch> = {
  火: '戌', 木: '未', 金: '丑', 水: '辰', 土: '辰',
};

// ── 八卦 ────────────────────────────────────────────

/** 三爻由下而上：1 陽 0 陰 */
export const TRIGRAMS: { name: Palace; bits: [number, number, number]; elem: Element; symbol: string }[] = [
  { name: '乾', bits: [1, 1, 1], elem: '金', symbol: '天' },
  { name: '兌', bits: [1, 1, 0], elem: '金', symbol: '澤' },
  { name: '離', bits: [1, 0, 1], elem: '火', symbol: '火' },
  { name: '震', bits: [1, 0, 0], elem: '木', symbol: '雷' },
  { name: '巽', bits: [0, 1, 1], elem: '木', symbol: '風' },
  { name: '坎', bits: [0, 1, 0], elem: '水', symbol: '水' },
  { name: '艮', bits: [0, 0, 1], elem: '土', symbol: '山' },
  { name: '坤', bits: [0, 0, 0], elem: '土', symbol: '地' },
];

export const PALACE_ELEM: Record<Palace, Element> = {
  乾: '金', 兌: '金', 離: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

/**
 * 京房納甲表：每卦內卦（初～三爻）與外卦（四～上爻）的干支。
 * 汰換點：可整表替換而不動演算法。
 */
export const NAJIA: Record<Palace, { inner: [Stem, Branch][]; outer: [Stem, Branch][] }> = {
  乾: { inner: [['甲', '子'], ['甲', '寅'], ['甲', '辰']], outer: [['壬', '午'], ['壬', '申'], ['壬', '戌']] },
  坤: { inner: [['乙', '未'], ['乙', '巳'], ['乙', '卯']], outer: [['癸', '丑'], ['癸', '亥'], ['癸', '酉']] },
  震: { inner: [['庚', '子'], ['庚', '寅'], ['庚', '辰']], outer: [['庚', '午'], ['庚', '申'], ['庚', '戌']] },
  巽: { inner: [['辛', '丑'], ['辛', '亥'], ['辛', '酉']], outer: [['辛', '未'], ['辛', '巳'], ['辛', '卯']] },
  坎: { inner: [['戊', '寅'], ['戊', '辰'], ['戊', '午']], outer: [['戊', '申'], ['戊', '戌'], ['戊', '子']] },
  離: { inner: [['己', '卯'], ['己', '丑'], ['己', '亥']], outer: [['己', '酉'], ['己', '未'], ['己', '巳']] },
  艮: { inner: [['丙', '辰'], ['丙', '午'], ['丙', '申']], outer: [['丙', '戌'], ['丙', '子'], ['丙', '寅']] },
  兌: { inner: [['丁', '巳'], ['丁', '卯'], ['丁', '丑']], outer: [['丁', '亥'], ['丁', '酉'], ['丁', '未']] },
};

/** 六十四卦名：key = `${下卦}${上卦}` */
export const HEX_NAMES: Record<string, string> = {
  乾乾: '乾為天', 兌乾: '天澤履', 離乾: '天火同人', 震乾: '天雷無妄',
  巽乾: '天風姤', 坎乾: '天水訟', 艮乾: '天山遯', 坤乾: '天地否',
  乾兌: '澤天夬', 兌兌: '兌為澤', 離兌: '澤火革', 震兌: '澤雷隨',
  巽兌: '澤風大過', 坎兌: '澤水困', 艮兌: '澤山咸', 坤兌: '澤地萃',
  乾離: '火天大有', 兌離: '火澤睽', 離離: '離為火', 震離: '火雷噬嗑',
  巽離: '火風鼎', 坎離: '火水未濟', 艮離: '火山旅', 坤離: '火地晉',
  乾震: '雷天大壯', 兌震: '雷澤歸妹', 離震: '雷火豐', 震震: '震為雷',
  巽震: '雷風恆', 坎震: '雷水解', 艮震: '雷山小過', 坤震: '雷地豫',
  乾巽: '風天小畜', 兌巽: '風澤中孚', 離巽: '風火家人', 震巽: '風雷益',
  巽巽: '巽為風', 坎巽: '風水渙', 艮巽: '風山漸', 坤巽: '風地觀',
  乾坎: '水天需', 兌坎: '水澤節', 離坎: '水火既濟', 震坎: '水雷屯',
  巽坎: '水風井', 坎坎: '坎為水', 艮坎: '水山蹇', 坤坎: '水地比',
  乾艮: '山天大畜', 兌艮: '山澤損', 離艮: '山火賁', 震艮: '山雷頤',
  巽艮: '山風蠱', 坎艮: '山水蒙', 艮艮: '艮為山', 坤艮: '山地剝',
  乾坤: '地天泰', 兌坤: '地澤臨', 離坤: '地火明夷', 震坤: '地雷復',
  巽坤: '地風升', 坎坤: '地水師', 艮坤: '地山謙', 坤坤: '坤為地',
};

export const SIX_GODS: SixGod[] = ['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武'];

/** 依日干起六神：初爻起某神，往上順排 */
export function sixGodStart(dayStem: Stem): number {
  switch (dayStem) {
    case '甲': case '乙': return 0; // 青龍
    case '丙': case '丁': return 1; // 朱雀
    case '戊': return 2;            // 勾陳
    case '己': return 3;            // 螣蛇
    case '庚': case '辛': return 4; // 白虎
    default: return 5;              // 壬癸 玄武
  }
}

/** 六親：以卦宮五行為「我」 */
export function relativeOf(palaceElem: Element, lineElem: Element): Relative {
  if (palaceElem === lineElem) return '兄弟';
  if (ELEM_GEN[lineElem] === palaceElem) return '父母'; // 生我者
  if (ELEM_GEN[palaceElem] === lineElem) return '子孫'; // 我生者
  if (ELEM_OVERCOME[lineElem] === palaceElem) return '官鬼'; // 剋我者
  return '妻財'; // 我剋者
}
