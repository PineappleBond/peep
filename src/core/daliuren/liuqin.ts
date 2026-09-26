/**
 * 六亲（五行生克关系）
 *
 * 以日干五行为基准，判断目标地支与日干的六亲关系。
 *
 * 规则（以日干五行为"我"）：
 * - 生我者 → 父母
 * - 同我者 → 兄弟
 * - 我生者 → 子孙
 * - 我克者 → 妻财
 * - 克我者 → 官鬼
 */
import { BRANCH_ELEMENT, STEM_ELEMENT } from "./constants";

/**
 * 根据日干五行和目标地支五行判断六亲
 *
 * 五行生克：
 * 生我：(targetElem + 1) % 5 === myElem
 * 同我：targetElem === myElem
 * 我生：(myElem + 1) % 5 === targetElem
 * 我克：(myElem + 2) % 5 === targetElem
 * 克我：(targetElem + 2) % 5 === myElem
 */
export function getLiuQin(
  dayStem: number,
  targetBranch: number,
): "父母" | "兄弟" | "子孙" | "妻财" | "官鬼" {
  const myElem = STEM_ELEMENT[dayStem];
  const targetElem = BRANCH_ELEMENT[targetBranch];

  if (targetElem === myElem) return "兄弟";
  // 生我者 → 父母：targetElem 生 myElem，即 (targetElem + 1) % 5 === myElem
  if ((targetElem + 1) % 5 === myElem) return "父母";
  // 我生者 → 子孙：myElem 生 targetElem，即 (myElem + 1) % 5 === targetElem
  if ((myElem + 1) % 5 === targetElem) return "子孙";
  // 我克者 → 妻财：myElem 克 targetElem，即 (myElem + 2) % 5 === targetElem
  if ((myElem + 2) % 5 === targetElem) return "妻财";
  // 克我者 → 官鬼：targetElem 克 myElem，即 (targetElem + 2) % 5 === myElem
  if ((targetElem + 2) % 5 === myElem) return "官鬼";

  // 理论上不会到达
  return "官鬼";
}

/**
 * 为所有 12 个地支计算六亲
 *
 * @param dayStem 日干
 * @returns Record<地支索引, 六亲名称>
 */
export function getAllLiuQin(
  dayStem: number,
): Record<number, "父母" | "兄弟" | "子孙" | "妻财" | "官鬼"> {
  const result: Record<number, "父母" | "兄弟" | "子孙" | "妻财" | "官鬼"> = {};
  for (let i = 0; i < 12; i++) {
    result[i] = getLiuQin(dayStem, i);
  }
  return result;
}
