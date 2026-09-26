import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // lunar-typescript 是双格式包（require→index.cjs / import→index.mjs）：
      // 应用的 import 与 iztro/lunar-lite 的 require 会被 rolldown 按条件各解析一份，
      // 同一份数据表被打包两次（engine +289KiB）。统一指到 ESM 单份；
      // 其 exports 映射只导出 "."，子路径被封锁，故必须用绝对路径。
      "lunar-typescript": fileURLToPath(
        new URL("./node_modules/lunar-typescript/dist/index.mjs", import.meta.url)
      ),
    },
  },
  server: { port: 5199, strictPort: true },
  preview: {
    port: 5199,
    // CSP 安全响应头——生产部署时应通过 nginx/CDN 配置同等或更严格的策略
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // rolldown（vite 8 内核）下 advancedChunks 已弃用，
        // 改用 manualChunks 函数形式实现相同分组逻辑
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // 命理学引擎依赖（iztro + 农历 + 日期 + 国际化）
          if (/(iztro|lunar-lite|lunar-typescript|dayjs|i18next)/.test(id)) {
            return "engine";
          }
          // React 核心（精确匹配 react、react-dom、scheduler、loose-envify，
          // 避免误匹配 react-router 等其他 react-* 库）
          if (
            /\/node_modules\/(react|react-dom)\/|\/node_modules\/scheduler\/|\/node_modules\/loose-envify\//.test(id)
          ) {
            return "react";
          }
        },
      },
    },
  },
  test: {
    exclude: ["node_modules", "e2e"],
  },
});
