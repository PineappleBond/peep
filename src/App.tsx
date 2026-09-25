/**
 * 应用入口 - 路由配置
 * 使用 react-router-dom 实现路由分离
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ZiweiPage } from "./pages/ZiweiPage";
import { DaLiuRenPage } from "./pages/DaLiuRenPage";
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

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ZiweiPage />} />
          <Route path="/liuren" element={<DaLiuRenPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
