/**
 * 六爻运限拨盘组件 - 4 行（流年/流月/流日/流时）
 * 复用紫微斗数的 Row/Cell 组件，显示丰富的阳历、阴历、干支信息
 */
import { memo, useCallback } from "react";
import type { LiuyaoHbarData, LiuyaoHbarVisible, LiuyaoHbarPick } from "../../core/liuyao/hbar";
import { Row, Cell } from "../HoroscopeBarParts";

interface LiuyaoHbarProps {
  hbarData: LiuyaoHbarData | null;
  visible: LiuyaoHbarVisible;
  pick: LiuyaoHbarPick;
  onToggleVisible: (level: keyof LiuyaoHbarVisible) => void;
  onPick: (level: keyof LiuyaoHbarPick, value: number) => void;
}

export const LiuyaoHbar = memo(function LiuyaoHbar({
  hbarData,
  visible,
  pick,
  onToggleVisible,
  onPick,
}: LiuyaoHbarProps) {
  // 稳定化 toggle 回调
  const toggleYearly = useCallback(() => onToggleVisible("yearly"), [onToggleVisible]);
  const toggleMonthly = useCallback(() => onToggleVisible("monthly"), [onToggleVisible]);
  const toggleDaily = useCallback(() => onToggleVisible("daily"), [onToggleVisible]);
  const toggleHourly = useCallback(() => onToggleVisible("hourly"), [onToggleVisible]);

  if (!hbarData) {
    return <div className="liuyao-hbar-empty">请选择记录以查看时间轴</div>;
  }

  return (
    <div className="liuyao-hbar">
      {/* 流年行 */}
      <Row
        label="流年"
        scope="yearly"
        on={visible.yearly}
        onToggle={toggleYearly}
        activeKey={pick.year}
        toggleTitle={visible.yearly ? "点击隐藏该层级" : "点击显示该层级"}
      >
        {hbarData.years.map((y, idx) => (
          <Cell
            key={y.year}
            main={`${y.year}`}
            sub={`${y.gz}·${y.age}`}
            scope="yearly"
            active={idx === hbarData.activeYearIdx}
            onClick={() => onPick("year", y.year)}
            title={y.gz}
          />
        ))}
      </Row>

      {/* 流月行 */}
      {visible.yearly && (
        <Row
          label="流月"
          scope="monthly"
          on={visible.monthly}
          onToggle={toggleMonthly}
          activeKey={`${pick.month}`}
          toggleTitle={visible.monthly ? "点击隐藏该层级" : "点击显示该层级"}
        >
          {hbarData.months.map((m, idx) => {
            const tooltipParts = [];
            if (m.gz) tooltipParts.push(m.gz);
            return (
              <Cell
                key={`${m.month}${m.leap ? "L" : ""}`}
                main={m.solarLabel}
                solar={m.label}
                sub={m.gz}
                scope="monthly"
                active={idx === hbarData.activeMonthIdx}
                onClick={() => onPick("month", m.month)}
                title={m.leap ? "闰月" : tooltipParts.join(" ")}
              />
            );
          })}
        </Row>
      )}

      {/* 流日行 */}
      {visible.monthly && (
        <Row
          label="流日"
          scope="daily"
          on={visible.daily}
          onToggle={toggleDaily}
          activeKey={`${pick.year}-${pick.month}-${pick.day}`}
          toggleTitle={visible.daily ? "点击隐藏该层级" : "点击显示该层级"}
        >
          {hbarData.days.map((d, idx) => {
            const tooltipParts = [];
            if (d.gz) tooltipParts.push(d.gz);
            return (
              <Cell
                key={`${pick.year}-${pick.month}-${d.day}`}
                main={d.solarLabel}
                solar={d.label}
                sub={d.gz}
                scope="daily"
                active={idx === hbarData.activeDayIdx}
                onClick={() => onPick("day", d.day)}
                title={tooltipParts.join(" ")}
              />
            );
          })}
        </Row>
      )}

      {/* 流时行 */}
      {visible.daily && (
        <Row
          label="流时"
          scope="hourly"
          on={visible.hourly}
          onToggle={toggleHourly}
          activeKey={`${pick.hour}`}
          toggleTitle={visible.hourly ? "点击隐藏该层级" : "点击显示该层级"}
        >
          {hbarData.hours.map((h, idx) => (
            <Cell
              key={h.hour}
              main={h.label}
              sub={h.gz}
              scope="hourly"
              active={idx === hbarData.activeHourIdx}
              onClick={() => onPick("hour", h.hour)}
              title={h.gz}
            />
          ))}
        </Row>
      )}
    </div>
  );
});
