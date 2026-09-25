/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ZiweiPage } from "./pages/ZiweiPage";
import { DaLiuRenPage } from "./pages/DaLiuRenPage";
import { WikiPage } from "./pages/WikiPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initDebugApi } from "./core/debugApi";

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

/** 404 未找到路由：重定向到首页 */
function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ZiweiPage />} />
            <Route path="/liuren" element={<DaLiuRenPage />} />
            <Route path="/wiki" element={<WikiPage />} />
            {/* 兜底：未知路径重定向到首页 */}
            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
