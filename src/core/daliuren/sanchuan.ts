/**
 * 大六壬九宗门三传
 *
 * 按优先级链取初传，中末传依天盘递推（伏吟用刑链、返吟用冲链）。
 * 优先级：贼克(元首/重审) → 比用(知一) → 涉害(见机/察微/缀瑕)
 *        → 遥克(蒿矢/弹射) → 昴星(虎视/冬蛇掩目) → 别责 → 八专(独足)
 * 特盘覆盖：伏吟(不虞/自任/自信/杜传)、返吟(无依/无亲)
 */
import {
  DI_ZHI,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  STEM_YIN_YANG,
  BRANCH_YIN_YANG,
  STEM_LODGING,
  DI_ZHI_XING,
  LIU_CHONG,
} from "./constants";
import type { FourLesson, ThreeTransmissionsResult } from "./types";

// ─── 常量 ────────────────────────────────────────────

/** 四孟：寅巳申亥 */
const SI_MENG = new Set([2, 5, 8, 11]);
/** 四仲：子卯午酉 */
const SI_ZHONG = new Set([0, 3, 6, 9]);
/** 自刑之地：辰午酉亥 */
const SELF_XING = new Set([4, 6, 9, 11]);

// ─── 辅助函数 ─────────────────────────────────────────

/** 取地支五行 */
function branchElem(b: number): number {
  return BRANCH_ELEMENT[b];
}

/** 取天干五行 */
function stemElem(s: number): number {
  return STEM_ELEMENT[s];
}

/**
 * 获取四课某课的"下"五行
 *
 * 第一课的下为日干（用天干五行），其余课的下为地支（用地支五行）。
 * 这与 PHP 参考实现一致：getShengke(wuxingDi[sike[1]], wuxingTian[rigan]) 用于第一课。
 */
function lessonLowerElement(lesson: FourLesson, dayStem: number): number {
  return lesson.lowerType === "stem" ? stemElem(dayStem) : branchElem(lesson.lower);
}

/** 上课五行（始终为地支） */
function lessonUpperElement(lesson: FourLesson): number {
  return branchElem(lesson.upper);
}

/** 五行 A 克 B */
function keOf(a: number): number {
  // 木(0)→土(2)、火(1)→金(3)、土(2)→水(4)、金(3)→木(0)、水(4)→火(1)
  return (a + 2) % 5;
}

/** 上克下：上课五行克下课五行 */
function isShangKeXia(lesson: FourLesson, dayStem: number): boolean {
  return keOf(lessonUpperElement(lesson)) === lessonLowerElement(lesson, dayStem);
}

/** 下贼上：下课五行克上课五行 */
function isXiaZeiShang(lesson: FourLesson, dayStem: number): boolean {
  return keOf(lessonLowerElement(lesson, dayStem)) === lessonUpperElement(lesson);
}

/**
 * 涉害深度计算
 *
 * 上神从天盘落点（earthPos）沿地盘回归本位（upper）路径上，
 * 逐宫检查遇到的克数（含地支本气与寄宫天干）。
 *
 * @param upper 上课地支索引
 * @param heavenBoard 天盘
 * @param isZei 是否为贼关系（下贼上）。true 则检查"地盘克上神"，false 则检查"上神克地盘"
 */
function calcShehaiDepth(
  upper: number,
  heavenBoard: number[],
  isZei: boolean
): number {
  // 天盘 upper 所在地盘宫位
  const earthPos = heavenBoard.indexOf(upper);
  if (earthPos === upper) return 0; // 上神在本位，无涉害

  // 计算从 earthPos 到 upper 的路径（循环）
  const path: number[] = [];
  if (earthPos < upper) {
    for (let i = earthPos; i <= upper; i++) path.push(i);
  } else {
    for (let i = earthPos; i <= 11; i++) path.push(i);
    for (let i = 0; i <= upper; i++) path.push(i);
  }

  let depth = 0;

  for (const pos of path) {
    // 检查地盤本支
    const posElem = branchElem(pos);
    if (isZei) {
      // 地盘克上神
      if (keOf(posElem) === branchElem(upper)) depth++;
    } else {
      // 上神克地盘
      if (keOf(branchElem(upper)) === posElem) depth++;
    }

    // 检查寄宫天干：该地盘位寄了哪些天干
    for (let s = 0; s < 10; s++) {
      if (STEM_LODGING[s] !== pos) continue;
      const sElem = stemElem(s);
      if (isZei) {
        if (keOf(sElem) === branchElem(upper)) depth++;
      } else {
        if (keOf(branchElem(upper)) === sElem) depth++;
      }
    }
  }

  return depth;
}

