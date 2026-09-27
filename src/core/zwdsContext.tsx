/**
 * 紫微排盘上下文：在 Ziwei 页面子树中共享排盘数据，避免显式 prop drilling。
 *
 * 设计要点：
 * - ZwdsProvider 包裹 Ziwei 页面的 Chart/HoroscopeBar 子树
 * - 子组件通过 useZwdsContext() 获取完整排盘数据，或通过 useZwdsSelector() 订阅特定切片
 * - 保留组件原有 prop 接口（向后兼容）：prop 显式传入时优先使用 prop，否则回退到 context
 * - 提供稳定 ref 访问（useZwdsRef），供事件回调读取最新值而不触发重渲染
 */
import { createContext, useContext, useMemo, useRef, useEffect, type ReactNode } from "react";
import type { Zwds } from "./useZwds";

/** 排盘数据上下文 */
const ZwdsContext = createContext<Zwds | null>(null);

/**
 * 排盘数据稳定引用上下文：
 * 存放最新的 z 对象 ref，供事件回调/命令读取而不触发组件重渲染。
 */
const ZwdsRefContext = createContext<React.MutableRefObject<Zwds | null> | null>(null);

/**
 * Zwds 提供者：包裹 Ziwei 页面的 Chart/HoroscopeBar 等排盘展示区域。
 * 同时提供 ref 上下文，便于调试 API 等非渲染场景读取最新数据。
 */
export function ZwdsProvider({ z, children }: { z: Zwds; children: ReactNode }) {
  // 维护稳定的 ref，始终指向最新 z
  const ref = useRef<Zwds | null>(z);
  useEffect(() => {
    ref.current = z;
  });

  return (
    <ZwdsRefContext.Provider value={ref}>
      <ZwdsContext.Provider value={z}>{children}</ZwdsContext.Provider>
    </ZwdsRefContext.Provider>
  );
}

/**
 * 获取完整的 Zwds 对象（必须在 ZwdsProvider 内使用）。
 * 注意：任何 pick/visible 变化都会触发使用此 hook 的组件重渲染；
 * 如需细粒度订阅请使用 useZwdsSelector()。
 */
export function useZwdsContext(): Zwds {
  const ctx = useContext(ZwdsContext);
  if (!ctx) {
    throw new Error("useZwdsContext 必须在 <ZwdsProvider> 内部使用");
  }
  return ctx;
}

/**
 * 可选地获取 Zwds 对象：不在 Provider 内时返回 null（不抛错）。
 * 用于 prop 回退场景——外部显式传 prop 时不需要 Provider。
 */
export function useZwdsContextOptional(): Zwds | null {
  return useContext(ZwdsContext);
}

/**
 * 选择器 hook：只订阅 Zwds 的特定切片，减少不必要的重渲染。
 * 选择器应返回稳定的原始值或引用（对象字段/已 useMemo 的数组）。
 *
 * 注意：由于 Zwds 对象每次 useZwds 返回新引用，selector 的相等性
 * 依赖 React 的引用比较。对于原始值（number/string/boolean）这很有效；
 * 对于对象值，确保 selector 返回的是 z 内部已 memo 的引用。
 */
export function useZwdsSelector<T>(selector: (z: Zwds) => T): T {
  const z = useZwdsContext();
  return selector(z);
}

/**
 * 获取排盘数据的稳定 ref（不触发重渲染）。
 * 供调试 API、事件回调等场景使用：读取 .current 即可获得最新值。
 */
export function useZwdsRef(): React.MutableRefObject<Zwds | null> {
  const ref = useContext(ZwdsRefContext);
  if (!ref) {
    throw new Error("useZwdsRef 必须在 <ZwdsProvider> 内部使用");
  }
  return ref;
}

/**
 * 合并 prop 与 context：prop 显式传入时优先使用 prop，否则回退到 context。
 * 用于组件向后兼容——prop 接口保留，但允许在 Provider 内省略。
 */
export function useZwdsProp(zProp?: Zwds | null): Zwds {
  const ctx = useContext(ZwdsContext);
  if (zProp) return zProp;
  if (ctx) return ctx;
  throw new Error("组件必须通过 prop 或 <ZwdsProvider> 提供排盘数据");
}

/**
 * 开发调试：获取当前 Zwds 上下文的快照摘要（仅 DEV 环境有效）。
 * 用于 DevDashboard / 控制台诊断。
 */
export function useZwdsDebugSnapshot() {
  const z = useZwdsContextOptional();
  return useMemo(() => {
    if (!z) return null;
    return {
      hasAstrolabe: !!z.astrolabe,
      hasHoroscope: !!z.horoscope,
      pickYear: z.pick.year,
      pickMonth: z.pick.month,
      pickDay: z.pick.day,
      pickHour: z.pick.hour,
      visible: { ...z.visible },
      decadesCount: z.decades.length,
      yearsCount: z.years.length,
      targetSolar: z.targetSolar,
    };
  }, [z]);
}
