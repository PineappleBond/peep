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
  BRANCH_ELEMENT,
  STEM_ELEMENT,
  TIAN_JIANG,
  LIU_CHONG,
  LIU_HE_PAIRS,
  SAN_HE_TRIPLES,
} from "./constants";
import type { DaLiuRenResult } from "./types";

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

/** 取五行（地支） */
function elemB(b: number): number {
  return BRANCH_ELEMENT[b];
}

/** 五行 A 克 B */
function keOf(a: number): number {
  return (a + 2) % 5;
}

/** 五行 A 生 B */
function shengOf(a: number): number {
  return (a + 1) % 5;
}

/** 天地盘是否伏吟（重合） */
function isFuyin(r: DaLiuRenResult): boolean {
  return r.heavenBoard[0] === 0;
}

/** 天地盘是否返吟（对冲） */
function isFanyin(r: DaLiuRenResult): boolean {
  return r.heavenBoard[0] === 6;
}

/** 天盘某支是否在四课出现 */
function inFourLessons(branch: number, r: DaLiuRenResult): boolean {
  return r.fourLessons.some((l) => l.upper === branch);
}

/** 天盘某支是否在三传中 */
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

/** 找某天将所在地盘宫位（-1 表示不存在） */
function findGeneralPosition(
  generalName: string,
  r: DaLiuRenResult
): number {
  const g = r.twelveGenerals.find((g) => g.name === generalName);
  return g ? g.position : -1;
}

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
      "三传成三合局（申子辰/寅午戌/巳酉丑/亥卯未）。事有定势、合而成局。",
    check: (r) => sanChuanSanHe(r),
  },
  {
    code: "guanjue",
    name: "官爵课",
    group: "三传",
    description:
      "三传递生且带驿马、天吏。主官运亨通、爵禄加身。",
    check: (r) => {
      // 三传递生 + 三传中含驿马（申子辰马在寅等）
      if (!sanChuanDiSheng(r)) return false;
      const yearBranch = r.fourPillars.yearBranch;
      // 驿马：申子辰→寅，寅午戌→申，巳酉丑→亥，亥卯未→巳
      const maMap: Record<number, number> = {
        0: 2, 4: 2, 8: 2, // 申子辰→寅
        2: 8, 6: 8, 10: 8, // 寅午戌→申
        5: 11, 9: 11, 1: 11, // 巳酉丑→亥
        11: 5, 3: 5, 7: 5, // 亥卯未→巳
      };
      const ma = maMap[yearBranch];
      return ma !== undefined && inSanChuan(ma, r);
    },
  },
  {
    code: "sanguang",
    name: "三光课",
    group: "三传",
    description:
      "三传递生且三传皆旺相（得月令）。事皆顺遂、光明通达。",
    check: (r) => {
      if (!sanChuanDiSheng(r)) return false;
      const { initial, middle, final } = r.threeTransmissions;
      const wx = r.wangXiang;
      const isWangXiang = (b: number) =>
        wx[b] === "旺" || wx[b] === "相";
      return isWangXiang(initial) && isWangXiang(middle) && isWangXiang(final);
    },
  },
  {
    code: "sanyang",
    name: "三阳课",
    group: "三传",
    description:
      "三传递克且三传皆旺相。事虽冲突但各有气焰。",
    check: (r) => {
      if (!sanChuanDiKe(r)) return false;
      const { initial, middle, final } = r.threeTransmissions;
      const wx = r.wangXiang;
      const isWangXiang = (b: number) =>
        wx[b] === "旺" || wx[b] === "相";
      return isWangXiang(initial) && isWangXiang(middle) && isWangXiang(final);
    },
  },
  {
    code: "liuyi",
    name: "六仪课",
    group: "三传",
    description:
      "三传见六仪（子、卯、巳、酉、亥、未为六仪支）。主有吉庆、贵人扶持。",
    check: (r) => {
      // 六仪：子、卯、巳、酉、亥、未
      const liuYi = new Set([0, 3, 5, 9, 11, 7]);
      const { initial, middle, final } = r.threeTransmissions;
      return (
        liuYi.has(initial) || liuYi.has(middle) || liuYi.has(final)
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
      "三传见贵人、禄、马（驿马）。主官禄双全、富贵显达。",
    check: (r) => {
      const hasGuiren = r.twelveGenerals.some(
        (g) => g.name === "贵人" && inSanChuan(r.heavenBoard[g.position], r)
      );
      // 禄：日干之禄（甲寅、乙卯、丙巳、丁午、戊巳、己午、庚申、辛酉、壬亥、癸子）
      const luMap: Record<number, number> = {
        0: 2, 1: 3, 2: 5, 3: 6, 4: 5, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0,
      };
      const lu = luMap[r.fourPillars.dayStem];
      const hasLu = inSanChuan(lu, r);
      // 驿马
      const yearBranch = r.fourPillars.yearBranch;
      const maMap: Record<number, number> = {
        0: 2, 4: 2, 8: 2,
        2: 8, 6: 8, 10: 8,
        5: 11, 9: 11, 1: 11,
        11: 5, 3: 5, 7: 5,
      };
      const ma = maMap[yearBranch];
      const hasMa = ma !== undefined && inSanChuan(ma, r);
      return hasGuiren && hasLu && hasMa;
    },
  },
  {
    code: "longde",
    name: "龙德课",
    group: "天将",
    description:
      "四课见青龙与天德（月德）。主吉庆重重、贵人提携。",
    check: (r) => {
      // 青龙临四课
      const qinglongPos = r.twelveGenerals.find((g) => g.name === "青龙");
      if (!qinglongPos) return false;
      const qinglongBranch = r.heavenBoard[qinglongPos.position];
      if (!inFourLessons(qinglongBranch, r)) return false;
      // 天德：正丁二坤三庚四辛五巳六癸七亥八子九丙十壬十一巳十二丙
      // 简化：月建对应的天德查表
      // 按月支：寅月→丁(无支)，此处用月德更简单
      // 月德：寅午戌月在丙（巳），申子辰月在壬（亥），亥卯未月在甲（寅），巳酉丑月在庚（申）
      const monthBranch = r.fourPillars.monthBranch;
      let tianDe: number;
      if ([2, 6, 10].includes(monthBranch)) tianDe = 5; // 寅午戌→巳
      else if ([8, 0, 4].includes(monthBranch)) tianDe = 11; // 申子辰→亥
      else if ([11, 3, 7].includes(monthBranch)) tianDe = 2; // 亥卯未→寅
      else tianDe = 8; // 巳酉丑→申
      return inFourLessons(tianDe, r);
    },
  },
  {
    code: "shitai",
    name: "时泰课",
    group: "天将",
    description:
      "三传见三合/六合且带吉将（青龙、太常、六合）。主时运亨通、百事和合。",
    check: (r) => {
      // 三传带合
      const { initial, middle, final } = r.threeTransmissions;
      const hasSanHe = sanChuanSanHe(r);
      const hasLiuHe = LIU_HE_PAIRS.some(
        (p) =>
          (p[0] === initial && p[1] === middle) ||
          (p[1] === initial && p[0] === middle) ||
          (p[0] === middle && p[1] === final) ||
          (p[1] === middle && p[0] === final)
      );
      if (!hasSanHe && !hasLiuHe) return false;
      // 带吉将
      const jiJiang = ["青龙", "太常", "六合"];
      return jiJiang.some((name) =>
        r.twelveGenerals.some(
          (g) => g.name === name && inSanChuan(r.heavenBoard[g.position], r)
        )
      );
    },
  },
  {
    code: "zhuyin",
    name: "铸印课",
    group: "天将",
    description:
      "三传递生且带吉将（青龙、太常）。主官职封拜、印信到手。",
    check: (r) => {
      if (!sanChuanDiSheng(r)) return false;
      const jiJiang = ["青龙", "太常"];
      return jiJiang.some((name) =>
        r.twelveGenerals.some(
          (g) => g.name === name && inSanChuan(r.heavenBoard[g.position], r)
        )
      );
    },
  },
  {
    code: "zhuolun",
    name: "斫轮课",
    group: "天将",
    description:
      "三传递克且带吉将。主以力制胜、劳而有功。",
    check: (r) => {
      if (!sanChuanDiKe(r)) return false;
      const jiJiang = ["青龙", "太常", "六合"];
      return jiJiang.some((name) =>
        r.twelveGenerals.some(
          (g) => g.name === name && inSanChuan(r.heavenBoard[g.position], r)
        )
      );
    },
  },

  // ──── 特殊类 ────
  {
    code: "tianhuo",
    name: "天祸课",
    group: "特殊",
    description:
      "四立日（立春、立夏、立秋、立冬）且四课见凶将（白虎、螣蛇）。主天降灾祸。",
    check: (r) => {
      // 简化：判断月支在四孟（寅巳申亥）且四课带凶将
      const monthBranch = r.fourPillars.monthBranch;
      const isSiLi = [2, 5, 8, 11].includes(monthBranch);
      if (!isSiLi) return false;
      const xiongJiang = ["白虎", "螣蛇"];
      return xiongJiang.some((name) =>
        r.twelveGenerals.some(
          (g) => g.name === name && inFourLessons(r.heavenBoard[g.position], r)
        )
      );
    },
  },
  {
    code: "jiuchou",
    name: "九丑课",
    group: "特殊",
    description:
      "四课见子午卯酉（四正）多位且带凶将。主百事不宜、大凶。",
    check: (r) => {
      const siZheng = new Set([0, 3, 6, 9]); // 子午卯酉
      let count = 0;
      for (const l of r.fourLessons) {
        if (siZheng.has(l.upper)) count++;
      }
      if (count < 3) return false;
      const xiongJiang = ["白虎", "螣蛇", "勾陈"];
      return xiongJiang.some((name) =>
        r.twelveGenerals.some(
          (g) => g.name === name && inFourLessons(r.heavenBoard[g.position], r)
        )
      );
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
      return `三传成三合局：${sanChuanStr}`;
    case "fugui":
      return `三传带贵人、禄、驿马：${sanChuanStr}`;
    case "sanguang":
      return `三传递生且皆旺相：${sanChuanStr}`;
    case "sanyang":
      return `三传递克且皆旺相：${sanChuanStr}`;
    default:
      return `三传：${sanChuanStr}`;
  }
}

/** 获取所有已注册课经规则 */
export function getAllKeJingRules(): KeJingRule[] {
  return rules;
}
