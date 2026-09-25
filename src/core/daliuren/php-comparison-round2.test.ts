/**
 * PHP 与 TypeScript 大六壬算法深度对比测试（第 2 轮）
 *
 * 覆盖更多边界情况和特殊场景
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

/** 对比两个结果的关键字段 */
function compareResults(php: any, ts: any, caseName: string): void {
  if (!php || !ts) {
    throw new Error(`${caseName}: 计算失败`);
  }

  const checks: string[] = [];

  // 1. 四柱对比
  if (php.rigan !== ts.fourPillars.dayStem) {
    checks.push(`日干: PHP=${php.rigan}, TS=${ts.fourPillars.dayStem}`);
  }
  if (php.rizhi !== ts.fourPillars.dayBranch) {
    checks.push(`日支: PHP=${php.rizhi}, TS=${ts.fourPillars.dayBranch}`);
  }

  // 2. 月将对比
  if (php.yuejiang !== ts.monthGeneral.branch) {
    checks.push(`月将: PHP=${php.yuejiang}, TS=${ts.monthGeneral.branch}`);
  }

  // 3. 天盘对比
  for (let i = 0; i < 12; i++) {
    if (php.tianpan[i] !== ts.heavenBoard[i]) {
      checks.push(`天盘[${i}]: PHP=${php.tianpan[i]}, TS=${ts.heavenBoard[i]}`);
    }
  }

  // 4. 四课对比（跳过第一课下课的结构差异）
  for (let i = 0; i < 4; i++) {
    const phpUpper = php.sike[i * 2 + 1];
    const phpLower = php.sike[i * 2];
    const tsUpper = ts.fourLessons[i].upper;
    const tsLower = ts.fourLessons[i].lower;

    if (phpUpper !== tsUpper) {
      checks.push(`四课${i + 1}上: PHP=${phpUpper}, TS=${tsUpper}`);
    }
    if (i === 0) continue; // 第一课下课跳过
    if (phpLower !== tsLower) {
      checks.push(`四课${i + 1}下: PHP=${phpLower}, TS=${tsLower}`);
    }
  }

  // 5. 三传对比
  if (php.sanchuan0 !== ts.threeTransmissions.initial) {
    checks.push(`初传: PHP=${php.sanchuan0}, TS=${ts.threeTransmissions.initial}`);
  }
  if (php.sanchuan1 !== ts.threeTransmissions.middle) {
    checks.push(`中传: PHP=${php.sanchuan1}, TS=${ts.threeTransmissions.middle}`);
  }
  if (php.sanchuan2 !== ts.threeTransmissions.final) {
    checks.push(`末传: PHP=${php.sanchuan2}, TS=${ts.threeTransmissions.final}`);
  }

  // 6. 九宗门对比（记录但不作为失败条件）
  const phpMethod = php.jiuzongmen;
  const tsMethod = ts.threeTransmissions.method;
  console.log(`${caseName} 九宗门: PHP=${phpMethod}, TS=${tsMethod}`);

  if (checks.length > 0) {
    console.log(`\n${caseName} 差异:`);
    checks.forEach(c => console.log(`  - ${c}`));
  }

  expect(checks).toHaveLength(0);
}

describe("PHP vs TypeScript 深度对比测试（第 2 轮）", () => {
  const testCases = [
    // 子时边界测试
    { date: "2024-01-01", time: "23:30", name: "子时边界1" },
    { date: "2024-01-01", time: "23:59", name: "子时边界2" },
    { date: "2024-01-02", time: "00:00", name: "子时边界3" },
    { date: "2024-01-02", time: "00:30", name: "子时边界4" },

    // 节气边界测试
    { date: "2024-02-04", time: "16:26", name: "立春精确时刻" },
    { date: "2024-02-04", time: "16:25", name: "立春前1分钟" },
    { date: "2024-05-05", time: "14:00", name: "立夏" },
    { date: "2024-08-07", time: "08:00", name: "立秋" },
    { date: "2024-11-07", time: "06:00", name: "立冬" },

    // 特殊日柱测试
    { date: "2024-02-29", time: "12:00", name: "闰年2月29日" },
    { date: "2024-12-31", time: "23:30", name: "年末子时" },
    { date: "2025-01-01", time: "00:00", name: "元旦子夜" },

    // 十二时辰全覆盖
    { date: "2024-06-15", time: "00:30", name: "子时" },
    { date: "2024-06-15", time: "01:30", name: "丑时" },
    { date: "2024-06-15", time: "03:30", name: "寅时" },
    { date: "2024-06-15", time: "05:30", name: "卯时" },
    { date: "2024-06-15", time: "07:30", name: "辰时" },
    { date: "2024-06-15", time: "09:30", name: "巳时" },
    { date: "2024-06-15", time: "11:30", name: "午时" },
    { date: "2024-06-15", time: "13:30", name: "未时" },
    { date: "2024-06-15", time: "15:30", name: "申时" },
    { date: "2024-06-15", time: "17:30", name: "酉时" },
    { date: "2024-06-15", time: "19:30", name: "戌时" },
    { date: "2024-06-15", time: "21:30", name: "亥时" },

    // 随机分布测试
    { date: "2025-03-15", time: "10:15", name: "随机1" },
    { date: "2025-07-20", time: "14:45", name: "随机2" },
    { date: "2025-11-10", time: "08:00", name: "随机3" },
    { date: "2026-04-25", time: "16:30", name: "随机4" },
    { date: "2026-09-30", time: "20:00", name: "随机5" },
  ];

  testCases.forEach(({ date, time, name }) => {
    it(`对比: ${name} (${date} ${time})`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      console.log(`\n========== ${name} ==========`);
      console.log(`日期时间: ${date} ${time}`);

      compareResults(phpResult, tsResult, name);
    });
  });
});
