/**
 * 人生K线图——基于 lifeKline 数据的可视化
 *
 * 功能：
 * 1. 蜡烛图渲染（开高低收 + 进出动能阴影）
 * 2. 域切换（十二宫选择）
 * 3. 时间范围选择（全部/大限段/自定义区间）
 * 4. 缩放/平移（鼠标滚轮 + 拖拽）
 * 5. 悬停显示详情（年份/干支/评分/引动因子）
 * 6. 大限段背景色带 + 均值线
 * 7. 响应式尺寸 + 暗色主题
 * 8. 无障碍：aria-label 标注
 */
import { useCallback, useMemo, useRef, useState, memo } from "react";
import type { LifeKlineData, KlineDomain, KlineYear } from "../../core/lifeKline";
import {
  CHART_DEFAULTS,
  DOMAIN_COLORS,
  linearScale,
  niceTickValues,
  resolveColor,
} from "./chartTheme";
import { SvgTooltip, ChartAxes } from "./ChartTooltip";

type KlineChartProps = {
  /** 人生K线数据 */
  data: LifeKlineData;
  /** 初始选中域（默认命宫） */
  initialDomain?: string;
  /** 自定义宽度（默认容器自适应） */
  width?: number;
  /** 自定义高度 */
  height?: number;
};

/** 时间范围模式 */
type RangeMode = "all" | "decade" | "custom";

