/**
 * 神煞计算
 *
 * 根据年支、月支、日干、日支、时支计算各类神煞。
 * 参考 PHP ZaieShensha.php 及传统六壬典籍。
 */
// ─── 类型定义 ────────────────────────────────────────────

export interface ShenSha {
  name: string;
  branch: number; // 落宫地支
  type: "吉" | "凶";
  description: string;
}

// ─── 三合局 ────────────────────────────────────────────

/**
 * 三合局
 * 申子辰(水)、巳酉丑(金)、寅午戌(火)、亥卯未(木)
 * 每组 [长生位, 帝旺位, 墓库位] 即三合的三个位置
 */
const SAN_HE: [number, number, number][] = [
  [8, 0, 4], // 申子辰
  [5, 9, 1], // 巳酉丑
  [2, 6, 10], // 寅午戌
  [11, 3, 7], // 亥卯未
];

/** 根据地支获取三合组（用于驿马、劫煞等） */
function getSanHeGroup(branch: number): [number, number, number] {
  for (const triple of SAN_HE) {
    if (triple.includes(branch)) return triple;
  }
  return [0, 4, 8]; // 默认
}

/** 季节判定（月支→季节索引） */
function getSeasonIndex(monthBranch: number): number {
  // 春=0(寅卯辰2,3,4) 夏=1(巳午未5,6,7) 秋=2(申酉戌8,9,10) 冬=3(亥子丑11,0,1)
  if ([2, 3, 4].includes(monthBranch)) return 0;
  if ([5, 6, 7].includes(monthBranch)) return 1;
  if ([8, 9, 10].includes(monthBranch)) return 2;
  return 3;
}

// ─── 单个神煞计算函数 ────────────────────────────────────

/** 驿马：日支三合局长生位的对冲（申子辰马在寅，寅午戌马在申…） */
function yiMa(dayBranch: number): number {
  const [changSheng] = getSanHeGroup(dayBranch);
  return (changSheng + 6) % 12;
}

/** 劫煞：三合局绝位 = (长生 + 9) % 12 */
function jieSha(dayBranch: number): number {
  const [changSheng] = getSanHeGroup(dayBranch);
  return (changSheng + 9) % 12;
}

/** 亡神：三合局帝旺位的对冲 = (帝旺 + 6) % 12 */
function wangShen(dayBranch: number): number {
  const [, diWang] = getSanHeGroup(dayBranch);
  return (diWang + 6) % 12;
}

/** 将星：三合局中间位（帝旺） */
function jiangXing(dayBranch: number): number {
  const [, diWang] = getSanHeGroup(dayBranch);
  return diWang;
}

/** 华盖：三合局墓库位 */
function huaGai(dayBranch: number): number {
  const [, , mu] = getSanHeGroup(dayBranch);
  return mu;
}

/** 咸池（桃花）：三合局沐浴位 = (长生 + 1) % 12 */
function xianChi(dayBranch: number): number {
  const [changSheng] = getSanHeGroup(dayBranch);
  return (changSheng + 1) % 12;
}

/** 岁破：年支对冲 */
function suiPo(yearBranch: number): number {
  return (yearBranch + 6) % 12;
}

/** 丧门：年支前两位 */
function sangMen(yearBranch: number): number {
  return (yearBranch + 2) % 12;
}

/** 吊客：年支后两位 */
function diaoKe(yearBranch: number): number {
  return (yearBranch + 10) % 12;
}

/** 病符：年支后一位 */
function bingFu(yearBranch: number): number {
  return (yearBranch + 11) % 12;
}

/** 天医：月支前一位 */
function tianYi(monthBranch: number): number {
  return (monthBranch + 1) % 12;
}

/** 皇书：季节书（春寅、夏巳、秋申、冬亥） */
function huangShu(monthBranch: number): number {
  const season = getSeasonIndex(monthBranch);
  // 春→寅(2)、夏→巳(5)、秋→申(8)、冬→亥(11)
  return [2, 5, 8, 11][season];
}

/** 天喜：季节喜（春戌、夏丑、秋辰、冬未） */
function tianXi(monthBranch: number): number {
  const season = getSeasonIndex(monthBranch);
  // 春→戌(10)、夏→丑(1)、秋→辰(4)、冬→未(7)
  return [10, 1, 4, 7][season];
}

