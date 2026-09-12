import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import type {} from "@/rtc-agent";

const DEFAULT_RIGHT_PANEL_WIDTH = 384; // 96 * 4 = 384px
const MIN_RIGHT_PANEL_WIDTH = 280;
const MAX_RIGHT_PANEL_WIDTH = 800;

export default function MainLayout() {
  const agentRef = useRef<RtcAgent>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const agent = agentRef.current;
    if (!agent) return;

    const handleReady = () => {
      // 嵌入式面板：禁用窗口交互，默认最大化
      agent.windowConfig = {
        defaultMode: 'maximized',
        draggable: false,
        resizable: false,
        showMinimize: false,
        showMaximize: false,
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

  // 拖拽调整右侧面板宽度
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, newWidth));
      setRightPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-3">
          <Outlet />
        </main>
      </div>
      {/* 可拖拽分隔线 */}
      <div
        className={`w-1 cursor-col-resize hover:bg-primary/50 transition-colors ${
          isDragging ? 'bg-primary' : 'bg-border'
        }`}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
      />
      {/* 右侧 AI 助手面板 */}
      <aside
        className="border-l border-border bg-background flex flex-col"
        style={{ width: `${rightPanelWidth}px` }}
      >
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
