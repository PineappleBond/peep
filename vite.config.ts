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
