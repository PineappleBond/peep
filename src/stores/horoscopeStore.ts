import { create } from "zustand";
import type { DaYun, LiuNian, LiuYue, LiuRi, LiuShi } from "@/modules/shared/horoscope";
import { lsGet, lsSet, STORAGE_KEYS } from "@/lib/utils";

export type HoroscopeLevel = "dayun" | "liunian" | "liuyue" | "liuri" | "liushi";

const STORAGE_KEY = STORAGE_KEYS.HOROSCOPE_STORE;

/**
 * 运限层级顺序（从粗到细），用于级联清空下级选择。
 *
 * 选择某一层时，其下级（更细粒度）全部清空。
 */
const LEVEL_ORDER: HoroscopeLevel[] = ["dayun", "liunian", "liuyue", "liuri", "liushi"];

interface HoroscopeValues {
  dayun: DaYun | null;
  liunian: LiuNian | null;
  liuyue: LiuYue | null;
  liuri: LiuRi | null;
  liushi: LiuShi | null;
}

interface HoroscopeState extends HoroscopeValues {
  /** 当前激活的时间维度 */
  activeLevel: HoroscopeLevel;

  /** 更新方法 */
  setActiveLevel: (level: HoroscopeLevel) => void;
  setDayun: (dayun: DaYun | null) => void;
  setLiunian: (liunian: LiuNian | null) => void;
  setLiuyue: (liuyue: LiuYue | null) => void;
  setLiuri: (liuri: LiuRi | null) => void;
  setLiushi: (liushi: LiuShi | null) => void;

  /** 重置所有选择 */
  reset: () => void;

  /** 获取当前选择的路径摘要 */
  getPathSummary: () => string[];
}

/** 从 localStorage 读取持久化状态 */
function loadPersistedState(): Partial<HoroscopeState> {
  return lsGet<Partial<HoroscopeState>>(STORAGE_KEY, {});
}

/** 持久化状态到 localStorage */
function persistState(state: HoroscopeState) {
  const toSave = {
    activeLevel: state.activeLevel,
    dayun: state.dayun,
    liunian: state.liunian,
    liuyue: state.liuyue,
    liuri: state.liuri,
    liushi: state.liushi,
  };
  lsSet(STORAGE_KEY, toSave);
}

/**
 * 生成"设置某一层级并清空其下级"的 partial state
 *
 * 例：setLevelAndClearChildren("liunian", ln) 会设置 liunian=ln，
 *     并清空 liuyue/liuri/liushi。
 */
function setLevelAndClearChildren<K extends HoroscopeLevel>(
  level: K,
  value: HoroscopeValues[K],
): Partial<HoroscopeValues> {
  const idx = LEVEL_ORDER.indexOf(level);
  const result: Partial<HoroscopeValues> = { [level]: value };
  // 清空该层级之后的所有子级
  for (let i = idx + 1; i < LEVEL_ORDER.length; i++) {
    result[LEVEL_ORDER[i]] = null;
  }
  return result;
}

const persisted = loadPersistedState();

export const useHoroscopeStore = create<HoroscopeState>((set, get) => ({
  activeLevel: persisted.activeLevel ?? "dayun",
  dayun: persisted.dayun ?? null,
  liunian: persisted.liunian ?? null,
  liuyue: persisted.liuyue ?? null,
  liuri: persisted.liuri ?? null,
  liushi: persisted.liushi ?? null,

  setActiveLevel: (level) => {
    set({ activeLevel: level });
    persistState(get());
  },

  setDayun:    (v) => { set(setLevelAndClearChildren("dayun", v));    persistState(get()); },
  setLiunian:  (v) => { set(setLevelAndClearChildren("liunian", v));  persistState(get()); },
  setLiuyue:   (v) => { set(setLevelAndClearChildren("liuyue", v));   persistState(get()); },
  setLiuri:    (v) => { set(setLevelAndClearChildren("liuri", v));    persistState(get()); },
  setLiushi:   (v) => { set(setLevelAndClearChildren("liushi", v));   persistState(get()); },

  reset: () => {
    set({
      activeLevel: "dayun",
      dayun: null, liunian: null, liuyue: null, liuri: null, liushi: null,
    });
    persistState(get());
  },

  getPathSummary: () => {
    const { dayun, liunian, liuyue, liuri, liushi } = get();
    const summary: string[] = [];

    if (dayun) {
      summary.push(`${dayun.startAge}-${dayun.startAge + 9}岁 ${dayun.tianGan}${dayun.diZhi}`);
    }
    if (liunian) {
      summary.push(`${liunian.year}年 ${liunian.tianGan}${liunian.diZhi}`);
    }
    if (liuyue) {
      summary.push(`${liuyue.month}月 ${liuyue.tianGan}${liuyue.diZhi}`);
    }
    if (liuri) {
      summary.push(`${liuri.day}日 ${liuri.tianGan}${liuri.diZhi}`);
    }
    if (liushi) {
      summary.push(`${liushi.label} ${liushi.tianGan}${liushi.diZhi}`);
    }

    return summary;
  },
}));
