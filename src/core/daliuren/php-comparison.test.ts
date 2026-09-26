/**
 * PHP 与 TypeScript 大六壬算法对比测试
 *
 * 对照 meixiaoqiu/liuren PHP 实现，验证 TypeScript 实现的正确性
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

  // 4. 四课对比（PHP 是 8 元素数组 [日干,干上神,干上神,上神再临,日支,支上神,支上神,上神再临]）
  // PHP 的四课结构：
  // Lesson 1: upper=sike[1], lower=sike[0]（日干，非寄宫）
  // Lesson 2: upper=sike[3], lower=sike[2]（干上神）
  // Lesson 3: upper=sike[5], lower=sike[4]（日支）
  // Lesson 4: upper=sike[7], lower=sike[6]（支上神）
  // 注意：PHP 第一课下课存储的是日干本身，而不是日干寄宫
  // 我们的 TypeScript 第一课下课存储的是日干寄宫
  // 这是数据结构差异，计算逻辑是一致的
  for (let i = 0; i < 4; i++) {
    const phpUpper = php.sike[i * 2 + 1];
    const phpLower = php.sike[i * 2];
    const tsUpper = ts.fourLessons[i].upper;
    const tsLower = ts.fourLessons[i].lower;

    if (phpUpper !== tsUpper) {
      checks.push(`四课${i + 1}上: PHP=${phpUpper}, TS=${tsUpper}`);
    }
    // 第一课：PHP 存日干，TS 存日干寄宫，跳过比较
    if (i === 0) {
      // PHP: sike[0] = 日干, TS: lesson1.lower = 日干寄宫
      // 计算逻辑一致，只是存储结构不同
      continue;
    }
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

  // 6. 九宗门对比
  const phpMethod = php.jiuzongmen;
  const tsMethod = ts.threeTransmissions.method;
  // 这里需要映射关系，暂时先记录
  console.log(
    `${caseName} 九宗门: PHP=${phpMethod} (${getPhpMethodName(phpMethod)}), TS=${tsMethod}`
  );

  if (checks.length > 0) {
    console.log(`\n${caseName} 差异:`);
    checks.forEach(c => console.log(`  - ${c}`));
  }

  expect(checks).toHaveLength(0);
}

/** PHP 九宗门名称映射 */
function getPhpMethodName(index: number): string {
  const names = [
    "未知",
    "元首",
    "重审",
    "比用",
    "比用知一",
    "涉害",
    "涉害见机",
    "涉害察微",
    "涉害缀瑕",
    "遥克蒿矢",
    "遥克弹射",
    "昴星虎视",
    "昴星冬蛇掩目",
    "别责",
    "八专",
    "八专独足",
    "伏吟不虞",
    "伏吟自任",
    "伏吟自信",
    "伏吟杜传",
    "反吟无依",
    "反吟无亲",
  ];
  return names[index] || `未知(${index})`;
}

describe("PHP vs TypeScript 对比测试", () => {
  const testCases = [
    { date: "2024-01-15", time: "14:30", name: "反吟案例" },
    { date: "2024-06-15", time: "10:00", name: "普通案例1" },
    { date: "2024-12-21", time: "23:00", name: "冬至边界" },
    { date: "2024-03-20", time: "12:00", name: "春分" },
    { date: "2024-09-23", time: "08:30", name: "秋分" },
    { date: "2025-02-03", time: "15:45", name: "立春前后" },
    { date: "2025-07-07", time: "01:15", name: "小暑子时" },
    { date: "2025-08-23", time: "19:00", name: "处暑" },
    { date: "2025-11-22", time: "11:30", name: "小雪" },
    { date: "2026-01-20", time: "16:20", name: "大寒" },
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
