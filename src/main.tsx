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
} catch {
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

// ── 开发环境启动信息（仅在 DEV 模式输出，帮助快速定位环境问题） ─────────
if (import.meta.env.DEV) {
  const startTime = performance.now();

  // 在控制台输出环境信息——便于快速识别版本/端口/时间
  // eslint-disable-next-line no-console
  console.log(
    `%c[紫微斗数排盘] 开发模式启动%c\n` +
      `版本: ${__PEEP_VERSION__}  构建: ${__PEEP_BUILD_TIME__}\n` +
      `模式: ${import.meta.env.MODE}  Base: ${import.meta.env.BASE_URL}`,
    "color:#2196f3;font-weight:bold;font-size:14px",
    "color:#888;font-size:11px",
  );

  // 在 load 事件后打印启动耗时
  window.addEventListener(
    "load",
    () => {
      const elapsed = performance.now() - startTime;
      // eslint-disable-next-line no-console
      console.log(
        `%c[peep] 页面加载完成，耗时 ${elapsed.toFixed(0)}ms%c\n` +
          `提示: 输入 peep.version() 查看调试 API | peep.setLogLevel("debug") 开启详细日志`,
        "color:#4caf50;font-weight:bold",
        "color:#888",
      );
    },
    { once: true },
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
