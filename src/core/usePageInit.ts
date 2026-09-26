/**
 * 页面级共享 hooks
 * - useDefaultPerson：加载默认人物并监听人物切换事件
 *   消除 DaLiuRenPage / WikiPage 的重复初始化逻辑
 * - useDebouncedValue：搜索输入防抖
 * - useListData：统一列表数据获取（分页 + 搜索 + 标签 + 加载状态）
 *   消除 LiurenList / WikiList 的重复数据获取逻辑
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

/* ─────────────── useDebouncedValue ─────────────── */

/**
 * 防抖值 hook：延迟更新状态值，常用于搜索输入防抖。
 * @param value 原始值（通常来自 input onChange）
 * @param delay 延迟毫秒数（默认 300ms）
 * @returns 防抖后的值，仅在 delay 内无新值时才更新
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ─────────────── useListData ─────────────── */

/** 列表数据查询结果（统一分页结构） */
export interface ListQueryResult<T> {
  items: T[];
  total: number;
}

/** useListData 选项 */
export interface UseListDataOptions<T> {
  /** 当前人物 ID */
  personId: number;
  /**
   * 数据获取函数：接收 (personId, filters) 返回列表数据。
   * 调用方负责适配各模块的 API（如 listLiurenRecords、listWikiDocs）。
   */
  fetchFn: (
    personId: number,
    filters: { searchText?: string; tags?: string[]; page?: number; pageSize?: number },
  ) => Promise<ListQueryResult<T>>;
  /** 标签获取函数（可选），用于渲染标签筛选按钮 */
  fetchTagsFn?: (personId: number) => Promise<string[]>;
  /** 每页条数（默认 20） */
  pageSize?: number;
  /** 搜索防抖延迟（默认 300ms） */
  debounceMs?: number;
  /** 刷新计数器，变化时重新加载数据 */
  refreshKey?: number;
}

/** useListData 返回值 */
export interface UseListDataResult<T> {
  /** 当前页数据 */
  items: T[];
  /** 总条数 */
  total: number;
  /** 当前页码（1-based） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 搜索文本（受控值，直接绑定 input） */
  searchText: string;
  /** 防抖后的搜索文本（实际用于查询） */
  debouncedSearchText: string;
  /** 已选中的标签 */
  selectedTags: string[];
  /** 所有可用标签（来自 fetchTagsFn） */
  allTags: string[];
  /** 数据加载中 */
  loading: boolean;
  /** 是否首次加载（首次时展示全屏 loading，后续加载保留旧数据避免闪烁） */
  isFirstLoad: boolean;
  /** 加载错误信息 */
  loadError: string | null;
  /** 设置搜索文本 */
  setSearchText: (v: string) => void;
  /** 切换标签选中状态 */
  toggleTag: (tag: string) => void;
  /** 切到下一页 */
  nextPage: () => void;
  /** 切到上一页 */
  prevPage: () => void;
  /** 跳到指定页 */
  setPage: (p: number) => void;
  /** 命令式设置过滤条件（供外部 ref 调用） */
  setFilters: (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => void;
  /** 手动触发重新加载 */
  reload: () => void;
}

/**
 * 通用列表数据获取 hook：统一封装分页、搜索防抖、标签筛选、加载状态。
 *
 * 设计动机：
 * LiurenList 和 WikiList 有高度重复的数据获取逻辑（分页、搜索防抖、标签筛选、
 * loading/error/firstLoad 状态管理、命令式 setFilters 接口）。
 * 本 hook 将这部分逻辑提取为通用工具，消除重复代码。
 *
 * 缓存策略：
 * - 标签列表使用内存缓存（由各模块的 tagCache 实现），写入/删除后自动失效
 * - 列表数据不做客户端缓存（IndexedDB 本身就是持久化存储，每次查询都走数据库）
 * - 搜索输入通过防抖（默认 300ms）减少不必要的查询
 */
export function useListData<T>(options: UseListDataOptions<T>): UseListDataResult<T> {
  const {
    personId,
    fetchFn,
    fetchTagsFn,
    pageSize = 20,
    debounceMs = 300,
    refreshKey = 0,
  } = options;

  // ── 状态 ──
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 防抖搜索文本
  const debouncedSearchText = useDebouncedValue(searchText, debounceMs);

  // 搜索文本变化时重置到第一页
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchText]);

  // ── 数据加载 ──
  // 用 ref 保持最新 fetchFn，避免 useEffect 依赖变化导致重复加载
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchFnRef.current(personId, {
        searchText: debouncedSearchText,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        page,
        pageSize,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      console.error("[useListData] 加载数据失败", err);
      setLoadError("加载失败，请重试");
    } finally {
      setLoading(false);
      setIsFirstLoad(false);
    }
    // personId / debouncedSearchText / selectedTags / page / refreshKey 变化时重新加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, debouncedSearchText, selectedTags, page, pageSize, refreshKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── 标签加载 ──
  const fetchTagsFnRef = useRef(fetchTagsFn);
  useEffect(() => {
    fetchTagsFnRef.current = fetchTagsFn;
  }, [fetchTagsFn]);

  useEffect(() => {
    if (!fetchTagsFnRef.current) return;
    fetchTagsFnRef
      .current(personId)
      .then(setAllTags)
      .catch(err => {
        console.error("[useListData] 加载标签失败", err);
      });
    // items.length 变化时刷新标签（新增/删除记录后标签可能变化）
     
  }, [personId, items.length, refreshKey]);

  // ── 操作函数 ──
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
    setPage(1);
  }, []);

  const nextPage = useCallback(() => setPage(p => p + 1), []);
  const prevPage = useCallback(() => setPage(p => Math.max(1, p - 1)), []);

  // 命令式设置过滤条件（供外部 ref 调用）
  const setFilters = useCallback(
    (filters: { searchText?: string; selectedTags?: string[]; page?: number }) => {
      if (filters.searchText !== undefined) setSearchText(filters.searchText);
      if (filters.selectedTags !== undefined) setSelectedTags(filters.selectedTags);
      if (filters.page !== undefined) setPage(filters.page);
    },
    [],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return useMemo(
    () => ({
      items,
      total,
      page,
      pageSize,
      totalPages,
      searchText,
      debouncedSearchText,
      selectedTags,
      allTags,
      loading,
      isFirstLoad,
      loadError,
      setSearchText,
      toggleTag,
      nextPage,
      prevPage,
      setPage,
      setFilters,
      reload: loadData,
    }),
    [
      items,
      total,
      page,
      pageSize,
      totalPages,
      searchText,
      debouncedSearchText,
      selectedTags,
      allTags,
      loading,
      isFirstLoad,
      loadError,
      setSearchText,
      toggleTag,
      nextPage,
      prevPage,
      setPage,
      setFilters,
      loadData,
    ],
  );
}
