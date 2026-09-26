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
  GetScopeData,
  computeScopeData,
  computeZiWeiData,
  DaLiuRen,
  computeDaLiuRenData,
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
      GetScopeData: typeof GetScopeData;
      computeScopeData: typeof computeScopeData;
      /** 纯计算：从 Zwds 状态提取 hbar/chart 数据（不操控 UI） */
      computeZiWeiData: typeof computeZiWeiData;
      DaLiuRen: typeof DaLiuRen;
      /** 纯计算：大六壬排盘（不操控 UI，推荐新代码使用） */
      computeDaLiuRenData: typeof computeDaLiuRenData;
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
      /** 获取缓存统计（命中率/大小/淘汰数）——性能监控 */
      getCacheStats: () => Record<
        string,
        { hits: number; misses: number; evictions: number; size: number }
      >;
      /** 清空全部缓存（调试用） */
      clearCaches: () => void;
    };
  }

  /** 结构化日志分级（供 debugApi 使用） */
  type LogLevel = "debug" | "info" | "warn" | "error";
}
