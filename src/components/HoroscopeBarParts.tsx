import type { ReactNode } from "react";
import { useEffect, useRef, memo } from "react";
import type { Scope } from "../core/utils";
import { useI18n } from "../core/i18n";

/**
 * HoroscopeBar 的 Row/Cell 子组件（提取为独立导出，供 LiuyaoHbar 复用）
 */

/** 行组件：使用 memo 避免父组件重渲染时不必要的更新 */
export const Row = memo(function Row({
  label,
  scope,
  on,
  onToggle,
  activeKey,
  wrap,
  toggleTitle,
  children,
}: {
  label: string;
  scope: Scope;
  on: boolean;
  onToggle: () => void;
  activeKey: string | number;
  wrap?: boolean;
  toggleTitle: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (wrap) return;
    const el = box.current?.querySelector<HTMLElement>(".hcell.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeKey, wrap]);

  return (
    <div className={`hrow hrow-${scope}`} role="group" aria-label={label}>
      <button
        className={`hlabel ${on ? "on" : ""}`}
        onClick={onToggle}
        title={toggleTitle}
        aria-pressed={on}
        type="button"
      >
        {label}
      </button>
      <div
        ref={box}
        className={`hcells ${wrap ? "hcells-grid" : ""}`}
        role="listbox"
        aria-label={t("hbar.listBox", { label })}
      >
        {children}
      </div>
    </div>
  );
});

/** 单元格组件：使用 memo 避免父组件重渲染时不必要的更新 */
export const Cell = memo(function Cell({
  main,
  sub,
  solar,
  scope,
  active,
  onClick,
  title,
}: {
  main: string;
  sub?: string;
  solar?: string;
  scope: Scope;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={`hcell ${active ? `on on-${scope}` : ""}`}
      onClick={onClick}
      title={title}
      aria-selected={active}
      type="button"
      role="option"
    >
      <b>{main}</b>
      {solar ? <i>{solar}</i> : null}
      {sub ? <i>{sub}</i> : null}
    </button>
  );
});
