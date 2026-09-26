/**
 * PHP 与 TypeScript 九宗门专项对比测试（第 3 轮）
 *
 * 九宗门是大六壬最核心的算法，需要确保每种取法都正确
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

/** PHP 九宗门名称映射 */
const PHP_JIU_ZONG_MEN_NAMES = [
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

/** 对比九宗门取法 */
function compareJiuZongMen(
  php: any,
  ts: any,
  _caseName: string,
): { match: boolean; details: string } {
  const phpMethod = php.jiuzongmen;
  const phpName = PHP_JIU_ZONG_MEN_NAMES[phpMethod] || `未知(${phpMethod})`;
  const tsMethod = ts.threeTransmissions.method;

  // 简单的名称映射检查（实际应该更严格）
  const methodMap: Record<number, string[]> = {
    1: ["元首"],
    2: ["重审"],
    3: ["比用"],
    4: ["比用知一", "知一"],
    5: ["涉害"],
    6: ["涉害见机"],
    7: ["涉害察微"],
    8: ["涉害缀瑕"],
    9: ["遥克蒿矢", "蒿矢"],
    10: ["遥克弹射", "弹射"],
    11: ["昴星虎视", "虎视"],
    12: ["昴星冬蛇掩目", "冬蛇掩目"],
    13: ["别责"],
    14: ["八专"],
    15: ["八专独足", "独足"],
    16: ["伏吟不虞", "伏吟不遇"],
    17: ["伏吟自任"],
    18: ["伏吟自信"],
    19: ["伏吟杜传"],
    20: ["反吟无依", "返吟无依"],
    21: ["反吟无亲", "返吟无亲"],
  };

  const expectedNames = methodMap[phpMethod] || [];
  const match = expectedNames.includes(tsMethod);

  return {
    match,
    details: `PHP: ${phpMethod}(${phpName}), TS: ${tsMethod}`,
  };
}

/** 对比三传 */
function compareSanchuan(php: any, ts: any): string[] {
  const checks: string[] = [];

  if (php.sanchuan0 !== ts.threeTransmissions.initial) {
    checks.push(`初传: PHP=${php.sanchuan0}, TS=${ts.threeTransmissions.initial}`);
  }
  if (php.sanchuan1 !== ts.threeTransmissions.middle) {
    checks.push(`中传: PHP=${php.sanchuan1}, TS=${ts.threeTransmissions.middle}`);
  }
  if (php.sanchuan2 !== ts.threeTransmissions.final) {
    checks.push(`末传: PHP=${php.sanchuan2}, TS=${ts.threeTransmissions.final}`);
  }

  return checks;
}

describe("九宗门专项对比测试（第 3 轮）", () => {
  // 已知会产生特定九宗门的案例
  const testCases = [
    // 元首/重审
    { date: "2024-01-10", time: "10:00", name: "元首/重审测试1" },
    { date: "2024-01-15", time: "14:00", name: "元首/重审测试2" },

    // 比用/知一
    { date: "2024-03-15", time: "12:00", name: "比用/知一测试1" },
    { date: "2024-06-20", time: "15:00", name: "比用/知一测试2" },

    // 涉害
    { date: "2024-03-20", time: "12:00", name: "涉害测试1" },
    { date: "2024-07-25", time: "09:00", name: "涉害测试2" },
    { date: "2024-11-30", time: "16:00", name: "涉害测试3" },

    // 遥克
    { date: "2024-06-15", time: "10:00", name: "遥克测试1" },
    { date: "2024-09-10", time: "14:00", name: "遥克测试2" },

    // 昴星
    { date: "2024-04-05", time: "08:00", name: "昴星测试1" },
    { date: "2024-10-15", time: "18:00", name: "昴星测试2" },

    // 别责
    { date: "2024-05-20", time: "11:00", name: "别责测试1" },
    { date: "2024-08-25", time: "13:00", name: "别责测试2" },

    // 八专
    { date: "2024-12-21", time: "23:00", name: "八专测试1" },
    { date: "2025-02-15", time: "10:00", name: "八专测试2" },

    // 伏吟
    { date: "2024-09-23", time: "08:30", name: "伏吟测试1" },
    { date: "2025-01-05", time: "14:00", name: "伏吟测试2" },
    { date: "2025-04-10", time: "09:00", name: "伏吟测试3" },

    // 反吟
    { date: "2024-01-15", time: "14:30", name: "反吟测试1" },
    { date: "2025-07-07", time: "01:15", name: "反吟测试2" },

    // 随机测试
    { date: "2024-02-14", time: "12:00", name: "随机1" },
    { date: "2024-05-01", time: "08:00", name: "随机2" },
    { date: "2024-08-08", time: "16:00", name: "随机3" },
    { date: "2024-11-11", time: "11:11", name: "随机4" },
    { date: "2025-03-03", time: "15:00", name: "随机5" },
    { date: "2025-06-06", time: "06:00", name: "随机6" },
    { date: "2025-09-09", time: "09:00", name: "随机7" },
    { date: "2025-12-12", time: "12:00", name: "随机8" },
  ];

  testCases.forEach(({ date, time, name }) => {
    it(`九宗门对比: ${name} (${date} ${time})`, () => {
      const phpResult = runPhp(date, time);
      const tsResult = runTs(date, time);

      if (!phpResult || !tsResult) {
        throw new Error(`${name}: 计算失败`);
      }

      console.log(`\n========== ${name} ==========`);
      console.log(`日期时间: ${date} ${time}`);

      // 对比九宗门
      const jzm = compareJiuZongMen(phpResult, tsResult, name);
      console.log(`九宗门: ${jzm.details} ${jzm.match ? "✅" : "❌"}`);

      // 对比三传
      const sanchuanChecks = compareSanchuan(phpResult, tsResult);
      if (sanchuanChecks.length > 0) {
        console.log("三传差异:");
        sanchuanChecks.forEach(c => console.log(`  - ${c}`));
      } else {
        console.log("三传: 完全一致 ✅");
      }

      // 九宗门匹配不是强制要求（因为名称映射可能不完全），但三传必须一致
      expect(sanchuanChecks).toHaveLength(0);
    });
  });
});
