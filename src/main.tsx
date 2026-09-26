import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./core/i18n";
import "./index.css";

/**
 * 全局错误兜底：未捕获的异常与未处理的 Promise rejection
 * 防止白屏且无反馈的"静默崩溃"，给出可感知的提示并记录日志。
 */
if (typeof window !== "undefined") {
  window.addEventListener("error", event => {
    console.error("[全局] 未捕获错误", event.error || event.message);
  });
  window.addEventListener("unhandledrejection", event => {
    console.error("[全局] 未处理的 Promise 拒绝", event.reason);
    // 阻止默认的控制台错误输出（已经手动记录）
    event.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
