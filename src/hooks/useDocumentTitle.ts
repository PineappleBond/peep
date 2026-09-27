/**
 * useDocumentTitle - 动态设置页面标题
 *
 * 设计：
 * - 组件挂载时设置 document.title，卸载时恢复原值
 * - 支持国际化：传入 i18n 键或静态字符串
 * - 保留应用名前缀（"窥见人生 ·"），统一品牌展示
 * - 若 title 为空则只保留前缀
 */
import { useEffect, useRef } from "react";

/** 应用名称前缀——显示在标题最前 */
const APP_PREFIX = "窥见人生";

/**
 * 设置页面标题
 * @param title 页面标题（已翻译的文本）；为空时仅显示应用名
 * @param options.keepPrefix 是否保留应用名前缀（默认 true）
 */
export function useDocumentTitle(
  title: string | undefined,
  options: { keepPrefix?: boolean } = {},
): void {
  const { keepPrefix = true } = options;
  const previousTitleRef = useRef<string | null>(null);

  useEffect(() => {
    // 保存旧标题（首次设置时）
    if (previousTitleRef.current === null) {
      previousTitleRef.current = document.title;
    }

    const parts: string[] = [];
    if (keepPrefix) parts.push(APP_PREFIX);
    if (title && title.trim()) parts.push(title.trim());

    document.title = parts.join(" · ");

    // 卸载时恢复原标题
    return () => {
      if (previousTitleRef.current !== null) {
        document.title = previousTitleRef.current;
        previousTitleRef.current = null;
      }
    };
  }, [title, keepPrefix]);
}
