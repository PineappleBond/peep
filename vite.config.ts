import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { removeConsoleCalls } from "./vite-plugin-remove-console-log.ts";

// Bundle 分析：设 ANALYZE=1 启用；会生成 stats.html 可视化报告（gitignore 掉）
const enableAnalyze = process.env.ANALYZE === "1";

export default defineConfig({
  plugins: [
    react(),
    // 生产构建移除源码中的 console.log / console.debug / console.info（保留 error / warn）
    removeConsoleCalls(),
    // Bundle 分析器——仅 ANALYZE=1 时启用，生成 stats.html 便于定位大模块
    enableAnalyze &&
      visualizer({
        filename: "stats.html",
        gzipSize: true,
        brotliSize: true,
        open: true,
        // treemap 视图：直观看每个模块的体积占比
        template: "treemap",
      }),
  ].filter(Boolean),
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
  server: {
    // 开发端口 5199；strictPort=true 保证端口冲突时立即报错退出，
    // 避免悄悄切换到其它端口导致外部脚本/调试 API 调用错位。
    port: 5199,
    strictPort: true,
    // 开发环境允许跨域——方便 e2e 调试工具/多窗口联动访问 dev server。
    // 生产部署由 nginx/CDN 的 CORS 策略控制，此处不影响线上。
    cors: true,
    // 开发环境也附加安全响应头，便于提前发现 CSP 兼容性 regressions
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    // 文件监听排除：node_modules / dist / .git / 测试产物。
    // 减少无用 inotify 事件，降低 CPU 占用，HMR 更稳定。
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/test-results/**",
        "**/playwright-report/**",
      ],
    },
    // HMR 覆盖：CSS 默认开启热替换，整页刷新仅在极端场景触发。
    hmr: {
      overlay: true, // 编译错误直接以浮层显示在页面，避免遗漏
    },
  },
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
  // 依赖预构建（optimizeDeps）——显著提升 dev server 冷启动速度。
  // 将大型/高频依赖预打包为 ESM，避免每次请求临时解析 CJS/UMD。
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "iztro",
      "dexie",
      "lunar-lite",
      "lunar-typescript",
      "@toon-format/toon",
    ],
    // Vite 8 已切换到 rolldown 内核；用 rolldownOptions 替代旧的 esbuildOptions。
    // 此处保留默认行为即可，rolldown 会自动按来源分 chunk。
    rolldownOptions: {},
  },
  build: {
    // 目标现代浏览器——利用 ES2020+ 语法，减少 polyfill 与转译体积
    target: "es2020",
    // 生产环境生成 source map，便于线上排查（CI/生产可设 NO_SOURCEMAP=1 关闭以加速）
    sourcemap: process.env.NO_SOURCEMAP === "1" ? false : true,
    // CSS 代码分割：每个异步 chunk 的 CSS 独立拆分，首屏只加载所需 CSS
    cssCodeSplit: true,
    // Vite 8 默认使用 oxc 压缩（rolldown 内核自带，比 esbuild 更快）
    // 显式声明以强调此处选择；可选值："oxc" | "terser" | "esbuild" | false
    minify: "oxc",
    // 报告产物体积阈值——超过 500 KiB 时打印警告，帮助识别大 chunk
    chunkSizeWarningLimit: 500,
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
            /\/node_modules\/(react|react-dom)\/|\/node_modules\/scheduler\/|\/node_modules\/loose-envify\//.test(
              id
            )
          ) {
            return "react";
          }
          // 路由库单独分包——升级频率低于 React，缓存友好
          if (/\/node_modules\/react-router/.test(id)) {
            return "router";
          }
          // Dexie（IndexedDB 封装）单独分包——仅 PersonDialog 等编辑流程使用
          if (/\/node_modules\/dexie\//.test(id)) {
            return "db";
          }
        },
      },
    },
  },
  test: {
    exclude: ["node_modules", "e2e"],
    // 失败时保留完整控制台输出，便于排查
    passWithNoTests: true,
  },
  // 开发环境通过 define 暴露少量只读元信息，方便调试（如 window.__PEEP_DEBUG__）。
  // 生产构建会被 tree-shaken 掉，不增加产物体积。
  define: {
    __PEEP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    __PEEP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
