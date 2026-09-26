import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { removeConsoleCalls } from "./vite-plugin-remove-console-log.ts";
import { VitePWA } from "vite-plugin-pwa";

// Bundle 分析：设 ANALYZE=1 启用；会生成 stats.html 可视化报告（gitignore 掉）
const enableAnalyze = process.env.ANALYZE === "1";

// base 尾斜杠兼容：Vite 8 在 base 配 '/peep/' 时，访问 '/peep'（无尾斜杠）会
// 返回友好提示页而不是 301 重定向。浏览器地址栏输入 '/peep' 很常见，加个 middleware
// 自动 redirect 到 '/peep/'，避免用户看到 Vite 的 did-you-mean 提示。
const BASE_PATH = "/peep/";
const BASE_WITHOUT_SLASH = BASE_PATH.replace(/\/$/, ""); // "/peep"
function redirectBaseSlashPlugin() {
  return {
    name: "peep:redirect-base-slash",
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        // 精确匹配 '/peep'（带 query 也处理：'/peep?x=1' → '/peep/?x=1'）
        if (req.url === BASE_WITHOUT_SLASH || req.url?.startsWith(BASE_WITHOUT_SLASH + "?")) {
          const query = req.url.slice(BASE_WITHOUT_SLASH.length); // "?x=1" 或 ""
          res.writeHead(301, { Location: BASE_PATH + query });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages 部署在子路径 https://<user>.github.io/peep/；
  // Vite 会据此给所有静态资源 URL 自动加前缀，并在 index.html 注入正确的 base 引用。
  // 尾斜杠必须带：'/peep/' 是目录，'/peep' 是文件——浏览器解析相对路径时两者行为不同。
  base: "/peep/",
  plugins: [
    // 子路径尾斜杠兼容：'/peep' → 301 → '/peep/'
    redirectBaseSlashPlugin(),
    react(),
    // 生产构建移除源码中的 console.log / console.debug / console.info（保留 error / warn）
    removeConsoleCalls(),
    // PWA 支持——自动生成 Service Worker，实现离线缓存与主屏幕安装
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      // 开发环境不注册 SW，避免干扰 HMR
      disable: process.env.NODE_ENV === "development",
      // manifest 内联声明（不再用 public/manifest.json）——
      // Vite build 时 vite-plugin-pwa 会自动把 icon/src 等相对路径按 base 前缀拼接，
      // 而 public/ 目录里的文件是原样 copy 到 dist 的，路径不会随 base 改变。
      manifest: {
        name: "紫微斗数排盘",
        short_name: "紫微斗数",
        description: "紫微斗数排盘 Web 应用",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#04060d",
        theme_color: "#04060d",
        orientation: "any",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // RTC Agent 组件分包后仍有 ~2.5MB（含 Lit + Dexie + 内部工具链），
        // 超过 workbox 默认 2MB 限制，提升到 5MB 避免构建失败。
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 静态资源使用 stale-while-revalidate：先展示缓存，后台更新
        // 文档页使用 NetworkFirst：优先网络，离线时回退缓存
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // 导航回退：离线时显示 index.html（SPA 单页应用必备）
        // vite-plugin-pwa 在 build 时会自动加上 base 前缀，无需手工写 /peep/index.html
        navigateFallback: "/index.html",
      },
    }),
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
      "pinyin-pro",
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
    // 模块预加载：为入口依赖的 chunk 注入 <link rel="modulepreload">
    // 让浏览器提前发现并下载关键 JS，减少串行加载延迟
    modulePreload: {
      // 仅预加载入口直接依赖的 chunk（不递归展开），平衡预加载数量与带宽
      resolveDependencies: (_filename, deps, { hostImportedModule }) => {
        // 预加载所有直接依赖（react / engine / router 等首屏必需 chunk）
        return deps.filter(dep => {
          // 排除大体积异步分包（rtc / pinyin），避免首屏浪费带宽
          return !/(rtc|pinyin|shared-worker)/.test(dep);
        });
      },
    },
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
          // RTC Agent 组件单独分包——体积较大（~1.5MB），与主 bundle 解耦避免触发
          // workbox 默认 2MB 上限；同时便于浏览器缓存（RTC 升级频率低于主应用）
          if (/\/node_modules\/@rtc-agent\/component\//.test(id)) {
            return "rtc";
          }
          // 拼音库单独分包——仅搜索时按需加载（动态 import），体积 ~624KB ESM
          if (/\/node_modules\/pinyin-pro\//.test(id)) {
            return "pinyin";
          }
        },
        // 分包文件命名：[name]-[hash]，hash 变化时文件名改变，利于长期缓存
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // CSS 文件单独命名，便于识别
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
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
