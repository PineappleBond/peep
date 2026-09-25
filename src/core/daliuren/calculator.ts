/**
 * 大六壬核心计算器
 *
 * 阶段二：在阶段一基础上增加九宗门三传和十二天将。
 */
import { Solar } from "lunar-typescript";
import {
  TIAN_GAN,
  DI_ZHI,
  STEM_LODGING,
  JIE_QI_NAMES,
  JIE_QI_TO_MONTH_GENERAL,
  MONTH_GENERAL_NAMES,
  XUN_HEAD,
  HOUR_TO_SHI_CHEN,
} from "./constants";
import type {
  DaLiuRenResult,
  FourLesson,
  FourPillars,
  HeavenEarthBoards,
  MonthGeneral,
  XunKong,
} from "./types";
import { calculateThreeTransmissions } from "./sanchuan";
import { calculateTwelveGenerals } from "./tianjiang";
import { getAllWangXiang } from "./wangshuai";
import { getAllLiuQin } from "./liuqin";
import { calculateXunDun, calculateRiDun } from "./dungan";
import { calculateShenSha } from "./shensha";
import { findBranchRelations } from "./relations";

// ─── 内部辅助 ────────────────────────────────────────────

/**
 * 由天干索引与地支索引计算六十甲子序号（0-59）。
 *
 * 六十甲子中，天干与地支满足：n ≡ stem (mod 10)，n ≡ branch (mod 12)。
 * 由 CRT 可得：n = (6 * stem - 5 * branch + 60) % 60。
 */
export function calculateSexagenaryIndex(stem: number, branch: number): number {
  return ((6 * stem - 5 * branch) % 60 + 60) % 60;
}

/**
 * 小时 → 时辰地支索引（0-11 对应子至亥）。
 * 23、0 时 → 子时(0)；1、2 时 → 丑时(1)；……21、22 时 → 亥时(11)。
 */
export function hourToBranch(hour: number): number {
  return HOUR_TO_SHI_CHEN[Math.floor(((hour % 24) + 24) % 24)];
}

// ─── 四柱 ────────────────────────────────────────────

/**
 * 根据公历时间计算四柱（年月日时干支）。
 *
 * 使用 lunar-typescript 的 Lunar 类（默认 sect=2，以正月初一换年柱；
 * 23 时按次日早子时计）。
 */
export function calculateFourPillars(solar: Solar): FourPillars {
  const lunar = solar.getLunar();

  const yearStem = lunar.getYearGanIndex();
  const yearBranch = lunar.getYearZhiIndex();
  const monthStem = lunar.getMonthGanIndex();
  const monthBranch = lunar.getMonthZhiIndex();
  const dayStem = lunar.getDayGanIndex();
  const dayBranch = lunar.getDayZhiIndex();
  const hourStem = lunar.getTimeGanIndex();
  const hourBranch = lunar.getTimeZhiIndex();

  const fmt = (s: number, b: number) => TIAN_GAN[s] + DI_ZHI[b];

  return {
    yearStem,
    yearBranch,
    monthStem,
    monthBranch,
    dayStem,
    dayBranch,
    hourStem,
    hourBranch,
    yearPillar: fmt(yearStem, yearBranch),
    monthPillar: fmt(monthStem, monthBranch),
    dayPillar: fmt(dayStem, dayBranch),
    hourPillar: fmt(hourStem, hourBranch),
  };
}

// ─── 月将 ────────────────────────────────────────────

/**
 * 根据公历时间计算月将（中气换将）。
 *
 * 遍历全年节气时刻，找到目标时刻之前最近的一个节气，
 * 按该节气在 24 节气中的索引查表得到月将。
 */