// ─── 中末传通用递推 ──────────────────────────────────

/** 标准递推：中传=天盘[初传]，末传=天盘[中传] */
function standardMiddleFinal(
  initial: number,
  heavenBoard: number[]
): { middle: number; final: number } {
  const middle = heavenBoard[initial];
  const final = heavenBoard[middle];
  return { middle, final };
}

// ─── 主函数 ──────────────────────────────────────────

/**
 * 计算三传（九宗门取法）
 *
 * @param fourLessons 四课
 * @param dayStem 日干索引
 * @param dayBranch 日支索引
 * @param heavenBoard 天盘
 */
export function calculateThreeTransmissions(
  fourLessons: FourLesson[],
  dayStem: number,
  dayBranch: number,
  heavenBoard: number[]
): ThreeTransmissionsResult {
  const trace: string[] = [];

  // 四课上下关系分类
  const xiaZeiShangIdx: number[] = []; // 下贼上的课索引
  const shangKeXiaIdx: number[] = []; // 上克下的课索引

  fourLessons.forEach((lesson, i) => {
    if (isXiaZeiShang(lesson, dayStem)) xiaZeiShangIdx.push(i);
    if (isShangKeXia(lesson, dayStem)) shangKeXiaIdx.push(i);
  });

  trace.push(
    `四课: ${fourLessons.map((l, idx) => `[${idx + 1}]${DI_ZHI[l.upper]}←${DI_ZHI[l.lower]}`).join(" ")}`
  );
  trace.push(
    `贼(${xiaZeiShangIdx.map((i) => i + 1).join(",") || "无"}) 克(${shangKeXiaIdx.map((i) => i + 1).join(",") || "无"})`
  );

  // 盘面检测
  const isFuyin = heavenBoard[0] === 0; // 天地盘重合
  const isFanyin = heavenBoard[0] === 6; // 天地盘对冲

  // 特殊日：丁未、己未虽有返吟盘但不按返吟处理
  const isDingWei = dayStem === 3 && dayBranch === 7;
  const isJiWei = dayStem === 5 && dayBranch === 7;

  trace.push(`盘面: ${isFuyin ? "伏吟" : isFanyin ? "返吟" : "常盘"}`);

  // ── 1. 伏吟（天地盘重合）──
  if (isFuyin) {
    return handleFuyin(
      fourLessons,
      dayStem,
      dayBranch,
      heavenBoard,
      xiaZeiShangIdx,
      shangKeXiaIdx,
      trace
    );
  }

  // ── 2. 返吟（天地盘对冲），丁未/己未除外 ──
  if (isFanyin && !isDingWei && !isJiWei) {
    return handleFanyin(
      fourLessons,
      dayStem,
      dayBranch,
      heavenBoard,
      xiaZeiShangIdx,
      shangKeXiaIdx,
      trace
    );
  }

  // ── 标准九宗门 ──

  // ── 3. 贼克：单一克取克者 ──
  if (
    xiaZeiShangIdx.length === 1 ||
    (xiaZeiShangIdx.length === 0 && shangKeXiaIdx.length === 1)
  ) {
    if (xiaZeiShangIdx.length === 1) {
      const idx = xiaZeiShangIdx[0];
      const initial = fourLessons[idx].upper;
      const { middle, final } = standardMiddleFinal(initial, heavenBoard);
      trace.push(`重审：第${idx + 1}课下贼上，取${DI_ZHI[initial]}为初传`);
      return { initial, middle, final, method: "重审", trace };
    } else {
      const idx = shangKeXiaIdx[0];
      const initial = fourLessons[idx].upper;
      const { middle, final } = standardMiddleFinal(initial, heavenBoard);
      trace.push(`元首：第${idx + 1}课上克下，取${DI_ZHI[initial]}为初传`);
      return { initial, middle, final, method: "元首", trace };
    }
  }

  // ── 4/5. 比用(知一) + 涉害 ──
  if (xiaZeiShangIdx.length > 1 || (shangKeXiaIdx.length > 1 && xiaZeiShangIdx.length === 0)) {
    const isZei = xiaZeiShangIdx.length > 0;
    const candidates = isZei ? xiaZeiShangIdx : shangKeXiaIdx;
    const dayYY = STEM_YIN_YANG[dayStem];

    // 按阴阳分组
    const xiangBi: number[] = []; // 与日干阴阳同
    const buBi: number[] = []; // 与日干阴阳异
    for (const idx of candidates) {
      if (BRANCH_YIN_YANG[fourLessons[idx].upper] === dayYY) {
        xiangBi.push(idx);
      } else {
        buBi.push(idx);
      }
    }

    // 比用/知一：唯一与日干阴阳同者
    if (
      xiangBi.length === 1 ||
      (xiangBi.length > 1 && fourLessons[xiangBi[0]].upper === fourLessons[xiangBi[1]].upper)
    ) {
      const idx = xiangBi[0];
      const initial = fourLessons[idx].upper;
      const { middle, final } = standardMiddleFinal(initial, heavenBoard);
      const methodName = isZei ? "比用" : "知一";
      trace.push(`${methodName}：${candidates.length}个${isZei ? "贼" : "克"}，取阴阳同者第${idx + 1}课`);
      return { initial, middle, final, method: methodName, trace };
    }

    // 涉害：比用无法唯一确定
    return handleShehai(
      fourLessons,
      dayStem,
      dayBranch,
      heavenBoard,
      candidates,
      xiangBi,
      buBi,
      isZei,
      trace
    );
  }

  // ── 以下为四课无克的情况 ──
  const noKe = xiaZeiShangIdx.length === 0 && shangKeXiaIdx.length === 0;
  if (!noKe) {
    // 不应发生（前面的分支已覆盖所有有克情况），兜底
    trace.push("兜底：未匹配任何九宗门");
    return { initial: 0, middle: heavenBoard[0], final: heavenBoard[heavenBoard[0]], method: "未知", trace };
  }

  // 四课上课值
  const l1Upper = fourLessons[0].upper;
  const l2Upper = fourLessons[1].upper;
  const l3Upper = fourLessons[2].upper;
  const l4Upper = fourLessons[3].upper;
  const allDistinct = l1Upper !== l3Upper || l2Upper !== l4Upper;

  // ── 6. 遥克（蒿矢/弹射）──
  if (allDistinct) {
    const yaokeResult = tryYaoke(fourLessons, dayStem, dayBranch, heavenBoard, trace);
    if (yaokeResult) return yaokeResult;
  }

  // ── 7. 昴星（虎视/冬蛇掩目）──
  if (allDistinct) {
    return handleMaoxing(dayStem, dayBranch, heavenBoard, fourLessons, trace);
  }

  // ── 8. 别责 ──
  if (l1Upper === l3Upper || l2Upper === l4Upper) {
    return handleBiezhe(dayStem, dayBranch, heavenBoard, fourLessons, trace);
  }

  // ── 9. 八专（独足）──
  if (l1Upper === l3Upper && l2Upper === l4Upper) {
    return handleBazhuan(dayStem, dayBranch, heavenBoard, fourLessons, trace);
  }

  // 兜底
  trace.push("兜底：未匹配任何九宗门");
  return { initial: 0, middle: heavenBoard[0], final: heavenBoard[heavenBoard[0]], method: "未知", trace };
}

