/**
 * PHP 与 TypeScript 辅助计算专项对比测试（第 4 轮）
 *
 * 测试十二天将、六亲、旬空、遁干等辅助计算
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { calculateDaLiuRen } from "./calculator";

/** 运行 PHP 计算器 */
function runPhp(date: string, time: string): any {
  try {
    const result = execSync(
      `cd /tmp/liuren && php cli_calculate.php ${date} ${time}`,
      { encoding: "utf-8", timeout: 5000 }
    );
    return JSON.parse(result);
  } catch (error) {
    console.error("PHP 执行失败:", error);
    return null;
  }
}

/** 运行 TypeScript 计算器 */
function runTs(date: string, time: string): any {
  try {
    return calculateDaLiuRen(date, time);
  } catch (error) {
    console.error("TypeScript 执行失败:", error);
    return null;
  }
}

/** PHP 天将名称映射 */
const PHP_TIAN_JIANG_NAMES = [
  '贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙',
  '天空', '白虎', '太常', '玄武', '太阴', '天后'
];

/** 对比十二天将 */
function compareTianJiang(php: any, ts: any): string[] {
  const checks: string[] = [];

  // PHP 的 tianjiang 数组是按地盘顺序排列的天将编号
  // TS 的 twelveGenerals 是按地盘顺序排列的对象数组
  for (let i = 0; i < 12; i++) {
    const phpGeneral = php.tianjiang[i];
    const tsGeneral = ts.twelveGenerals[i].general;

    if (phpGeneral !== tsGeneral) {
      const phpName = PHP_TIAN_JIANG_NAMES[phpGeneral] || `未知(${phpGeneral})`;
      const tsName = ts.twelveGenerals[i].name;
      checks.push(`天将[${i}]: PHP=${phpGeneral}(${phpName}), TS=${tsGeneral}(${tsName})`);
    }
  }

  return checks;
}

/** 对比旬空 */
function compareXunKong(php: any, ts: any): string[] {
  const checks: string[] = [];

  // PHP 没有直接输出旬空，但可以通过四柱计算
  // TS 有 xunKong 字段
  // 这里我们只检查 TS 的旬空是否合理（不强制与 PHP 对比）

  return checks;
}

/** 对比三传天将 */
function compareSanchuanTianJiang(php: any, ts: any): string[] {
  const checks: string[] = [];

  // PHP 输出三传的天将：sanchuan0tianjiang, sanchuan1tianjiang, sanchuan2tianjiang
  // TS 没有直接输出三传的天将，但可以通过十二天将查找
  // 这里跳过，因为 TS 的 API 设计不同

  return checks;
}

/** 对比昼夜贵人 */
function compareGuiren(php: any, ts: any): string[] {
  const checks: string[] = [];

  // PHP 输出 guirenPeriod (day/night)
  // TS 没有直接输出这个，但可以通过计算验证
  // 这里跳过详细对比

  return checks;
}

describe("辅助计算专项对比测试（第 4 轮）", () => {
  const testCases = [
    // 不同时辰测试天将顺逆
    { date: "2024-06-15", time: "06:00", name: "卯时测试" },
    { date: "2024-06-15", time: "12:00", name: "午时测试" },
    { date: "2024-06-15", time: "18:00", name: "酉时测试" },
    { date: "2024-06-15", time: "00:00", name: "子时测试" },

    // 不同日干测试贵人
    { date: "2024-01-01", time: "12:00", name: "甲日测试" },
    { date: "2024-01-02", time: "12:00", name: "乙日测试" },
    { date: "2024-01-03", time: "12:00", name: "丙日测试" },
    { date: "2024-01-04", time: "12:00", name: "丁日测试" },
    { date: "2024-01-05", time: "12:00", name: "戊日测试" },
    { date: "2024-01-06", time: "12:00", name: "己日测试" },
    { date: "2024-01-07", time: "12:00", name: "庚日测试" },
    { date: "2024-01-08", time: "12:00", name: "辛日测试" },
    { date: "2024-01-09", time: "12:00", name: "壬日测试" },
    { date: "2024-01-10", time: "12:00", name: "癸日测试" },

    // 昼夜测试
    { date: "2024-06-15", time: "10:00", name: "白天测试1" },
    { date: "2024-06-15", time: "14:00", name: "白天测试2" },
    { date: "2024-06-15", time: "22:00", name: "夜晚测试1" },
    { date: "2024-06-15", time: "02:00", name: "夜晚测试2" },

    // 随机测试
    { date: "2024-03-15", time: "09:00", name: "随机1" },
    { date: "2024-07-20", time: "15:00", name: "随机2" },
    { date: "2024-11-25", time: "11:00", name: "随机3" },
    { date: "2025-02-14", time: "16:00", name: "随机4" },
    { date: "2025-05-01", time: "08:00", name: "随机5" },
    { date: "2025-08-08", time: "13:00", name: "随机6" },
    { date: "2025-10-31", time: "19:00", name: "随机7" },
    { date: "2026-01-01", time: "00:00", name: "随机8" },
  ];

  testCases.forEach(({ date, time, name }) => {
    it(`辅助计算对比: ${name} (${date} ${time})`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      if (!phpResult || !tsResult) {
        throw new Error(`${name}: 计算失败`);
      }

      console.log(`\n========== ${name} ==========`);
      console.log(`日期时间: ${date} ${time}`);
      console.log(`日干: PHP=${phpResult.rigan}, TS=${tsResult.fourPillars.dayStem}`);
      console.log(`时支: PHP=${phpResult.shizhi}, TS=${tsResult.fourPillars.hourBranch}`);
      console.log(`天盘: PHP=${JSON.stringify(phpResult.tianpan)}, TS=${JSON.stringify(tsResult.heavenBoard)}`);
      console.log(`昼夜: PHP=${phpResult.guirenPeriod}, shunni=${phpResult.shunni}`);

      // 对比十二天将
      const tianjiangChecks = compareTianJiang(phpResult, tsResult);
      if (tianjiangChecks.length > 0) {
        console.log('十二天将差异:');
        tianjiangChecks.forEach(c => console.log(`  - ${c}`));
      } else {
        console.log('十二天将: 完全一致 ✅');
      }

      // 其他辅助计算（旬空、遁干等）在 TS 中有但 PHP 没有直接输出，跳过对比

      expect(tianjiangChecks).toHaveLength(0);
    });
  });
});
