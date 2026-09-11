import { create } from "zustand";
import type {
  ScenarioId,
  SixLines,
} from "@/modules/liuyao";
import { defaultExtrasFor, scenarioOf } from "@/modules/liuyao/core/scenarios/newRegistry";

interface LiuyaoState {
  /** 当前起卦数据 */
  lines: SixLines;
  date: string;
  scenarioId: ScenarioId;
  /** 用神目标（手动输入） */
  yongTarget: string;
  /** 场景专属 context，如 illnessDuration */
  extras: Record<string, string>;
  /** 占事问题 */
  question: string;
  /** 背景信息 */
  background: string;

  // Actions
  setLines: (lines: SixLines) => void;
  setDate: (date: string) => void;
  setScenarioId: (id: ScenarioId) => void;
  setYongTarget: (t: string) => void;
  setExtras: (extras: Record<string, string>) => void;
  setQuestion: (q: string) => void;
  setBackground: (b: string) => void;
}

/** 返回当前日期的 ISO 格式字符串（YYYY-MM-DD） */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const useLiuyaoStore = create<LiuyaoState>((set) => ({
  lines: [1, 1, 1, 0, 0, 0],
  date: todayISO(),
  scenarioId: "illness_medicine",
  yongTarget: "自占",
  extras: defaultExtrasFor(scenarioOf("illness_medicine")),
  question: "",
  background: "",

  setLines: (lines) => set({ lines }),
  setDate: (date) => set({ date }),
  setScenarioId: (id) => {
    const def = scenarioOf(id);
    set({
      scenarioId: id,
      extras: defaultExtrasFor(def),
    });
  },
  setYongTarget: (t) => set({ yongTarget: t }),
  setExtras: (extras) => set({ extras }),
  setQuestion: (q) => set({ question: q }),
  setBackground: (b) => set({ background: b }),
}));
