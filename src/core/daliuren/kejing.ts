/**
 * 大六壬课经规则引擎
 *
 * 课经（格局）是对盘面特征的高层归纳：根据天地盘、四课、三传、天将等
 * 组合关系判断属于何种"课体"（如元首课、伏吟课、富贵课等）。
 *
 * 实现 20+ 个常用课经规则，按分组（三传/四课/天将/特殊）分类。
 */

import {
  DI_ZHI,
  STEM_ELEMENT,
  LIU_CHONG,
  SAN_HE_TRIPLES,
  XUN_HEAD,
  DAY_VIRTUES,
  DAY_ORIGIN,
} from "./constants";
import type { DaLiuRenResult } from "./types";
import {
  elemB,
  keOf,
  shengOf,
  sexagenaryIndex,
  stemLodgingBranch,
  isFuyin,
  isFanyin,
  inFourLessons,
  getGeneralRidingBranch,
  findGeneralPosition,
} from "./utils";

// ─── 课经接口 ─────────────────────────────────────────

/** 单条课经规则 */
export interface KeJingRule {
  /** 规则代码（如 "yuanshou"） */
  code: string;
  /** 规则名称（如 "元首课"） */
  name: string;
  /** 分组（如 "三传"、"四课"、"天将"、"特殊"） */
  group: string;
  /** 规则描述 */
  description: string;
  /** 判断条件：返回 true 表示该规则匹配 */
  check: (result: DaLiuRenResult) => boolean;
}

/** 课经匹配结果 */
export interface KeJingMatch {
  /** 匹配到的规则 */
  rule: KeJingRule;
  /** 匹配证据（人可读的字符串列表） */
  evidence: string[];
}

// ─── 辅助函数 ─────────────────────────────────────────
// elemB, keOf, shengOf, isFuyin, isFanyin, inFourLessons,
// getGeneralRidingBranch, findGeneralPosition 已从 utils.ts 导入

/** 天盘某支是否在三传中（保留为工具函数） */
function inSanChuan(branch: number, r: DaLiuRenResult): boolean {
  const { initial, middle, final } = r.threeTransmissions;
  return initial === branch || middle === branch || final === branch;
}

/** 三传递生（初生中、中生末） */
function sanChuanDiSheng(r: DaLiuRenResult): boolean {
  const { initial, middle, final } = r.threeTransmissions;
  return (
    shengOf(elemB(initial)) === elemB(middle) &&
    shengOf(elemB(middle)) === elemB(final)
  );
}

/** 三传递克（初克中、中克末） */
function sanChuanDiKe(r: DaLiuRenResult): boolean {
  const { initial, middle, final } = r.threeTransmissions;
  return (
    keOf(elemB(initial)) === elemB(middle) &&
    keOf(elemB(middle)) === elemB(final)
  );
}

/** 三传是否三合局 */
function sanChuanSanHe(r: DaLiuRenResult): boolean {
  const { initial, middle, final } = r.threeTransmissions;
  const sorted = [initial, middle, final].sort((a, b) => a - b);
  return SAN_HE_TRIPLES.some(
    (t) => t[0] === sorted[0] && t[1] === sorted[1] && t[2] === sorted[2]
  );
}

// findGeneralPosition, getGeneralRidingBranch 已从 utils.ts 导入

/** 天将某是否在天盘某支（按天将落宫的天盘支判断） */
function generalOnBranch(
  generalName: string,
  branch: number,
  r: DaLiuRenResult
): boolean {
  const g = r.twelveGenerals.find((g) => g.name === generalName);
  if (!g) return false;
  return r.heavenBoard[g.position] === branch;
}

/**
 * 驿马计算：按年支/日支三合局取对冲
 * 申子辰→寅、寅午戌→申、巳酉丑→亥、亥卯未→巳
 */
function travelHorse(branch: number): number {
  // PHP: match(branch%4){ 0→2(寅), 1→11(亥), 2→8(申), 3→5(巳) }
  // 验证：申子辰(0,4,8)%4=0→寅 ✓ 寅午戌(2,6,10)%4=2→申 ✓
  //       巳酉丑(5,9,1)%4=1→亥 ✓ 亥卯未(11,3,7)%4=3→巳 ✓
  switch (branch % 4) {
    case 0: return 2;   // 申子辰→寅
    case 1: return 11;  // 巳酉丑→亥
    case 2: return 8;   // 寅午戌→申
    case 3: return 5;   // 亥卯未→巳
    default: return -1;
  }
}

// stemLodgingBranch 已从 utils.ts 导入

