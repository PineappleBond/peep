import { memo, useEffect, useRef, type ReactNode } from "react";

/**
 * 运限拨盘基础组件 - 行容器
 * 用于八字和紫微斗数的运限选择器
 */

export function HoroscopeRow({
  label,
  scope,
  on,
  onToggle,
  activeKey,
  wrap,
  children,
}: {
  label: string;
  scope: "decadal" | "yearly" | "monthly" | "daily" | "hourly";
  on: boolean;
  onToggle?: () => void;
  activeKey: string | number;
  wrap?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrap) return;
    const el = box.current?.querySelector<HTMLElement>(".hcell.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeKey, wrap]);

  return (
    <div className={`hrow hrow-${scope}`}>
      {onToggle ? (
        <button
          className={`hlabel ${on ? "on" : ""}`}
          onClick={onToggle}
          title={on ? "点击隐藏该层级" : "点击显示该层级"}
        >
          {label}
        </button>
      ) : (
        <div className={`hlabel ${on ? "on" : ""}`}>
          {label}
        </div>
      )}
      <div ref={box} className={`hcells ${wrap ? "hcells-grid" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export const HoroscopeCell = memo(function HoroscopeCell({
  main,
  sub,
  scope,
  active,
  onClick,
  title,
}: {
  main: string;
  sub?: string;
  scope: "decadal" | "yearly" | "monthly" | "daily" | "hourly";
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button className={`hcell ${active ? `on on-${scope}` : ""}`} onClick={onClick} title={title}>
      <b>{main}</b>
      {sub ? <i>{sub}</i> : null}
    </button>
  );
});
