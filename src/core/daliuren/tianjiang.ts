/**
 * 大六壬十二天将（贵神）
 *
 * 昼夜贵人起法（"甲戊庚牛羊"口诀）：
 * - 昼占（卯时至申时，时辰 1-6）：甲戊→丑、乙己→子、丙丁→亥、庚辛→午、壬癸→巳
 * - 夜占（酉时至寅时，时辰 7-11,0）：甲戊→未、乙己→申、丙丁→酉、庚辛→寅、壬癸→卯
 *
 * 顺逆行：贵人落地盘亥子丑寅卯辰（5-10 逆行，其余顺行）
 * 天将顺序：贵人→螣蛇→朱雀→六合→勾陈→青龙→天空→白虎→太常→玄武→太阴→天后
 */
import { TIAN_JIANG, NOBLEMAN_TABLE } from "./constants";
import type { TwelveGeneral } from "./types";

/**
 * 判断是否为昼占
 *
 * 卯时(1)至申时(6)为昼，其余为夜。
 */
export function isDaytime(hourBranch: number): boolean {
  // 卯=3, 辰=4, 巳=5, 午=6 → 但按传统：卯=1时辰...
  // 实际上：子(0)=夜, 丑(1)=夜, 寅(2)=夜, 卯(3)=昼, 辰(4)=昼, 巳(5)=昼,
  //         午(6)=昼, 未(7)=昼, 申(8)=昼, 酉(9)=夜, 戌(10)=夜, 亥(11)=夜
  return hourBranch >= 3 && hourBranch <= 8;
}

/**
 * 计算十二天将
 *
 * @param dayStem 日干索引（0-9）
 * @param hourBranch 时支索引（0-11）
 * @param heavenBoard 天盘
 * @param _earthBoard 地盘（恒为 0-11，未使用但保留签名一致性）
 * @returns 按地盘子至亥排列的十二天将
 */
export function calculateTwelveGenerals(
  dayStem: number,
  hourBranch: number,
  heavenBoard: number[],
  _earthBoard: number[]
): TwelveGeneral[] {
  // 1. 确定昼夜
  const day = isDaytime(hourBranch);

  // 2. 取贵人落支
  const noblemanTable = NOBLEMAN_TABLE[dayStem];
  const nobleman = day ? noblemanTable[0] : noblemanTable[1];

  // 3. 找贵人所在地盘宫位（天盘 nobleman 在哪个地盘位）
  const noblemanGround = heavenBoard.indexOf(nobleman);

  // 4. 判断顺逆行
  // 贵人落地盘巳(5)午(6)未(7)申(8)酉(9)戌(10) → 逆行
  // 贵人落地盘亥(11)子(0)丑(1)寅(2)卯(3)辰(4) → 顺行
  const isReverse = noblemanGround >= 5 && noblemanGround <= 10;

  // 5. 排列十二天将
  const generals: TwelveGeneral[] = [];
  for (let ground = 0; ground < 12; ground++) {
    let generalIdx: number;
    if (isReverse) {
      // 逆行：地盘子位 = (贵人天将 + 地盘位 - 贵人地盘位) mod 12 的逆序
      // 公式：generalIdx = (heavenBoard[ground] - nobleman + 12) % 12 ... 不对
      // PHP: tianjiangNi[i] = normalizeTianjiang(guiren - i - tianpan[0])
      // 其中 i 是地盘位
      generalIdx = ((nobleman - heavenBoard[ground]) % 12 + 12) % 12;
    } else {
      // 顺行：
      // PHP: tianjiangShun[i] = normalizeTianjiang(tianpan[0] - guiren + i)
      // 其中 i 是地盘位
      generalIdx = ((heavenBoard[ground] - nobleman) % 12 + 12) % 12;
    }

    generals.push({
      position: ground,
      general: generalIdx,
      name: TIAN_JIANG[generalIdx],
    });
  }

  return generals;
}
