/**
 * useHoveredId hook 测试
 *
 * 由于项目未安装 @testing-library/react，采用类型检查和导出验证方式。
 * 实际交互行为由集成测试 / E2E 覆盖。
 */
import { describe, it, expect } from "vitest";
import { useHoveredId } from "./useHoveredId";

describe("useHoveredId", () => {
  it("hook 可正常导入", () => {
    expect(useHoveredId).toBeDefined();
    expect(typeof useHoveredId).toBe("function");
  });

  it("无参数调用不抛出异常（仅类型检查）", () => {
    // 注意：此处无法在 React 环境外调用 hook，
    // 仅验证导出和类型签名正确性
    expect(useHoveredId).toHaveLength(0);
  });
});
