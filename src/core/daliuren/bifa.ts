/**
 * 毕法引擎（毕法赋）
 *
 * 实现《六壬大全·毕法赋》前六法判断：
 *  - 第一法：前后引从也（引从类）
 *  - 第二法：首尾相见也（相见类）
 *  - 第三法：连幕贵人也（贵人类）
 *  - 第四法：崔官使者也（官鬼类）
 *  - 第五法：六阳相济也（阴阳类）
 *  - 第六法：六阴相继吉（吉庆类）
 *
 * 参考 PHP BiFaRuleEngine / Rules/*.php。
 */

import {
  DI_ZHI,
  XUN_HEAD,
  NOBLEMAN_TABLE,
  SAN_HE_TRIPLES as _SAN_HE_TRIPLES,
  DAY_VIRTUES,
  DAY_ORIGIN,
  DAY_LU,
} from "./constants";
import type { DaLiuRenResult } from "./types";
import {
  elemB,
  shengOf,
  stemLodgingBranch,
  sexagenaryIndex,
  getGeneralRidingBranch as _getGeneralRidingBranch,
  findGeneralPosition,
  inFourLessons as _inFourLessons,
  isFuyin,
} from "./utils";

// ─── 类型定义 ────────────────────────────────────────────

/** 单条毕法规则 */
export interface BiFaRule {
  /** 规则代码（如 "bifa.01"） */
  code: string;
  /** 规则名称（如 "前后引从升迁吉"） */
  name: string;
  /** 规则描述 */
  description: string;
  /** 判断条件：返回 true 表示该法成立 */
  check: (result: DaLiuRenResult) => boolean;
}

/** 毕法匹配结果 */
export interface BiFaMatch {
  /** 匹配到的规则 */
  rule: BiFaRule;
  /** 命中证据（人可读的字符串列表） */
  evidence: string[];
}

// ─── 辅助函数 ────────────────────────────────────────────
// elemB, shengOf, stemLodgingBranch, getGeneralRidingBranch,
// findGeneralPosition, inFourLessons, isFuyin, sexagenaryIndex 已从 utils.ts 导入

/**
 * 计算六十甲子日序号（0-59），调用共享的 sexagenaryIndex
 */
function daySexagenaryIndex(r: DaLiuRenResult): number {
  return sexagenaryIndex(r.fourPillars.dayStem, r.fourPillars.dayBranch);
}

/** 获取旬首地支 */
function xunHeadBranch(r: DaLiuRenResult): number {
  const dayIndex = daySexagenaryIndex(r);
  const xunIdx = Math.floor(dayIndex / 10);
  return XUN_HEAD[xunIdx];
}

/**
 * 获取旬尾地支（旬首 + 9）
 *
 * 一旬十日，旬首起甲、旬尾至癸，癸所在支 = 旬首 + 9（mod 12）。
 */
function xunTailBranch(r: DaLiuRenResult): number {
  return (xunHeadBranch(r) + 9) % 12;
}

/** 判断地支是否旬空 */
function _isXunVoid(branch: number, r: DaLiuRenResult): boolean {
  const xunHead = xunHeadBranch(r);
  return branch === (xunHead + 10) % 12 || branch === (xunHead + 11) % 12;
}

/** 天盘某支所在地盘宫位（-1 表示不存在） */
function heavenBranchGround(branch: number, r: DaLiuRenResult): number {
  return r.heavenBoard.indexOf(branch);
}

// findGeneralPosition, getGeneralRidingBranch 已从 utils.ts 导入

/** 判断三传是否为三合局，返回五行（-1 表示不合局） */
function sanChuanSanHeElement(r: DaLiuRenResult): number {
  const { initial, middle, final } = r.threeTransmissions;
  const sorted = [initial, middle, final].sort((a, b) => a - b);
  // 三合局 → 五行：申子辰=水(4)、巳酉丑=金(3)、寅午戌=火(1)、亥卯未=木(0)
  if (sorted[0] === 0 && sorted[1] === 4 && sorted[2] === 8) return 4; // 水
  if (sorted[0] === 1 && sorted[1] === 5 && sorted[2] === 9) return 3; // 金
  if (sorted[0] === 2 && sorted[1] === 6 && sorted[2] === 10) return 1; // 火
  if (sorted[0] === 3 && sorted[1] === 7 && sorted[2] === 11) return 0; // 木
  return -1;
}

