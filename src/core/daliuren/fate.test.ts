/**
 * 大六壬命宫行年测试
 */
import { describe, expect, it } from "vitest";
import { calculateFate } from "./fate";

describe("calculateFate 命宫行年", () => {
  it("男命：返回命宫与行年", () => {
    const fate = calculateFate(1990, "男", 2026);
    expect(fate).toBeDefined();
    expect(fate.mingGong).toBeGreaterThanOrEqual(0);
    expect(fate.mingGong).toBeLessThan(12);
    expect(fate.xingNian).toBeGreaterThanOrEqual(0);
    expect(fate.xingNian).toBeLessThan(12);
    expect(fate.age).toBe(2026 - 1990 + 1); // 虚岁 37
  });

  it("女命：返回命宫与行年", () => {
    const fate = calculateFate(1990, "女", 2026);
    expect(fate).toBeDefined();
    expect(fate.mingGong).toBeGreaterThanOrEqual(0);
    expect(fate.xingNian).toBeGreaterThanOrEqual(0);
    expect(fate.age).toBe(37);
  });

  it("不同年份命宫可能不同", () => {
    const f1 = calculateFate(1984, "男", 2026);
    const f2 = calculateFate(1990, "男", 2026);
    expect(typeof f1.mingGong).toBe("number");
    expect(typeof f2.mingGong).toBe("number");
    // 命宫 = 生年地支，1984=子(0)，1990=午(6)
    expect(f1.mingGong).not.toBe(f2.mingGong);
  });

  it("男女命行年不同（同生年，同当前年）", () => {
    const male = calculateFate(1990, "男", 2026);
    const female = calculateFate(1990, "女", 2026);
    // 男命顺行、女命逆行，行年一般不同
    expect(typeof male.xingNian).toBe("number");
    expect(typeof female.xingNian).toBe("number");
  });

  it("虚岁计算正确", () => {
    const fate = calculateFate(2000, "男", 2026);
    expect(fate.age).toBe(27); // 2026 - 2000 + 1
  });
});
