/**
 * 旺相休囚死（季节旺衰）
 *
 * 根据月支确定当令五行，再判断目标地支五行与当令五行的关系。
 *
 * 关系：
 * - 同五行 → 旺
 * - 我生者 → 相（当令生目标）
 * - 生我者 → 休（目标生当令）
 * - 克我者 → 囚（目标克当令）
 * - 我克者 → 死（当令克目标）
 */
import { BRANCH_ELEMENT } from "./constants";

/**
 * 五行生克关系判断
 *
 * 五行顺序：木(0) 火(1) 土(2) 金(3) 水(4)
 * 生：木→火→土→金→水→木（(x+1)%5 为被生者）
 * 克：木→土→水→火→金→木（(x+2)%5 为被克者）
 */

/**
 * 判断 targetElement 相对于 wangElement 的旺衰状态
 *
 * @param wangElement 当令五行（0-4）
 * @param targetElement 目标五行（0-4）
 * @returns "旺" | "相" | "休" | "囚" | "死"
 */
function wuxingState(wangElement: number, targetElement: number): "旺" | "相" | "休" | "囚" | "死" {
  if (targetElement === wangElement) return "旺";
  // 我生者 → 相：当令生目标，即 (wangElement + 1) % 5 === targetElement
  if ((wangElement + 1) % 5 === targetElement) return "相";
  // 生我者 → 休：目标生当令，即 (targetElement + 1) % 5 === wangElement
  if ((targetElement + 1) % 5 === wangElement) return "休";
  // 克我者 → 囚：目标克当令，即 (targetElement + 2) % 5 === wangElement
  if ((targetElement + 2) % 5 === wangElement) return "囚";
  // 我克者 → 死：当令克目标，即 (wangElement + 2) % 5 === targetElement
  if ((wangElement + 2) % 5 === targetElement) return "死";
  // 理论上不会到达
  return "死";
}

/**
 * 根据月支获取当令五行
 *
 * 规则：
 * - 寅卯月（2,3）→ 木旺（0）
 * - 巳午月（5,6）→ 火旺（1）
 * - 申酉月（8,9）→ 金旺（3）
 * - 亥子月（11,0）→ 水旺（4）
 * - 辰戌丑未月（4,10,1,7）→ 土旺（2）
 */
function getDangLingElement(monthBranch: number): number {
  // 月支五行即为当令五行（土月自然得土）
  return BRANCH_ELEMENT[monthBranch];
}

/**
 * 获取目标地支在当月季节的旺相休囚死状态
 *
 * @param monthBranch 月支（决定当令五行）
 * @param targetBranch 目标地支（判断其五行旺衰状态）
 * @returns "旺" | "相" | "休" | "囚" | "死"
 */
export function getWangXiang(
  monthBranch: number,
  targetBranch: number
): "旺" | "相" | "休" | "囚" | "死" {
  const dangLing = getDangLingElement(monthBranch);
  const targetElem = BRANCH_ELEMENT[targetBranch];
  return wuxingState(dangLing, targetElem);
}

/**
 * 为所有 12 个地支计算旺相休囚死
 *
 * @param monthBranch 月支
 * @returns Record<地支索引, 旺衰状态>
 */
export function getAllWangXiang(
  monthBranch: number
): Record<number, "旺" | "相" | "休" | "囚" | "死"> {
  const result: Record<number, "旺" | "相" | "休" | "囚" | "死"> = {};
  for (let i = 0; i < 12; i++) {
    result[i] = getWangXiang(monthBranch, i);
  }
  return result;
}
