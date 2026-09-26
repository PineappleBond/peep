/**
 * EmptyState 通用空状态组件测试
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("渲染 icon + title", () => {
    const html = renderToString(<EmptyState icon="☰" title="暂无数据" />);
    expect(html).toContain("☰");
    expect(html).toContain("暂无数据");
    expect(html).toContain("empty-state");
  });

  it("渲染带 description 的内容", () => {
    const html = renderToString(
      <EmptyState icon="📝" title="Wiki" description="点击右上角新建文档" />,
    );
    expect(html).toContain("Wiki");
    expect(html).toContain("点击右上角新建文档");
  });

  it("description 为 undefined 时不渲染 p 元素", () => {
    const html = renderToString(<EmptyState icon="⚠" title="错误" />);
    expect(html).not.toContain("empty-state-desc");
  });

  it("支持自定义 className", () => {
    const html = renderToString(<EmptyState icon="☰" title="测试" className="my-custom" />);
    expect(html).toContain("my-custom");
  });

  it("icon 标记为 aria-hidden", () => {
    const html = renderToString(<EmptyState icon="✦" title="测试" />);
    expect(html).toContain('aria-hidden="true"');
  });
});
