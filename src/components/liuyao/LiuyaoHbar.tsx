/**
 * 六爻运限拨盘组件 - 4 行（流年/流月/流日/流时）
 */
import { memo } from "react";
import type { LiuyaoHbarData, LiuyaoHbarVisible, LiuyaoHbarPick } from "../../core/liuyao/hbar";

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
  if (!hbarData) {
    return <div className="liuyao-hbar-empty">请选择记录以查看时间轴</div>;
  }

  return (
    <div className="liuyao-hbar">
      {/* 流年行 */}
      <div className="liuyao-hbar-row" role="group" aria-label="流年">
        <button
          className="liuyao-hbar-label"
          aria-pressed={visible.yearly}
          onClick={() => onToggleVisible("yearly")}
        >
          流年
        </button>
        <div className="liuyao-hbar-cells" role="listbox">
          {hbarData.years.map((cell, idx) => (
            <button
              key={cell.year}
              role="option"
              aria-selected={idx === hbarData.activeYearIdx}
              className={`liuyao-hbar-cell ${idx === hbarData.activeYearIdx ? "active" : ""}`}
              onClick={() => onPick("year", cell.year)}
            >
              {cell.gz}
            </button>
          ))}
        </div>
      </div>

      {/* 流月行 */}
      {visible.yearly && (
        <div className="liuyao-hbar-row" role="group" aria-label="流月">
          <button
            className="liuyao-hbar-label"
            aria-pressed={visible.monthly}
            onClick={() => onToggleVisible("monthly")}
          >
            流月
          </button>
          <div className="liuyao-hbar-cells" role="listbox">
            {hbarData.months.map((cell, idx) => (
              <button
                key={`${pick.year}-${cell.month}`}
                role="option"
                aria-selected={idx === hbarData.activeMonthIdx}
                className={`liuyao-hbar-cell ${idx === hbarData.activeMonthIdx ? "active" : ""}`}
                onClick={() => onPick("month", cell.month)}
              >
                {cell.gz}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 流日行 */}
      {visible.monthly && (
        <div className="liuyao-hbar-row" role="group" aria-label="流日">
          <button
            className="liuyao-hbar-label"
            aria-pressed={visible.daily}
            onClick={() => onToggleVisible("daily")}
          >
            流日
          </button>
          <div className="liuyao-hbar-cells" role="listbox">
            {hbarData.days.map((cell, idx) => (
              <button
                key={`${pick.year}-${pick.month}-${cell.day}`}
                role="option"
                aria-selected={idx === hbarData.activeDayIdx}
                className={`liuyao-hbar-cell ${idx === hbarData.activeDayIdx ? "active" : ""}`}
                onClick={() => onPick("day", cell.day)}
              >
                {cell.gz}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 流时行 */}
      {visible.daily && (
        <div className="liuyao-hbar-row" role="group" aria-label="流时">
          <button
            className="liuyao-hbar-label"
            aria-pressed={visible.hourly}
            onClick={() => onToggleVisible("hourly")}
          >
            流时
          </button>
          <div className="liuyao-hbar-cells" role="listbox">
            {hbarData.hours.map((cell, idx) => (
              <button
                key={cell.hour}
                role="option"
                aria-selected={idx === hbarData.activeHourIdx}
                className={`liuyao-hbar-cell ${idx === hbarData.activeHourIdx ? "active" : ""}`}
                onClick={() => onPick("hour", cell.hour)}
              >
                {cell.gz}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
