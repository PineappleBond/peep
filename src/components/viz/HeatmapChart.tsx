/**
 * 热力图（流日吉凶）——日历视图展示全年每日吉凶
 *
 * 设计：
 * 1. 类似 GitHub 贡献图的网格布局
 * 2. 颜色深浅表示吉凶程度（绿→红）
 * 3. 悬停显示当日详情
 * 4. 按月/周分组
 * 5. 响应式尺寸
 */
import { useMemo, useState, memo } from "react";
import type { LifeKlineData, KlineDomain } from "../../core/lifeKline";
import { CHART_DEFAULTS, DOMAIN_COLORS, scoreColor, resolveColor } from "./chartTheme";
import { SvgTooltip } from "./ChartTooltip";

/** 单日数据 */
type DayData = {
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  day: number;
  score: number; // 0-100
  ganZhi: string;
  domain: string;
};

type HeatmapChartProps = {
  /** 人生K线数据 */
  lifeKline: LifeKlineData;
  /** 选中的宫位域（默认命宫） */
  domainKey?: string;
  /** 选中年份 */
  year?: number;
  /** 图表宽度 */
  width?: number;
};

/** 生成某年的日历网格（简化版：基于年K线插值） */
function generateYearData(lifeKline: LifeKlineData, domainKey: string, year: number): DayData[] {
  const domain = lifeKline.domains.find(d => d.key === domainKey);
  if (!domain) return [];

  // 找到该年的K线数据
  const yearData = domain.years.find(y => y.year === year);
  if (!yearData) return [];

  const days: DayData[] = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // 简化：基于年K线的 open/close 插值生成每日评分
  // 实际应该调用流日计算（此处为演示）
  const yearDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const baseScore = yearData.open;
  const targetScore = yearData.close;

  for (let i = 0; i < yearDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // 线性插值 + 随机波动
    const progress = i / yearDays;
    const trend = baseScore + (targetScore - baseScore) * progress;
    const noise = (Math.random() - 0.5) * 10;
    const score = Math.max(0, Math.min(100, Math.round(trend + noise)));

    const dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    days.push({
      date: dateStr,
      year,
      month: date.getMonth() + 1,
      day: date.getDate(),
      score,
      ganZhi: "", // 简化：不计算干支
      domain: domain.palaceName,
    });
  }

  return days;
}

export const HeatmapChart = memo(function HeatmapChart({
  lifeKline,
  domainKey = "p0",
  year = new Date().getFullYear(),
  width = 800,
}: HeatmapChartProps) {
  const [hoverDay, setHoverDay] = useState<DayData | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // 生成全年数据
  const days = useMemo(
    () => generateYearData(lifeKline, domainKey, year),
    [lifeKline, domainKey, year],
  );

  // 图表参数
  const cellSize = 12;
  const cellGap = 2;
  const margin = { top: 30, right: 20, bottom: 40, left: 40 };

  // 按月分组
  const months = useMemo(() => {
    const grouped = new Map<number, DayData[]>();
    for (const d of days) {
      const arr = grouped.get(d.month) ?? [];
      arr.push(d);
      grouped.set(d.month, arr);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [days]);

  // 计算网格位置（周 x 日）
  const getCellPos = (day: DayData, weekOffset: number) => {
    const date = new Date(day.year, day.month - 1, day.day);
    const dayOfWeek = date.getDay(); // 0=周日
    const x = margin.left + weekOffset * (cellSize + cellGap);
    const y = margin.top + dayOfWeek * (cellSize + cellGap);
    return { x, y };
  };

  // 计算每周的起始位置
  const weekOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let weekIdx = 0;
    const firstDay = new Date(year, 0, 1);
    const firstDayOfWeek = firstDay.getDay();

    for (const d of days) {
      const date = new Date(d.year, d.month - 1, d.day);
      const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
      const week = Math.floor((dayOfYear + firstDayOfWeek) / 7);
      offsets.set(d.date, week);
      weekIdx = Math.max(weekIdx, week);
    }
    return { offsets, totalWeeks: weekIdx + 1 };
  }, [days, year]);

  const height = margin.top + margin.bottom + 7 * (cellSize + cellGap);

  return (
    <div className="heatmap-chart" role="figure" aria-label={`${year}年流日吉凶热力图`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="heatmap-svg"
        role="img"
        aria-label="全年每日吉凶热力图"
      >
        {/* 月份标签 */}
        {months.map(([month, monthDays], i) => {
          if (monthDays.length === 0) return null;
          const firstDay = monthDays[0];
          const week = weekOffsets.offsets.get(firstDay.date) ?? 0;
          const x = margin.left + week * (cellSize + cellGap);
          return (
            <text key={month} x={x} y={margin.top - 8} fill={CHART_DEFAULTS.textFill} fontSize={10}>
              {month}月
            </text>
          );
        })}

        {/* 日期格子 */}
        {days.map(day => {
          const week = weekOffsets.offsets.get(day.date) ?? 0;
          const { x, y } = getCellPos(day, week);
          const color = scoreColor(day.score, 50);

          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={resolveColor(color)}
              fillOpacity={0.3 + (day.score / 100) * 0.7}
              stroke="transparent"
              strokeWidth={1}
              style={{ cursor: "pointer", transition: "all 0.15s ease" }}
              onMouseEnter={e => {
                setHoverDay(day);
                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (rect) {
                  setHoverPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }
              }}
              onMouseLeave={() => setHoverDay(null)}
            />
          );
        })}

        {/* 图例 */}
        <g transform={`translate(${width - 150}, ${height - 20})`}>
          <text x={0} y={0} fill={CHART_DEFAULTS.textFill} fontSize={10}>
            凶
          </text>
          {[20, 40, 60, 80].map((score, i) => (
            <rect
              key={i}
              x={20 + i * 16}
              y={-10}
              width={12}
              height={12}
              rx={2}
              fill={resolveColor(scoreColor(score, 50))}
              fillOpacity={0.3 + (score / 100) * 0.7}
            />
          ))}
          <text x={100} y={0} fill={CHART_DEFAULTS.textFill} fontSize={10}>
            吉
          </text>
        </g>

        {/* Tooltip */}
        {hoverDay && (
          <SvgTooltip
            visible
            x={hoverPos.x}
            y={hoverPos.y}
            viewWidth={width}
            viewHeight={height}
            size={{ width: 160, height: 80 }}
          >
            <div style={{ fontWeight: 600 }}>
              {hoverDay.date}
              {hoverDay.ganZhi && ` (${hoverDay.ganZhi})`}
            </div>
            <div>
              评分：
              <strong style={{ color: resolveColor(scoreColor(hoverDay.score, 50)) }}>
                {hoverDay.score}
              </strong>
            </div>
            <div style={{ fontSize: "10px", color: "var(--dim)" }}>{hoverDay.domain}</div>
          </SvgTooltip>
        )}
      </svg>

      <div
        className="heatmap-note"
        style={{ marginTop: "8px", fontSize: "11px", color: "var(--dim)", lineHeight: 1.6 }}
      >
        基于年K线插值生成的每日评分（简化演示）。颜色越深表示吉凶程度越强。绿色为吉，红色为凶。
      </div>
    </div>
  );
});
