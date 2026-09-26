/**
 * @rtc-agent/component 当前发布包（0.2.6）未附带 .d.ts——package.json 声明了 types 字段，
 * 但 dist 目录无对应文件。此处手写最小类型声明覆盖其对外 API 表面，
 * 仅覆盖 peep-v2 实际用到的部分。升级包版本时按需扩充。
 *
 * 本文件为纯 ambient 声明（无 import/export 顶层语句），TS 自动识别为全局类型。
 */

declare module "@rtc-agent/component" {
  export interface RtcAgentFunction {
    name: string;
    description: string;
    zodSchema?: unknown;
    parameters?: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (...args: any[]) => any;
    returns?: { schema?: unknown; description?: string };
  }

  export interface RtcAgentFunctionGroup {
    name: string;
    description: string;
    functions: RtcAgentFunction[];
  }

  export interface RtcAgentServerConfig {
    url: string;
    redirectUri?: string;
  }

  export interface RtcAgentConfig {
    appLabel?: string;
    theme?: "light" | "dark" | "system";
    lang?: string;
    databaseName?: string;
    server?: RtcAgentServerConfig;
    workerUrl?: string;
    agentName?: string;
    agentDescription?: string;
    persona?: string;
    groups?: RtcAgentFunctionGroup[];
    agentConfig?: {
      name?: string;
      persona?: string;
      groups?: RtcAgentFunctionGroup[];
    };
    on?: {
      ready?: () => void;
    };
  }

  /** createRtcAgent 返回值：HTMLElement + 生命周期方法 */
  export interface RtcAgentWithLifecycle extends HTMLElement {
    theme: "light" | "dark" | "system";
    lang: string;
    agentConfig: RtcAgentConfig["agentConfig"];
    /** 窗口配置（ready 事件后设置）：embedded=true 表示嵌入式面板模式 */
    windowConfig: {
      embedded?: boolean;
      defaultMode?: string;
      draggable?: boolean;
      resizable?: boolean;
    };
    /** 活动栏配置（ready 事件后设置） */
    activityBarConfig: {
      disabledActivities?: string[];
    };
    destroy(): void;
  }

  export function createRtcAgent(config: RtcAgentConfig): RtcAgentWithLifecycle;
  export function switchLocale(locale: string): Promise<void>;
}
