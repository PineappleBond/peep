/**
 * IndexedDB 序列化测试
 *
 * 验证 calculateDaLiuRen 返回的数据结构可以被 IndexedDB 正确序列化。
 * IndexedDB 使用 structured clone algorithm，不支持函数、DOM 节点等。
 */
import { describe, it, expect } from "vitest";
import { calculateDaLiuRen } from "./calculator";

/**
 * 递归检查对象是否包含函数
 */
function findFunctions(obj: unknown, path: string = "root"): string[] {
  const functions: string[] = [];

  if (typeof obj === "function") {
    functions.push(path);
    return functions;
  }

  if (obj === null || obj === undefined) {
    return functions;
  }

  if (typeof obj !== "object") {
    return functions;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      functions.push(...findFunctions(item, `${path}[${index}]`));
    });
    return functions;
  }

  // 普通对象
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    functions.push(...findFunctions(value, `${path}.${key}`));
  }

  return functions;
}

describe("IndexedDB 序列化", () => {
  it("calculateDaLiuRen 结果不包含函数（可被 IndexedDB 序列化）", () => {
    const result = calculateDaLiuRen("2024-01-15", "10:30:00", {
      birthYear: 1990,
      gender: "男",
    });

    // 查找结果中的所有函数
    const functions = findFunctions(result);

    // 应该没有任何函数
    expect(functions).toEqual([]);
  });

  it("keJing 匹配结果不包含 check 函数", () => {
    const result = calculateDaLiuRen("2024-01-15", "10:30:00");

    // keJing 可能为空或有匹配，无论如何检查
    for (const match of result.keJing) {
      expect(typeof match.rule.check).toBe("undefined");
      expect(match.rule.code).toBeDefined();
      expect(match.rule.name).toBeDefined();
      expect(match.rule.description).toBeDefined();
      expect(match.rule.group).toBeDefined();
    }
  });

  it("biFa 匹配结果不包含 check 函数", () => {
    const result = calculateDaLiuRen("2024-01-15", "10:30:00");

    // biFa 可能为空或有匹配，无论如何检查
    for (const match of result.biFa) {
      expect(typeof match.rule.check).toBe("undefined");
      expect(match.rule.code).toBeDefined();
      expect(match.rule.name).toBeDefined();
      expect(match.rule.description).toBeDefined();
    }
  });

  it("结果可以通过 structuredClone 克隆", () => {
    const result = calculateDaLiuRen("2024-01-15", "10:30:00", {
      birthYear: 1990,
      gender: "男",
    });

    // structuredClone 是 IndexedDB 使用的克隆算法
    // 如果包含函数会抛出 DataCloneError
    expect(() => structuredClone(result)).not.toThrow();

    // 验证克隆后的数据与原数据一致
    const cloned = structuredClone(result);
    expect(cloned.calculationTime).toBe(result.calculationTime);
    expect(cloned.fourPillars).toEqual(result.fourPillars);
    expect(cloned.keJing.length).toBe(result.keJing.length);
    expect(cloned.biFa.length).toBe(result.biFa.length);
  });

  it("结果可以通过 JSON 序列化和反序列化", () => {
    const result = calculateDaLiuRen("2024-01-15", "10:30:00", {
      birthYear: 1990,
      gender: "男",
    });

    // JSON 序列化也是常见的序列化方式
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);

    // 验证关键字段一致
    expect(parsed.calculationTime).toBe(result.calculationTime);
    expect(parsed.fourPillars).toEqual(result.fourPillars);
    expect(parsed.keJing.length).toBe(result.keJing.length);
    expect(parsed.biFa.length).toBe(result.biFa.length);
  });

  it("多个不同日期的计算结果都可序列化", () => {
    const testCases = [
      { date: "2024-01-01", time: "00:00:00" },
      { date: "2024-06-15", time: "12:00:00" },
      { date: "2024-12-31", time: "23:59:59" },
      { date: "2025-03-20", time: "08:30:00" },
    ];

    for (const { date, time } of testCases) {
      const result = calculateDaLiuRen(date, time);
      const functions = findFunctions(result);
      expect(functions).toEqual([]);

      // 验证可以克隆
      expect(() => structuredClone(result)).not.toThrow();
    }
  });
});
