/**
 * 调试 API 统一管理：window.peep 接口
 * 供自动化测试和控制台调试使用
 */
import { getChartDataForScope, type ScopeChartData } from "./analysis";
import type { Scope } from "./utils";
import type { Zwds } from "./useZwds";
import type { Person } from "./personDb";

/** 运限级别 */
export type ScopeName = "decadal" | "yearly" | "monthly" | "daily" | "hourly";

/** ZiWei 返回数据 */
export type ZiWeiResult = {
  person: Person | null;
  hbar: {
    visible: Record<Scope, boolean>;
    pick: { year: number; month: number; day: number; hour: number };
    activeDecadeIdx: number;
  };
  chart: ScopeChartData | null;
};

/** React 回调注册：从 App.tsx 注入 */
let _selectPerson: ((personId: number) => Promise<void>) | null = null;
let _getZwds: (() => Zwds | null) | null = null;
let _getPerson: (() => Person | null) | null = null;

/** 注册 React 回调（App.tsx 初始化时调用） */
export function registerDebugApi(opts: {
  selectPerson: (personId: number) => Promise<void>;
  getZwds: () => Zwds | null;
  getPerson: () => Person | null;
}) {
  _selectPerson = opts.selectPerson;
  _getZwds = opts.getZwds;
  _getPerson = opts.getPerson;
}

/**
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据
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

  const z = _getZwds();
  if (!z) {
    throw new Error("排盘数据未就绪");
  }

  // 2. 设置运限级别（操控 UI：只显示目标 scope，其他全部关闭）
  if (scope) {
    z.actions.showScope(scope);

    // 设置时间
    if (time) {
      const date = typeof time === "string" || typeof time === "number" ? new Date(time) : time;
      setHoroscopeTime(z, date);
    }

    // 等待 React 状态更新完成
    await new Promise((r) => requestAnimationFrame(r));
  }

  // 3. 获取数据
  const person = _getPerson();
  const hbar = {
    visible: { ...z.visible },
    pick: { ...z.pick },
    activeDecadeIdx: z.activeDecadeIdx,
  };

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

/** 初始化 window.peep（仅在开发环境） */
export function initDebugApi() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;

  (window as any).peep = {
    ZiWei,
    getChartDataForScope,
  };
}
