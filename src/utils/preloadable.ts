/**
 * preloadable - 路由懒加载包装器（支持 hover 预加载）
 *
 * 设计：
 * - 包装 React.lazy 的 factory，在首次调用 import() 后缓存模块
 * - 提供 preload() 方法，可在 hover 等时机提前触发 chunk 下载
 * - 与 React.lazy 兼容：返回 { default } 模块的 Promise
 *
 * 使用：
 * const loader = preloadable(() => import("./pages/XPage"))
 * const XPage = lazy(loader.load)
 * // 在 NavLink 的 onMouseEnter 里调 loader.preload()
 */

export interface PreloadableLoader<T> {
  /** 供 React.lazy 使用的加载函数 */
  load: () => Promise<T>;
  /** 提前触发 chunk 下载（幂等：已加载则不再发起请求） */
  preload: () => void;
}

/**
 * 创建可预加载的懒加载包装
 * @param factory 返回 Promise 的 import 函数（需要返回带 default 导出的模块）
 */
export function preloadable<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
): PreloadableLoader<T> {
  let promise: Promise<T> | null = null;

  const load = () => {
    if (!promise) {
      promise = factory();
      // 错误时清空 promise，允许下次重新加载
      promise.catch(() => {
        promise = null;
      });
    }
    return promise;
  };

  const preload = () => {
    load();
  };

  return { load, preload };
}