/** 天马：月支相关（正月起午，顺行六阳辰） */
function tianMa(monthBranch: number): number {
  // 正月起午，顺行六阳辰：午申戌子寅辰
  const yangBranches = [6, 8, 10, 0, 2, 4]; // 午申戌子寅辰
  const idx = (monthBranch - 2 + 12) % 12; // 正月=寅=2 → idx=0
  return yangBranches[idx % 6];
}

/** 文昌：日干禄前一位（按日干查） */
function wenChang(dayStem: number): number {
  // 甲→巳、乙→午、丙→申、丁→酉、戊→申、己→酉、庚→亥、辛→子、壬→寅、癸→卯
  const table = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
  return table[dayStem];
}

/** 学堂：日干学堂位 */
function xueTang(dayStem: number): number {
  // 甲→亥、乙→午、丙→寅、丁→酉、戊→寅、己→酉、庚→巳、辛→子、壬→申、癸→卯
  const table = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
  return table[dayStem];
}

/** 词馆：日干词馆位 */
function ciGuan(dayStem: number): number {
  // 甲→寅、乙→卯、丙→巳、丁→午、戊→巳、己→午、庚→申、辛→酉、壬→亥、癸→子
  const table = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
  return table[dayStem];
}

/** 天德：月支对应的天德贵人 */
function tianDe(monthBranch: number): number {
  // 正月起丁（天干，这里转为寄宫地支），实际天德按地支论：
  // 寅→丁(寄巳5)、卯→申(8)、辰→壬(寄亥11)、巳→辛(寄戌10)、
  // 午→亥(11)、未→甲(寄寅2)、申→癸(寄子0)、酉→寅(2)、
  // 戌→丙(寄巳5)、亥→乙(寄卯3)、子→巳(5)、丑→庚(寄申8)
  // 简化用地支表示：
  const table = [5, 8, 11, 10, 11, 2, 0, 2, 5, 3, 8, 5];
  // 顺序：子丑寅卯辰巳午未申酉戌亥
  return table[monthBranch];
}

/** 月德：按季节查月德贵人（与 PHP seasonOf 对照） */
function yueDe(monthBranch: number): number {
  // 春(寅卯辰)→巳(5)、夏(巳午未)→申(8)、秋(申酉戌)→亥(11)、冬(亥子丑)→寅(2)
  // 规律：每季月德 = 该季三合局长生位
  // 春=寅午戌局长生=巳(5)、夏=申子辰局长生=申(8)...
  const season = getSeasonIndex(monthBranch);
  return [5, 8, 11, 2][season];
}

/** 红艳：日干查（咸池类桃花） */
function hongYan(dayStem: number): number {
  // 甲→午、乙→申、丙→寅、丁→未、戊→辰、己→辰、庚→戌、辛→酉、壬→子、癸→申
  const table = [6, 8, 2, 7, 4, 4, 10, 9, 0, 8];
  return table[dayStem];
}

/** 丧车：正月起未，逆行四季 */
function sangChe(monthBranch: number): number {
  return [7, 4, 1, 10][(monthBranch + 2) % 4];
}

/** 游魂：正月起亥，顺行十二辰 */
function youHun(monthBranch: number): number {
  return (monthBranch + 9) % 12;
}

/** 伏殃：正月起酉，逆行四仲 */
function fuYang(monthBranch: number): number {
  return [9, 6, 3, 0][(monthBranch + 2) % 4];
}

/** 岁虎：岁后四辰 */
function suiHu(yearBranch: number): number {
  return (yearBranch + 8) % 12;
}

/** 三丘：按季节查（与 PHP ZaieShensha SEASONS 对照） */
function sanQiu(monthBranch: number): number {
  // 春→丑(1)、夏→辰(4)、秋→未(7)、冬→戌(10)
  const season = getSeasonIndex(monthBranch);
  return [1, 4, 7, 10][season];
}

/** 五墓：按季节查（与三丘互为冲位，与 PHP ZaieShensha SEASONS 对照） */
function wuMu(monthBranch: number): number {
  // 春→未(7)、夏→戌(10)、秋→丑(1)、冬→辰(4)
  const season = getSeasonIndex(monthBranch);
  return [7, 10, 1, 4][season];
}

// ─── 主入口 ────────────────────────────────────────────

/**
 * 计算常用神煞
 *
 * @param yearBranch 年支
 * @param monthBranch 月支
 * @param dayStem 日干
 * @param dayBranch 日支
 * @param hourBranch 时支
 * @returns 神煞列表
 */
