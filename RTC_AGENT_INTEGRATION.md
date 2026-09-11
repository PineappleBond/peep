# rtc-agent 组件集成说明

## 概述

peep 项目现在使用本地编译的 rtc-agent 组件，而不是 CDN 版本。这样可以确保使用最新的组件版本，并且不依赖外部网络。

## 工作流程

### 构建流程

1. **自动构建**：运行 `npm run build` 或 `npm run dev` 时，会自动执行 `build:rtc-agent` 脚本
2. **构建步骤**：
   - 编译 `web-components/packages/component`
   - 将编译产物复制到 `public/rtc-agent-component/`
   - 继续正常的 Vite 构建流程

### 手动构建

如果需要单独构建 rtc-agent 组件：

```bash
npm run build:rtc-agent
```

### 文件结构

```
peep/
├── public/
│   └── rtc-agent-component/    # 自动复制的编译产物（已加入 .gitignore）
│       ├── index.js            # ES module 入口
│       ├── index.umd.js        # UMD 版本
│       └── ...                 # 其他资源文件
└── scripts/
    └── build-rtc-agent.ts      # 构建脚本
```

## 开发注意事项

1. **首次启动**：确保先运行 `npm run build:rtc-agent` 或让 `npm run dev` 自动执行
2. **组件更新**：修改 web-component 代码后，需要重新运行构建
3. **版本控制**：`public/rtc-agent-component/` 已加入 .gitignore，不会提交到仓库

## 引用方式

在 `index.html` 中引用本地组件：

```html
<script type="module" src="/rtc-agent-component/index.js"></script>
```

## 故障排除

### 404 错误

如果遇到 `/rtc-agent-component/index.js` 404 错误：

1. 确保已运行 `npm run build:rtc-agent`
2. 检查 `public/rtc-agent-component/` 目录是否存在
3. 重启开发服务器

### 组件未更新

如果修改了 web-component 代码但未见效果：

1. 运行 `npm run build:rtc-agent` 重新构建
2. 清除浏览器缓存
3. 重启开发服务器
