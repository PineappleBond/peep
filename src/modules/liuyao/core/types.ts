/**
 * 模組間 JSON 契約 — 精簡版
 * 保留核心六爻排盤型別：ChartJSON
 */

// ── 基礎術數型別 ──────────────────────────────────────────────

export type Stem =
  | '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';

export type Branch =
  | '子' | '丑' | '寅' | '卯' | '辰' | '巳'
  | '午' | '未' | '申' | '酉' | '戌' | '亥';

export type Element = '金' | '木' | '水' | '火' | '土';

export type Relative = '父母' | '兄弟' | '子孫' | '妻財' | '官鬼';

export type SixGod = '青龍' | '朱雀' | '勾陳' | '螣蛇' | '白虎' | '玄武';

export type Palace = '乾' | '兌' | '離' | '震' | '巽' | '坎' | '艮' | '坤';

export type HexType = '本宮' | '一世' | '二世' | '三世' | '四世' | '五世' | '遊魂' | '歸魂';

/** 起卦每爻輸入值：0 少陰、1 少陽、2 老陰、3 老陽 */
export type LineValue = 0 | 1 | 2 | 3;

/** 六爻卦象的六条爻线值（从初爻到上爻） */
export type SixLines = [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];

/** 旬空狀態 */
export type KongState = null | '逢空' | '填實' | '沖空';

// ── 排盤輸出：ChartJSON ──────────────────────────────────────

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
  /** 六親仍以本卦卦宮五行論 */
  rel: Relative;
}

export interface ChartJSON {
  name: string;
  palace: Palace;
  palaceElem: Element;
  type: HexType;
  /** 世/應爻位 1–6 */
  shi: number;
  ying: number;
  lines: ChartLine[];
  /** 無動爻時為 null */
  changed: { name: string; lines: ChangedLine[] } | null;
  month: { branch: Branch; elem: Element };
  day: {
    stem: Stem;
    branch: Branch;
    elem: Element;
    /** 旬空兩支 */
    kong: [Branch, Branch];
  };
}

/** 用神定位結果 */
export interface YongShen {
  rel: Relative;
  /** 上卦時的爻位；伏藏時為 null */
  pos: number | null;
  /** 多現時的選定理由 */
  pickedBy: '動爻' | '持世' | '初現' | null;
  /** 不上卦時：本宮首卦伏神資訊 */
  hidden: { under: number; stem: Stem; branch: Branch; elem: Element } | null;
}

/** 求測對象 → 決定用神六親 */
export type YongTarget = '自占' | '父母' | '子女' | '配偶' | '兄弟' | '醫藥';

// ── M2 輸入/輸出 ─────────────────────────────────────────────

export type ScenarioId =
  | 'marriage_female'
  | 'marriage_male'
  | 'wealth_business'
  | 'number_prediction'
  | 'career_official'
  | 'weekly_fortune'
  | 'lifetime_yearly'
  | 'education_exam'
  | 'pregnancy_children'
  | 'job_hunting'
  | 'illness_medicine'
  | 'traveler_return'
  | 'stock_futures'
  | 'travel_safety'
  | 'lawsuit'
  | 'message_contact'
  | 'home_fengshui'
  | 'lost_item'
  | 'misc_other';

export type IllnessDuration = '近病' | '久病';

export interface ScenarioContextField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
}

export interface RuleContext {
  scenario: ScenarioId;
  yongTarget: YongTarget;
  /** 場景專屬 context，如 illnessDuration */
  extras: Record<string, string>;
}

export type RuleCat =
  | '旺衰' | '生剋' | '合沖' | '空亡' | '墓' | '伏神' | '場景' | '用神链' | '應期';

export interface RuleHit {
  /** 規則庫 id，如 R-WW-01 */
  id: string;
  name: string;
  cat: RuleCat;
  /** 對評分的貢獻；資訊類規則為 0 */
  delta: number;
  /** 命中內容說明，如「月建午火生用神未土」 */
  detail: string;
  /** 典籍出處 */
  source: string;
  enabled: boolean;
  /** 供 UI 生剋動畫用：相關爻位（1–6；0 表月建/日辰等外部因素） */
  edges?: SkeEdge[];
  /** v1.3 爻位權重乘數（預設 1） */
  posWeight?: number;
}

/** 生剋連線（REQ-14 動畫消費，UI 不重複斷卦） */
export interface SkeEdge {
  /** 'month' | 'day' | 爻位 1–6；回頭生剋時 from === to */
  from: 'month' | 'day' | number;
  /** 爻位 1–6 */
  to: number;
  kind: '生' | '剋' | '沖' | '合' | '墓' | '比和';
  /** 來源規則 id（M2 RuleHit 對應，可點線定位側欄） */
  ruleId?: string;
  /** 對評分的 delta；資訊類為 undefined */
  delta?: number;
  /** 藥丸標籤文字，如「午火 生 +2.0」 */
  label?: string;
  /** 依序播放序號：0 月建 → 1 日辰 → 2 動爻 → 3 用神/其他 */
  order?: number;
}

/** v1.3 元神／忌神／仇神槽位 */
export interface ShenSlot {
  rel: Relative;
  elem: Element;
  positions: number[];
}

export interface ShenChain {
  yuan: ShenSlot;
  ji: ShenSlot;
  chou: ShenSlot;
}

export interface RuleEngineResult {
  yong: YongShen;
  hits: RuleHit[];
  /** 用神伏藏 → true，M3 暫停評分 */
  scoringSuspended: boolean;
  /** REQ-14：各爻點擊時的生剋連線（M2 唯一資料源，UI 不重複斷卦） */
  lineEdges: Record<number, SkeEdge[]>;
  /** v1.3 元神／忌神／仇神定位（用神不上卦時為 null） */
  shenChain: ShenChain | null;
}

// ── M3 輸出：ScoreJSON ───────────────────────────────────────

export type Grade = '吉' | '偏吉' | '平' | '偏凶' | '凶';

export interface ScoreBreakdownItem {
  ruleId: string;
  name: string;
  delta: number;
  contribution: number;
}

export interface ScoreJSON {
  /** 伏藏暫停評分時為 null（UI 顯示「—」） */
  total: number | null;
  grade: Grade | null;
  breakdown: ScoreBreakdownItem[];
}

// ── M4 場景定義（資料檔 schema） ─────────────────────────────

export interface ScenarioDef {
  scenarioId: ScenarioId;
  title: string;
  /** 評分卡標籤，如「康復傾向」 */
  scoreLabel: string;
  /** 場景專屬規則 id（REQ-11） */
  extraRules: string[];
  /** 場景專屬 UI context 欄位 */
  contextFields: ScenarioContextField[];
  /** FlowMap「場景語義」節點匹配的規則前綴 */
  flowMapRulePrefixes: string[];
  /** 場景加強版免責 */
  disclaimer: string;
}

// ── 規則庫資料檔 schema（§3） ────────────────────────────────

export interface RuleDef {
  id: string;
  cat: RuleCat;
  name: string;
  /** 權重說明；實際 delta 由引擎依命中情境給定 */
  weight: string;
  source: string;
  enabled: boolean;
}
