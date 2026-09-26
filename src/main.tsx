import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./core/i18n";
import { initPerformanceMonitoring } from "./core/performance";
import { initErrorTracking } from "./core/errorTracking";
import { initTheme } from "./core/theme";
import { initShortcuts } from "./core/shortcuts";
import "./index.css";

// ── GitHub Pages SPA 重定向恢复 ──────────────────────────────────
// 用户直接访问 /peep/liuren 时，GitHub Pages 返回 404.html；404.html 把原始路径
// 存入 sessionStorage 后跳回 /peep/。这里在 React 启动前同步读取并 replaceState，
// 让 BrowserRouter 初始化时拿到正确的路径（basename="/peep" 下剥出 "/liuren"）。
// 必须在 ReactDOM.createRoot 之前执行，否则 BrowserRouter 已读旧 location。
try {
  const savedPath = sessionStorage.getItem("spa-redirect-path");
  if (savedPath) {
    const search = sessionStorage.getItem("spa-redirect-search") || "";
    const hash = sessionStorage.getItem("spa-redirect-hash") || "";
    sessionStorage.removeItem("spa-redirect-path");
    sessionStorage.removeItem("spa-redirect-search");
    sessionStorage.removeItem("spa-redirect-hash");
    // 拼回带 base 前缀的完整 URL（与 vite.config.ts 的 base '/peep/' 对齐）
    const target = `/peep${savedPath}${search}${hash}`;
    window.history.replaceState(window.history.state, "", target);
  }
} catch (_e) {
  /* 隐私模式 / sessionStorage 不可用：降级丢失原始路径，回退到首页 */
}

// ── 初始化主题（在渲染前应用，避免闪烁） ──────────────────────────
initTheme();

// ── 初始化全局键盘快捷键监听 ────────────────────────────
initShortcuts();

// ── 初始化监控模块 ──────────────────────────────────────────
// 性能监控：生产环境启用上报，开发环境仅控制台输出
initPerformanceMonitoring();

// 错误监控：捕获全局 JS 错误、Promise 未处理异常、资源加载失败
// 包含去重、批量上报、敏感信息过滤
initErrorTracking();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
