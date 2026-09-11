import { create } from "zustand";
import { calculateBazi, type BaziResult } from "@/modules/bazi/core";
import { LocalChartAdapter } from "@/modules/bazi/core/LocalChartAdapter";
import type { BaziInput } from "@/modules/bazi/types";

interface BaziState {
  /** 当前排盘结果（旧格式，向后兼容） */
  currentResult: BaziResult | null;
  /** 当前输入 */
  currentInput: BaziInput | null;
  /** 真一式排盘数据（LocalChartAdapter 输出，包含十神、神煞、大运等详细信息） */
  // TODO: 当 LocalChartAdapter 完成类型化后，替换为具体类型
  chartData: Record<string, unknown> | null;
  /** 错误信息 */
  error: string | null;

  /** 执行排盘（失败时设置 error 状态并返回 null，不抛出异常） */
  doChart: (input: BaziInput) => BaziResult | null;
  /** 清除当前结果 */
  clearResult: () => void;
  /** 设置错误 */
  setError: (error: string | null) => void;
}

/**
 * 将 computeShenSha 的 main 结果转为按柱位分组的神煞名列表
 * main: [{name, matches: [{target_pillar, ...}]}, ...]
 * => { year: ["天乙贵人", ...], month: [...], day: [...], hour: [...] }
 */
function groupShenShaByPillar(shenShaResult: {
  main?: Array<{ name: string; matches?: Array<{ target_pillar?: string }> }>;
}): Record<string, string[]> {
  const out: Record<string, string[]> = { year: [], month: [], day: [], hour: [] };
  const pillarMap: Record<string, string> = {
    "年柱": "year", "月柱": "month", "日柱": "day", "时柱": "hour",
  };
  for (const rule of shenShaResult?.main || []) {
    for (const match of rule.matches || []) {
      const tp = match.target_pillar;
      if (!tp) continue;
      const key = pillarMap[tp];
      if (key && !out[key].includes(rule.name)) {
        out[key].push(rule.name);
      }
    }
  }
  return out;
}

export const useBaziStore = create<BaziState>((set) => ({
  currentResult: null,
  currentInput: null,
  chartData: null,
  error: null,

  doChart: (input: BaziInput) => {
    // 旧格式结果（向后兼容）
    // calculateBazi 可能因输入数据异常抛出，捕获后设置错误状态并返回 null
    let result: BaziResult;
    try {
      result = calculateBazi(input);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("calculateBazi failed:", e);
      set({ currentResult: null, currentInput: input, chartData: null, error: `排盘计算失败：${msg}` });
      return null;
    }

    // 真一式排盘数据
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LocalChartAdapter 尚未完成类型化
    let rawChartData: any = null;
    let adapterError: string | null = null;
    try {
      const adapter = new LocalChartAdapter();
      const pad = (n: number) => String(n).padStart(2, "0");
      const gender = input.gender || "male";
      const profile = {
        birthday: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
        birth_time: `${pad(input.hour)}:${pad(input.minute || 0)}`,
        gender,
        name: "",
        use_true_solar_time: false,
        birth_longitude: null,
        birth_timezone_id: null,
        birth_timezone_offset: 8,
      };
      rawChartData = adapter.compute(profile);

      // 计算神煞并合并到 chartData
      // 盲派引擎(LocalChartAdapter)约定: 0=男, 1=女 (与 lunar-typescript 相反)
      const genderNum = gender === "male" ? 0 : 1;
      const ssResult = adapter.computeShenSha(rawChartData, genderNum);
      rawChartData.shen_sha = groupShenShaByPillar(ssResult);
      rawChartData.shen_sha_full = ssResult;

      // 为每个大运也附上神煞名列表
      if (ssResult.dayun) {
        for (let i = 0; i < ssResult.dayun.length; i++) {
          const [, names] = ssResult.dayun[i] || [];
          if (rawChartData.da_yun?.[i]) {
            rawChartData.da_yun[i].shen_sha = names || [];
          }
        }
      }
    } catch (e) {
      adapterError = e instanceof Error ? e.message : String(e);
      console.warn("LocalChartAdapter compute failed:", e);
      rawChartData = null;
    }

    set({ currentResult: result, currentInput: input, chartData: rawChartData, error: adapterError });
    return result;
  },

  clearResult: () => set({ currentResult: null, currentInput: null, chartData: null }),
  setError: (error) => set({ error }),
}));
