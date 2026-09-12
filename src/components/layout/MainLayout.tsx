import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import type {} from "@/rtc-agent";

export default function MainLayout() {
  const agentRef = useRef<RtcAgent>(null);

  useEffect(() => {
    const agent = agentRef.current;
    if (!agent) return;

    const handleReady = () => {
      // 嵌入式面板：禁用窗口交互，默认最大化
      agent.windowConfig = {
        embedded: true,  // 等同于: defaultMode: maximized, draggable: false,
                         // resizable: false, showMinimize: false, showMaximize: false
      };

      // 只保留 chat 按钮
      agent.activityBarConfig = {
        disabledActivities: ['files', 'settings'],
      };
    };

    // 组件可能已经 ready
    if (agent.shadowRoot) {
      handleReady();
    } else {
      agent.addEventListener('rtc-agent-ready', handleReady, { once: true });
    }

    return () => {
      agent.removeEventListener('rtc-agent-ready', handleReady);
    };
  }, []);

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
          ref={agentRef}
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
