/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 * 非首页路由使用 React.lazy 懒加载，减少主 bundle 体积
 *
 * 优化点：
 * - 路由懒加载 chunk 支持 hover 预加载（preloadable）
 * - 每个路由包裹独立 ErrorBoundary，故障隔离
 * - 顶部进度条 RouteLoader 显示懒加载进度
 * - 404 路由展示真实 404 页面（带倒计时跳转）
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/Spinner";
import { ZiweiPage } from "./pages/ZiweiPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RouteLoader } from "./components/RouteLoader";
import { DevDashboard } from "./components/DevDashboard";
import { PerformanceMonitor } from "./components/PerformanceMonitor";
import { initDebugApi } from "./core/debugApi";
import { useI18n } from "./core/i18n";
import { initPlugins } from "./core/pluginLoader";
import { usePluginExtensions } from "./core/pluginSystem";
import { createPeepRtcAgent, startThemeSync, syncLocale, syncTheme } from "./core/rtcAgent";
import { preloadable } from "./utils/preloadable";

// ── 可预加载的懒加载路由包装：支持 hover 提前下载 chunk ─────────────
const daLiuRenLoader = preloadable(() =>
  import("./pages/DaLiuRenPage").then(m => ({ default: m.DaLiuRenPage })),
);
const liuyaoLoader = preloadable(() =>
  import("./pages/LiuyaoPage").then(m => ({ default: m.LiuyaoPage })),
);
const wikiLoader = preloadable(() =>
  import("./pages/WikiPage").then(m => ({ default: m.WikiPage })),
);

// React.lazy 包装（使用 preloadable 的 load 函数）
const DaLiuRenPage = lazy(daLiuRenLoader.load);
const LiuyaoPage = lazy(liuyaoLoader.load);
const WikiPage = lazy(wikiLoader.load);

/** 暴露路由预加载方法到全局——供 Header/NavLink hover 触发 */
export const routePreloaders = {
  "/liuren": daLiuRenLoader.preload,
  "/liuyao": liuyaoLoader.preload,
  "/wiki": wikiLoader.preload,
};

// 初始化调试 API：内部通道始终可用（供 RTC Agent Function 调用），
// window.peep 全局对象仅在 DEV 环境暴露，缩小生产环境攻击面。
initDebugApi();

// 清理旧版持久化
try {
  localStorage.removeItem("zwds-input-v2");
  localStorage.removeItem("zwds-nav-v1");
  localStorage.removeItem("zwds-kline-domain");
  localStorage.removeItem("zwds-archive-v1");
} catch {
  /* ignore */
}

/** 懒加载路由的占位加载指示器 */
function LazyFallback() {
  const { t } = useI18n();
  return (
    <div className="lazy-loading" role="status" aria-live="polite">
      <Spinner size="md" text={t("app.loading")} />
    </div>
  );
}

/**
 * RouteWithErrorBoundary - 路由级错误边界包装
 * 每个路由组件包裹在独立的 ErrorBoundary 内，支持自动重试
 * 路由切换时自动重置（ErrorBoundary 已内置 popstate 监听）
 */
function RouteWithErrorBoundary({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <ErrorBoundary name={name} maxAutoRetries={1}>
      <div className="route-transition">{children}</div>
    </ErrorBoundary>
  );
}

function App() {
  // 插件系统异步初始化：仅首次挂载触发
  const [pluginsReady, setPluginsReady] = useState(false);
  const extensions = usePluginExtensions();
  useEffect(() => {
    let cancelled = false;
    initPlugins().then(() => {
      if (!cancelled) setPluginsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── RTC Agent 全局初始化 ─────────────────────────────────────
  // 创建 RTC 实例并挂到 #rtc-slot；组件销毁时调 destroy() 清理 WebSocket 与事件监听。
  // 同时启动主题同步监听（MutationObserver + matchMedia）。
  const rtcSlotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const slot = rtcSlotRef.current;
    if (!slot) return;
    const agent = createPeepRtcAgent();
    slot.replaceChildren(agent);
    const cleanupThemeSync = startThemeSync();
    // 初始化时同步一次（agent 创建时的 theme 已取 getTheme()，但 data-theme 属性
    // 可能在 initTheme() 之后被覆盖，这里确保一致）
    syncTheme();
    return () => {
      cleanupThemeSync();
      agent.destroy();
    };
  }, []);

  // ── 语言同步 ─────────────────────────────────────
  // peep-v2 的 i18n 上下文变化时（用户在 Header 切换语言），同步给 RTC 组件。
  const { locale } = useI18n();
  useEffect(() => {
    syncLocale(locale);
  }, [locale]);

  return (
    <ErrorBoundary name="App.Root">
      {/* 全局 5:3 双栏布局：左侧紫微斗数主内容，右侧 RTC Agent AI 助手 */}
      <div className="rtc-layout">
        <div className="rtc-layout-main">
          <BrowserRouter basename="/peep">
            {/* 顶部路由加载进度条 */}
            <RouteLoader />
            <Layout>
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <RouteWithErrorBoundary name="ZiweiPage">
                        <ZiweiPage />
                      </RouteWithErrorBoundary>
                    }
                  />
                  <Route
                    path="/liuren"
                    element={
                      <RouteWithErrorBoundary name="DaLiuRenPage">
                        <DaLiuRenPage />
                      </RouteWithErrorBoundary>
                    }
                  />
                  <Route
                    path="/liuyao"
                    element={
                      <RouteWithErrorBoundary name="LiuyaoPage">
                        <LiuyaoPage />
                      </RouteWithErrorBoundary>
                    }
                  />
                  <Route
                    path="/wiki"
                    element={
                      <RouteWithErrorBoundary name="WikiPage">
                        <WikiPage />
                      </RouteWithErrorBoundary>
                    }
                  />
                  {/* 插件路由：插件启用后自动注入 */}
                  {pluginsReady &&
                    extensions.routes.map(r => {
                      const Comp = r.element;
                      return (
                        <Route
                          key={`plugin:${r.pluginId}:${r.path}`}
                          path={r.path}
                          element={
                            <ErrorBoundary name={`Plugin:${r.pluginId}`} maxAutoRetries={1}>
                              <div className="route-transition">
                                <Comp />
                              </div>
                            </ErrorBoundary>
                          }
                        />
                      );
                    })}
                  {/* 兜底：404 未找到页面（带倒计时跳转） */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </Layout>
            {/* 开发者性能仪表板（仅 DEV 环境渲染） */}
            <DevDashboard />
            {/* 性能监控悬浮窗（仅 DEV 环境渲染） */}
            <PerformanceMonitor />
          </BrowserRouter>
        </div>
        <aside className="rtc-layout-side" aria-label="AI 助手">
          <div ref={rtcSlotRef} id="rtc-slot" />
        </aside>
      </div>
    </ErrorBoundary>
  );
}

export default App;
