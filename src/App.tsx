/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 * 非首页路由使用 React.lazy 懒加载，减少主 bundle 体积
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/Spinner";
import { ZiweiPage } from "./pages/ZiweiPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DevDashboard } from "./components/DevDashboard";
import { initDebugApi } from "./core/debugApi";
import { useI18n } from "./core/i18n";
import { initPlugins } from "./core/pluginLoader";
import { usePluginExtensions } from "./core/pluginSystem";
import { createPeepRtcAgent, startThemeSync, syncLocale, syncTheme } from "./core/rtcAgent";

// 大六壬 / Wiki 页面仅在访问时按需加载，降低首屏 bundle 体积
const DaLiuRenPage = lazy(() =>
  import("./pages/DaLiuRenPage").then(m => ({ default: m.DaLiuRenPage })),
);
const WikiPage = lazy(() => import("./pages/WikiPage").then(m => ({ default: m.WikiPage })));

// 初始化调试 API（生产/开发均暴露 window.peep，供 RTC Agent Function 调用）
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

/** 404 未找到路由：重定向到首页 */
function NotFoundRedirect() {
  return <Navigate to="/" replace />;
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
    startThemeSync();
    // 初始化时同步一次（agent 创建时的 theme 已取 getTheme()，但 data-theme 属性
    // 可能在 initTheme() 之后被覆盖，这里确保一致）
    syncTheme();
    return () => {
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
    <ErrorBoundary>
      {/* 全局 5:3 双栏布局：左侧紫微斗数主内容，右侧 RTC Agent AI 助手 */}
      <div className="rtc-layout">
        <div className="rtc-layout-main">
          <BrowserRouter basename="/peep">
            <Layout>
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  <Route path="/" element={<ZiweiPage />} />
                  <Route path="/liuren" element={<DaLiuRenPage />} />
                  <Route path="/wiki" element={<WikiPage />} />
                  {/* 插件路由：插件启用后自动注入 */}
                  {pluginsReady &&
                    extensions.routes.map(r => {
                      const Comp = r.element;
                      return (
                        <Route
                          key={`plugin:${r.pluginId}:${r.path}`}
                          path={r.path}
                          element={<Comp />}
                        />
                      );
                    })}
                  {/* 兜底：未知路径重定向到首页 */}
                  <Route path="*" element={<NotFoundRedirect />} />
                </Routes>
              </Suspense>
            </Layout>
            {/* 开发者性能仪表板（仅 DEV 环境渲染） */}
            <DevDashboard />
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
