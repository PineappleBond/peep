import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import MainLayout from "@/components/layout/MainLayout";

// Route-level code splitting: each page is a separate chunk
const WorkbenchPage = lazy(() => import("@/pages/WorkbenchPage"));
const DocumentsPage = lazy(() => import("@/modules/documents/pages/DocumentsPage"));
const DocumentEditPage = lazy(() => import("@/modules/documents/pages/DocumentEditPage"));
const PersonsPage = lazy(() => import("@/modules/persons/pages/PersonsPage"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground text-sm">加载中...</p>
    </div>
  );
}

/** 全局错误边界 —— 捕获所有子组件的渲染错误，避免白屏 */
class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
          <h1 className="text-xl font-semibold">页面出错了</h1>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            渲染过程中发生了未预期的错误。请尝试刷新页面。
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground/70 mt-2 p-3 bg-muted rounded max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            className="mt-2 px-4 py-2 text-sm rounded-md border hover:bg-muted"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <GlobalErrorBoundary>
      <Routes>
        <Route element={<MainLayout />}>
          {/* 工作台：支持 ?tab=bazi|ziwei|liuyao&personId=X */}
          <Route path="/" element={<Suspense fallback={<PageFallback />}><WorkbenchPage /></Suspense>} />
          <Route path="/persons" element={<Suspense fallback={<PageFallback />}><PersonsPage /></Suspense>} />
          <Route path="/documents" element={<Suspense fallback={<PageFallback />}><DocumentsPage /></Suspense>} />
          <Route path="/documents/:type" element={<Suspense fallback={<PageFallback />}><DocumentsPage /></Suspense>} />
          <Route path="/documents/edit/:id" element={<Suspense fallback={<PageFallback />}><DocumentEditPage /></Suspense>} />
          <Route path="/documents/new" element={<Suspense fallback={<PageFallback />}><DocumentEditPage /></Suspense>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-center" />
    </GlobalErrorBoundary>
  );
}

export default App;
