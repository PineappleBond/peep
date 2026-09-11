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

  // ===== Element Interface =====

  /** <rtc-agent> 自定义元素 */
  interface RtcAgent extends HTMLElement {
    /** 声明式配置 — 在 rtc-agent-ready 事件后设置 */
    agentConfig: RtcAgentConfig;
    /** 视觉主题: 'light' | 'dark' */
    theme: string;
    /** UI 头部显示的应用标签 */
    appLabel: string;
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
