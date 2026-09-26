/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 * 非首页路由使用 React.lazy 懒加载，减少主 bundle 体积
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ZiweiPage } from "./pages/ZiweiPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initDebugApi } from "./core/debugApi";
import { useI18n } from "./core/i18n";

// 大六壬 / Wiki 页面仅在访问时按需加载，降低首屏 bundle 体积
const DaLiuRenPage = lazy(() =>
  import("./pages/DaLiuRenPage").then(m => ({ default: m.DaLiuRenPage })),
);
const WikiPage = lazy(() => import("./pages/WikiPage").then(m => ({ default: m.WikiPage })));

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
      {t("app.loading")}
    </div>
  );
}

/** 404 未找到路由：重定向到首页 */
function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              <Route path="/" element={<ZiweiPage />} />
              <Route path="/liuren" element={<DaLiuRenPage />} />
              <Route path="/wiki" element={<WikiPage />} />
              {/* 兜底：未知路径重定向到首页 */}
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
