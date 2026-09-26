/**
 * 图表 Tooltip 浮层——纯 SVG 内嵌渲染（避免 DOM/SVG 混合定位问题）
 *
 * 设计要点：
 * 1. 直接在 SVG 内渲染，通过 transform 定位
 * 2. 自动避让边缘（flip 到另一侧）
 * 3. 内容通过 children 传入（支持多行 text）
 */
import { type ReactNode } from "react";
import { CHART_DEFAULTS } from "./chartTheme";

type TooltipProps = {
  /** 是否显示 */
  visible: boolean;
  /** 锚点坐标（SVG 坐标系） */
  x: number;
  y: number;
  /** SVG viewBox 宽高（用于边界避让） */
  viewWidth: number;
  viewHeight: number;
  /** 浮层内容 */
  children: ReactNode;
  /** 可选：浮层尺寸（用于精确避让） */
  size?: { width: number; height: number };
};

export function SvgTooltip({
  visible,
  x,
  y,
  viewWidth,
  viewHeight,
  children,
  size = { width: 200, height: 100 },
}: TooltipProps) {
  if (!visible) return null;

  // 自动避让边界：优先右上，空间不足则翻转
  const pad = 12;
  let tx = x + pad;
  let ty = y - size.height / 2;
  if (tx + size.width > viewWidth - pad) tx = x - size.width - pad;
  if (ty < pad) ty = pad;
  if (ty + size.height > viewHeight - pad) ty = viewHeight - pad - size.height;

  return (
    <g
      className="chart-tooltip"
      transform={`translate(${tx},${ty})`}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      <rect
        width={size.width}
        height={size.height}
        rx={8}
        fill={CHART_DEFAULTS.tooltipBg}
        stroke={CHART_DEFAULTS.tooltipBorder}
        strokeWidth={1}
        style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
      />
      <foreignObject width={size.width} height={size.height} x={0} y={0}>
        <div
          style={{
            padding: "8px 10px",
            color: "var(--text)",
            fontSize: "11px",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        >
          {children}
        </div>
      </foreignObject>
    </g>
  );
}

/** 图表通用坐标轴（X/Y 轴 + 网格线） */
export function ChartAxes({
  xTicks,
  yTicks,
  xScale,
  yScale,
  width,
  height,
  margin,
  formatX = String,
  formatY = String,
  xLabel,
  yLabel,
}: {
  xTicks: { value: number; label?: string }[];
  yTicks: { value: number; label?: string }[];
  xScale: (v: number) => number;
  yScale: (v: number) => number;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
}) {
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  return (
    <g className="chart-axes">
      {/* 水平网格线 + Y 轴刻度 */}
      {yTicks.map(t => {
        const y = yScale(t.value);
        return (
          <g key={`y-${t.value}`}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y}
              y2={y}
              stroke={CHART_DEFAULTS.gridStroke}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={margin.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fill={CHART_DEFAULTS.textFill}
              fontSize={10}
            >
              {t.label ?? formatY(t.value)}
            </text>
          </g>
        );
      })}

      {/* X 轴刻度 */}
      {xTicks.map(t => {
        const x = xScale(t.value);
        return (
          <g key={`x-${t.value}`}>
            <line
              x1={x}
              x2={x}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke={CHART_DEFAULTS.gridStroke}
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.5}
            />
            <text
              x={x}
              y={height - margin.bottom + 16}
              textAnchor="middle"
              fill={CHART_DEFAULTS.textFill}
              fontSize={10}
            >
              {t.label ?? formatX(t.value)}
            </text>
          </g>
        );
      })}

      {/* 坐标轴线 */}
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={height - margin.bottom}
        y2={height - margin.bottom}
        stroke={CHART_DEFAULTS.axisStroke}
        strokeWidth={1}
      />
      <line
        x1={margin.left}
        x2={margin.left}
        y1={margin.top}
        y2={height - margin.bottom}
        stroke={CHART_DEFAULTS.axisStroke}
        strokeWidth={1}
      />

      {/* 轴标签 */}
      {xLabel && (
        <text
          x={margin.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill={CHART_DEFAULTS.textFill}
          fontSize={11}
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          fill={CHART_DEFAULTS.textFill}
          fontSize={11}
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          {yLabel}
        </text>
      )}
    </g>
  );
}
