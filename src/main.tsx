import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./core/i18n";
import { initPerformanceMonitoring } from "./core/performance";
import { initErrorTracking } from "./core/errorTracking";
import { initTheme } from "./core/theme";
import "./index.css";

// ── 初始化主题（在渲染前应用，避免闪烁） ──────────────────────────
initTheme();

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
