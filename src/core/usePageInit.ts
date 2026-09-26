/**
 * 页面级共享 hooks
 * - useDefaultPerson：加载默认人物并监听人物切换事件
 *   消除 DaLiuRenPage / WikiPage 的重复初始化逻辑
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person } from "./personDb";
import { getDefaultPerson } from "./personDb";
import { globalEvents } from "./events";

/**
 * 加载默认人物，监听 person.changed 事件。
 * @param onPersonChanged 切换人物时的额外处理（清空选中、刷新列表等）
 * @returns { person, initError, refresh }
 *   - person：当前人物，null 表示尚未加载
 *   - initError：初始化失败时的错误信息
 *   - refresh：手动刷新人物（目前仅用于调试 API）
 */
export function useDefaultPerson(onPersonChanged?: (newPerson: Person) => void) {
  const [person, setPerson] = useState<Person | null>(null);
  /** 初始化失败时展示错误提示（避免无限 loading） */
  const [initError, setInitError] = useState<string | null>(null);

  // 初始加载默认人物
  useEffect(() => {
    getDefaultPerson()
      .then(p => {
        if (p.id != null) setPerson(p);
        else setInitError("未找到默认人物，请刷新页面重试");
      })
      .catch(err => {
        console.error("[useDefaultPerson] 加载默认人物失败", err);
        setInitError("加载人物信息失败，请检查浏览器存储设置后刷新页面");
      });
  }, []);

  // 用 ref 保持 onPersonChanged 最新引用，避免 useEffect 依赖变化
  const onPersonChangedRef = useRef(onPersonChanged);
  useEffect(() => {
    onPersonChangedRef.current = onPersonChanged;
  }, [onPersonChanged]);

  // 监听全局人物切换事件（通过 ref 读取最新回调，避免每次渲染都重新订阅）
  useEffect(() => {
    const handlePersonChanged = (newPerson: Person) => {
      if (newPerson.id == null) return;
      setPerson(newPerson);
      onPersonChangedRef.current?.(newPerson);
    };
    globalEvents.on("person.changed", handlePersonChanged);
    return () => {
      globalEvents.off("person.changed", handlePersonChanged);
    };
  }, []);

  const refresh = useCallback(async () => {
    const p = await getDefaultPerson();
    if (p.id != null) setPerson(p);
  }, []);

  return { person, initError, refresh };
}

/**
 * 列表刷新计数器 hook。
 * @returns { refreshKey, refresh, refreshRef }
 *   - refreshKey：计数器，变化时应触发列表重新加载
 *   - refresh：递增计数器
 *   - refreshRef：同步 ref，供回调中读取最新值（避免闭包过时）
 */
export function useRefreshKey() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshRef = useRef(0);
  refreshRef.current = refreshKey;

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return { refreshKey, refresh, refreshRef };
}