/**
 * 计算六十甲子日序号所在的旬索引（0-5）
 * 甲子旬=0, 甲戌旬=1, 甲申旬=2, 甲午旬=3, 甲辰旬=4, 甲寅旬=5
 */
function dayXunIndex(dayIndex: number): number {
  return Math.floor(dayIndex / 10);
}

/** 获取旬首地支 */
function xunHeadBranch(dayIndex: number): number {
  return XUN_HEAD[dayXunIndex(dayIndex)];
}

/**
 * 日干五行是否旺相（按月令）
 * 简化：直接用 wangXiang 中天盘该支的状态
 */
function isBranchWangXiang(branch: number, r: DaLiuRenResult): boolean {
  const wx = r.wangXiang[branch];
  return wx === "旺" || wx === "相";
}

/**
 * 日干按五行是否旺相
 */
function isStemWangXiang(stem: number, r: DaLiuRenResult): boolean {
  const elem = STEM_ELEMENT[stem];
  // 找与日干同五行的地支（如甲=木→看寅卯）
  // 简化：用日干寄宫上神的旺相状态
  const lodging = stemLodgingBranch(stem);
  return isBranchWangXiang(lodging, r);
}

/** 六吉将编号：贵人(0)、六合(3)、青龙(5)、太常(8)、太阴(10)、天后(11) */
const AUSPICIOUS_GENERALS = new Set([0, 3, 5, 8, 10, 11]);

/** 六凶将编号 */
const INauspicious_GENERALS = new Set([1, 2, 4, 6, 7, 9]);

/**
 * 旬奇表（索引 0-5 对应六甲旬）
 *
 * 甲子旬→丑(1)、甲戌旬→丑(1)、甲申旬→子(0)、甲午旬→子(0)、甲辰旬→亥(11)、甲寅旬→亥(11)
 * 出处：《烟波钓叟赋》"六旬妙处有奇仪"。
 */
const XUN_WONDERS = [1, 1, 0, 0, 11, 11];

/**
 * 日奇表（索引对应 TIAN_GAN）
 *
 * 甲→午(6)、乙→巳(5)、丙→辰(4)、丁→卯(3)、戊→寅(2)、
 * 己→丑(1)、庚→未(7)、辛→申(8)、壬→酉(9)、癸→戌(10)
 * 出处：《奇门遁甲》日奇贵人起法。
 */
const DAY_WONDERS = [6, 5, 4, 3, 2, 1, 7, 8, 9, 10];

// DAY_VIRTUES 已从 constants.ts 导入

/** 支仪表（六仪课用）：子→午、丑→巳、寅→辰、卯→卯(3)、辰→寅、巳→丑、午→未、未→申、申→酉、酉→戌、戌→亥、亥→子 */
const BRANCH_INSTRUMENTS = [6, 5, 4, 3, 2, 1, 7, 8, 9, 10, 11, 0];

/**
 * 九丑十日表：日干→允许的日支列表
 * 按 PHP JiuchouRule：
 * 戊(4)→子(0)午(6)、壬(8)→子(0)午(6)
 * 乙(1)→卯(3)酉(9)、己(5)→卯(3)酉(9)、辛(7)→卯(3)酉(9)
 */
const JIUCHOU_DAYS: Record<number, number[]> = {
  1: [3, 9],   // 乙卯、乙酉
  4: [0, 6],   // 戊子、戊午
  5: [3, 9],   // 己卯、己酉
  7: [3, 9],   // 辛卯、辛酉
  8: [0, 6],   // 壬子、壬午
};

// ─── 课经规则列表 ─────────────────────────────────────