/** 无方向夹拱：a、b 两宫位分别位于 target 的前一宫/后一宫 */
function flanks(a: number, b: number, target: number): boolean {
  const front = (target + 1) % 12;
  const back = (target + 11) % 12;
  return (a === front && b === back) || (a === back && b === front);
}

// inFourLessons, isFuyin 已从 utils.ts 导入

// ─── 毕法规则列表 ─────────────────────────────────────────

const rules: BiFaRule[] = [
  // 第一法：前后引从升迁吉
  {
    code: "bifa.01",
    name: "前后引从升迁吉",
    description: "初末传分临日干（或日支）前后宫，前引后从，主迁官进职、修宅迁居。",
    check: r => {
      const { initial, final } = r.threeTransmissions;
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      const lodging = stemLodgingBranch(dayStem);
      // 引从天干：初传临日干寄宫前一宫、末传临后一宫
      const lodgingFront = (lodging + 1) % 12;
      const lodgingBack = (lodging + 11) % 12;
      const initialGround = heavenBranchGround(initial, r);
      const finalGround = heavenBranchGround(final, r);
      if (initialGround === -1 || finalGround === -1) return false;
      const yinGan = initialGround === lodgingFront && finalGround === lodgingBack;
      if (yinGan) return true;
      // 引从地支
      const rizhiFront = (dayBranch + 1) % 12;
      const rizhiBack = (dayBranch + 11) % 12;
      const yinZhi = initialGround === rizhiFront && finalGround === rizhiBack;
      if (yinZhi) return true;
      // 拱贵格：引从天干 + 干上神为昼夜贵人之一
      const [dayNoble, nightNoble] = NOBLEMAN_TABLE[dayStem];
      const ganShang = r.heavenBoard[lodging];
      const gongGui = yinGan && (ganShang === dayNoble || ganShang === nightNoble);
      if (gongGui) return true;
      // 两贵引从天干格：引从天干 + 初末传为昼夜二贵
      const liangGui =
        yinGan &&
        ((initial === dayNoble && final === nightNoble) ||
          (initial === nightNoble && final === dayNoble));
      if (liangGui) return true;
      // 干支拱日禄（伏吟）（DAY_LU 已从 constants.ts 导入）
      const lu = DAY_LU[dayStem];
      if (isFuyin(r) && flanks(lodging, dayBranch, lu)) return true;
      // 干支拱昼贵/夜贵（伏吟）
      if (isFuyin(r) && flanks(lodging, dayBranch, dayNoble)) return true;
      if (isFuyin(r) && flanks(lodging, dayBranch, nightNoble)) return true;
      return false;
    },
  },

  // 第二法：首尾相见始终宜
  {
    code: "bifa.02",
    name: "首尾相见始终宜",
    description:
      "旬首、旬尾分别临日干与日支，或四建尽入四课，或三传尽入四课，主事情前后相续、吉凶易成。",
    check: r => {
      const dayStem = r.fourPillars.dayStem;
      const dayBranch = r.fourPillars.dayBranch;
      const lodging = stemLodgingBranch(dayStem);
      const xunHead = xunHeadBranch(r);
      const xunTail = xunTailBranch(r);
      const ganShang = r.heavenBoard[lodging];
      const zhiShang = r.heavenBoard[dayBranch];
      // 周而复始 A：旬尾临干、旬首临支
      if (ganShang === xunTail && zhiShang === xunHead) return true;
      // 周而复始 B：旬首临干、旬尾临支
      if (ganShang === xunHead && zhiShang === xunTail) return true;
      // 天心格：四建（太岁、月建、日支、占时）尽入四课
      const lessonBranches = new Set<number>();
      r.fourLessons.forEach(l => {
        lessonBranches.add(l.upper);
        lessonBranches.add(l.lower);
      });
      const nianzhi = r.fourPillars.yearBranch;
      const yuezhi = r.fourPillars.monthBranch;
      const shizhi = r.fourPillars.hourBranch;
      if (
        lessonBranches.has(nianzhi) &&
        lessonBranches.has(yuezhi) &&
        lessonBranches.has(dayBranch) &&
        lessonBranches.has(shizhi)
      ) {
        return true;
      }
      // 回还格：三传尽入四课
      const { initial, middle, final } = r.threeTransmissions;
      if (lessonBranches.has(initial) && lessonBranches.has(middle) && lessonBranches.has(final)) {
        return true;
      }
      return false;
    },
  },

  // 第三法：帘幕贵人高甲第
  {
    code: "bifa.03",
    name: "帘幕贵人高甲第",
    description:
      "昼占取夜贵、夜占取昼贵为帘幕贵人；帘幕临干年命、旬首帘幕、斗鬼、德入天门等皆为科名之象。",
    check: r => {
      const dayStem = r.fourPillars.dayStem;
      const lodging = stemLodgingBranch(dayStem);
      const [_dayNoble, nightNoble] = NOBLEMAN_TABLE[dayStem];
      // 帘幕贵人：昼占取夜贵、夜占取昼贵（简化：用昼夜贵人中非当前用者）
      // 简化判断：帘幕贵人 = 夜贵（昼占用）或昼贵（夜占用），这里用两贵交替
      const curtain = nightNoble; // 简化：取夜贵为帘幕
      const ganShang = r.heavenBoard[lodging];
      // 帘幕贵人临日干寄宫
      if (ganShang === curtain) return true;
      // 旬首作帘幕
      const xunHead = xunHeadBranch(r);
      if (xunHead === curtain && ganShang === xunHead) return true;
      // 辰戌旬首临干年命
      if ((xunHead === 4 || xunHead === 10) && ganShang === xunHead) return true;
      // 德入天门：日德加临地盘亥宫（DAY_VIRTUES 已从 constants.ts 导入）
      const dayVirtue = DAY_VIRTUES[dayStem];
      if (r.heavenBoard[11] === dayVirtue && r.threeTransmissions.initial === dayVirtue)
        return true;
      return false;
    },
  },

  // 第四法：催官使者赴官期
  {
    code: "bifa.04",
    name: "催官使者赴官期",
    description:
      "日鬼或官星乘白虎加临日干或年命为催官使者；或官星临日干年命而三传组成三合局、局生官星为催官符。",
    check: r => {
      const dayStem = r.fourPillars.dayStem;
      const lodging = stemLodgingBranch(dayStem);
      // 官星表（普通五行官鬼）
      const DAY_OFFICIALS: Record<number, number[]> = {
        0: [8, 9],
        1: [8, 9], // 甲乙(木)→申酉(金)
        2: [0, 11],
        3: [0, 11], // 丙丁(火)→亥子(水)
        4: [2, 3],
        5: [2, 3], // 戊己(土)→寅卯(木)
        6: [5, 6],
        7: [5, 6], // 庚辛(金)→巳午(火)
        8: [4, 10, 1, 7],
        9: [4, 10, 1, 7], // 壬癸(水)→辰戌丑未(土)
      };
      const officials = DAY_OFFICIALS[dayStem] || [];
      // 催官使者：官星乘白虎加临日干寄宫
      const baihuPos = findGeneralPosition("白虎", r);
      if (baihuPos >= 0) {
        const baihuBranch = r.heavenBoard[baihuPos];
        if (officials.includes(baihuBranch)) {
          // 白虎所乘天盘支为官星，检查是否加临日干寄宫
          if (r.heavenBoard[lodging] === baihuBranch) return true;
        }
      }
      // 催官符：官星加临日干寄宫 + 三传合局生官星
      const ganShang = r.heavenBoard[lodging];
      if (officials.includes(ganShang)) {
        const officialElem = elemB(ganShang);
        const sanheElem = sanChuanSanHeElement(r);
        if (sanheElem >= 0 && shengOf(sanheElem) === officialElem) {
          return true;
        }
      }
      // 恩主举荐·长生作贵人：当前贵人的天盘支 = 日干长生位（DAY_ORIGIN 已从 constants.ts 导入）
      const origin = DAY_ORIGIN[dayStem];
      const [dayNoble] = NOBLEMAN_TABLE[dayStem];
      if (dayNoble === origin) return true;
      return false;
    },
  },

  // 第五法：六阳数足须公用
  {
    code: "bifa.05",
    name: "六阳数足须公用",
    description:
      "四课四上神与中末传六位全阳，或六位恰五阳一阴而占人年命有阳支填实，主公用明白、利公不利私。",
    check: r => {
      const uppers = r.fourLessons.map(l => l.upper);
      const { middle, final } = r.threeTransmissions;
      const positions = [...uppers, middle, final];
      const yangCount = positions.filter(b => b % 2 === 0).length;
      // 六阳格：六位全阳
      if (yangCount === 6) return true;
      // 五阳格：五位阳，一位阴
      if (yangCount === 5) return true;
      return false;
    },
  },

  // 第六法：六阴相继尽昏迷
  {
    code: "bifa.06",
    name: "六阴相继尽昏迷",
    description:
      "四课四上神与中末传六位全阴，或六位恰五阴一阳而占人年命得阴填实，主事情幽暗、进退难决。",
    check: r => {
      const uppers = r.fourLessons.map(l => l.upper);
      const { middle, final } = r.threeTransmissions;
      const positions = [...uppers, middle, final];
      const yinCount = positions.filter(b => b % 2 === 1).length;
      // 六阴格：六位全阴
      if (yinCount === 6) return true;
      // 五阴格：五位阴，一位阳
      if (yinCount === 5) return true;
      return false;
    },
  },
];

