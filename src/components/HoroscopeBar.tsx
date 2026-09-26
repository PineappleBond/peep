import type { ReactNode } from "react";
import { useEffect, useRef, memo } from "react";
import type { Scope } from "../core/utils";
import type { Zwds } from "../core/useZwds";
import { useI18n } from "../core/i18n";

/**
 * 底部运限拨盘（文墨天机式）：
 * 大限 → 流年 → 流月 → 流日 → 流时 五行联动，
 * 点行首标签开/关该层级在盘面上的显示。
 */

function Row({
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

  useEffect(() => {
    if (wrap) return;
    const el = box.current?.querySelector<HTMLElement>(".hcell.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeKey, wrap]);

  return (
    <div className={`hrow hrow-${scope}`}>
      <button
        className={`hlabel ${on ? "on" : ""}`}
        onClick={onToggle}
        title={toggleTitle}
        aria-pressed={on}
      >
        {label}
      </button>
      <div ref={box} className={`hcells ${wrap ? "hcells-grid" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function Cell({
  main,
  sub,
  scope,
  active,
  onClick,
  title,
}: {
  main: string;
  sub?: string;
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
    >
      <b>{main}</b>
      {sub ? <i>{sub}</i> : null}
    </button>
  );
}

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

  return (
    <section className="hbar" aria-label={t("hbar.label")}>
      <Row
        label={t("hbar.decadal")}
        scope="decadal"
        on={visible.decadal}
        onToggle={() => actions.toggleScope("decadal")}
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
        onToggle={() => actions.toggleScope("yearly")}
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
          />
        ))}
      </Row>

      <Row
        label={t("hbar.monthly")}
        scope="monthly"
        on={visible.monthly}
        onToggle={() => actions.toggleScope("monthly")}
        activeKey={`${pick.month}${effLeap ? "L" : ""}`}
        toggleTitle={visible.monthly ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {months.map(m => (
          <Cell
            key={`${m.month}${m.leap ? "L" : ""}`}
            main={m.label}
            sub={m.gz}
            scope="monthly"
            active={pick.month === m.month && effLeap === m.leap}
            onClick={() => actions.pickMonth(m.month, m.leap)}
            title={m.leap ? t("hbar.leapMonthHint") : undefined}
          />
        ))}
      </Row>

      <Row
        label={t("hbar.daily")}
        scope="daily"
        on={visible.daily}
        onToggle={() => actions.toggleScope("daily")}
        activeKey={`${pick.year}-${pick.month}-${clampedDay}`}
        wrap
        toggleTitle={visible.daily ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {days.map(d => (
          <Cell
            key={d.day}
            main={d.label}
            sub={d.gz}
            scope="daily"
            active={clampedDay === d.day}
            onClick={() => actions.pickDay(d.day)}
            title={d.gz ? t("hbar.dayTitle", { label: d.label, gz: d.gz }) : d.label}
          />
        ))}
      </Row>

      <Row
        label={t("hbar.hourly")}
        scope="hourly"
        on={visible.hourly}
        onToggle={() => actions.toggleScope("hourly")}
        activeKey={pick.hour}
        toggleTitle={visible.hourly ? t("hbar.toggleOff") : t("hbar.toggleOn")}
      >
        {hours.map(h => (
          <Cell
            key={h.hour}
            main={h.label}
            sub={h.gz}
            scope="hourly"
            active={pick.hour === h.hour}
            onClick={() => actions.pickHour(h.hour)}
          />
        ))}
      </Row>
    </section>
  );
});