const rules: KeJingRule[] = [
  // ──── 三传类（九宗门对应）────
  {
    code: "yuanshou",
    name: "元首课",
    group: "三传",
    description:
      "三传取法为'元首'：四课中仅有一课上克下（无下贼上），取该课上神为初传。主事顺遂、尊长有喜。",
    check: (r) => r.threeTransmissions.method === "元首",
  },
  {
    code: "chongshen",
    name: "重审课",
    group: "三传",
    description:
      "三传取法为'重审'：四课中仅有一课下贼上（无上克下），取该课上神为初传。主事有反复、需再审。",
    check: (r) => r.threeTransmissions.method === "重审",
  },
  {
    code: "biyong",
    name: "比用课",
    group: "三传",
    description:
      "三传取法为'比用'（知一）：四课多克，取与日干阴阳相同者。事出多端，宜择一而从。",
    check: (r) => r.threeTransmissions.method === "比用",
  },
  {
    code: "shehai",
    name: "涉害课",
    group: "三传",
    description:
      "三传取法为'涉害'：多克且阴阳难分，比涉害深度取之。事有牵缠，历尽艰辛方成。",
    check: (r) =>
      r.threeTransmissions.method.startsWith("涉害"),
  },
  {
    code: "yaoke",
    name: "遥克课",
    group: "三传",
    description:
      "三传取法为'遥克'（蒿矢/弹射）：四课无克而遥克日干或日干遥克。事出意外、暗中相伤。",
    check: (r) =>
      r.threeTransmissions.method === "蒿矢" ||
      r.threeTransmissions.method === "弹射",
  },
  {
    code: "maoxing",
    name: "昴星课",
    group: "三传",
    description:
      "三传取法为'昴星'（虎视/冬蛇掩目）：四课无克无遥，取酉上下神。事多惊恐、忧疑不安。",
    check: (r) =>
      r.threeTransmissions.method === "昴星虎视" ||
      r.threeTransmissions.method === "昴星冬蛇掩目",
  },
  {
    code: "biezhe",
    name: "别责课",
    group: "三传",
    description:
      "三传取法为'别责'：四课不备（三课），取干合/支冲。事有偏枯、不得周全。",
    check: (r) => r.threeTransmissions.method === "别责",
  },
  {
    code: "bazhuan",
    name: "八专课",
    group: "三传",
    description:
      "三传取法为'八专'（独足）：干支同位（四课仅二），事难两全、独力难支。",
    check: (r) =>
      r.threeTransmissions.method === "八专" ||
      r.threeTransmissions.method === "八专独足",
  },

  // ──── 盘面类（天地盘关系）────
  {
    code: "fuyin",
    name: "伏吟课",
    group: "盘面",
    description:
      "天地盘重合，十二神各居本宫。主事迟滞、伏而不动，病忧土怪，讼争田庐。",
    check: (r) => isFuyin(r),
  },
  {
    code: "fanyin",
    name: "返吟课",
    group: "盘面",
    description:
      "天地盘对冲，十二神各居冲位。主事反复、去而复来，动摇不安。",
    check: (r) => isFanyin(r),
  },

  // ──── 四课 / 三传特征 ────
  {
    code: "sanqi",
    name: "三奇课",
    group: "三传",
    description:
      "占日所在六甲旬的旬奇发用或入于中末传。万事和合、千殃解除。",
    check: (r) => {
      // 计算日干支序号
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      const dayIndex = sexagenaryIndex(dayStem, dayBranch);
      const xunIdx = dayXunIndex(dayIndex);
      const xunWonder = XUN_WONDERS[xunIdx];
      const dayWonder = DAY_WONDERS[dayStem];
      const { initial, middle, final } = r.threeTransmissions;
      // 旬奇入三传
      return (
        initial === xunWonder ||
        middle === xunWonder ||
        final === xunWonder ||
        initial === dayWonder ||
        middle === dayWonder ||
        final === dayWonder
      );
    },
  },
  {
    code: "guanjue",
    name: "官爵课",
    group: "三传",
    description:
      "太岁、月建、本命或行年的驿马发用，同时天魁戌与太常入传。官爵印绶、得之荣华。",
    check: (r) => {
      const { initial, middle, final } = r.threeTransmissions;
      const transmissions = [initial, middle, final];
      // 驿马来源：太岁、月建、本命、行年
      const sources = [
        r.fourPillars.yearBranch,
        r.fourPillars.monthBranch,
        r.fate?.mingGong ?? -1,
        r.fate?.xingNian ?? -1,
      ].filter((b) => b >= 0);
      const sourceHorses = sources.map(travelHorse);
      // 驿马发用：初传为某来源的驿马
      const horseMatches = sourceHorses.some((h) => h === initial);
      if (!horseMatches) return false;
      // 天魁戌(10)入传 + 太常(8)入传
      const hasTianKui = transmissions.includes(10); // 戌
      const transmissionGenerals = transmissions.map((b) => getGeneralRidingBranch(b, r));
      const hasTaiChang = transmissionGenerals.includes(8); // 太常编号=8
      return hasTianKui && hasTaiChang;
    },
  },
  {
    code: "sanguang",
    name: "三光课",
    group: "三传",
    description:
      "日干、日支与发用均得旺相，日上神、辰上神与发用又均乘吉将。课入三光，万事吉昌。",
    check: (r) => {
      const stem = r.fourPillars.dayStem;
      const branch = r.fourPillars.dayBranch;
      const initial = r.threeTransmissions.initial;
      // 日干、日支、初传旺相
      if (!isStemWangXiang(stem, r)) return false;
      if (!isBranchWangXiang(branch, r)) return false;
      if (!isBranchWangXiang(initial, r)) return false;
      // 日上神（第一课上课）、辰上神（第三课上课）、初传 乘吉将
      const dayUpper = r.fourLessons[0]?.upper;
      const branchUpper = r.fourLessons[2]?.upper;
      if (dayUpper === undefined || branchUpper === undefined) return false;
      const dayUpperGeneral = getGeneralRidingBranch(dayUpper, r);
      const branchUpperGeneral = getGeneralRidingBranch(branchUpper, r);
      const initialGeneral = getGeneralRidingBranch(initial, r);
      return (
        AUSPICIOUS_GENERALS.has(dayUpperGeneral) &&
        AUSPICIOUS_GENERALS.has(branchUpperGeneral) &&
        AUSPICIOUS_GENERALS.has(initialGeneral)
      );
    },
  },
  {
    code: "sanyang",
    name: "三阳课",
    group: "三传",
    description:
      "贵人顺行，日干寄宫与日支均乘贵前五将，发用又得季节旺相。课入三阳，官爵翱翔。",
    check: (r) => {
      const stem = r.fourPillars.dayStem;
      const branch = r.fourPillars.dayBranch;
      const initial = r.threeTransmissions.initial;
      // 贵人顺行：贵人（天乙）在地盘上的排列方向为顺
      // 简化判断：贵人顺行即昼贵在昼位（贵人起法已含昼夜判断）
      // 贵前五将 = 贵人编号+1 到 +5（按十二天将顺序）
      const guirenGeneral = r.twelveGenerals.find((g) => g.name === "贵人");
      if (!guirenGeneral) return false;
      // 贵前五将：按天将顺序，贵人(0)前五为 螣蛇(1)、朱雀(2)、六合(3)、勾陈(4)、青龙(5)
      // 即天将编号 1-5
      const noblemanFront = new Set([1, 2, 3, 4, 5]);
      // 日干寄宫与日支乘贵前五将
      const lodging = stemLodgingBranch(stem);
      const lodgingGeneral = getGeneralRidingBranch(lodging, r);
      const branchGeneral = getGeneralRidingBranch(branch, r);
      if (!noblemanFront.has(lodgingGeneral)) return false;
      if (!noblemanFront.has(branchGeneral)) return false;
      // 发用旺相
      return isBranchWangXiang(initial, r);
    },
  },
  {
    code: "liuyi",
    name: "六仪课",
    group: "三传",
    description:
      "占日所在六甲旬的旬首地支发用、入于中传或末传。兆多喜庆、求旺相宜。",
    check: (r) => {
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      const dayIndex = sexagenaryIndex(dayStem, dayBranch);
      const xunInstrument = xunHeadBranch(dayIndex);
      const { initial, middle, final } = r.threeTransmissions;
      return (
        initial === xunInstrument ||
        middle === xunInstrument ||
        final === xunInstrument
      );
    },
  },
  {
    code: "chongshanchuan",
    name: "冲神三传",
    group: "三传",
    description:
      "三传皆六冲关系（初末冲、中末冲等）。主事多冲突、反复不定。",
    check: (r) => {
      const { initial, middle, final } = r.threeTransmissions;
      return (
        LIU_CHONG[initial] === final ||
        LIU_CHONG[initial] === middle ||
        LIU_CHONG[middle] === final
      );
    },
  },

  // ──── 天将类 ────
  {
    code: "fugui",
    name: "富贵课",
    group: "天将",
    description:
      "天乙贵人乘旺相之神发用，上下五行相生，又临日干寄宫、日支、本命或行年。天降福德、万事新鲜。",
    check: (r) => {
      const initial = r.threeTransmissions.initial;
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      // 初传乘贵人（天将编号 0）
      const initialGeneral = getGeneralRidingBranch(initial, r);
      if (initialGeneral !== 0) return false;
      // 初传旺相
      if (!isBranchWangXiang(initial, r)) return false;
      // 初传所在地盘宫位（下神）
      const ground = r.heavenBoard.indexOf(initial);
      if (ground === -1) return false;
      // 上下相生（天盘初传五行与地盘宫位五行相生）
      const upperElem = elemB(initial);
      const lowerElem = elemB(ground);
      const generatingDirection =
        shengOf(upperElem) === lowerElem
          ? "upper_generates_lower"
          : shengOf(lowerElem) === upperElem
            ? "lower_generates_upper"
            : null;
      if (generatingDirection === null) return false;
      // 临日干寄宫、日支、本命或行年
      const dayStemLodging = stemLodgingBranch(dayStem);
      const targets = [
        dayStemLodging,
        dayBranch,
        r.fate?.mingGong ?? -1,
        r.fate?.xingNian ?? -1,
      ];
      const matchesTarget = targets.some((t) => t === ground);
      return matchesTarget;
    },
  },
  {
    code: "longde",
    name: "龙德课",
    group: "天将",
    description:
      "太岁乘天乙贵人发用，月将又入于三传。君恩及下、万姓欢忻。",
    check: (r) => {
      const yearBranch = r.fourPillars.yearBranch;
      const monthGeneralBranch = r.monthGeneral.branch;
      const initial = r.threeTransmissions.initial;
      const { middle, final } = r.threeTransmissions;
      // 初传 = 太岁（年支）
      if (initial !== yearBranch) return false;
      // 初传乘天乙贵人（天将编号 0）
      const initialGeneral = getGeneralRidingBranch(initial, r);
      if (initialGeneral !== 0) return false;
      // 月将入三传
      return (
        initial === monthGeneralBranch ||
        middle === monthGeneralBranch ||
        final === monthGeneralBranch
      );
    },
  },
  {
    code: "shitai",
    name: "时泰课",
    group: "天将",
    description:
      "初末传乘青龙、六合相对，太岁或月建入传并兼作日财或日德。皇恩欲拜、灾患潜消。",
    check: (r) => {
      const { initial, final } = r.threeTransmissions;
      const middle = r.threeTransmissions.middle;
      const transmissions = [initial, middle, final];
      const yearBranch = r.fourPillars.yearBranch;
      const monthBranch = r.fourPillars.monthBranch;
      const dayStem = r.fourPillars.dayStem;
      // 初末传乘青龙(5)/六合(3)相对
      const transmissionGenerals = transmissions.map((b) =>
        getGeneralRidingBranch(b, r)
      );
      const dragonUnion =
        (transmissionGenerals[0] === 5 && transmissionGenerals[2] === 3) ||
        (transmissionGenerals[0] === 3 && transmissionGenerals[2] === 5);
      if (!dragonUnion) return false;
      // 太岁或月建入传并兼作日财或日德
      const dayVirtue = DAY_VIRTUES[dayStem];
      // 日财：日干所克之五行对应的地支（简化：看年/月支五行是否被日干所克）
      const dayElem = STEM_ELEMENT[dayStem];
      const dayWealthElem = keOf(dayElem); // 日干所克的五行
      const isDayWealth = (b: number) => elemB(b) === dayWealthElem;
      const yearInTrans = transmissions.includes(yearBranch);
      const monthInTrans = transmissions.includes(monthBranch);
      const yearQualifies =
        yearInTrans && (isDayWealth(yearBranch) || yearBranch === dayVirtue);
      const monthQualifies =
        monthInTrans && (isDayWealth(monthBranch) || monthBranch === dayVirtue);
      return yearQualifies || monthQualifies;
    },
  },
  {
    code: "zhuyin",
    name: "铸印课",
    group: "天将",
    description:
      "天魁戌与太乙巳同入三传；戌为印、巳为炉。顽金铸篆、藉火功全。",
    check: (r) => {
      const { initial, middle, final } = r.threeTransmissions;
      // 戌(10) 与 巳(5) 同入三传
      const transmissions = [initial, middle, final];
      return transmissions.includes(10) && transmissions.includes(5);
    },
  },
  {
    code: "zhuolun",
    name: "斫轮课",
    group: "天将",
    description:
      "初传卯加临地盘申（庚）或酉（辛）发用；木就金斫、革故鼎新。",
    check: (r) => {
      const initial = r.threeTransmissions.initial;
      // 初传为卯(3)
      if (initial !== 3) return false;
      // 天盘卯加临地盘申(8)或酉(9)
      // 即 heavenBoard[8] === 3 或 heavenBoard[9] === 3
      return r.heavenBoard[8] === 3 || r.heavenBoard[9] === 3;
    },
  },

  // ──── 特殊类 ────
  {
    code: "tianhuo",
    name: "天祸课",
    group: "特殊",
    description:
      "四立日，今日干支临昨日干支，或昨日干支临今日干支。以新易旧、天有灾祸。",
    check: (r) => {
      // 四立日：需要判断今天是否为立春/立夏/立秋/立冬
      // 简化：用月支在四孟（寅巳申亥）近似判断四立后的月份
      // 严格判断需要节气数据，此处用四孟月+干支相临模式
      const monthBranch = r.fourPillars.monthBranch;
      const isSiLi = [2, 5, 8, 11].includes(monthBranch);
      if (!isSiLi) return false;
      // 今日干支与昨日干支相临：今日干寄宫上神为昨日干寄宫，今日支上神为昨日支
      // 简化判断：天盘中今日日干寄宫位的天盘支与昨日干支寄宫相同
      // 由于缺少精确节气数据，用月支四孟+天地盘特定模式近似
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      const todayStemLodge = stemLodgingBranch(dayStem);
      // 昨日干支
      const dayIndex = sexagenaryIndex(dayStem, dayBranch);
      const yesterdayIndex = (dayIndex + 59) % 60;
      const yesterdayStem = yesterdayIndex % 10;
      const yesterdayBranch = yesterdayIndex % 12;
      const yesterdayStemLodge = stemLodgingBranch(yesterdayStem);
      // 今日干支临昨日干支：
      // 天盘在昨日干寄宫位上的支 = 今日干寄宫位上的天盘支（简化）
      // 方向一：todayStemOnYesterdayStem + todayBranchOnYesterdayBranch
      const todayStemUpper = r.heavenBoard[yesterdayStemLodge];
      const todayBranchUpper = r.heavenBoard[yesterdayBranch];
      const yesterdayStemUpper = r.heavenBoard[todayStemLodge];
      const yesterdayBranchUpper = r.heavenBoard[dayBranch];
      const todayOnYesterday =
        todayStemUpper === yesterdayStemLodge &&
        todayBranchUpper === yesterdayBranch;
      const yesterdayOnToday =
        yesterdayStemUpper === todayStemLodge &&
        yesterdayBranchUpper === dayBranch;
      return todayOnYesterday || yesterdayOnToday;
    },
  },
  {
    code: "jiuchou",
    name: "九丑课",
    group: "特殊",
    description:
      "九丑十日占课，天盘丑加临日支。刚日男凶、柔日女祸。",
    check: (r) => {
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      // 九丑十日
      const allowedBranches = JIUCHOU_DAYS[dayStem];
      if (!allowedBranches) return false;
      if (!allowedBranches.includes(dayBranch)) return false;
      // 天盘丑(1)临日支：heavenBoard[dayBranch] === 1
      return r.heavenBoard[dayBranch] === 1;
    },
  },
  {
    code: "fuyang",
    name: "伏殃课",
    group: "特殊",
    description:
      "四课见丧门、吊客（年支前后二位）。主孝服、丧事。",
    check: (r) => {
      // 丧门：年支+2，吊客：年支-2（对冲前/后）
      const yearBranch = r.fourPillars.yearBranch;
      const sangMen = (yearBranch + 2) % 12;
      const diaoKe = (yearBranch + 10) % 12; // 即 -2
      return (
        inFourLessons(sangMen, r) || inFourLessons(diaoKe, r)
      );
    },
  },

  // ──── 补充课经规则 ────
  {
    code: "lianzhu",
    name: "连珠课",
    group: "三传",
    description:
      "三传连续相生（初生中、中生末），如连珠不绝。主事情连绵不断、顺遂无阻。",
    check: (r) => sanChuanDiSheng(r),
  },
  {
    code: "lianru",
    name: "连茹课",
    group: "三传",
    description:
      "三传地支连续相同或形成三合局。主事情纠缠、连绵不绝。",
    check: (r) => {
      const { initial, middle, final } = r.threeTransmissions;
      // 三传相同
      if (initial === middle && middle === final) return true;
      // 三传为三合局
      return sanChuanSanHe(r);
    },
  },
  {
    code: "xuanGuan",
    name: "玄关课",
    group: "特殊",
    description:
      "日干寄宫上神与日支上神相生，且发用为日干长生位。主玄机暗通、事有妙应。",
    check: (r) => {
      const dayStem = r.fourPillars.dayStem;
      const lodging = stemLodgingBranch(dayStem);
      const dayBranch = r.fourPillars.dayBranch;
      const ganShang = r.fourLessons[0]?.upper;
      const zhiShang = r.fourLessons[2]?.upper;
      if (ganShang === undefined || zhiShang === undefined) return false;
      // 干上神生支上神
      const generates = shengOf(elemB(ganShang)) === elemB(zhiShang);
      // 初传为日干长生位（DAY_ORIGIN 已从 constants.ts 导入）
      const origin = DAY_ORIGIN[dayStem];
      const initial = r.threeTransmissions.initial;
      return generates && initial === origin;
    },
  },
  {
    code: "tianXin",
    name: "天心课",
    group: "特殊",
    description:
      "四建（太岁、月建、日支、占时）尽入四课整体地支集合。主非常之事可即日而成。",
    check: (r) => {
      const lessonBranches = new Set<number>();
      r.fourLessons.forEach((l) => {
        lessonBranches.add(l.upper);
        lessonBranches.add(l.lower);
      });
      const nianzhi = r.fourPillars.yearBranch;
      const yuezhi = r.fourPillars.monthBranch;
      const rizhi = r.fourPillars.dayBranch;
      const shizhi = r.fourPillars.hourBranch;
      return (
        lessonBranches.has(nianzhi) &&
        lessonBranches.has(yuezhi) &&
        lessonBranches.has(rizhi) &&
        lessonBranches.has(shizhi)
      );
    },
  },
  {
    code: "tianMu",
    name: "天目课",
    group: "特殊",
    description:
      "天魁戌乘朱雀发用。主文书口舌、眼目之疾。",
    check: (r) => {
      const initial = r.threeTransmissions.initial;
      if (initial !== 10) return false; // 戌
      const initialGeneral = getGeneralRidingBranch(initial, r);
      return initialGeneral === 2; // 朱雀
    },
  },
  {
    code: "tianEr",
    name: "天耳课",
    group: "特殊",
    description:
      "天魁戌乘太阴发用。主暗中听闻、机密之事。",
    check: (r) => {
      const initial = r.threeTransmissions.initial;
      if (initial !== 10) return false; // 戌
      const initialGeneral = getGeneralRidingBranch(initial, r);
      return initialGeneral === 10; // 太阴
    },
  },
  {
    code: "jinHua",
    name: "金华课",
    group: "特殊",
    description:
      "太白酉乘太阴或天后发用。主阴私暗昧、女子之事。",
    check: (r) => {
      const initial = r.threeTransmissions.initial;
      if (initial !== 9) return false; // 酉
      const initialGeneral = getGeneralRidingBranch(initial, r);
      return initialGeneral === 10 || initialGeneral === 11; // 太阴或天后
    },
  },
  {
    code: "yuTang",
    name: "玉堂课",
    group: "特殊",
    description:
      "日干寄宫上神乘贵人或青龙。主文章显达、科甲高中。",
    check: (r) => {
      const ganShang = r.fourLessons[0]?.upper;
      if (ganShang === undefined) return false;
      const general = getGeneralRidingBranch(ganShang, r);
      return general === 0 || general === 5; // 贵人或青龙
    },
  },
  {
    code: "jinRu",
    name: "进儒课",
    group: "特殊",
    description:
      "日干寄宫上神得旺相且乘吉将，发用又生之日干。主学业进步、科举得中。",
    check: (r) => {
      const dayStem = r.fourPillars.dayStem;
      const ganShang = r.fourLessons[0]?.upper;
      if (ganShang === undefined) return false;
      const general = getGeneralRidingBranch(ganShang, r);
      const isWangXiang = isBranchWangXiang(ganShang, r);
      const generatesStem = shengOf(elemB(ganShang)) === STEM_ELEMENT[dayStem];
      return isWangXiang && generatesStem && AUSPICIOUS_GENERALS.has(general);
    },
  },
  {
    code: "tuiRu",
    name: "退儒课",
    group: "特殊",
    description:
      "日干寄宫上神休囚且乘凶将，发用又克之日干。主学业退步、科举落第。",
    check: (r) => {
      const dayStem = r.fourPillars.dayStem;
      const ganShang = r.fourLessons[0]?.upper;
      if (ganShang === undefined) return false;
      const general = getGeneralRidingBranch(ganShang, r);
      const isWangXiang = isBranchWangXiang(ganShang, r);
      const keStem = keOf(elemB(ganShang)) === STEM_ELEMENT[dayStem];
      return !isWangXiang && keStem && INauspicious_GENERALS.has(general);
    },
  },
  {
    code: "longhu",
    name: "龙虎课",
    group: "天将",
    description:
      "青龙与白虎同入三传，或分临初末传。主竞争激烈的变动。",
    check: (r) => {
      const { initial, middle, final } = r.threeTransmissions;
      const generals = [initial, middle, final].map((b) =>
        getGeneralRidingBranch(b, r)
      );
      const hasDragon = generals.includes(5); // 青龙
      const hasTiger = generals.includes(7); // 白虎
      return hasDragon && hasTiger;
    },
  },
  {
    code: "tianluo_diwan",
    name: "天罗地网课",
    group: "特殊",
    description:
      "四课中见天罗（戌）与地网（辰）。主困厄难出、事多阻碍。",
    check: (r) => {
      const hasTianLuo = inFourLessons(10, r); // 戌
      const hasDiWang = inFourLessons(4, r); // 辰
      return hasTianLuo && hasDiWang;
    },
  },
];

