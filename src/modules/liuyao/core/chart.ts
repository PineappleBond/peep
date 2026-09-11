import type {
  Branch, ChangedLine, ChartJSON, ChartLine, Element, KongState, LineValue, Relative, Stem,
  YongShen, YongTarget,
} from './types';
import {
  BRANCH_CHONG, BRANCH_ELEM, BRANCH_HE, ELEM_GEN, NAJIA, PALACE_ELEM, SIX_GODS, TRIGRAMS, relativeOf, sixGodStart,
} from './constants';
import { dayGanzhi, monthBranch, xunKong } from './calendar';
import { palaceInfo, trigramOf, hexName, type Bits } from './palace';

export interface ChartInput {
  /** 六爻由下而上：0 少陰 1 少陽 2 老陰 3 老陽 */
  lines: [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  /** ISO 日期 yyyy-mm-dd */
  date: string;
  /** 手動覆寫月建（節氣邊界日用） */
  monthBranchOverride?: Branch;
  /** 手動覆寫日柱，如 '甲子' */
  dayGanzhiOverride?: string;
}

function isYang(v: LineValue): boolean {
  return v === 1 || v === 3;
}

function isMoving(v: LineValue): boolean {
  return v === 2 || v === 3;
}

/** v1.3 應期初版：旬空爻的填實／冲空判定 */
function kongStateOf(
  branch: Branch,
  elem: Element,
  dayBranch: Branch,
  dayElem: Element,
  isKong: boolean,
): KongState {
  if (!isKong) return null;
  if (BRANCH_CHONG[dayBranch] === branch) return '沖空';
  if (BRANCH_HE[dayBranch] === branch || ELEM_GEN[dayElem] === elem || dayElem === elem) {
    return '填實';
  }
  return '逢空';
}

/** 對一個六爻卦裝干支（依內外卦分別查納甲表） */
function najiaOf(bits: Bits): { stem: Stem; branch: Branch }[] {
  const lower = trigramOf(bits.slice(0, 3)).name;
  const upper = trigramOf(bits.slice(3, 6)).name;
  const result: { stem: Stem; branch: Branch }[] = [];
  for (let i = 0; i < 3; i++) {
    const [stem, branch] = NAJIA[lower].inner[i];
    result.push({ stem, branch });
  }
  for (let i = 0; i < 3; i++) {
    const [stem, branch] = NAJIA[upper].outer[i];
    result.push({ stem, branch });
  }
  return result;
}

/** M1 排盤引擎：輸入起卦資料，輸出 ChartJSON 契約 */
export function buildChart(input: ChartInput): ChartJSON {
  const [y, m, d] = input.date.split('-').map(Number);

  const day = input.dayGanzhiOverride
    ? { stem: input.dayGanzhiOverride[0] as Stem, branch: input.dayGanzhiOverride[1] as Branch }
    : dayGanzhi(y, m, d);
  const kong = xunKong(day.stem, day.branch);
  const mBranch = input.monthBranchOverride ?? monthBranch(y, m, d);

  const bits = input.lines.map((v) => (isYang(v) ? 1 : 0)) as Bits;
  const info = palaceInfo(bits);
  const palaceElem = PALACE_ELEM[info.palace];
  const ganzhi = najiaOf(bits);
  const godStart = sixGodStart(day.stem);

  const dayElem = BRANCH_ELEM[day.branch];

  const lines: ChartLine[] = input.lines.map((v, i) => {
    const { stem, branch } = ganzhi[i];
    const elem = BRANCH_ELEM[branch];
    const isKong = kong.includes(branch);
    return {
      pos: (i + 1) as ChartLine['pos'],
      yang: isYang(v),
      moving: isMoving(v),
      stem,
      branch,
      elem,
      rel: relativeOf(palaceElem, elem),
      god: SIX_GODS[(godStart + i) % 6],
      kong: isKong,
      kongState: kongStateOf(branch, elem, day.branch, dayElem, isKong),
    };
  });

  let changed: ChartJSON['changed'] = null;
  if (lines.some((l) => l.moving)) {
    const changedBits = bits.map((b, i) => (lines[i].moving ? (b ? 0 : 1) : b)) as Bits;
    const changedGanzhi = najiaOf(changedBits);
    const changedLines: ChangedLine[] = changedBits.map((b, i) => {
      const { stem, branch } = changedGanzhi[i];
      const elem = BRANCH_ELEM[branch];
      return {
        pos: (i + 1) as ChangedLine['pos'],
        yang: b === 1,
        stem,
        branch,
        elem,
        rel: relativeOf(palaceElem, elem),
      };
    });
    changed = { name: hexName(changedBits), lines: changedLines };
  }

  return {
    name: info.name,
    palace: info.palace,
    palaceElem,
    type: info.type,
    shi: info.shi,
    ying: info.ying,
    lines,
    changed,
    month: { branch: mBranch, elem: BRANCH_ELEM[mBranch] },
    day: { ...day, elem: BRANCH_ELEM[day.branch], kong },
  };
}

/** 搖卦：三枚銅錢機率模型 */
export function tossLine(rng: () => number = Math.random): LineValue {
  let headsCount = 0;
  for (let i = 0; i < 3; i++) if (rng() < 0.5) headsCount++;
  switch (headsCount) {
    case 3: return 3;
    case 0: return 2;
    case 2: return 0;
    default: return 1;
  }
}

export function tossHexagram(rng: () => number = () => Math.random()): ChartInput['lines'] {
  return [tossLine(rng), tossLine(rng), tossLine(rng), tossLine(rng), tossLine(rng), tossLine(rng)];
}

/** 由 yongTarget 決定用神六親 */
function yongRelOf(yongTarget: YongTarget, chart: ChartJSON): Relative {
  switch (yongTarget) {
    case '自占': return chart.lines[chart.shi - 1].rel;
    case '父母': return '父母';
    case '子女': return '子孫';
    case '配偶': return '妻財';
    case '兄弟': return '兄弟';
    case '醫藥': return '子孫';
  }
}

/** 定位用神：在六爻中找對應六親，多現時優先動爻、持世 */
export function locateYong(chart: ChartJSON, yongTarget: YongTarget): YongShen {
  const rel = yongRelOf(yongTarget, chart);
  const candidates = chart.lines.filter((l) => l.rel === rel);

  if (candidates.length === 0) {
    // 用神不上卦，查本宮首卦伏神
    const tri = TRIGRAMS.find((t) => t.name === chart.palace)!;
    const pureGanzhi = [...NAJIA[tri.name].inner, ...NAJIA[tri.name].outer];
    for (let i = 0; i < 6; i++) {
      const [stem, branch] = pureGanzhi[i];
      const elem = BRANCH_ELEM[branch];
      if (relativeOf(chart.palaceElem, elem) === rel) {
        return { rel, pos: null, pickedBy: null, hidden: { under: i + 1, stem, branch, elem } };
      }
    }
    return { rel, pos: null, pickedBy: null, hidden: null };
  }

  if (candidates.length === 1) {
    return { rel, pos: candidates[0].pos, pickedBy: null, hidden: null };
  }
  const moving = candidates.find((l) => l.moving);
  if (moving) return { rel, pos: moving.pos, pickedBy: '動爻', hidden: null };
  const onShi = candidates.find((l) => l.pos === chart.shi);
  if (onShi) return { rel, pos: onShi.pos, pickedBy: '持世', hidden: null };
  return { rel, pos: candidates[0].pos, pickedBy: '初現', hidden: null };
}