export function calculateShenSha(
  yearBranch: number,
  monthBranch: number,
  dayStem: number,
  dayBranch: number,
  hourBranch: number
): ShenSha[] {
  const sha: ShenSha[] = [];

  // ── 年煞 ──
  sha.push({
    name: "岁破",
    branch: suiPo(yearBranch),
    type: "凶",
    description: "太岁对冲之辰，主破败",
  });
  sha.push({
    name: "丧门",
    branch: sangMen(yearBranch),
    type: "凶",
    description: "岁前二辰，主丧事",
  });
  sha.push({
    name: "吊客",
    branch: diaoKe(yearBranch),
    type: "凶",
    description: "岁后二辰，主吊唁",
  });
  sha.push({
    name: "病符",
    branch: bingFu(yearBranch),
    type: "凶",
    description: "岁后一辰，主疾病",
  });
  sha.push({
    name: "岁虎",
    branch: suiHu(yearBranch),
    type: "凶",
    description: "岁后四辰，主凶险",
  });

  // ── 月煞 ──
  sha.push({
    name: "天医",
    branch: tianYi(monthBranch),
    type: "吉",
    description: "月支前一位，主医药",
  });
  sha.push({
    name: "皇书",
    branch: huangShu(monthBranch),
    type: "吉",
    description: "季节书辰，主文书",
  });
  sha.push({
    name: "天喜",
    branch: tianXi(monthBranch),
    type: "吉",
    description: "季节喜辰，主喜庆",
  });
  sha.push({
    name: "天马",
    branch: tianMa(monthBranch),
    type: "吉",
    description: "正月起午顺行六阳辰，主出行",
  });
  sha.push({
    name: "天德",
    branch: tianDe(monthBranch),
    type: "吉",
    description: "月德所临，化凶为吉",
  });
  sha.push({
    name: "月德",
    branch: yueDe(monthBranch),
    type: "吉",
    description: "月建三合之德辰",
  });
  sha.push({
    name: "丧车",
    branch: sangChe(monthBranch),
    type: "凶",
    description: "正月起未逆行四季，主丧事",
  });
  sha.push({
    name: "游魂",
    branch: youHun(monthBranch),
    type: "凶",
    description: "正月起亥顺行，主不安",
  });
  sha.push({
    name: "伏殃",
    branch: fuYang(monthBranch),
    type: "凶",
    description: "正月起酉逆行四仲，主殃咎",
  });
  sha.push({
    name: "三丘",
    branch: sanQiu(monthBranch),
    type: "凶",
    description: "季节丘位，主讼事",
  });
  sha.push({
    name: "五墓",
    branch: wuMu(monthBranch),
    type: "凶",
    description: "季节墓位，主暗昧",
  });

  // ── 日煞（干/支） ──
  sha.push({
    name: "驿马",
    branch: yiMa(dayBranch),
    type: "吉",
    description: "日支三合长生对冲，主传送出行",
  });
  sha.push({
    name: "劫煞",
    branch: jieSha(dayBranch),
    type: "凶",
    description: "日支三合绝位，主劫夺",
  });
  sha.push({
    name: "亡神",
    branch: wangShen(dayBranch),
    type: "凶",
    description: "日支三合帝旺对冲，主失脱",
  });
  sha.push({
    name: "将星",
    branch: jiangXing(dayBranch),
    type: "吉",
    description: "日支三合帝旺位，主威武",
  });
  sha.push({
    name: "华盖",
    branch: huaGai(dayBranch),
    type: "凶",
    description: "日支三合墓库位，主孤高",
  });
  sha.push({
    name: "咸池",
    branch: xianChi(dayBranch),
    type: "凶",
    description: "桃花煞，主淫佚",
  });
  sha.push({
    name: "红艳",
    branch: hongYan(dayStem),
    type: "凶",
    description: "日干桃花，主酒色",
  });
  sha.push({
    name: "文昌",
    branch: wenChang(dayStem),
    type: "吉",
    description: "日干禄前一位，主文章",
  });
  sha.push({
    name: "学堂",
    branch: xueTang(dayStem),
    type: "吉",
    description: "日干学堂位，主学业",
  });
  sha.push({
    name: "词馆",
    branch: ciGuan(dayStem),
    type: "吉",
    description: "日干词馆位，主词章",
  });

  return sha;
}