// ─── 伏吟处理 ──────────────────────────────────────

function handleFuyin(
  fourLessons: FourLesson[],
  dayStem: number,
  _dayBranch: number,
  _heavenBoard: number[],
  xiaZeiShangIdx: number[],
  shangKeXiaIdx: number[],
  trace: string[]
): ThreeTransmissionsResult {
  const hasKe = xiaZeiShangIdx.length > 0 || shangKeXiaIdx.length > 0;

  if (hasKe) {
    // 不虞格：有克取克
    let initial: number;
    if (xiaZeiShangIdx.length > 0) {
      initial = fourLessons[xiaZeiShangIdx[0]].upper;
      trace.push(`伏吟不虞：取第${xiaZeiShangIdx[0] + 1}课贼为初传`);
    } else {
      initial = fourLessons[shangKeXiaIdx[0]].upper;
      trace.push(`伏吟不虞：取第${shangKeXiaIdx[0] + 1}课克为初传`);
    }
    // 中末传用刑链，自刑时取支上神替代
    let middle: number;
    let final: number;
    if (SELF_XING.has(initial)) {
      middle = fourLessons[2].upper; // 支上神
      if (SELF_XING.has(middle)) {
        final = LIU_CHONG[middle];
      } else {
        final = DI_ZHI_XING[middle];
      }
    } else {
      middle = DI_ZHI_XING[initial];
      final = DI_ZHI_XING[middle];
    }
    trace.push(`刑链: ${DI_ZHI[initial]}→${DI_ZHI[middle]}→${DI_ZHI[final]}`);
    return { initial, middle, final, method: "伏吟不虞", trace };
  }

  // 无克：自任/自信
  const isYang = STEM_YIN_YANG[dayStem] === 1;
  let initial: number;
  if (isYang) {
    initial = fourLessons[0].upper; // 干上神
    trace.push(`伏吟自任：阳日取干上神${DI_ZHI[initial]}`);
  } else {
    initial = fourLessons[2].upper; // 支上神
    trace.push(`伏吟自信：阴日取支上神${DI_ZHI[initial]}`);
  }

  let middle: number;
  let method = isYang ? "伏吟自任" : "伏吟自信";

  if (SELF_XING.has(initial)) {
    // 杜传格：初传自刑
    method = "伏吟杜传";
    if (isYang) {
      middle = fourLessons[2].upper; // 取支上神
    } else {
      middle = fourLessons[0].upper; // 取干上神
    }
    trace.push(`杜传：初传${DI_ZHI[initial]}自刑，中传取${DI_ZHI[middle]}`);
  } else {
    middle = DI_ZHI_XING[initial];
    trace.push(`自任/自信刑链: ${DI_ZHI[initial]}→${DI_ZHI[middle]}`);
  }

  // 末传
  let final: number;
  // 子卯互刑特殊处理
  if (initial === 3 && middle === 0) {
    final = LIU_CHONG[middle]; // 卯刑子，子不復刑，取子冲午
    trace.push(`子卯互刑：末传取冲${DI_ZHI[final]}`);
  } else if (SELF_XING.has(middle)) {
    final = LIU_CHONG[middle];
    trace.push(`中传${DI_ZHI[middle]}自刑，末传取冲${DI_ZHI[final]}`);
  } else {
    final = DI_ZHI_XING[middle];
    trace.push(`末传: ${DI_ZHI[final]}`);
  }

  return { initial, middle, final, method, trace };
}

