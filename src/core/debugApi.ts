/**
 * 调试 API 统一管理：window.peep 接口
 * 供自动化测试和控制台调试使用
 */
import { getChartDataForScope, type ScopeChartData } from "./analysis";
import type { Scope } from "./utils";
import type { Zwds } from "./useZwds";
import type { Person } from "./personDb";
import { buildHbarData, type HbarData } from "./hbar";
import { calculateDaLiuRen } from "./daliuren/calculator";
import type { DaLiuRenResult } from "./daliuren/types";

/** 运限级别 */
export type ScopeName = "decadal" | "yearly" | "monthly" | "daily" | "hourly";

/** ZiWei 返回数据 */
export type ZiWeiResult = {
  person: Person | null;
  /** 运限拨盘完整数据（含大运/流年/流月/流日/流时列表） */
  hbar: HbarData & { visible: Record<Scope, boolean> };
  chart: ScopeChartData | null;
};

/** React 回调注册：从 App.tsx 注入 */
let _selectPerson: ((personId: number) => Promise<void>) | null = null;
let _getZwds: (() => Zwds | null) | null = null;
let _getPerson: (() => Person | null) | null = null;

/** 注册 React 回调（App.tsx 初始化时调用） */
export function registerDebugApi(opts: {
  selectPerson?: (personId: number) => Promise<void>;
  getZwds?: () => Zwds | null;
  getPerson?: () => Person | null;
}) {
  if (opts.selectPerson) _selectPerson = opts.selectPerson;
  if (opts.getZwds) _getZwds = opts.getZwds;
  if (opts.getPerson) _getPerson = opts.getPerson;
}

/**
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据
 *
 * 执行顺序：
 * 1. 切换人物（等待 astrolabe 重新计算完成）
 * 2. 设置时间（在 pick 被 useEffect 重置为"今天"之后）
 * 3. 设置运限级别（只显示目标 scope）
 * 4. 等待所有状态更新完成
 *
 * @param personId 人物 ID
 * @param scope 运限级别（decadal/yearly/monthly/daily/hourly）
 * @param time 可选时间参数（Date 或时间戳），用于设置运限时间
 */
export async function ZiWei(
  personId: number,
  scope?: ScopeName,
  time?: Date | number | string
): Promise<ZiWeiResult> {
  if (!_selectPerson || !_getZwds || !_getPerson) {
    throw new Error("调试 API 未初始化，请确认 App 已加载");
  }

  // 1. 切换人物（操控 UI）
  await _selectPerson(personId);

  // 等待 astrolabe 重新计算 + useEffect 重置 pick 完成
  await new Promise((r) => setTimeout(r, 100));

  const z = _getZwds();
  if (!z) {
    throw new Error("排盘数据未就绪");
  }

  // 2. 设置时间（在 useEffect 重置之后）
  if (time) {
    const date = parseDate(time);
    if (isNaN(date.getTime())) {
      throw new Error(`无法解析时间：${time}`);
    }
    setHoroscopeTime(z, date);
  }

  // 3. 设置运限级别（只显示目标 scope，其他全部关闭）
  if (scope) {
    z.actions.showScope(scope);
  }

  // 4. 等待所有状态更新完成（双 rAF 确保渲染完成）
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // 5. 获取数据
  const person = _getPerson();
  const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
  const hbar = hbarBase
    ? { ...hbarBase, visible: { ...z.visible } }
    : { visible: { ...z.visible } } as any;

  let chart: ScopeChartData | null = null;
  if (scope && z.astrolabe && z.horoscope) {
    chart = getChartDataForScope({
      astrolabe: z.astrolabe,
      horoscope: z.horoscope,
      scope,
    });
  }

  return { person, hbar, chart };
}

/** 解析时间：支持 Date/数字/字符串（含 "2024-06-15 12" 这种简写） */
function parseDate(time: Date | number | string): Date {
  if (time instanceof Date) return time;
  if (typeof time === "number") return new Date(time);
  // 字符串：尝试补全时间部分
  let str = time.trim();
  // "2024-06-15 12" → "2024-06-15 12:00:00"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}$/.test(str)) {
    str += ":00:00";
  }
  // "2024-06-15" → "2024-06-15 00:00:00"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str += " 00:00:00";
  }
  return new Date(str);
}

/** 设置运限时间：根据 Date 设置年月日时 */
function setHoroscopeTime(z: Zwds, date: Date): void {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 转换为时辰索引（0-11）
  const hourIdx = Math.floor(((hour + 1) % 24) / 2);

  z.actions.pickYear(year);
  z.actions.pickMonth(month, false);
  z.actions.pickDay(day);
  z.actions.pickHour(hourIdx);
}

/**
 * 大六壬排盘调试接口
 *
 * @param date 公历日期（YYYY-MM-DD）
 * @param time 时间（HH:mm 或 HH:mm:ss）
 * @param fateInput 可选：生年与性别
 */
export function DaLiuRen(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" }
): DaLiuRenResult {
  return calculateDaLiuRen(date, time, fateInput);
}

/** 初始化 window.peep（仅在开发环境） */
export function initDebugApi() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;

  (window as any).peep = {
    ZiWei,
    DaLiuRen,
    getChartDataForScope,
  };
}
