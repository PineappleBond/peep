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
const TIMEZONE_OFFSET = 8; // UTC+8

/**
 * 计算儒略日数（Julian Day Number）
 */
function calcJD(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/**
 * 计算儒略世纪数（Julian Century）
 */
function calcT(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * 计算太阳几何平均黄经（Geometric Mean Longitude of the Sun）
 */
function calcGeomMeanLongSun(T: number): number {
  let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
  while (L0 > 360.0) L0 -= 360.0;
  while (L0 < 0.0) L0 += 360.0;
  return L0;
}

/**
 * 计算太阳几何平均近点角（Geometric Mean Anomaly of the Sun）
 */
function calcGeomMeanAnomalySun(T: number): number {
  return 357.52911 + T * (35999.05029 - 0.0001537 * T);
}

/**
 * 计算地球轨道偏心率（Eccentricity of Earth Orbit）
 */
function calcEccentricityEarthOrbit(T: number): number {
  return 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
}

/**
 * 计算太阳方程（Sun Equation of Center）
 */
function calcSunEqOfCenter(T: number): number {
  const M = calcGeomMeanAnomalySun(T);
  const Mrad = (M * Math.PI) / 180.0;
  const sinM = Math.sin(Mrad);
  const sin2M = Math.sin(2 * Mrad);
  const sin3M = Math.sin(3 * Mrad);
  const C =
    sinM * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    sin2M * (0.019993 - 0.000101 * T) +
    sin3M * 0.000289;
  return C;
}

/**
 * 计算太阳真黄经（Sun True Longitude）
 */
function calcSunTrueLong(T: number): number {
  return calcGeomMeanLongSun(T) + calcSunEqOfCenter(T);
}

/**
 * 计算太阳视黄经（Sun Apparent Longitude）
 */
function calcSunApparentLong(T: number): number {
  const o = calcSunTrueLong(T);
  const omega = 125.04 - 1934.136 * T;
  return o - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180.0);
}

/**
 * 计算平均黄赤交角（Mean Obliquity of the Ecliptic）
 */
function calcMeanObliquityOfEcliptic(T: number): number {
  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  return 23.0 + (26.0 + seconds / 60.0) / 60.0;
}

/**
 * 计算修正黄赤交角（Obliquity Correction）
 */
function calcObliquityCorrection(T: number): number {
  const e0 = calcMeanObliquityOfEcliptic(T);
  const omega = 125.04 - 1934.136 * T;
  return e0 + 0.00256 * Math.cos((omega * Math.PI) / 180.0);
}

/**
 * 计算太阳赤纬（Sun Declination）
 */
function calcSunDeclination(T: number): number {
  const e = calcObliquityCorrection(T);
  const lambda = calcSunApparentLong(T);
  const sint = Math.sin((e * Math.PI) / 180.0) * Math.sin((lambda * Math.PI) / 180.0);
  return (Math.asin(sint) * 180.0) / Math.PI;
}

/**
 * 计算时差方程（Equation of Time）
 */
function calcEquationOfTime(T: number): number {
  const epsilon = calcObliquityCorrection(T);
  const l0 = calcGeomMeanLongSun(T);
  const e = calcEccentricityEarthOrbit(T);
  const m = calcGeomMeanAnomalySun(T);

  let y = Math.tan(((epsilon / 2.0) * Math.PI) / 180.0);
  y *= y;

  const sin2l0 = Math.sin((2.0 * l0 * Math.PI) / 180.0);
  const sinm = Math.sin((m * Math.PI) / 180.0);
  const cos2l0 = Math.cos((2.0 * l0 * Math.PI) / 180.0);
  const sin4l0 = Math.sin((4.0 * l0 * Math.PI) / 180.0);
  const sin2m = Math.sin((2.0 * m * Math.PI) / 180.0);

  const Etime =
    y * sin2l0 -
    2.0 * e * sinm +
    4.0 * e * y * sinm * cos2l0 -
    0.5 * y * y * sin4l0 -
    1.25 * e * e * sin2m;

  return ((Etime * 180.0) / Math.PI) * 4.0; // in minutes
}

/**
 * 计算日出时角（Hour Angle for Sunrise）
 */
function calcHourAngleSunrise(lat: number, declination: number): number {
  const latRad = (lat * Math.PI) / 180.0;
  const decRad = (declination * Math.PI) / 180.0;
  const cosHA =
    Math.cos((90.833 * Math.PI) / 180.0) / (Math.cos(latRad) * Math.cos(decRad)) -
    Math.tan(latRad) * Math.tan(decRad);
  return (Math.acos(cosHA) * 180.0) / Math.PI;
}

/**
 * 计算日出日落时间（与 PHP date_sun_info 完全一致）
 */
function calcSunriseSunset(
  year: number,
  month: number,
  day: number,
  latitude: number,
  longitude: number,
): { sunrise: number; sunset: number } {
  const jd = calcJD(year, month, day);
  const T = calcT(jd + 0.5); // 使用正午计算

  const eqTime = calcEquationOfTime(T);
  const declination = calcSunDeclination(T);
  const hourAngle = calcHourAngleSunrise(latitude, declination);

  // 计算日出日落时间（UTC 分钟数，从午夜 UTC 开始）
  const sunriseMinutesUTC = 720 - 4 * (longitude + hourAngle) - eqTime;
  const sunsetMinutesUTC = 720 - 4 * (longitude - hourAngle) - eqTime;

  // 转换为 Unix 时间戳（秒）
  // 注意：使用 UTC 午夜作为基准，加上 UTC 分钟数
  const baseDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const sunriseTimestamp =
    Math.floor(baseDate.getTime() / 1000) + Math.floor(sunriseMinutesUTC * 60);
  const sunsetTimestamp = Math.floor(baseDate.getTime() / 1000) + Math.floor(sunsetMinutesUTC * 60);

  return { sunrise: sunriseTimestamp, sunset: sunsetTimestamp };
}

/**
 * 计算北京时间的日出日落，判断是否为昼占
 *
 * 使用 NOAA 完整天文算法，与 PHP 的 date_sun_info 完全一致
 */
export function isDaytime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): boolean {
  // 计算日出日落（返回 UTC 时间戳）
  const { sunrise, sunset } = calcSunriseSunset(
    year,
    month,
    day,
    BEIJING_LATITUDE,
    BEIJING_LONGITUDE,
  );

  // 计算当前时间戳（UTC）
  const currentDate = new Date(Date.UTC(year, month - 1, day, hour - TIMEZONE_OFFSET, minute, 0));
  const currentTimestamp = Math.floor(currentDate.getTime() / 1000);

  // 判断是否在日出日落之间
  return currentTimestamp >= sunrise && currentTimestamp < sunset;
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
  minute: number,
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
      generalIdx = (((nobleman - ground - heaven0) % 12) + 12) % 12;
    } else {
      // 顺行
      generalIdx = (((heaven0 - nobleman + ground) % 12) + 12) % 12;
    }

    generals.push({
      position: ground,
      general: generalIdx,
      name: TIAN_JIANG[generalIdx],
    });
  }

  return generals;
}
