import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./index.css";
import { installPeepAPI } from "@/lib/peep-api";
import { createRtcAgentConfig } from "@/lib/rtc-agent-config";
import type { RtcAgent } from "./rtc-agent";

// ── rtc-agent 环境感知加载 ─────────────────────────────
// Local 环境使用编译的源码（public/rtc-agent-local/），Production 环境使用 CDN。
// 版本号从 .env 文件的 VITE_RTC_AGENT_VERSION 读取
const RTC_AGENT_VERSION = import.meta.env.VITE_RTC_AGENT_VERSION as string;
const RTC_AGENT_LOCAL_URL = `${import.meta.env.BASE_URL}rtc-agent-local/index.js`;
const RTC_AGENT_CDN_URL = `https://cdn.jsdelivr.net/npm/@rtc-agent/component@${RTC_AGENT_VERSION}/dist/index.js`;

/** 尝试加载指定 URL 的 rtc-agent 脚本 */
function tryLoadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`[rtc-agent] Failed to load from ${url}`));
    };
    document.head.appendChild(script);
  });
}

/** 先尝试加载本地 URL，失败后回退到 CDN URL */
async function loadRtcAgentScript(): Promise<void> {
  try {
    await tryLoadScript(RTC_AGENT_LOCAL_URL);
  } catch (localErr) {
    console.warn(`[rtc-agent] Local load failed, falling back to CDN:`, localErr);
    await tryLoadScript(RTC_AGENT_CDN_URL);
  }
}

// 安装 peep API 到 window.peep
installPeepAPI();

// ── rtc-agent 测试模式跳过 ─────────────────────────────
// Playwright e2e 测试时通过 VITE_RTC_AGENT_DISABLED=true 禁用，避免浮层拦截指针事件
const rtcAgentDisabled = import.meta.env.VITE_RTC_AGENT_DISABLED === 'true';

// 初始化 rtc-agent 配置
async function initRtcAgent() {
  if (rtcAgentDisabled) {
    // 测试模式：移除 <rtc-agent> 元素，彻底避免指针拦截
    document.querySelector('rtc-agent')?.remove();
    return;
  }

  // 先加载 rtc-agent 组件脚本
  await loadRtcAgentScript();

  // 等待 rtc-agent 组件就绪
  if (window.RtcAgentModule?.whenReady) {
    await window.RtcAgentModule.whenReady;
  }

  const agent = document.querySelector<RtcAgent>('rtc-agent');
  if (!agent) {
    console.error('[rtc-agent] <rtc-agent> element not found');
    return;
  }

  // 设置配置（会加载 AGENT.md 作为 persona）
  agent.agentConfig = await createRtcAgentConfig();
}

initRtcAgent().catch((e) => console.error("[rtc-agent] init failed:", e));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ThemeProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
