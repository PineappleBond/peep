# 插件开发指南

peep-v2 提供了一套轻量级的插件系统，允许第三方开发者扩展应用功能。插件以 TypeScript 模块形式注册，构建时受类型检查，运行时无额外沙箱开销。

## 快速开始

### 1. 创建插件文件

在 `src/plugins/` 下新建文件，例如 `myPlugin.tsx`：

```tsx
import type { Plugin } from "../core/pluginTypes";

export const myPlugin: Plugin = {
  manifest: {
    id: "my-plugin", // 唯一标识（kebab-case）
    name: "我的插件",
    version: "0.1.0",
    author: "Your Name",
    description: "做点什么的小插件",
  },

  install(ctx) {
    // 异步初始化（可选），可拉取远端配置
    ctx.toast.show("插件已加载 ✨", "info");
  },

  // 静态声明扩展点
  menus: [
    {
      path: "/my-plugin",
      label: "我的插件", // 或 i18n key，如 "nav.myPlugin"
      order: 200, // 数值越小越靠前
    },
  ],

  routes: [
    {
      path: "/my-plugin",
      element: MyPluginPage, // React 组件
    },
  ],

  components: [
    {
      slot: "layout.footer", // 注入位置
      component: MyBadge,
      order: 100,
    },
  ],
};
```

### 2. 注册到加载器

编辑 `src/core/pluginLoader.ts`，在 `BUILTIN_PLUGINS` 数组中追加：

```ts
import { myPlugin } from "../plugins/myPlugin";
const BUILTIN_PLUGINS = [samplePlugin, myPlugin];
```

完成。重启 dev server 即可看到效果。

## 扩展点

### 菜单（MenuExtension）

在 Header 导航区添加图标入口。

```ts
{
  path: "/my-plugin",         // 必填：路由路径
  label: "我的插件",           // 必填：显示标签或 i18n key
  icon?: MyIcon,              // 可选：24x24 SVG 风格图标组件
  end?: boolean,              // 可选：NavLink 严格匹配（默认前缀匹配）
  order?: number,             // 可选：排序权重，默认 100
}
```

### 路由（RouteExtension）

注册新的页面路由，由 `App.tsx` 在插件启用后动态渲染。

```ts
{
  path: "/my-plugin",
  element: MyPluginPage,       // React 组件（无需 React.lazy，插件模块已按需加载）
  lazy?: boolean,
}
```

### 组件插槽（ComponentExtension）

在宿主预留的可注入位置渲染自定义组件。

```ts
{
  slot: "layout.footer",      // 目标插槽（见 ComponentSlot 联合类型）
  component: MyBadge,
  order?: number,
}
```

**当前可用插槽：**

| 插槽名           | 位置          | 说明                       |
| ---------------- | ------------- | -------------------------- |
| `layout.footer`  | 页面底部      | 主 footer 内，iztro 链接后 |
| `header.actions` | Header 操作区 | PersonSelector 旁（预留）  |
| `ziwei.sidebar`  | 首页盘面侧边  | 预留                       |

> 新增插槽请在 `src/core/pluginTypes.tsx` 的 `ComponentSlot` 联合类型中追加字面量，并在宿主组件中调用 `pluginExtensions.slotComponents[slotName]` 渲染。

## PluginContext API

`install(ctx)` 钩子接收的上下文，提供插件与宿主交互的能力：

### toast

```ts
ctx.toast.show("保存成功", "success"); // 类型: "info" | "success" | "error"
```

### storage

按插件 id 隔离的持久化 KV 存储（基于 localStorage，键自动加前缀 `zwds-plugin:<id>:`）。

```ts
ctx.storage.set("counter", 42);
const n = ctx.storage.get<number>("counter", 0);
ctx.storage.remove("counter");
```

### events

命名空间化的事件总线，避免跨插件冲突：

```ts
// 触发：实际事件名为 `${pluginId}:demo`
ctx.events.emit("demo", { foo: 1 });

// 监听本插件命名空间事件
ctx.events.on("demo", payload => {
  /* ... */
});

// 监听全局事件（跨插件通信，谨慎使用）
ctx.events.onGlobal("other-plugin:broadcast", handler);
```

### 动态注册扩展

除静态声明外，也可以在 `install` 钩子中动态注册：

```ts
install(ctx) {
  ctx.registerMenu({ path: "/x", label: "X" });
  ctx.registerRoute({ path: "/x", element: PageX });
  ctx.registerComponent({ slot: "layout.footer", component: XBadge });
}
```

## 生命周期

| 钩子           | 触发时机 | 用途                                  |
| -------------- | -------- | ------------------------------------- |
| `install(ctx)` | 首次安装 | 异步初始化、订阅事件、拉取配置        |
| `enable()`     | 启用     | 启动定时器、恢复订阅                  |
| `disable()`    | 禁用     | 暂停活动资源                          |
| `uninstall()`  | 卸载前   | 清理资源（事件监听器随 ctx 自动销毁） |

典型流程：`register → install → enable → (disable → enable)* → uninstall`

## 调试

插件系统在 `window.__zwdsPlugins` 暴露调试接口，可在浏览器控制台使用：

```js
__zwdsPlugins.status(); // 列出所有插件状态
__zwdsPlugins.enabled(); // 列出启用的插件 id
__zwdsPlugins.count; // 已注册插件总数
__zwdsPlugins.dumpStorage("my-plugin"); // 查看某插件的存储内容
__zwdsPlugins.emitGlobal("foo", 1); // 触发全局事件（调试用）
```

## 设计边界

**本系统有意保持轻量：**

- 插件以 TS 模块形式静态注册，构建时检查，非动态代码加载
- 前端环境天然沙箱（无文件/网络特权），不做额外权限控制
- 不做 CPU/内存限制（浏览器同源策略已提供基础隔离）
- 不提供宿主内部状态的写权限，仅通过 events / storage / toast 暴露受控 API

**如需更重的扩展能力（自定义数据源、复杂 UI 注入、跨应用插件市场），建议：**

- 考虑 Module Federation / import maps 实现运行时动态加载
- 增加权限模型（Capability / Permission 清单）
- 引入 Web Worker 沙箱执行插件代码

## 示例

参考 `src/plugins/samplePlugin.tsx` 与 `src/plugins/SamplePluginPage.tsx`，展示：

- 静态 + 动态扩展注册
- 持久化存储（计数器 + 问候语）
- 命名空间事件触发
- Footer 徽章注入
- Header 菜单注入

启动 dev server 后访问 `/sample-plugin` 查看效果。
