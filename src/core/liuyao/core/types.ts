/**
 * 模块间 JSON 契约 —— 精简版
 * 保留核心六爻排盘类型：ChartJSON
 */

// ── 基础术数类型 ──────────────────────────────────────────────

export type Stem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";

export type Branch =
  "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";

export type Element = "金" | "木" | "水" | "火" | "土";

export type Relative = "父母" | "兄弟" | "子孙" | "妻财" | "官鬼";

export type SixGod = "青龙" | "朱雀" | "勾陈" | "螣蛇" | "白虎" | "玄武";

export type Palace = "乾" | "兑" | "离" | "震" | "巽" | "坎" | "艮" | "坤";

export type HexType = "本宫" | "一世" | "二世" | "三世" | "四世" | "五世" | "游魂" | "归魂";

/** 起卦每爻输入值：0 少阴、1 少阳、2 老阴、3 老阳 */
export type LineValue = 0 | 1 | 2 | 3;

/** 六爻卦象的六条爻线值（从初爻到上爻） */
export type SixLines = [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];

/** 旬空状态 */
export type KongState = null | "逢空" | "填实" | "冲空";

/** 旺衰状态 */
export type VigorState = "旺" | "相" | "休" | "囚" | "死";

// ── 排盘输出：ChartJSON ──────────────────────────────────────

export interface ChartLine {
  /** 爻位 1（初爻）～6（上爻） */
  pos: 1 | 2 | 3 | 4 | 5 | 6;
  yang: boolean;
  moving: boolean;
  stem: Stem;
  branch: Branch;
  elem: Element;
  rel: Relative;
  god: SixGod;
  kong: boolean;
  kongState: KongState;
}

export interface ChangedLine {
  pos: 1 | 2 | 3 | 4 | 5 | 6;
  yang: boolean;
  stem: Stem;
  branch: Branch;
  elem: Element;
  /** 六亲仍以本卦卦宫五行论 */
  rel: Relative;
}

export interface ChartJSON {
  name: string;
  palace: Palace;
  palaceElem: Element;
  type: HexType;
  /** 世/应爻位 1–6 */
  shi: number;
  ying: number;
  lines: ChartLine[];
  /** 无动爻时为 null */
  changed: { name: string; lines: ChangedLine[] } | null;
  month: { branch: Branch; elem: Element };
  day: {
    stem: Stem;
    branch: Branch;
    elem: Element;
    /** 旬空两支 */
    kong: [Branch, Branch];
  };
}

/** 用神定位结果 */
export interface YongShen {
  rel: Relative;
  /** 上卦时的爻位；伏藏时为 null */
  pos: number | null;
  /** 多现时的选定理由 */
  pickedBy: "动爻" | "持世" | "初现" | null;
  /** 不上卦时：本宫首卦伏神信息 */
  hidden: { under: number; stem: Stem; branch: Branch; elem: Element } | null;
}

/** 求测对象 → 决定用神六亲 */
export type YongTarget = "自占" | "父母" | "子女" | "配偶" | "兄弟" | "医药";

// ── 排盘输入 ─────────────────────────────────────────────────

export interface ChartInput {
  lines: SixLines;
  date: string; // YYYY-MM-DD
  /** 月建覆写（节气交界日手动修正） */
  monthBranchOverride?: Branch;
  /** 日柱覆写（节气交界日手动修正） */
  dayGanzhiOverride?: string;
}
