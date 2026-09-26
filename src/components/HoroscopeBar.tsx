import type { ReactNode } from "react";
import { useEffect, useRef, memo, useMemo, useCallback } from "react";
import type { Scope } from "../core/utils";
import type { Zwds } from "../core/useZwds";
import { useI18n } from "../core/i18n";

/**
 * 底部运限拨盘（文墨天机式）：
 * 大限 → 流年 → 流月 → 流日 → 流时 五行联动，
 * 点行首标签开/关该层级在盘面上的显示。
 */

/** 行组件：使用 memo 避免父组件重渲染时不必要的更新 */
const Row = memo(function Row({
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
const Cell = memo(function Cell({
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

export const HoroscopeBar = memo(function HoroscopeBar({ z }: { z: Zwds }) {
  const { t } = useI18n();
  const {
    decades,
    childhood,
    activeDecadeIdx,
    years,
    months,
    days,
    hours,
    pick,
    clampedDay,
    effLeap,
    visible,
    actions,
  } = z;

  // 稳定化 toggle 回调，避免 Row 组件因新函数引用而重渲染
  const toggleDecadal = useCallback(() => actions.toggleScope("decadal"), [actions]);
  const toggleYearly = useCallback(() => actions.toggleScope("yearly"), [actions]);
  const toggleMonthly = useCallback(() => actions.toggleScope("monthly"), [actions]);
  const toggleDaily = useCallback(() => actions.toggleScope("daily"), [actions]);
  const toggleHourly = useCallback(() => actions.toggleScope("hourly"), [actions]);

  // 构建干支链提示信息
  const tooltipData = useMemo(() => {
    const decade = activeDecadeIdx >= 0 ? decades[activeDecadeIdx] : null;
    const decadeGz = decade ? `${decade.heavenlyStem}${decade.earthlyBranch}` : "";
    const year = years.find(y => y.year === pick.year);
    const yearGz = year?.gz ?? "";
    const month = months.find(m => m.month === pick.month && m.leap === effLeap);
    const monthGz = month?.gz ?? "";
    const day = days.find(d => d.day === clampedDay);
    const dayGz = day?.gz ?? "";
    const hour = hours[pick.hour];
    const hourGz = hour?.gz ?? "";

    return { decadeGz, yearGz, monthGz, dayGz, hourGz };
  }, [decades, activeDecadeIdx, years, months, days, hours, pick, effLeap, clampedDay]);

  return (
    <section className="hbar" aria-label={t("hbar.label")}>
      <Row
        label={t("hbar.decadal")}
        scope="decadal"
        on={visible.decadal}
        onToggle={toggleDecadal}
        activeKey={activeDecadeIdx}
        toggleTitle={visible.decadal ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {childhood && (
          <Cell
            main={t("hbar.childhood")}
            sub={childhood.label}
            scope="decadal"
            active={activeDecadeIdx === -1}
            onClick={() => actions.pickDecade(-1)}
            title={t("hbar.childhoodYear", { start: childhood.startYear, end: childhood.endYear })}
          />
        )}
        {decades.map((d, k) => (
          <Cell
            key={`${d.range[0]}-${d.earthlyBranch}`}
            main={`${d.range[0]}~${d.range[1]}`}
            sub={t("hbar.decadalSub", { stem: d.heavenlyStem, branch: d.earthlyBranch })}
            scope="decadal"
            active={activeDecadeIdx === k}
            onClick={() => actions.pickDecade(k)}
            title={t("hbar.decadalTitle", { start: d.startYear, end: d.endYear })}
          />
        ))}
      </Row>

      <Row
        label={t("hbar.yearly")}
        scope="yearly"
        on={visible.yearly}
        onToggle={toggleYearly}
        activeKey={pick.year}
        toggleTitle={visible.yearly ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {years.map(y => (
          <Cell
            key={y.year}
            main={`${y.year}`}
            sub={`${y.gz}·${y.age}`}
            scope="yearly"
            active={pick.year === y.year}
            onClick={() => actions.pickYear(y.year)}
            title={tooltipData.decadeGz ? `${tooltipData.decadeGz} ${y.gz}` : y.gz}
          />
        ))}
      </Row>

      <Row
        label={t("hbar.monthly")}
        scope="monthly"
        on={visible.monthly}
        onToggle={toggleMonthly}
        activeKey={`${pick.month}${effLeap ? "L" : ""}`}
        toggleTitle={visible.monthly ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {months.map(m => {
          const tooltipParts = [];
          if (tooltipData.decadeGz) tooltipParts.push(tooltipData.decadeGz);
          if (tooltipData.yearGz) tooltipParts.push(tooltipData.yearGz);
          if (m.gz) tooltipParts.push(m.gz);
          return (
            <Cell
              key={`${m.month}${m.leap ? "L" : ""}`}
              main={m.solarLabel}
              solar={m.label}
              sub={m.gz}
              scope="monthly"
              active={pick.month === m.month && effLeap === m.leap}
              onClick={() => actions.pickMonth(m.month, m.leap)}
              title={m.leap ? t("hbar.leapMonthHint") : tooltipParts.join(" ")}
            />
          );
        })}
      </Row>

      <Row
        label={t("hbar.daily")}
        scope="daily"
        on={visible.daily}
        onToggle={toggleDaily}
        activeKey={`${pick.year}-${pick.month}-${clampedDay}`}
        wrap
        toggleTitle={visible.daily ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {days.map(d => {
          const tooltipParts = [];
          if (tooltipData.decadeGz) tooltipParts.push(tooltipData.decadeGz);
          if (tooltipData.yearGz) tooltipParts.push(tooltipData.yearGz);
          if (tooltipData.monthGz) tooltipParts.push(tooltipData.monthGz);
          if (d.gz) tooltipParts.push(d.gz);
          return (
            <Cell
              key={d.day}
              main={d.solarLabel}
              solar={d.label}
              sub={d.gz}
              scope="daily"
              active={clampedDay === d.day}
              onClick={() => actions.pickDay(d.day)}
              title={tooltipParts.join(" ")}
            />
          );
        })}
      </Row>

      <Row
        label={t("hbar.hourly")}
        scope="hourly"
        on={visible.hourly}
        onToggle={toggleHourly}
        activeKey={pick.hour}
        toggleTitle={visible.hourly ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {hours.map(h => {
          const tooltipParts = [];
          if (tooltipData.decadeGz) tooltipParts.push(tooltipData.decadeGz);
          if (tooltipData.yearGz) tooltipParts.push(tooltipData.yearGz);
          if (tooltipData.monthGz) tooltipParts.push(tooltipData.monthGz);
          if (tooltipData.dayGz) tooltipParts.push(tooltipData.dayGz);
          if (h.gz) tooltipParts.push(h.gz);
          return (
            <Cell
              key={h.hour}
              main={h.label}
              sub={h.gz}
              scope="hourly"
              active={pick.hour === h.hour}
              onClick={() => actions.pickHour(h.hour)}
              title={tooltipParts.join(" ")}
            />
          );
        })}
      </Row>
    </section>
  );
});