export const KlineChart = memo(function KlineChart({
  data,
  initialDomain = "命宫",
  width = 900,
  height = 420,
}: KlineChartProps) {
  const { domains, bands } = data;

  // 当前选中域
  const [domainKey, setDomainKey] = useState<string>(() => {
    const found = domains.find(d => d.palaceName === initialDomain);
    return found?.key ?? domains[0]?.key ?? "";
  });
  const domain = domains.find(d => d.key === domainKey) ?? domains[0];

  // 时间范围
  const [rangeMode, setRangeMode] = useState<RangeMode>("all");
  const [selectedDecadeIdx, setSelectedDecadeIdx] = useState(0);

  // 缩放/平移状态（viewStart/viewEnd 为年份索引）
  const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);

  // 悬停状态
  const [hoverYear, setHoverYear] = useState<KlineYear | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // SVG 引用
  const svgRef = useRef<SVGSVGElement>(null);

  // 过滤后的数据
  const years = useMemo(() => {
    if (!domain) return [];
    let result = domain.years;
    if (rangeMode === "decade" && bands[selectedDecadeIdx]) {
      const b = bands[selectedDecadeIdx];
      result = result.filter(y => y.year >= b.startYear && y.year <= b.endYear);
    } else if (rangeMode === "custom" && viewRange) {
      result = result.filter(y => y.year >= viewRange.start && y.year <= viewRange.end);
    }
    return result;
  }, [domain, rangeMode, selectedDecadeIdx, bands, viewRange]);

  // 图表尺寸
  const margin = CHART_DEFAULTS.margin;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Y 轴范围（固定 0-100）
  const yDomain: [number, number] = [0, 100];
  const yScale = linearScale(yDomain, [height - margin.bottom, margin.top]);

  // X 轴比例（band 等宽）
  const xScale = useCallback(
    (idx: number) => {
      if (years.length <= 1) return margin.left + plotW / 2;
      return margin.left + (idx / (years.length - 1)) * plotW;
    },
    [years.length, margin.left, plotW],
  );

  // Y 轴刻度
  const yTicks = useMemo(() => {
    const vals = niceTickValues(yDomain[0], yDomain[1], 5);
    return vals.map(v => ({ value: v }));
  }, [yDomain]);

  // X 轴刻度（稀疏显示，避免拥挤）
  const xTicks = useMemo(() => {
    if (years.length === 0) return [];
    const step = Math.max(1, Math.floor(years.length / 10));
    return years
      .filter((_, i) => i % step === 0 || i === years.length - 1)
      .map(y => ({ value: y.year, label: String(y.year) }));
  }, [years]);

  // 蜡烛宽度
  const candleWidth = Math.max(2, Math.min(12, plotW / years.length - 2));

  // 鼠标事件
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || years.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // 找最近的年份
      let minDist = Infinity;
      let closest: KlineYear | null = null;
      years.forEach((y, i) => {
        const cx = xScale(i);
        const dist = Math.abs(mx - cx);
        if (dist < minDist) {
          minDist = dist;
          closest = y;
        }
      });

      if (closest && minDist < candleWidth * 2) {
        setHoverYear(closest);
        setHoverPos({ x: mx, y: my });
      } else {
        setHoverYear(null);
      }
    },
    [years, xScale, candleWidth],
  );

  const handleMouseLeave = useCallback(() => setHoverYear(null), []);

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (years.length === 0) return;

      const delta = e.deltaY > 0 ? 1 : -1; // 1=缩小，-1=放大
      const currentLen = years.length;
      const newLen = Math.max(10, Math.min(data.lastAge, currentLen + delta * 5));

      // 以鼠标位置为中心缩放
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const ratio = (mx - margin.left) / plotW;

      const centerYear = years[Math.floor(ratio * years.length)]?.year ?? years[0].year;
      const halfLen = Math.floor(newLen / 2);
      const start = domain.years[0].year;
      const end = domain.years[domain.years.length - 1].year;

      setViewRange({
        start: Math.max(start, centerYear - halfLen),
        end: Math.min(end, centerYear + halfLen),
      });
      setRangeMode("custom");
    },
    [years, margin.left, plotW, domain, data.lastAge],
  );

  if (!domain) return null;

  const color = DOMAIN_COLORS[domain.palaceName] ?? "var(--cyan)";

  return (
    <div className="kline-chart" role="figure" aria-label={`${domain.label}人生K线图`}>
      {/* 控制栏 */}
      <div className="kline-controls">
        <select
          value={domainKey}
          onChange={e => setDomainKey(e.target.value)}
          aria-label="选择宫位域"
        >
          {domains.map(d => (
            <option key={d.key} value={d.key}>
              {d.label}
              {d.isBody ? "（身宫）" : ""}
            </option>
          ))}
        </select>

        <div className="range-buttons">
          <button
            className={rangeMode === "all" ? "active" : ""}
            onClick={() => {
              setRangeMode("all");
              setViewRange(null);
            }}
          >
            全部
          </button>
          <select
            value={selectedDecadeIdx}
            onChange={e => {
              setSelectedDecadeIdx(Number(e.target.value));
              setRangeMode("decade");
            }}
            aria-label="选择大限段"
          >
            {bands.map((b, i) => (
              <option key={i} value={i}>
                {b.label}
              </option>
            ))}
          </select>
          {viewRange && (
            <button
              onClick={() => {
                setRangeMode("all");
                setViewRange(null);
              }}
            >
              重置缩放
            </button>
          )}
        </div>
      </div>

      {/* SVG 图表 */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="kline-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        role="img"
        aria-label={`${domain.label} K线图，共 ${years.length} 年数据`}
      >
        {/* 大限段背景色带 */}
        {rangeMode === "all" &&
          bands.map((b, i) => {
            const startIdx = years.findIndex(y => y.year >= b.startYear);
            const endIdx = years.findIndex(y => y.year > b.endYear);
            if (startIdx < 0) return null;
            const x1 = xScale(startIdx);
            const x2 = endIdx >= 0 ? xScale(endIdx - 1) : xScale(years.length - 1);
            return (
              <rect
                key={i}
                x={x1 - candleWidth / 2}
                y={margin.top}
                width={x2 - x1 + candleWidth}
                height={plotH}
                fill={i % 2 === 0 ? "rgba(96, 165, 250, 0.04)" : "rgba(243, 201, 107, 0.04)"}
              />
            );
          })}

        {/* 坐标轴 */}
        <ChartAxes
          xTicks={xTicks}
          yTicks={yTicks}
          xScale={(v: number) => {
            const idx = years.findIndex(y => y.year === v);
            return idx >= 0 ? xScale(idx) : 0;
          }}
          yScale={yScale}
          width={width}
          height={height}
          margin={margin}
          xLabel="年份"
          yLabel="评分"
        />

        {/* 50 分基线 */}
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={yScale(50)}
          y2={yScale(50)}
          stroke="var(--line-strong)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        {/* K线蜡烛 */}
        {years.map((y, i) => {
          const cx = xScale(i);
          const isUp = y.close >= y.open;
          const bodyColor = isUp ? resolveColor("var(--m-lu)") : resolveColor("var(--m-ji)");
          const bodyTop = yScale(Math.max(y.open, y.close));
          const bodyBottom = yScale(Math.min(y.open, y.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);

          return (
            <g key={y.year} className="kline-candle">
              {/* 上影线（进） */}
              <line
                x1={cx}
                x2={cx}
                y1={yScale(y.high)}
                y2={bodyTop}
                stroke={bodyColor}
                strokeWidth={1}
              />
              {/* 下影线（出） */}
              <line
                x1={cx}
                x2={cx}
                y1={bodyBottom}
                y2={yScale(y.low)}
                stroke={bodyColor}
                strokeWidth={1}
              />
              {/* 实体 */}
              <rect
                x={cx - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={isUp ? bodyColor : "none"}
                stroke={bodyColor}
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* 大限段均值线 */}
        {domain.decadeAvg.map((d, i) => {
          const startIdx = years.findIndex(y => y.year >= d.startYear);
          const endIdx = years.findIndex(y => y.year > d.endYear);
          if (startIdx < 0 || d.avg === 0) return null;
          const x1 = xScale(startIdx);
          const x2 = endIdx >= 0 ? xScale(endIdx - 1) : xScale(years.length - 1);
          return (
            <line
              key={i}
              x1={x1}
              x2={x2}
              y1={yScale(d.avg)}
              y2={yScale(d.avg)}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
              opacity={0.6}
            />
          );
        })}

        {/* 十字准星 + 悬停点 */}
        {hoverYear && (
          <>
            <line
              x1={xScale(years.indexOf(hoverYear))}
              x2={xScale(years.indexOf(hoverYear))}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="var(--line-strong)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={xScale(years.indexOf(hoverYear))}
              cy={yScale(hoverYear.close)}
              r={4}
              fill={color}
              stroke="var(--text)"
              strokeWidth={1.5}
            />
          </>
        )}

        {/* Tooltip */}
        {hoverYear && (
          <SvgTooltip
            visible
            x={hoverPos.x}
            y={hoverPos.y}
            viewWidth={width}
            viewHeight={height}
            size={{ width: 220, height: 140 }}
          >
            <div style={{ fontWeight: 600, color: resolveColor(color) }}>
              {hoverYear.year} 年（{hoverYear.ganZhi}）· {hoverYear.age} 岁
            </div>
            <div>
              评分：<strong>{hoverYear.close}</strong>
              <span style={{ color: hoverYear.net >= 0 ? "var(--m-lu)" : "var(--m-ji)" }}>
                {" "}
                ({hoverYear.net >= 0 ? "+" : ""}
                {hoverYear.net})
              </span>
            </div>
            <div>
              开：{hoverYear.open} | 收：{hoverYear.close}
            </div>
            <div>
              高：{hoverYear.high} | 低：{hoverYear.low}
            </div>
            <div>
              进：+{hoverYear.gain} | 出：-{hoverYear.drain}
            </div>
            <div style={{ color: "var(--dim)", fontSize: "10px", marginTop: "4px" }}>
              形态：{hoverYear.pattern}
            </div>
          </SvgTooltip>
        )}
      </svg>

      {/* 图例说明 */}
      <div className="kline-legend">
        <span className="legend-item">
          <span className="legend-color" style={{ background: "var(--m-lu)" }} />
          阳线（进）
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: "var(--m-ji)" }} />
          阴线（出）
        </span>
        <span className="legend-item">
          <span className="legend-line" style={{ borderColor: color }} />
          大限均值
        </span>
      </div>
    </div>
  );
});
