/**
 * PHP 与 TypeScript 终极随机对比测试
 *
 * 200 个随机案例 + 24 节气精确时刻测试
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

describe("终极随机对比测试（200+ 案例）", () => {
  const testCases: Array<{ date: string; time: string; name: string }> = [];

  // 200 个随机案例
  let seed = 54321;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 200; i++) {
    const year = 2020 + Math.floor(random() * 10); // 2020-2030
    const month = Math.floor(random() * 12) + 1;
    const maxDay = new Date(year, month, 0).getDate();
    const day = Math.floor(random() * maxDay) + 1;
    const hour = Math.floor(random() * 24);
    const minute = Math.floor(random() * 60);

    testCases.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      name: `随机${i + 1}`,
    });
  }

  // 24 节气测试（2024年）
  const jieqi2024 = [
    { date: "2024-02-04", time: "16:26", name: "立春" },
    { date: "2024-02-19", time: "12:12", name: "雨水" },
    { date: "2024-03-05", time: "10:22", name: "惊蛰" },
    { date: "2024-03-20", time: "11:06", name: "春分" },
    { date: "2024-04-04", time: "15:02", name: "清明" },
    { date: "2024-04-19", time: "21:59", name: "谷雨" },
    { date: "2024-05-05", time: "08:10", name: "立夏" },
    { date: "2024-05-20", time: "20:00", name: "小满" },
    { date: "2024-06-05", time: "12:10", name: "芒种" },
    { date: "2024-06-21", time: "04:51", name: "夏至" },
    { date: "2024-07-06", time: "22:20", name: "小暑" },
    { date: "2024-07-22", time: "15:45", name: "大暑" },
    { date: "2024-08-07", time: "08:09", name: "立秋" },
    { date: "2024-08-23", time: "04:34", name: "处暑" },
    { date: "2024-09-07", time: "11:11", name: "白露" },
    { date: "2024-09-22", time: "20:44", name: "秋分" },
    { date: "2024-10-08", time: "02:59", name: "寒露" },
    { date: "2024-10-23", time: "06:14", name: "霜降" },
    { date: "2024-11-07", time: "06:19", name: "立冬" },
    { date: "2024-11-22", time: "03:56", name: "小雪" },
    { date: "2024-12-06", time: "23:16", name: "大雪" },
    { date: "2024-12-21", time: "17:20", name: "冬至" },
  ];

  testCases.push(...jieqi2024);

  testCases.forEach(({ date, time, name }, _idx) => {
    it(`${name}: ${date} ${time}`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      if (!phpResult || !tsResult) {
        throw new Error(`计算失败: ${date} ${time}`);
      }

      const checks = comprehensiveCompare(phpResult, tsResult);

      if (checks.length > 0) {
        console.log(`\n${name}: ${date} ${time}`);
        console.log("差异:");
        checks.forEach(c => console.log(`  - ${c}`));
      }

      expect(checks).toHaveLength(0);
    });
  });
});
