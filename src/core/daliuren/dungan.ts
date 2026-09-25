/**
 * 遁干（旬遁、日遁/五子元遁）
 *
 * 旬遁：按日柱所在旬的旬首天干（恒为甲），在天盘上依次遁出十干。
 * 日遁（五子元遁）：按日干决定子时起何干，顺推十二时辰的天干。
 */
import { TIAN_GAN, DI_ZHI, XUN_HEAD } from "./constants";
import { sexagenaryIndex } from "./utils";

/**
 * 五子元遁：日干 → 子时天干
 *
 * 口诀：
 * 甲己日起甲子时（子时天干 = 甲，索引 0）
 * 乙庚日起丙子时（子时天干 = 丙，索引 2）
 * 丙辛日起戊子时（子时天干 = 戊，索引 4）
 * 丁壬日起庚子时（子时天干 = 庚，索引 6）
 * 戊癸日起壬子时（子时天干 = 壬，索引 8）
 *
 * 规律：子时天干索引 = (dayStem % 5) * 2
 */
function getZiShiStem(dayStem: number): number {
  return (dayStem % 5) * 2;
}

/**
 * 日遁（五子元遁）：按日干起时干
 *
 * @param dayStem 日干索引（0-9）
 * @param hourBranch 时辰地支索引（0-11），子时=0
 * @returns 该时辰的天干字符串
 */
export function getRiDunStem(dayStem: number, hourBranch: number): string {
  const ziStem = getZiShiStem(dayStem);
  // 从子时天干开始，顺推 hourBranch 步
  const stemIdx = (ziStem + hourBranch) % 10;
  return TIAN_GAN[stemIdx];
}

/**
 * 日遁（五子元遁）：返回 12 个时辰的天干
 *
 * @param dayStem 日干索引（0-9）
 * @returns 长度为 12 的数组，索引对应子至亥的天干
 */
export function calculateRiDun(dayStem: number): string[] {
  const result: string[] = [];
  const ziStem = getZiShiStem(dayStem);
  for (let i = 0; i < 12; i++) {
    const stemIdx = (ziStem + i) % 10;
    result.push(TIAN_GAN[stemIdx]);
  }
  return result;
}

/**
 * 旬遁：按旬首在天盘上遁天干
 *
 * 旬首恒为甲（索引 0），从天盘上旬首所临之地盘位开始，
 * 沿地盘顺序（子→丑→寅…）依次遁出甲、乙、丙、丁……
 *
 * 具体规则：
 * 1. 找出日柱所在旬的旬首地支（XUN_HEAD）
 * 2. 旬首地支在地盘上的位置 = 旬首地支本身
 * 3. 天盘上该位置的支 → 遁甲
 * 4. 天盘上下一地支位置 → 遁乙，依此类推
 *
 * @param dayStem 日干（用于确定旬）
 * @param dayBranch 日支（用于确定旬）
 * @param heavenBoard 天盘（12 个地支索引）
 * @returns Map<地盘宫位, 遁干字符>
 */
export function calculateXunDun(
  dayStem: number,
  dayBranch: number,
  heavenBoard: number[]
): Map<number, string> {
  // 计算日柱在六甲中的旬首地支
  // 六旬：甲子(0)、甲戌(10)、甲申(8)、甲午(6)、甲辰(4)、甲寅(2)
  const sexIdx = sexagenaryIndex(dayStem, dayBranch);
  const xunIdx = Math.floor(sexIdx / 10); // 第几旬（0-5）
  const xunHeadBranch = XUN_HEAD[xunIdx];

  // 旬遁：从旬首地支在地盘的位置开始，沿天盘遁出十干
  // 天盘 heavenBoard[xunHeadBranch] = 旬首所在宫位对应的天盘支
  // 实际上旬遁是：旬首加临时辰，然后从旬首所在地盘位起甲，
  // 顺次（地盘顺序）遁出十天干

  // 在大六壬中，旬遁是按地盘顺序，从旬首地支所在宫位开始，
  // 依次分配天干：旬首位→甲，下一位→乙，…
  // 但这里 heavenBoard 是月将加时的结果，
  // 旬遁的起点是旬首地支在地盘的位置

  const result = new Map<number, string>();

  // 从旬首地支在地盘的位置开始，沿地盘顺序遁十干
  for (let i = 0; i < 10; i++) {
    const pos = (xunHeadBranch + i) % 12;
    const stemIdx = i; // 甲=0, 乙=1, ... 癸=9
    result.set(pos, TIAN_GAN[stemIdx]);
  }

  return result;
}

/**
 * 获取日柱对应的旬首信息
 *
 * @param dayStem 日干
 * @param dayBranch 日支
 * @returns 旬首地支索引和旬首名称
 */
export function getXunInfo(dayStem: number, dayBranch: number): {
  xunHead: number;
  xunName: string;
} {
  const sexIdx = sexagenaryIndex(dayStem, dayBranch);
  const xunIdx = Math.floor(sexIdx / 10);
  const xunHead = XUN_HEAD[xunIdx];
  return { xunHead, xunName: `甲${DI_ZHI[xunHead]}旬` };
}