// ─── 返吟处理 ──────────────────────────────────────

function handleFanyin(
  fourLessons: FourLesson[],
  dayStem: number,
  dayBranch: number,
  _heavenBoard: number[],
  xiaZeiShangIdx: number[],
  shangKeXiaIdx: number[],
  trace: string[]
): ThreeTransmissionsResult {
  const l1Upper = fourLessons[0].upper;
  const l3Upper = fourLessons[2].upper;

  // 无亲格检测：辛未、辛丑、丁丑（丁未/己未已排除）
  const isWuqin =
    (dayStem === 7 && dayBranch === 7) ||
    (dayStem === 7 && dayBranch === 1) ||
    (dayStem === 3 && dayBranch === 1);

  if (isWuqin) {
    let initial: number;
    if (dayBranch === 1) {
      initial = 11; // 亥
    } else {
      initial = 5; // 巳
    }
    const middle = l3Upper;
    const final = l1Upper;
    trace.push(`返吟无亲：支=${DI_ZHI[dayBranch]}，初传${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "返吟无亲", trace };
  }

  // 无依格：有克取克，无克取默认
  let initial: number;
  const hasKe = xiaZeiShangIdx.length > 0 || shangKeXiaIdx.length > 0;

  if (hasKe) {
    if (xiaZeiShangIdx.length > 0) {
      initial = fourLessons[xiaZeiShangIdx[0]].upper;
    } else {
      initial = fourLessons[shangKeXiaIdx[0]].upper;
    }
    trace.push(`返吟无依：取克为初传${DI_ZHI[initial]}`);
  } else {
    initial = 0; // 默认子
    trace.push("返吟无依：无克，初传默认子");
  }

  // 中末传用冲链
  const middle = LIU_CHONG[initial];
  const final = LIU_CHONG[middle];
  trace.push(`冲链: ${DI_ZHI[initial]}→${DI_ZHI[middle]}→${DI_ZHI[final]}`);

  return { initial, middle, final, method: "返吟无依", trace };
}

// ─── 涉害处理 ──────────────────────────────────────

function handleShehai(
  fourLessons: FourLesson[],
  dayStem: number,
  _dayBranch: number,
  heavenBoard: number[],
  candidates: number[],
  xiangBi: number[],
  buBi: number[],
  isZei: boolean,
  trace: string[]
): ThreeTransmissionsResult {
  // 确定涉害候选组
  const biyongArr = xiangBi.length > 0 ? xiangBi : buBi;

  // 计算各候选涉害深度
  const depths = new Map<number, number>();
  for (const idx of biyongArr) {
    const depth = calcShehaiDepth(fourLessons[idx].upper, heavenBoard, isZei);
    depths.set(idx, depth);
    trace.push(
      `涉害：第${idx + 1}课 ${DI_ZHI[fourLessons[idx].upper]} 深度=${depth}`
    );
  }

  const maxDepth = Math.max(...depths.values());
  const deepest = biyongArr.filter((idx) => depths.get(idx) === maxDepth);

  if (deepest.length === 1) {
    const idx = deepest[0];
    const initial = fourLessons[idx].upper;
    const { middle, final } = standardMiddleFinal(initial, heavenBoard);
    trace.push(`涉害：取最深层${idx + 1}，初传${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "涉害", trace };
  }

  // 深度相同 → 孟 > 仲 > 季
  const mengCandidates = deepest.filter((idx) => SI_MENG.has(fourLessons[idx].lower));
  const zhongCandidates = deepest.filter((idx) => SI_ZHONG.has(fourLessons[idx].lower));

  if (mengCandidates.length > 0 && mengCandidates.length < deepest.length) {
    // 见机格：取孟
    const idx = mengCandidates[0];
    const initial = fourLessons[idx].upper;
    const { middle, final } = standardMiddleFinal(initial, heavenBoard);
    trace.push(`涉害见机：取孟上神${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "涉害见机", trace };
  }

  if (zhongCandidates.length > 0 && zhongCandidates.length < deepest.length) {
    // 察微格：取仲
    const idx = zhongCandidates[0];
    const initial = fourLessons[idx].upper;
    const { middle, final } = standardMiddleFinal(initial, heavenBoard);
    trace.push(`涉害察微：取仲上神${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "涉害察微", trace };
  }

  // 缀瑕格：阳日取干上课，阴日取支上课
  const isYang = STEM_YIN_YANG[dayStem] === 1;
  const initial = isYang ? fourLessons[0].upper : fourLessons[2].upper;
  const { middle, final } = standardMiddleFinal(initial, heavenBoard);
  trace.push(`涉害缀瑕：${isYang ? "阳" : "阴"}日取${isYang ? "干" : "支"}上课${DI_ZHI[initial]}`);
  return { initial, middle, final, method: "涉害缀瑕", trace };
}

// ─── 遥克处理 ──────────────────────────────────────

function tryYaoke(
  fourLessons: FourLesson[],
  dayStem: number,
  _dayBranch: number,
  heavenBoard: number[],
  trace: string[]
): ThreeTransmissionsResult | null {
  const dayElem = stemElem(dayStem);
  const yaokeShangKeXia: number[] = []; // 四课上神克日干
  const yaokeXiaZeiShang: number[] = []; // 日干克四课上神

  for (let i = 0; i < 4; i++) {
    const lessonUpperElem = lessonUpperElement(fourLessons[i]);
    if (keOf(lessonUpperElem) === dayElem) {
      yaokeShangKeXia.push(i); // 上神克日干
    }
    if (keOf(dayElem) === lessonUpperElem) {
      yaokeXiaZeiShang.push(i); // 日干克上神
    }
  }

  const dayYY = STEM_YIN_YANG[dayStem];

  // 蒿矢：四课上神克日干
  if (yaokeShangKeXia.length > 0) {
    let initial: number;
    if (yaokeShangKeXia.length === 1) {
      initial = fourLessons[yaokeShangKeXia[0]].upper;
    } else {
      // 多个取与日干阴阳同者
      initial = fourLessons[yaokeShangKeXia[0]].upper;
      for (const idx of yaokeShangKeXia) {
        if (BRANCH_YIN_YANG[fourLessons[idx].upper] === dayYY) {
          initial = fourLessons[idx].upper;
          break;
        }
      }
    }
    const { middle, final } = standardMiddleFinal(initial, heavenBoard);
    trace.push(`蒿矢：上神遥克日干，初传${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "蒿矢", trace };
  }

  // 弹射：日干克四课上神
  if (yaokeXiaZeiShang.length > 0) {
    let initial: number;
    if (yaokeXiaZeiShang.length === 1) {
      initial = fourLessons[yaokeXiaZeiShang[0]].upper;
    } else {
      initial = fourLessons[yaokeXiaZeiShang[0]].upper;
      for (const idx of yaokeXiaZeiShang) {
        if (BRANCH_YIN_YANG[fourLessons[idx].upper] === dayYY) {
          initial = fourLessons[idx].upper;
          break;
        }
      }
    }
    const { middle, final } = standardMiddleFinal(initial, heavenBoard);
    trace.push(`弹射：日干遥克上神，初传${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "弹射", trace };
  }

  return null;
}

// ─── 昴星处理 ──────────────────────────────────────

function handleMaoxing(
  dayStem: number,
  _dayBranch: number,
  heavenBoard: number[],
  fourLessons: FourLesson[],
  trace: string[]
): ThreeTransmissionsResult {
  const isYang = STEM_YIN_YANG[dayStem] === 1;

  if (isYang) {
    // 虎视格：初传=地盘酉上神，中传=支上神，末传=干上神
    const initial = heavenBoard[9]; // 酉=9
    const middle = fourLessons[2].upper;
    const final = fourLessons[0].upper;
    trace.push(`昴星虎视：阳日取酉上神${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "昴星虎视", trace };
  } else {
    // 冬蛇掩目格：初传=天盘酉下神（天盘酉所在地盘位），中传=干上神，末传=支上神
    const youPos = heavenBoard.indexOf(9); // 天盘酉所在地盘位
    const initial = youPos;
    const middle = fourLessons[0].upper;
    const final = fourLessons[2].upper;
    trace.push(`昴星冬蛇掩目：阴日取酉下神${DI_ZHI[initial]}`);
    return { initial, middle, final, method: "昴星冬蛇掩目", trace };
  }
}

// ─── 别责处理 ──────────────────────────────────────

function handleBiezhe(
  dayStem: number,
  dayBranch: number,
  heavenBoard: number[],
  fourLessons: FourLesson[],
  trace: string[]
): ThreeTransmissionsResult {
  const isYang = STEM_YIN_YANG[dayStem] === 1;
  let initial: number;

  if (isYang) {
    // 阳日取干合上神：日干+5=合干（mod 10），取合干寄宫上的天盘支
    const heStem = (dayStem + 5) % 10;
    initial = heavenBoard[STEM_LODGING[heStem]];
    trace.push(`别责：阳日取干合(${DI_ZHI[STEM_LODGING[heStem]]})上神${DI_ZHI[initial]}`);
  } else {
    // 阴日取支冲前一位（三合）：日支+4=冲位（mod 12），此处实为支前三合
    initial = (dayBranch + 4) % 12;
    trace.push(`别责：阴日取支冲${DI_ZHI[initial]}`);
  }

  // 中末传均取干上神
  const middle = fourLessons[0].upper;
  const final = fourLessons[0].upper;
  return { initial, middle, final, method: "别责", trace };
}

// ─── 八专处理 ──────────────────────────────────────

function handleBazhuan(
  dayStem: number,
  _dayBranch: number,
  _heavenBoard: number[],
  fourLessons: FourLesson[],
  trace: string[]
): ThreeTransmissionsResult {
  const isYang = STEM_YIN_YANG[dayStem] === 1;
  let initial: number;

  if (isYang) {
    // 阳日：干上神顺数 2 位
    initial = (fourLessons[0].upper + 2) % 12;
    trace.push(`八专：阳日干上神顺数2位${DI_ZHI[initial]}`);
  } else {
    // 阴日：支上神（第四课上神）逆数 2 位
    initial = ((fourLessons[3].upper - 2) % 12 + 12) % 12;
    trace.push(`八专：阴日支上神逆数2位${DI_ZHI[initial]}`);
  }

  // 中末传均取干上神
  const middle = fourLessons[0].upper;
  const final = fourLessons[0].upper;

  const method = initial === middle && middle === final ? "八专独足" : "八专";
  if (method === "八专独足") {
    trace.push("独足：三传俱同");
  }

  return { initial, middle, final, method, trace };
}