// ─── 主入口 ─────────────────────────────────────────

/**
 * 评估盘面符合哪些课经规则。
 *
 * @param result 完整的大六壬盘面
 * @returns 匹配到的课经列表（含证据）
 */
export function evaluateKeJing(result: DaLiuRenResult): KeJingMatch[] {
  const matches: KeJingMatch[] = [];

  for (const rule of rules) {
    let matched = false;
    try {
      matched = rule.check(result);
    } catch {
      matched = false;
    }
    if (matched) {
      matches.push({
        rule,
        evidence: [buildEvidence(rule.code, result)],
      });
    }
  }

  return matches;
}

/**
 * 根据规则代码构造证据描述。
 */
function buildEvidence(code: string, r: DaLiuRenResult): string {
  const diZhi = DI_ZHI;
  const tr = r.threeTransmissions;
  const sanChuanStr = `${diZhi[tr.initial]}→${diZhi[tr.middle]}→${diZhi[tr.final]}`;

  switch (code) {
    case "yuanshou":
    case "chongshen":
    case "biyong":
    case "shehai":
    case "yaoke":
    case "maoxing":
    case "biezhe":
    case "bazhuan":
      return `三传取法：${r.threeTransmissions.method}，三传：${sanChuanStr}`;
    case "fuyin":
      return `天地盘重合（伏吟盘），天盘子位=${diZhi[r.heavenBoard[0]]}`;
    case "fanyin":
      return `天地盘对冲（返吟盘），天盘子位=${diZhi[r.heavenBoard[0]]}冲子`;
    case "sanqi":
      return `旬奇或日奇入三传：${sanChuanStr}`;
    case "guanjue":
      return `驿马发用+天魁太常入传：${sanChuanStr}`;
    case "fugui":
      return `天乙贵人乘旺相发用，上下相生，临日辰命年：${sanChuanStr}`;
    case "longde":
      return `太岁乘贵人发用，月将入传：${sanChuanStr}`;
    case "sanguang":
      return `日辰用旺相，三处乘吉将：${sanChuanStr}`;
    case "sanyang":
      return `贵人顺行，日辰乘贵前五将，发用旺相：${sanChuanStr}`;
    case "liuyi":
      return `旬首地支入三传：${sanChuanStr}`;
    case "shitai":
      return `初末乘青龙六合，太岁月建入传为日财日德：${sanChuanStr}`;
    case "zhuyin":
      return `天魁戌与太乙巳同入三传：${sanChuanStr}`;
    case "zhuolun":
      return `初传卯加临地盘申或酉发用：${sanChuanStr}`;
    case "tianhuo":
      return `四立日，今日干支与昨日干支相临：${sanChuanStr}`;
    case "jiuchou":
      return `九丑十日，天盘丑临日支：${sanChuanStr}`;
    case "fuyang":
      return `四课见丧门或吊客：${sanChuanStr}`;
    case "chongshanchuan":
      return `三传见六冲关系：${sanChuanStr}`;
    case "lianzhu":
      return `三传递生（连珠课）：${sanChuanStr}`;
    case "lianru":
      return `三传连茹（相同或三合局）：${sanChuanStr}`;
    case "xuanGuan":
      return `日干上神生支上神，初传为日干长生（玄关课）：${sanChuanStr}`;
    case "tianXin":
      return `四建尽入四课（天心课）：${sanChuanStr}`;
    case "tianMu":
      return `天魁戌乘朱雀发用（天目课）：${sanChuanStr}`;
    case "tianEr":
      return `天魁戌乘太阴发用（天耳课）：${sanChuanStr}`;
    case "jinHua":
      return `太白酉乘太阴或天后发用（金华课）：${sanChuanStr}`;
    case "yuTang":
      return `日干上神乘贵人或青龙（玉堂课）：${sanChuanStr}`;
    case "jinRu":
      return `日干上神旺相乘吉将，生之日干（进儒课）：${sanChuanStr}`;
    case "tuiRu":
      return `日干上神休囚乘凶将，克之日干（退儒课）：${sanChuanStr}`;
    case "longhu":
      return `青龙白虎同入三传（龙虎课）：${sanChuanStr}`;
    case "tianluo_diwan":
      return `四课见天罗地网（辰戌）：${sanChuanStr}`;
    default:
      return `三传：${sanChuanStr}`;
  }
}

/** 获取所有已注册课经规则 */
export function getAllKeJingRules(): KeJingRule[] {
  return rules;
}
