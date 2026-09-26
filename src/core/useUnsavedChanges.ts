/**
 * 未保存变更提示 Hook
 *
 * 设计：
 * - 当表单有未保存修改时，阻止用户意外离开页面（浏览器关闭/刷新）
 * - 通过 beforeunload 事件触发浏览器原生确认对话框
 * - 不侵入路由逻辑（WikiEditor 是组件内切换，不走路由）
 *
 * 使用：
 *   const [dirty, setDirty] = useState(false);
 *   useUnsavedChanges(dirty);
 */
import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      // 现代浏览器会忽略自定义 message，但仍需设置 returnValue 以触发确认
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
