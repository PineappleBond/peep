# 开发者指南

面向贡献者的工程化文档。环境搭建/命令速览见根目录 `README.md`，本文档聚焦：架构理解、代码规范、调试技巧、常见问题。

## 目录

- [项目结构](#项目结构)
- [代码规范与工具链](#代码规范与工具链)
- [调试工具](#调试工具)
- [性能与启动优化](#性能与启动优化)
- [常见问题 FAQ](#常见问题-faq)
- [贡献流程](#贡献流程)

## 项目结构

```text
peep-v2/
├── src/
│   ├── core/            # 纯逻辑层——可直接单元测试
│   │   ├── useZwds.ts         紫微斗数 hook（封装 iztro 引擎）
│   │   ├── analysis.ts        结构分析（格局/三方四正/飞宫/夹宫）
│   │   ├── lifeKline.ts       人生 K 线引擎
│   │   ├── hbar.ts            运限拨盘数据
│   │   ├── debugApi.ts        window.peep 调试接口
│   │   ├── exportData.ts      AI 导出（TOON/MD/JSON）
│   │   ├── knowledge.ts       知识库（格局/星情/赋文）
│   │   ├── decadePlan.ts      十年规划表
│   │   ├── synastry.ts        合盘
│   │   ├── rectify.ts         生时校正
│   │   ├── globalSearch.ts    全局搜索核心（模糊/拼音/正则）
│   │   ├── shortcuts.ts       全局键盘快捷键
│   │   ├── guide.ts           用户引导流程
│   │   ├── sync.ts            多设备同步（加密导出/导入）
│   │   ├── theme.ts           主题管理（亮/暗/跟随系统）
│   │   ├── toast.ts           全局 Toast 通知
│   │   ├── i18n.tsx           国际化支持
│   │   ├── pluginSystem.ts    插件系统核心
│   │   ├── daliuren/          大六壬子模块
│   │   ├── personDb.ts        Dexie 人物档案库
│   │   ├── wikiDb.ts          Dexie Wiki 库
│   │   └── *.test.ts          配套单测
│   ├── components/      # UI 组件（无状态优先）
│   │   ├── CommandPalette.tsx 命令面板（Ctrl+K 全局搜索）
│   │   ├── ShortcutHelp.tsx   快捷键帮助弹窗
│   │   ├── GuideOverlay.tsx   用户引导覆盖层
│   │   ├── DevDashboard.tsx   开发者性能仪表板
│   │   ├── SyncDialog.tsx     多设备同步对话框
│   │   ├── ThemeEditor.tsx    主题颜色编辑器
│   │   └── ToastHost.tsx      Toast 通知容器
│   ├── pages/           # 路由页（紫微/大六壬/Wiki）
│   ├── App.tsx          # 路由根
│   ├── main.tsx         # 入口 + 全局错误兜底
│   └── index.css        # 全局样式入口（@import src/styles/）
├── docs/                # 文档（架构/调试 API/赋文库）
├── e2e/                 # Playwright 端到端测试
├── eslint.config.js     # ESLint 9 flat config
├── prettier.config.js   # Prettier 风格
├── lint-staged.config.js
├── vite.config.ts
└── tsconfig.json        # strict 模式
```

## 代码规范与工具链

### 一键检查

```bash
npm run quality   # typecheck + lint + format:check
```

### 分项命令

| 命令                   | 作用                                | 何时使用           |
| ---------------------- | ----------------------------------- | ------------------ |
| `npm run dev`          | 启动开发服务器（端口 5199）         | 日常开发           |
| `npm run dev:debug`    | 启动开发服务器（Vite debug 模式）   | 排查 Vite 问题     |
| `npm run typecheck`    | 仅跑 `tsc --noEmit`，不生成产物     | 快速确认类型无错   |
| `npm run lint`         | ESLint 全量（warn 不算失败）        | 提交前自检         |
| `npm run lint:fix`     | ESLint 自动修复可修项               | 处理批量 warning   |
| `npm run format`       | Prettier 格式化 src/                | 统一风格           |
| `npm run format:check` | 检查是否都格式化过                  | CI/CD 使用         |
| `npm test`             | vitest 跑全部单测                   | 任何改动后必跑     |
| `npm run test:watch`   | vitest watch 模式（改代码自动重跑） | 开发时持续测试     |
| `npm run test:ui`      | vitest UI 模式（可视化测试界面）    | 可视化查看测试结果 |

### 提交时自动检查

- **husky** 注册 `pre-commit` 钩子，仅对 staged 文件跑 Prettier + ESLint。
- **lint-staged** 控制范围——`src/**/*.{ts,tsx,css}` 走 Prettier+ESLint；`**/*.{md,json}` 仅 Prettier。
- 不想跑钩子？`git commit --no-verify`（紧急修复时使用，正常开发不建议跳过）。

### ESLint 规则哲学

- **错误（error）**——真 bug：`react-hooks/rules-of-hooks`、`eqeqeq`、`no-var` 等。
- **警告（warn）**——建议项：`@typescript-eslint/no-explicit-any`、`ban-ts-comment`、`react-hooks/exhaustive-deps`、`consistent-type-imports` 等。warn 不阻塞构建。
- 规则渐进收紧——先抓真错误，再逐步把高频 warning 转 error。

### TypeScript strict 模式

项目 `tsconfig.json` 开启 `strict: true`，意味着：

- `strictNullChecks`——必须处理 null/undefined
- `noImplicitAny`——函数参数必须有类型
- `strictFunctionTypes`——函数参数逆变

新增代码若报类型错，**优先写准确类型**而非 `any`；实在无法确定时用 `unknown` + 类型守卫。

### Prettier 风格

- 100 字符行宽（中文注释友好）
- 双引号 + 分号 + 尾逗号
- 单参数箭头函数无括号：`x => x`

冲突以 Prettier 为准（ESLint 已关掉格式类规则）。

## 调试工具

### 浏览器控制台——`window.peep`

开发环境（`import.meta.env.DEV`）暴露的全局对象。详见 [`docs/debug-api.md`](debug-api.md)。

```js
// 查看版本 + 可用方法
peep.version();

// 新手友好帮助（含可运行代码示例）
peep.help();

// 查看运行环境（版本/模式/内存/回调状态等）
peep.env();

// 健康检查（验证核心功能是否正常）
await peep.health();

// 切到人物 1 的大限，指定时间
await peep.ZiWei(1, "decadal", "2024-06-15");

// 创建大六壬起课
await peep.DaLiuRenCreate({
  personId: 1,
  question: "明天面试如何？",
  tags: ["面试"],
});
```

### 新增调试工具（v0.1.0+）

| 方法            | 作用                                  | 使用场景             |
| --------------- | ------------------------------------- | -------------------- |
| `peep.help()`   | 控制台显示常用命令和示例              | 忘记 API 时快速查阅  |
| `peep.env()`    | 查看环境信息（版本/模式/回调/内存等） | 排查"代码没生效"问题 |
| `peep.health()` | 健康检查（回调/IndexedDB/引擎/缓存）  | 排查"排盘失败"问题   |

### 结构化日志

调试 API 已接入分级日志（带分类标签和时间戳），浏览器控制台可按分类过滤：

```js
// 调整日志级别——开发期建议 debug
peep.setLogLevel("debug");
```

日志格式：`[peep 10:30:45][ZiWei] 执行成功 { personId: 1, scope: "decadal" }`

- `debug` 灰：内部流程（回调注册、耗时）
- `info` 蓝：每个 API 的起止
- `warn` 橙：可能问题（未用）
- `error` 红：API 失败（含上下文）

### 性能计时

调试 API 内置 `timer()` 工具——每个方法调用结束自动打印耗时：

```text
[peep 10:30:45][ZiWei] 耗时 23.4ms
```

排查慢调用时，把 logLevel 切到 `debug` 即可看到。

### 错误边界（ErrorBoundary）

开发环境下，渲染异常会显示更详细的错误信息：

- 错误消息和类型
- 组件栈（可展开）
- 发生时间
- "复制错误"按钮（一键复制到剪贴板）
- 控制台结构化输出（带颜色标记，便于搜索）

生产环境保持通用错误提示，不泄露内部信息。

### 开发模式启动横幅

应用启动时（DEV 模式）会在控制台输出：

- 版本号和构建时间
- 运行模式和 Base URL
- 页面加载完成后的启动耗时
- 调试 API 提示（`peep.version()` / `peep.setLogLevel("debug")`）

### React DevTools

项目使用 React 18 + StrictMode，推荐装 [React DevTools](https://react.dev/learn/react-developer-tools)：

- Components 面板：查看组件 props/state
- Profiler 面板：记录渲染耗时，排查重渲染

### Vite HMR 调试

- 保存文件即热替换（CSS/React 组件均支持）
- 编译错误直接以浮层形式覆盖在页面（`server.hmr.overlay: true`）
- 端口 5199 严格占用——冲突时立即报错（`strictPort: true`），避免悄悄切换

## 性能与启动优化

### Dev server 冷启动

`vite.config.ts` 已配置 `optimizeDeps.include` 预打包大型依赖：

- React 生态（react / react-dom / react-router-dom）
- 命理引擎（iztro / dexie / lunar-lite / lunar-typescript / @toon-format/toon）

首次启动会多几秒预构建；后续启动秒开。

### 构建产物分析

```bash
npm run build
# 查看产物分布：
# - engine-Bxxxx.js    命理引擎 (~467KB gzip 147KB)
# - react-Cxxxx.js     React 核心 (~140KB gzip 45KB)
# - index-Dxxxx.js     应用主包 (~403KB gzip 137KB)
```

`manualChunks` 把引擎/React/应用分离，浏览器可并行下载、长期缓存 engine+react chunk。

### 测试速度

33 个测试文件、1474 个测试用例，单次约 29 秒。跑单项：

```bash
# 只跑某个测试文件
npx vitest run src/core/analysis.test.ts

# watch 模式——改代码自动重跑
npx vitest
```

## 常见问题 FAQ

### Q: 启动时报 "Port 5199 is already in use"

**A**: 端口被占用。`strictPort: true` 会直接退出而非自动换端口。解决：

```bash
# 查找占用进程
lsof -i :5199
# 杀死后重启，或临时改端口
npm run dev -- --port 5200
```

### Q: 修改文件后页面不更新

**A**: HMR 失效的几种情况：

1. 修改了 `vite.config.ts` 或 `tsconfig.json`——需重启 dev server
2. 修改了 `.env` 文件——同上
3. `index.css` 的改动偶尔需要 hard reload（Cmd+Shift+R）

### Q: tsc 报 "Cannot find name '**PEEP_VERSION**'"

**A**: `__PEEP_VERSION__` / `__PEEP_BUILD_TIME__` 是 Vite `define` 注入的全局常量，类型声明在 `src/vite-env.d.ts`。确保 `vite-env.d.ts` 在 tsconfig include 内（已在 src/ 下）。

### Q: `window.peep` 在生产环境不可用？

**A**: 预期行为。`initDebugApi()` 内部判断 `import.meta.env.DEV`，生产构建会被 tree-shaken。这是安全设计——不要把敏感逻辑放在 peep API。

### Q: ESLint 报 182 warnings 烦人，能不能关掉？

**A**: 不建议直接关掉。可以：

- 改阈值：`npm run lint -- --quiet` 仅显示 error
- 收紧规则：在 `eslint.config.js` 把特定 warning 转 error（或 off）
- 逐文件 disable：`// eslint-disable-next-line <rule>` 加说明

### Q: 跑 `npm test` 偶尔失败、再跑又过？

**A**: 异步测试的时序问题。调试 API 类测试依赖 `requestAnimationFrame`，偶发超时。重跑一般就过；若频繁失败，增加 `waitForCallbacks` 的 timeout 参数。

### Q: 提交时 husky pre-commit 失败

**A**: 说明 staged 文件有 lint/format 问题。解决：

```bash
# 自动修复可修项
npm run lint:fix
npm run format
# 重新 add
git add .
# 再提交
```

紧急情况下可 `git commit --no-verify` 跳过（不推荐）。

### Q: 添加新的运限级别 / 星耀类型该改哪些文件？

**A**: 按这个顺序排查：

1. `src/core/useZwds.ts`——引擎接口
2. `src/core/analysis.ts` / `hbar.ts` / `lifeKline.ts`——分析层
3. `src/core/exportData.ts`——导出层（注意 K线量化数据**不随导出**的口径）
4. `src/components/`——UI 展示
5. `src/core/knowledge.ts` + `docs/kb/`——知识库
6. `src/core/debugApi.ts` + `docs/debug-api.md`——调试接口和文档
7. 相关 `*.test.ts`——单元测试

## 贡献流程

1. 拉取最新 main：`git pull origin main`
2. 创建分支（可选）：`git checkout -b feat/xxx`（小改动可直接在 main）
3. 改代码、写测试
4. 自检：`npm run quality && npm test`
5. 提交：中文提交信息，格式 `类别：概述——细节`
   - `功能：` 新功能
   - `修：` 修复
   - `文档：` 文档
   - `重构：` 重构
6. 推送：`git push`（husky pre-commit 自动跑 lint-staged）

### 提交信息示例

```text
功能：开发体验——Vite 配置优化 + 调试 API 结构化日志
修：大六壬调试 API UI 状态同步
文档：补充 debug-api.md 的 Wiki 部分
重构：analysis.ts 提取纯函数便于单测
```