export function calculateMonthGeneral(solar: Solar): MonthGeneral {
  const lunar = solar.getLunar();
  const jieqiTable = lunar.getJieQiTable();

  // 目标时刻（毫秒时间戳）
  const targetMs = new Date(
    solar.getYear(),
    solar.getMonth() - 1,
    solar.getDay(),
    solar.getHour(),
    solar.getMinute(),
    solar.getSecond()
  ).getTime();

  // 找到 targetMs 之前（含）最近的节气
  let lastJieQiIdx = 23; // 默认大雪（年末）
  for (let i = 23; i >= 0; i--) {
    const jqSolar = jieqiTable[JIE_QI_NAMES[i]];
    if (!jqSolar) continue;
    const jqMs = new Date(
      jqSolar.getYear(),
      jqSolar.getMonth() - 1,
      jqSolar.getDay(),
      jqSolar.getHour(),
      jqSolar.getMinute(),
      jqSolar.getSecond()
    ).getTime();
    if (jqMs <= targetMs) {
      lastJieQiIdx = i;
      break;
    }
  }

  const branch = JIE_QI_TO_MONTH_GENERAL[lastJieQiIdx];
  return { branch, name: MONTH_GENERAL_NAMES[branch] };
}

// ─── 天地盘 ────────────────────────────────────────────

/**
 * 月将加时：天盘 = 地盘 + (月将 - 时支) mod 12。
 *
 * 地盘固定为子至亥（0-11）；天盘为月将加临时支后的旋转结果。
 * 验证：heaven[hourBranch] = monthGeneral。
 */
export function buildHeavenEarthBoards(
  monthGeneralBranch: number,
  hourBranch: number
): HeavenEarthBoards {
  const earth: number[] = [];
  const heaven: number[] = [];
  const offset = ((monthGeneralBranch - hourBranch) % 12 + 12) % 12;
  for (let i = 0; i < 12; i++) {
    earth.push(i);
    heaven.push((i + offset) % 12);
  }
  return { earth, heaven };
}

// ─── 四课 ────────────────────────────────────────────

/**
 * 提取四课。
 *
 * 大六壬以日干、日支为基：
 * - 第一课：日干（寄宫地盘）→ 天盘上神
 * - 第二课：第一课上神所在地盘 → 天盘上神
 * - 第三课：日支（地盘）→ 天盘上神
 * - 第四课：第三课上神所在地盘 → 天盘上神
 */
export function extractFourLessons(
  dayStem: number,
  dayBranch: number,
  heavenBoard: number[]
): FourLesson[] {
  // 第一课：日干寄宫为下，天盘对应支为上
  const stemLodging = STEM_LODGING[dayStem];
  const lesson1Upper = heavenBoard[stemLodging];

  // 第二课：第一课上神所在地盘 → 天盘
  const lesson2Upper = heavenBoard[lesson1Upper];

  // 第三课：日支为下，天盘对应支为上
  const lesson3Upper = heavenBoard[dayBranch];

  // 第四课：第三课上神所在地盘 → 天盘
  const lesson4Upper = heavenBoard[lesson3Upper];

  return [
    { upper: lesson1Upper, lower: stemLodging, lowerType: "stem" },
    { upper: lesson2Upper, lower: lesson1Upper, lowerType: "branch" },
    { upper: lesson3Upper, lower: dayBranch, lowerType: "branch" },
    { upper: lesson4Upper, lower: lesson3Upper, lowerType: "branch" },
  ];
}

// ─── 旬空 ────────────────────────────────────────────

/**
 * 计算日柱旬空。
 *
 * 六十甲子分六旬（每旬 10 日），旬首为甲*，旬空为本旬 10 支之外余下的 2 支。
 * 例：甲子旬（子→亥缺戌亥），戌亥即空亡。
 */
export function calculateXunKong(dayStem: number, dayBranch: number): XunKong {
  const sexagenaryIndex = calculateSexagenaryIndex(dayStem, dayBranch);
  const xunIdx = Math.floor(sexagenaryIndex / 10); // 第几旬（0-5）
  const xunHead = XUN_HEAD[xunIdx]; // 旬首地支

  // 空亡 = 旬首 + 10、旬首 + 11（mod 12）
  const void1 = (xunHead + 10) % 12;
  const void2 = (xunHead + 11) % 12;

  return { xunHead, void1, void2 };
}

