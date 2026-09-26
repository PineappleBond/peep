/// <reference types="vite/client" />

/**
 * 开发环境调试 API 类型声明
 * window.peep 仅在 import.meta.env.DEV 下可用
 */
import type {
  PersonList,
  PersonGet,
  PersonCreate,
  PersonUpdate,
  PersonDelete,
  ZiWei,
  DaLiuRen,
  DaLiuRenCreate,
  DaLiuRenList,
  DaLiuRenView,
  WikiCreate,
  WikiList,
  WikiView,
  getChartDataForScope,
} from "./core/debugApi";

declare global {
  /**
   * 构建期注入的全局常量（vite.config.ts 的 define 字段）。
   * 生产构建会被 tree-shaken 掉，仅开发环境可访问。
   */
  const __PEEP_VERSION__: string;
  const __PEEP_BUILD_TIME__: string;

  interface Window {
    peep?: {
      PersonList: typeof PersonList;
      PersonGet: typeof PersonGet;
      PersonCreate: typeof PersonCreate;
      PersonUpdate: typeof PersonUpdate;
      PersonDelete: typeof PersonDelete;
      ZiWei: typeof ZiWei;
      DaLiuRen: typeof DaLiuRen;
      DaLiuRenCreate: typeof DaLiuRenCreate;
      DaLiuRenList: typeof DaLiuRenList;
      DaLiuRenView: typeof DaLiuRenView;
      WikiCreate: typeof WikiCreate;
      WikiList: typeof WikiList;
      WikiView: typeof WikiView;
      getChartDataForScope: typeof getChartDataForScope;
      /** 打印版本、构建时间、可用 API 列表——控制台调试入口 */
      version: () => void;
      /** 动态调整日志级别（debug/info/warn/error） */
      setLogLevel: (level: LogLevel) => void;
    };
  }

  /** 结构化日志分级（供 debugApi 使用） */
  type LogLevel = "debug" | "info" | "warn" | "error";
}
