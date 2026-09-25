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

/** 北京经纬度 */
const BEIJING_LATITUDE = 39.9042;
const BEIJING_LONGITUDE = 116.4074;

/**
 * 计算北京时间的日出日落，判断是否为昼占
 *
 * 使用简化的天文算法，与 PHP 的 date_sun_info 保持一致
 */
export function isDaytime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): boolean {
  // 计算当日的日出日落时间戳（简化版，使用固定的正午时间计算）
  const noonDate = new Date(year, month - 1, day, 12, 0, 0);
  const noonTimestamp = Math.floor(noonDate.getTime() / 1000);

  // 使用简化的日出日落计算（基于纬度）
  // 这是一个近似算法，与 PHP 的 date_sun_info 结果相近
  const dayOfYear = Math.floor(
    (noonDate.getTime() - new Date(year, 0, 0).getTime()) / 86400000
  );

  // 太阳赤纬（简化公式）
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));

  // 时角计算
  const latRad = (BEIJING_LATITUDE * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;

  const cosHourAngle =
    (Math.sin(-0.833 * (Math.PI / 180)) - Math.sin(latRad) * Math.sin(decRad)) /
    (Math.cos(latRad) * Math.cos(decRad));

  // 极昼/极夜情况
  if (cosHourAngle > 1) return false; // 极夜
  if (cosHourAngle < -1) return true; // 极昼

  const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);

  // 日出日落时间（小时）
  const sunriseHour = 12 - hourAngle / 15;
  const sunsetHour = 12 + hourAngle / 15;

  // 当前时间（小时）
  const currentHour = hour + minute / 60;

  return currentHour >= sunriseHour && currentHour < sunsetHour;
}

/**
 * 计算十二天将
 *
 * @param dayStem 日干索引（0-9）
 * @param hourBranch 时支索引（0-11）
 * @param heavenBoard 天盘
 * @param _earthBoard 地盘（恒为 0-11，未使用但保留签名一致性）
 * @param year 公历年
 * @param month 公历月
 * @param day 公历日
 * @param hour 时（0-23）
 * @param minute 分（0-59）
 * @returns 按地盘子至亥排列的十二天将
 */
export function calculateTwelveGenerals(
  dayStem: number,
  hourBranch: number,
  heavenBoard: number[],
  _earthBoard: number[],
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): TwelveGeneral[] {
  // 1. 确定昼夜（使用实际日出日落计算）
  const isDay = isDaytime(year, month, day, hour, minute);

  // 2. 取贵人落支
  const noblemanTable = NOBLEMAN_TABLE[dayStem];
  const nobleman = isDay ? noblemanTable[0] : noblemanTable[1];

  // 3. 找贵人所在地盘宫位（天盘 nobleman 在哪个地盘位）
  const noblemanGround = heavenBoard.indexOf(nobleman);

  // 4. 判断顺逆行
  // 贵人落地盘巳(5)午(6)未(7)申(8)酉(9)戌(10) → 逆行
  // 贵人落地盘亥(11)子(0)丑(1)寅(2)卯(3)辰(4) → 顺行
  const isReverse = noblemanGround >= 5 && noblemanGround <= 10;

  // 5. 排列十二天将
  // PHP 公式：
  // 顺行: tianjiangShun[i] = normalizeTianjiang(tianpan[0] - guiren + i)
  // 逆行: tianjiangNi[i] = normalizeTianjiang(guiren - i - tianpan[0])
  // 其中 i 是地盘位（0-11），不是天盘值
  const heaven0 = heavenBoard[0]; // 天盘子位的值
  const generals: TwelveGeneral[] = [];
  for (let ground = 0; ground < 12; ground++) {
    let generalIdx: number;
    if (isReverse) {
      // 逆行
      generalIdx = ((nobleman - ground - heaven0) % 12 + 12) % 12;
    } else {
      // 顺行
      generalIdx = ((heaven0 - nobleman + ground) % 12 + 12) % 12;
    }

    generals.push({
      position: ground,
      general: generalIdx,
      name: TIAN_JIANG[generalIdx],
    });
  }

  return generals;
}