// ─── 主入口 ─────────────────────────────────────────

/**
 * 评估盘面符合哪些毕法规则。
 *
 * @param result 完整的大六壬盘面
 * @returns 匹配到的毕法列表（含证据）
 */
export function evaluateBiFa(result: DaLiuRenResult): BiFaMatch[] {
  const matches: BiFaMatch[] = [];

  for (const rule of rules) {
    let matched = false;
    try {
      matched = rule.check(result);
    } catch {
      matched = false;
    }
    if (matched) {
      // 只存储可序列化的规则元数据，排除 check 函数（否则 IndexedDB 无法克隆）
      const { check: _check, ...serializableRule } = rule;
      matches.push({
        rule: serializableRule as BiFaRule,
        evidence: [buildBiFaEvidence(rule.code, result)],
      });
    }
  }

  return matches;
}

/**
 * 根据规则代码构造证据描述。
 */
function buildBiFaEvidence(code: string, r: DaLiuRenResult): string {
  const diZhi = DI_ZHI;
  const tr = r.threeTransmissions;
  const sanChuanStr = `${diZhi[tr.initial]}→${diZhi[tr.middle]}→${diZhi[tr.final]}`;

  switch (code) {
    case "bifa.01":
      return `初末传分临日干/日支前后宫，前引后从：${sanChuanStr}`;
    case "bifa.02":
      return `旬首旬尾临干支，或四建/三传尽入四课：${sanChuanStr}`;
    case "bifa.03":
      return `帘幕贵人临干年命或德入天门等科名之象：${sanChuanStr}`;
    case "bifa.04":
      return `官星乘白虎临日干年命，或三传合局生官星：${sanChuanStr}`;
    case "bifa.05":
      return `四课上神与中末传六位全阳或五阳：${sanChuanStr}`;
    case "bifa.06":
      return `四课上神与中末传六位全阴或五阴：${sanChuanStr}`;
    default:
      return `三传：${sanChuanStr}`;
  }
}

/** 获取所有已注册毕法规则 */
export function getAllBiFaRules(): BiFaRule[] {
  return rules;
}
