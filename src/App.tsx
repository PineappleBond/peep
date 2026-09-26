/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 * 非首页路由使用 React.lazy 懒加载，减少主 bundle 体积
 */
import { lazy, Suspense, useEffect, useState } from "react";
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

// 大六壬 / Wiki 页面仅在访问时按需加载，降低首屏 bundle 体积
const DaLiuRenPage = lazy(() =>
  import("./pages/DaLiuRenPage").then(m => ({ default: m.DaLiuRenPage })),
);
const WikiPage = lazy(() => import("./pages/WikiPage").then(m => ({ default: m.WikiPage })));
const VizPage = lazy(() => import("./pages/VizPage").then(m => ({ default: m.VizPage })));
const InsightsPage = lazy(() =>
  import("./pages/InsightsPage").then(m => ({ default: m.InsightsPage })),
);

// 初始化调试 API
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

/** 插件路由渲染器 —— 将插件注册的 routes 渲染为 <Route> 节点 */
function PluginRoutes() {
  const extensions = usePluginExtensions();
  return (
    <>
      {extensions.routes.map(r => {
        const Comp = r.element;
        return <Route key={`plugin:${r.pluginId}:${r.path}`} path={r.path} element={<Comp />} />;
      })}
    </>
  );
}

function App() {
  // 插件系统异步初始化：仅首次挂载触发
  const [pluginsReady, setPluginsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    initPlugins().then(() => {
      if (!cancelled) setPluginsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/" element={<ZiweiPage />} />
              <Route path="/liuren" element={<DaLiuRenPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              <Route path="/viz" element={<VizPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              {/* 插件路由：插件启用后自动注入 */}
              {pluginsReady && <PluginRoutes />}
              {/* 兜底：未知路径重定向到首页 */}
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </Suspense>
        </Layout>
        {/* 开发者性能仪表板（仅 DEV 环境渲染） */}
        <DevDashboard />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
