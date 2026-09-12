/* eslint-disable @typescript-eslint/no-explicit-any -- rtc-agent is a dynamic host integration surface */
/**
 * rtc-agent Web Component — TypeScript Declarations for Host Integration
 *
 * 两种使用方式：
 *
 * 1. UMD (本项目): <script type="module" src="https://cdn.jsdelivr.net/npm/@rtc-agent/component/dist/index.js">
 *    组件注册在 `window.RtcAgentModule` 上
 *
 * 2. ES module (npm install @rtc-agent/component):
 *    import { whenReady, AgentConfig } from '@rtc-agent/component';
 */

import type { ZodType } from 'zod';

// ===== Public API Types =====

declare global {
  /** OpenAPI Schema 格式的参数定义 */
  interface OpenAPISchema {
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
    format?: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    enum?: unknown[];
    properties?: Record<string, OpenAPISchema>;
    items?: OpenAPISchema;
    $ref?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
  }

  /** 参数定义（OpenAPI 格式） */
  interface ParameterDef {
    name: string;
    schema: OpenAPISchema;
    required?: boolean;
    description?: string;
  }

  /** 返回值定义（OpenAPI 格式） */
  interface ReturnDef {
    schema: OpenAPISchema;
    description?: string;
  }

  /** 声明式 agent 配置 — 宿主集成的主要入口 */
  interface RtcAgentFunctionDef {
    name: string;
    description: string;
    handler: (params: Record<string, unknown>) => unknown;
    /** OpenAPI Schema 参数定义（旧版，向后兼容） */
    parameters?: ParameterDef[];
    /** Zod schema 用于运行时校验和文档生成（推荐） */
    zodSchema?: ZodType;
    returns?: ReturnDef;
  }

  interface RtcAgentFunctionGroup {
    name: string;
    description?: string;
    functions: RtcAgentFunctionDef[];
  }

  interface RtcAgentConfig {
    name?: string;
    description?: string;
    persona?: string;
    functions?: RtcAgentFunctionDef[];
    groups?: RtcAgentFunctionGroup[];
    onError?: (error: Error, context: string) => void;
  }

  /** 窗口配置 — 控制窗口行为和 UI 可见性 */
  interface WindowConfig {
    /** 默认窗口模式 */
    defaultMode?: 'normal' | 'maximized' | 'minimized';
    /** 嵌入式模式：禁用所有交互（拖拽、缩放、按钮），等同于 defaultMode: maximized + draggable: false + resizable: false + showMinimize: false + showMaximize: false */
    embedded?: boolean;
    /** 是否可拖拽 */
    draggable?: boolean;
    /** 是否可缩放 */
    resizable?: boolean;
    /** 是否显示最小化按钮 */
    showMinimize?: boolean;
    /** 是否显示最大化按钮 */
    showMaximize?: boolean;
    /** 是否显示关闭按钮 */
    showClose?: boolean;
    /** 初始尺寸 */
    initialSize?: { width: number; height: number };
    /** 初始位置 */
    initialPosition?: { x: number; y: number };
    /** 最小宽度 */
    minWidth?: number;
    /** 最小高度 */
    minHeight?: number;
    /** 最大宽度 */
    maxWidth?: number;
    /** 最大高度 */
    maxHeight?: number;
  }

  /** Activity Bar 配置 — 控制侧边栏按钮显隐 */
  interface ActivityBarConfig {
    /** 要隐藏的活动按钮（chat 始终显示，不可隐藏） */
    disabledActivities?: ('files' | 'settings')[];
    /** 默认激活的活动 */
    defaultActivity?: 'chat' | 'files' | 'settings';
  }

  // ===== Element Interface =====

  /** <rtc-agent> 自定义元素 */
  interface RtcAgent extends HTMLElement {
    /** 声明式配置 — 在 rtc-agent-ready 事件后设置 */
    agentConfig: RtcAgentConfig;
    /** 视觉主题: 'light' | 'dark' */
    theme: string;
    /** UI 头部显示的应用标签 */
    appLabel: string;
    /** 窗口配置 — 控制窗口行为和 UI 可见性 */
    windowConfig: WindowConfig | null;
    /** Activity Bar 配置 — 控制侧边栏按钮显隐 */
    activityBarConfig: ActivityBarConfig | null;
  }

  // ===== Ready Signal =====

  /**
   * UMD 全局: `window.RtcAgentModule.whenReady`
   * ES module: `import { whenReady } from '@rtc-agent/component'`
   */
  interface RtcAgentModule {
    whenReady: Promise<void>;
  }

  // ===== Global Type Extensions =====

  interface Window {
    RtcAgentModule?: RtcAgentModule;
    /**
     * Peep 业务 API 挂载点（类型定义见 src/lib/peep-api.ts 的 PeepAPI 接口）
     *
     * 使用 unknown 保持类型安全：rtc-agent Web Component 在 JS 运行时消费此属性，
     * 不依赖 TS 类型；内部代码通过 installPeepAPI() 写入，也无需读取。
     */
    peep?: unknown;
  }

  interface HTMLElementTagNameMap {
    'rtc-agent': RtcAgent;
  }

  interface HTMLElementEventMap {
    'rtc-agent-ready': CustomEvent<void>;
  }
}

// React 19 JSX intrinsic elements — module augmentation
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'rtc-agent': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'app-label'?: string;
          'scenarios-url'?: string;
          'redirect-uri'?: string;
          'server-url'?: string;
        },
        HTMLElement
      >;
    }
  }
}

export type {
  OpenAPISchema,
  ParameterDef,
  ReturnDef,
  RtcAgentFunctionDef,
  RtcAgentFunctionGroup,
  RtcAgentConfig,
  RtcAgent,
  RtcAgentModule
};
