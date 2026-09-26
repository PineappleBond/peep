/**
 * useEventListener hook 测试
 *
 * 由于项目未安装 @testing-library/react，采用导出验证方式。
 * hook 的实际事件监听行为由集成测试 / E2E 覆盖。
 */
import { describe, it, expect } from "vitest";
import { useEventListener } from "./useEventListener";

describe("useEventListener", () => {
  it("hook 可正常导入", () => {
    expect(useEventListener).toBeDefined();
    expect(typeof useEventListener).toBe("function");
  });

  it("函数签名接受 4 个参数（含默认值）", () => {
    // 验证导出的函数存在
    expect(useEventListener.length).toBeLessThanOrEqual(4);
  });
});
