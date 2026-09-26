/**
 * 示例插件 —— 演示插件系统的核心扩展能力
 *
 * 展示：
 * - 元数据声明
 * - 生命周期钩子（install / uninstall）
 * - 静态菜单 / 路由 / 组件扩展
 * - 使用 PluginContext 的 toast / storage / events API
 */
import type { Plugin } from "../core/pluginTypes";
import { SamplePluginPage } from "./SamplePluginPage";

/** 注入到 footer 的徽章组件 */
function SampleFooterBadge() {
  return (
    <span className="plugin-sample-badge" title="示例插件已启用">
      🧩 Sample
    </span>
  );
}

/** 菜单图标（使用 emoji 文字图标，避免引入额外 SVG） */
function SampleMenuIcon({ className }: { className?: string; "aria-hidden"?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 L14 8 L20 9 L15.5 13.5 L17 20 L12 16.5 L7 20 L8.5 13.5 L4 9 L10 8 Z" />
    </svg>
  );
}

export const samplePlugin: Plugin = {
  manifest: {
    id: "sample-plugin",
    name: "示例插件",
    version: "0.1.0",
    author: "peep-v2",
    description: "演示插件系统核心能力：菜单、路由、组件扩展 + 存储/事件 API",
  },

  // ── 生命周期 ─────────────────────────────
  install(ctx) {
    ctx.toast.show("示例插件已安装 ✨", "info");
    // 订阅一个示例事件，验证事件总线工作
    ctx.events.on("demo-click", payload => {
      // eslint-disable-next-line no-console
      console.info("[sample-plugin] 收到 demo-click 事件", payload);
    });
  },

  uninstall() {
    // 清理资源：事件监听器随 PluginContext 销毁，无需手动清理
  },

  enable() {
    // 启用时可以恢复定时器、订阅等
  },

  disable() {
    // 禁用时暂停活动资源
  },

  // ── 静态扩展 ─────────────────────────────
  menus: [
    {
      path: "/sample-plugin",
      label: "nav.samplePlugin",
      icon: SampleMenuIcon,
      order: 200, // 排在内置菜单之后
    },
  ],

  routes: [
    {
      path: "/sample-plugin",
      element: SamplePluginPage,
    },
  ],

  components: [
    {
      slot: "layout.footer",
      component: SampleFooterBadge,
      order: 100,
    },
  ],
};
