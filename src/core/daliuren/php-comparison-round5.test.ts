/**
 * PHP 与 TypeScript 全面综合对比测试（第 5 轮 - 最终轮）
 *
 * 综合测试所有模块，确保完整性和正确性
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

/** 全面对比 */
function comprehensiveCompare(php: any, ts: any, caseName: string): string[] {
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

  // 7. 六亲（三传）
  if (php.liuqin0 !== undefined && ts.liuQin[ts.threeTransmissions.initial] !== undefined) {
    // PHP 的 liuqin 值范围：-2=子孙, -1=妻财, 0=兄弟, 1=官鬼, 2=父母
    // TS 的六亲是字符串，需要映射
    const liuqinMap: Record<number, string> = {
      "-2": "子孙",
      "-1": "妻财",
      "0": "兄弟",
      "1": "官鬼",
      "2": "父母",
    };
    const expectedLiuqin = liuqinMap[php.liuqin0];
    const actualLiuqin = ts.liuQin[ts.threeTransmissions.initial];
    if (expectedLiuqin !== actualLiuqin) {
      checks.push(`初传六亲: PHP=${expectedLiuqin}, TS=${actualLiuqin}`);
    }
  }

  return checks;
}

describe("全面综合对比测试（第 5 轮 - 最终轮）", () => {
  // 生成 50 个随机测试案例
  const testCases: Array<{ date: string; time: string; name: string }> = [];

  // 固定案例
  testCases.push(
    { date: "2024-01-01", time: "00:00", name: "元旦子夜" },
    { date: "2024-02-29", time: "12:00", name: "闰年2月29日" },
    { date: "2024-06-15", time: "18:00", name: "夏至前后" },
    { date: "2024-12-21", time: "23:30", name: "冬至子时" },
    { date: "2025-01-01", time: "12:00", name: "2025元旦" },
    { date: "2025-07-07", time: "01:15", name: "小暑子时" },
    { date: "2025-12-31", time: "23:59", name: "年末" },
    { date: "2026-01-01", time: "00:00", name: "2026元旦" }
  );

  // 随机案例
  for (let i = 0; i < 42; i++) {
    const year = 2024 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);

    testCases.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      name: `随机${i + 1}`,
    });
  }

  testCases.forEach(({ date, time, name }) => {
    it(`综合对比: ${name} (${date} ${time})`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      if (!phpResult || !tsResult) {
        throw new Error(`${name}: 计算失败`);
      }

      const checks = comprehensiveCompare(phpResult, tsResult, name);

      if (checks.length > 0) {
        console.log(`\n========== ${name} ==========`);
        console.log(`日期时间: ${date} ${time}`);
        console.log(`差异:`);
        checks.forEach(c => console.log(`  - ${c}`));
        console.log(`PHP 天将: ${JSON.stringify(phpResult.tianjiang)}`);
        console.log(`TS 天将: ${JSON.stringify(tsResult.twelveGenerals.map(g => g.general))}`);
      }

      expect(checks).toHaveLength(0);
    });
  });
});
