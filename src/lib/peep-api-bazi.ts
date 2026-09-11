/**
 * peep.bazi API - 八字排盘工作流方法
 *
 * 工作流：
 * 1. 接收 personId 和 scope（level + datetime）
 * 2. 解析 datetime，提取年、月、日、时
 * 3. 计算八字四柱和大运
 * 4. 根据 datetime 找到对应的大运
 * 5. 根据 level 计算流年、流月、流日、流时
 * 6. 同步到 horoscopeStore
 * 7. 返回结果
 */

import type { HoroscopeScope } from "@/lib/peep-api";
import { useBaziStore } from "@/stores/baziStore";
import { useHoroscopeStore } from "@/stores/horoscopeStore";
import { buildDetailedChart } from "@/modules/bazi/components/ZhenyiChartWithHighlight";
import { personToBaziInput, applyScopeToHoroscopeStore, getActivePerson } from "@/lib/horoscope-utils";

// ── 主 API ──────────────────────────────────────
export const baziAPI = {
  /**
   * 八字排盘（纯数据操作，不做页面跳转）
   *
   * 页面跳转由 rtc-agent-config handler 负责
   */
  async chart(personId: number, scope: HoroscopeScope) {
    // 1. 读取人物
    const person = await getActivePerson(personId);

    // 2. 转换为 BaziInput
    const input = personToBaziInput(person);
    const bStore = useBaziStore.getState();

    // 3. 检查是否已经计算好 chartData
    let result = bStore.currentResult;
    const isInputMatch = bStore.currentInput &&
      bStore.currentInput.year === input.year &&
      bStore.currentInput.month === input.month &&
      bStore.currentInput.day === input.day &&
      bStore.currentInput.hour === input.hour &&
      bStore.currentInput.gender === input.gender;

    if (!bStore.chartData || !isInputMatch) {
      // 未计算或输入不匹配，重新计算
      result = bStore.doChart(input);
      if (!result) {
        // doChart 失败时已设置 error 状态
        const adapterError = useBaziStore.getState().error || "未知错误";
        throw new Error(`八字排盘失败：无法为 personId=${personId} 生成 chartData（${adapterError}）`);
      }
    }

    // 4. 重新获取 store 状态
    const updatedStore = useBaziStore.getState();
    const chartData = updatedStore.chartData;
    if (!result) result = updatedStore.currentResult;
    if (!chartData || !result) {
      const adapterError = updatedStore.error || "未知错误";
      throw new Error(`八字排盘失败：无法为 personId=${personId} 生成 chartData（${adapterError}）`);
    }

    // 5. 同步 scope 到 UI 并获取运势路径
    applyScopeToHoroscopeStore(input, scope);
    const hStore = useHoroscopeStore.getState();
    const pathSummary = hStore.getPathSummary();

    // 6. 用 buildDetailedChart 构建 DetailedChart
    const chart = buildDetailedChart(
      chartData,
      hStore.dayun,
      hStore.liunian,
      hStore.liuyue,
      hStore.liuri,
      hStore.liushi,
      input.gender || "male",
    );

    return { 图表: chart, 运势路径: pathSummary };
  },
};
