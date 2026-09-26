/**
 * 插件加载器 —— 应用启动时调用
 *
 * 负责：
 * - 集中登记所有内建插件
 * - 按顺序安装并启用
 * - 失败不阻塞主应用启动
 */
import { registerAndEnable } from "../core/pluginSystem";

/** 内建插件清单：新增插件在此追加 */
const BUILTIN_PLUGINS: any[] = [];

let initialized = false;

/**
 * 初始化插件系统
 *
 * 建议在 App 顶层调用一次；重复调用为 no-op。
 */
export async function initPlugins(): Promise<void> {
  if (initialized) return;
  initialized = true;
  for (const plugin of BUILTIN_PLUGINS) {
    try {
      await registerAndEnable(plugin);
    } catch (err) {
      console.error(`[plugin-loader] 插件 "${plugin.manifest.id}" 加载失败`, err);
    }
  }
}
