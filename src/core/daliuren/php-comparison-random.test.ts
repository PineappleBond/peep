/**
 * PHP 与 TypeScript 大规模随机对比测试
 *
 * 100 个随机案例，全面验证算法正确性
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { calculateDaLiuRen } from "./calculator";

/** 运行 PHP 计算器 */
function runPhp(date: string, time: string): any {
  try {
    const result = execSync(`cd /tmp/liuren && php cli_calculate.php ${date} ${time}`, {
      encoding: "utf-8",
      timeout: 5000,
    });
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

/** 全面对比 */
function comprehensiveCompare(php: any, ts: any): string[] {
  const checks: string[] = [];

  // 1. 四柱
  if (php.rigan !== ts.fourPillars.dayStem) {
    checks.push(`日干: PHP=${php.rigan}, TS=${ts.fourPillars.dayStem}`);
  }
  if (php.rizhi !== ts.fourPillars.dayBranch) {
    checks.push(`日支: PHP=${php.rizhi}, TS=${ts.fourPillars.dayBranch}`);
  }

  // 2. 月将
  if (php.yuejiang !== ts.monthGeneral.branch) {
    checks.push(`月将: PHP=${php.yuejiang}, TS=${ts.monthGeneral.branch}`);
  }

  // 3. 天盘
  for (let i = 0; i < 12; i++) {
    if (php.tianpan[i] !== ts.heavenBoard[i]) {
      checks.push(`天盘[${i}]: PHP=${php.tianpan[i]}, TS=${ts.heavenBoard[i]}`);
    }
  }

  // 4. 四课（跳过第一课下课的结构差异）
  for (let i = 0; i < 4; i++) {
    const phpUpper = php.sike[i * 2 + 1];
    const tsUpper = ts.fourLessons[i].upper;
    if (phpUpper !== tsUpper) {
      checks.push(`四课${i + 1}上: PHP=${phpUpper}, TS=${tsUpper}`);
    }
    if (i > 0) {
      const phpLower = php.sike[i * 2];
      const tsLower = ts.fourLessons[i].lower;
      if (phpLower !== tsLower) {
        checks.push(`四课${i + 1}下: PHP=${phpLower}, TS=${tsLower}`);
      }
    }
  }

  // 5. 三传
  if (php.sanchuan0 !== ts.threeTransmissions.initial) {
    checks.push(`初传: PHP=${php.sanchuan0}, TS=${ts.threeTransmissions.initial}`);
  }
  if (php.sanchuan1 !== ts.threeTransmissions.middle) {
    checks.push(`中传: PHP=${php.sanchuan1}, TS=${ts.threeTransmissions.middle}`);
  }
  if (php.sanchuan2 !== ts.threeTransmissions.final) {
    checks.push(`末传: PHP=${php.sanchuan2}, TS=${ts.threeTransmissions.final}`);
  }

  // 6. 十二天将
  for (let i = 0; i < 12; i++) {
    if (php.tianjiang[i] !== ts.twelveGenerals[i].general) {
      checks.push(`天将[${i}]: PHP=${php.tianjiang[i]}, TS=${ts.twelveGenerals[i].general}`);
    }
  }

  return checks;
}

describe("大规模随机对比测试（100 个案例）", () => {
  // 生成 100 个随机测试案例
  const testCases: Array<{ date: string; time: string }> = [];

  // 使用固定种子生成随机数（确保可重现）
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // 覆盖 2024-2028 年
  for (let i = 0; i < 100; i++) {
    const year = 2024 + Math.floor(random() * 5);
    const month = Math.floor(random() * 12) + 1;
    const maxDay = new Date(year, month, 0).getDate();
    const day = Math.floor(random() * maxDay) + 1;
    const hour = Math.floor(random() * 24);
    const minute = Math.floor(random() * 60);

    testCases.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    });
  }

  // 添加特殊边界案例
  testCases.push(
    { date: "2024-02-29", time: "12:00" }, // 闰年
    { date: "2024-12-31", time: "23:59" }, // 年末
    { date: "2025-01-01", time: "00:00" }, // 年初
    { date: "2024-06-21", time: "12:00" }, // 夏至
    { date: "2024-12-21", time: "12:00" }, // 冬至
    { date: "2024-03-20", time: "12:00" }, // 春分
    { date: "2024-09-23", time: "12:00" }, // 秋分
  );

  testCases.forEach(({ date, time }, idx) => {
    it(`随机案例 ${idx + 1}: ${date} ${time}`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      if (!phpResult || !tsResult) {
        throw new Error(`计算失败: ${date} ${time}`);
      }

      const checks = comprehensiveCompare(phpResult, tsResult);

      if (checks.length > 0) {
        console.log(`\n案例 ${idx + 1}: ${date} ${time}`);
        console.log("差异:");
        checks.forEach(c => console.log(`  - ${c}`));
      }

      expect(checks).toHaveLength(0);
    });
  });
});