// ─── 主入口 ────────────────────────────────────────────

/**
 * 大六壬排盘（阶段三）
 *
 * @param dateStr 公历日期（YYYY-MM-DD 或 YYYY/MM/DD）
 * @param timeStr 时间（HH:mm 或 HH:mm:ss）
 * @returns 完整盘面数据（四柱、月将、天地盘、四课、旬空、三传、天将、旺衰、六亲、遁干、神煞、刑冲破害）
 */
export function calculateDaLiuRen(
  dateStr: string,
  timeStr: string
): DaLiuRenResult {
  // 解析时间
  const [year, month, day] = dateStr.split(/[\/-]/).map(Number);
  const timeParts = timeStr.split(":").map(Number);
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  const second = timeParts[2] ?? 0;

  // 构造 Solar 对象
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second);

  // 四柱
  const fourPillars = calculateFourPillars(solar);

  // 月将（中气换将）
  const monthGeneral = calculateMonthGeneral(solar);

  // 天地盘（月将加占时）
  const boards = buildHeavenEarthBoards(
    monthGeneral.branch,
    fourPillars.hourBranch
  );

  // 四课
  const fourLessons = extractFourLessons(
    fourPillars.dayStem,
    fourPillars.dayBranch,
    boards.heaven
  );

  // 旬空
  const xunKong = calculateXunKong(
    fourPillars.dayStem,
    fourPillars.dayBranch
  );

  // 三传（九宗门）
  const threeTransmissions = calculateThreeTransmissions(
    fourLessons,
    fourPillars.dayStem,
    fourPillars.dayBranch,
    boards.heaven
  );

  // 十二天将
  const twelveGenerals = calculateTwelveGenerals(
    fourPillars.dayStem,
    fourPillars.hourBranch,
    boards.heaven,
    boards.earth
  );

  // 旺相休囚死（按天盘每个地支判断）
  const wangXiang = getAllWangXiang(fourPillars.monthBranch);

  // 六亲（按天盘每个地支判断）
  const liuQin = getAllLiuQin(fourPillars.dayStem);

  // 旬遁
  const xunDunMap = calculateXunDun(
    fourPillars.dayStem,
    fourPillars.dayBranch,
    boards.heaven
  );
  const xunDun: Record<number, string> = {};
  xunDunMap.forEach((v, k) => {
    xunDun[k] = v;
  });

  // 日遁（五子元遁）
  const riDun = calculateRiDun(fourPillars.dayStem);

  // 神煞
  const shenSha = calculateShenSha(
    fourPillars.yearBranch,
    fourPillars.monthBranch,
    fourPillars.dayStem,
    fourPillars.dayBranch,
    fourPillars.hourBranch
  );

  // 刑冲破害（四课 + 三传的所有地支）
  const allBranches = [
    ...fourLessons.map((l) => l.upper),
    ...fourLessons.map((l) => l.lower),
    threeTransmissions.initial,
    threeTransmissions.middle,
    threeTransmissions.final,
  ];
  const relations = findBranchRelations(allBranches);

  // 格式化时间
  const pad = (n: number) => String(n).padStart(2, "0");
  const calculationTime = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;

  // 合并追踪记录
  const calculationTrace = [
    ...threeTransmissions.trace,
    `天将: ${twelveGenerals.map((g) => g.name).join(",")}`,
  ];

  return {
    calculationTime,
    fourPillars,
    monthGeneral,
    earthBoard: boards.earth,
    heavenBoard: boards.heaven,
    fourLessons,
    xunKong,
    threeTransmissions,
    twelveGenerals,
    wangXiang,
    liuQin,
    xunDun,
    riDun,
    shenSha,
    relations,
    calculationTrace,
  };
}
