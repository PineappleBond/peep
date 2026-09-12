import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
      {/* 右侧 AI 助手面板 */}
      <aside className="w-96 border-l border-border bg-background flex flex-col">
        <rtc-agent
          app-label="Peep AI"
          scenarios-url="/peep/rtc-agent/scenarios/"
          redirect-uri="/peep/auth/callback.html"
          server-url="https://rtc-agent.cherish.chat"
          className="flex-1 overflow-hidden"
        />
      </aside>
    </div>
  );
}
