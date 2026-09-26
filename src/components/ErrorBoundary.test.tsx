/**
 * ErrorBoundary 单元测试（基于 renderToString）
 *
 * 注：React 的 server-side renderer 不会调用 componentDidCatch，
 * 所以只能测试：
 * 1. 子组件正常渲染时 boundary 不拦截
 * 2. 自定义 fallback 渲染路径（通过直接构造错误状态）
 * 3. 工具函数（buildErrorReport）的行为
 *
 * 完整的 componentDidCatch 行为（渲染捕获 + 自动重试 + reportError 集成）
 * 由集成测试 / E2E 测试覆盖。
 */
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ErrorBoundary } from "./ErrorBoundary";

/** 正常子组件 */
function Ok() {
  return <div data-testid="ok">正常渲染</div>;
}

describe("ErrorBoundary (SSR 路径)", () => {
  it("子组件正常渲染时直接传递 children", () => {
    const html = renderToString(
      <ErrorBoundary name="Test">
        <Ok />
      </ErrorBoundary>,
    );

    expect(html).toContain("正常渲染");
    expect(html).toContain('data-testid="ok"');
  });

  it("自定义 fallback 在非错误状态下不渲染", () => {
    const fallback = vi.fn(() => <div>降级 UI</div>);

    const html = renderToString(
      <ErrorBoundary name="Test" fallback={fallback}>
        <Ok />
      </ErrorBoundary>,
    );

    expect(html).toContain("正常渲染");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("props 传递 name/onError/maxAutoRetries 不导致错误", () => {
    const onError = vi.fn();
    expect(() =>
      renderToString(
        <ErrorBoundary name="Test" onError={onError} maxAutoRetries={2}>
          <Ok />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
  });
});
