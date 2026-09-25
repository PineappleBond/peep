/// <reference types="vite/client" />

/**
 * 开发环境调试 API 类型声明
 * window.peep 仅在 import.meta.env.DEV 下可用
 */
import type {
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
  interface Window {
    peep?: {
      ZiWei: typeof ZiWei;
      DaLiuRen: typeof DaLiuRen;
      DaLiuRenCreate: typeof DaLiuRenCreate;
      DaLiuRenList: typeof DaLiuRenList;
      DaLiuRenView: typeof DaLiuRenView;
      WikiCreate: typeof WikiCreate;
      WikiList: typeof WikiList;
      WikiView: typeof WikiView;
      getChartDataForScope: typeof getChartDataForScope;
    };
  }
}
