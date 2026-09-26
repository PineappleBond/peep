/**
 * PageState 页面状态容器组件测试
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { PageState } from "./PageState";
import { I18nProvider } from "../core/i18n";

/** 用 I18nProvider 包裹渲染 */
function renderWithI18n(element: React.ReactElement) {
  return renderToString(<I18nProvider>{element}</I18nProvider>);
}

describe("PageState", () => {
  it("ready=true 且无 error 时渲染 children", () => {
    const html = renderWithI18n(
      <PageState ready={true} error={null}>
        <div data-testid="content">页面内容</div>
      </PageState>,
    );
    expect(html).toContain("页面内容");
  });

  it("ready=false 且无 error 时展示 loading", () => {
    const html = renderWithI18n(
      <PageState ready={false} error={null} loadingText="加载中...">
        <div>页面内容</div>
      </PageState>,
    );
    expect(html).toContain("加载中");
    expect(html).toContain("page-loading");
  });

  it("error 非 null 时展示错误提示", () => {
    const html = renderWithI18n(
      <PageState ready={false} error="初始化失败">
        <div>页面内容</div>
      </PageState>,
    );
    expect(html).toContain("初始化失败");
    expect(html).toContain("err-box");
  });

  it("error 优先级高于 loading", () => {
    const html = renderWithI18n(
      <PageState ready={false} error="出错了" loadingText="加载中">
        <div>内容</div>
      </PageState>,
    );
    expect(html).toContain("出错了");
    expect(html).not.toContain("加载中");
  });

  it("支持自定义 className", () => {
    const html = renderWithI18n(
      <PageState ready={false} error={null} className="my-page">
        <div>内容</div>
      </PageState>,
    );
    expect(html).toContain("my-page");
  });
});
