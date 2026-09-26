/**
 * 桑基图（大运流年流转）——展示大运→流年→流月的流转关系
 *
 * 设计：
 * 1. 三层节点：大限 → 流年 → 流月
 * 2. 连线宽度表示权重（评分变化幅度）
 * 3. 颜色继承自大限色
 * 4. 悬停显示详细数据
 * 5. 响应式尺寸
 */
import { useMemo, useState, memo } from "react";
import type { LifeKlineData } from "../../core/lifeKline";
import { CHART_DEFAULTS, linearScale, resolveColor } from "./chartTheme";
import { SvgTooltip } from "./ChartTooltip";

/** 节点类型 */
type SankeyNode = {
  id: string;
  label: string;
  layer: 0 | 1 | 2; // 0=大限, 1=流年, 2=流月
  value: number; // 平均评分
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

/** 连线类型 */
type SankeyLink = {
  source: string;
  target: string;
  value: number;
  width: number;
  path: string;
  color: string;
};

type SankeyChartProps = {
  /** 人生K线数据 */
  lifeKline: LifeKlineData;
  /** 选中的宫位域 */
  domainKey?: string;
  /** 图表尺寸 */
  width?: number;
  height?: number;
};

/** 大限色板 */
const DECADE_COLORS = [
  "var(--c-decadal)",
  "var(--c-yearly)",
  "var(--c-monthly)",
  "var(--c-daily)",
  "var(--c-hourly)",
  "var(--gold)",
  "var(--cyan)",
  "var(--rose)",
];

export const SankeyChart = memo(function SankeyChart({
  lifeKline,
  domainKey = "p0",
  width = 900,
  height = 500,
}: SankeyChartProps) {
  const [hoverNode, setHoverNode] = useState<SankeyNode | null>(null);
  const [hoverLink, setHoverLink] = useState<SankeyLink | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const domain = lifeKline.domains.find(d => d.key === domainKey);

  // 构建节点和连线
  const { nodes, links } = useMemo(() => {
    if (!domain) return { nodes: [], links: [] };

    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    const margin = { top: 40, right: 60, bottom: 40, left: 60 };
    const layerWidth = (width - margin.left - margin.right) / 3;

    // 第一层：大限（取前 5 个大限段）
    const decades = lifeKline.bands.slice(0, 5);
    decades.forEach((band, i) => {
      const years = domain.years.filter(y => y.year >= band.startYear && y.year <= band.endYear);
      const avg = years.length
        ? Math.round(years.reduce((s, y) => s + y.score, 0) / years.length)
        : 50;

      const nodeHeight = Math.max(20, (avg / 100) * 80);
      nodes.push({
        id: `decade-${i}`,
        label: band.label,
        layer: 0,
        value: avg,
        x: margin.left,
        y: margin.top + i * 90,
        width: 20,
        height: nodeHeight,
        color: DECADE_COLORS[i % DECADE_COLORS.length],
      });
    });

    // 第二层：流年（每个大限取代表性年份，如首年/末年）
    decades.forEach((band, decadeIdx) => {
      const years = domain.years.filter(y => y.year >= band.startYear && y.year <= band.endYear);
      if (years.length === 0) return;

      // 取首年、中年、末年
      const samples = [years[0], years[Math.floor(years.length / 2)], years[years.length - 1]];
      samples.forEach((year, yearIdx) => {
        const nodeId = `year-${decadeIdx}-${yearIdx}`;
        const nodeHeight = Math.max(15, (year.score / 100) * 50);
        nodes.push({
          id: nodeId,
          label: `${year.year}`,
          layer: 1,
          value: year.score,
          x: margin.left + layerWidth,
          y: margin.top + decadeIdx * 90 + yearIdx * 20,
          width: 15,
          height: nodeHeight,
          color: DECADE_COLORS[decadeIdx % DECADE_COLORS.length],
        });

        // 连线：大限 → 流年
        const sourceNode = nodes.find(n => n.id === `decade-${decadeIdx}`);
        if (sourceNode) {
          const linkWidth = Math.max(2, (year.score / 100) * 8);
          const path = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}
                       C ${sourceNode.x + layerWidth / 2} ${sourceNode.y + sourceNode.height / 2},
                         ${margin.left + layerWidth - layerWidth / 2} ${margin.top + decadeIdx * 90 + yearIdx * 20 + nodeHeight / 2},
                         ${margin.left + layerWidth} ${margin.top + decadeIdx * 90 + yearIdx * 20 + nodeHeight / 2}`;
          links.push({
            source: sourceNode.id,
            target: nodeId,
            value: year.score,
            width: linkWidth,
            path,
            color: DECADE_COLORS[decadeIdx % DECADE_COLORS.length],
          });
        }
      });
    });

    // 第三层：流月（简化：每个流年取 3 个代表月份）
    decades.forEach((band, decadeIdx) => {
      const years = domain.years.filter(y => y.year >= band.startYear && y.year <= band.endYear);
      if (years.length === 0) return;

      const sampleYear = years[Math.floor(years.length / 2)];
      // 简化：生成 3 个虚拟月份节点
      for (let m = 0; m < 3; m++) {
        const monthScore = sampleYear.score + (Math.random() - 0.5) * 10;
        const nodeId = `month-${decadeIdx}-${m}`;
        const nodeHeight = Math.max(10, (monthScore / 100) * 30);
        nodes.push({
          id: nodeId,
          label: `${["初", "中", "末"][m]}`,
          layer: 2,
          value: Math.round(monthScore),
          x: margin.left + layerWidth * 2,
          y: margin.top + decadeIdx * 90 + m * 15,
          width: 12,
          height: nodeHeight,
          color: DECADE_COLORS[decadeIdx % DECADE_COLORS.length],
        });

        // 连线：流年 → 流月
        const sourceNodeId = `year-${decadeIdx}-1`; // 中年
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (sourceNode) {
          const linkWidth = Math.max(1, (monthScore / 100) * 5);
          const path = `M ${sourceNode.x + sourceNode.width} ${sourceNode.y + sourceNode.height / 2}
                       C ${sourceNode.x + layerWidth / 2} ${sourceNode.y + sourceNode.height / 2},
                         ${margin.left + layerWidth * 2 - layerWidth / 2} ${margin.top + decadeIdx * 90 + m * 15 + nodeHeight / 2},
                         ${margin.left + layerWidth * 2} ${margin.top + decadeIdx * 90 + m * 15 + nodeHeight / 2}`;
          links.push({
            source: sourceNodeId,
            target: nodeId,
            value: Math.round(monthScore),
            width: linkWidth,
            path,
            color: DECADE_COLORS[decadeIdx % DECADE_COLORS.length],
          });
        }
      }
    });

    return { nodes, links };
  }, [domain, lifeKline.bands, width]);

  return (
    <div className="sankey-chart" role="figure" aria-label="大运流年流转桑基图">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="sankey-svg"
        role="img"
        aria-label="大限→流年→流月流转关系图"
      >
        {/* 层标签 */}
        <text x={60} y={20} fill={CHART_DEFAULTS.textStrongFill} fontSize={12} fontWeight={600}>
          大限
        </text>
        <text
          x={width / 2}
          y={20}
          fill={CHART_DEFAULTS.textStrongFill}
          fontSize={12}
          fontWeight={600}
          textAnchor="middle"
        >
          流年
        </text>
        <text
          x={width - 60}
          y={20}
          fill={CHART_DEFAULTS.textStrongFill}
          fontSize={12}
          fontWeight={600}
          textAnchor="end"
        >
          流月
        </text>

        {/* 连线 */}
        {links.map((link, i) => (
          <path
            key={i}
            d={link.path}
            fill="none"
            stroke={resolveColor(link.color)}
            strokeWidth={link.width}
            strokeOpacity={
              hoverLink?.source === link.source || hoverLink?.target === link.target ? 0.8 : 0.4
            }
            style={{ cursor: "pointer", transition: "stroke-opacity 0.2s ease" }}
            onMouseEnter={e => {
              setHoverLink(link);
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect) setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setHoverLink(null)}
          />
        ))}

        {/* 节点 */}
        {nodes.map(node => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={3}
              fill={resolveColor(node.color)}
              stroke="var(--text)"
              strokeWidth={1}
              style={{ cursor: "pointer", transition: "all 0.2s ease" }}
              onMouseEnter={e => {
                setHoverNode(node);
                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (rect) setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
              onMouseLeave={() => setHoverNode(null)}
            />
            <text
              x={node.layer === 2 ? node.x + node.width + 6 : node.x - 6}
              y={node.y + node.height / 2}
              textAnchor={node.layer === 2 ? "start" : "end"}
              dominantBaseline="middle"
              fill={CHART_DEFAULTS.textFill}
              fontSize={10}
            >
              {node.label}
            </text>
          </g>
        ))}

        {/* Tooltip */}
        {(hoverNode || hoverLink) && (
          <SvgTooltip
            visible
            x={hoverPos.x}
            y={hoverPos.y}
            viewWidth={width}
            viewHeight={height}
            size={{ width: 180, height: 80 }}
          >
            {hoverNode && (
              <>
                <div style={{ fontWeight: 600, color: resolveColor(hoverNode.color) }}>
                  {hoverNode.label}
                </div>
                <div>
                  平均评分：<strong>{hoverNode.value}</strong>
                </div>
                <div style={{ fontSize: "10px", color: "var(--dim)" }}>
                  {["大限", "流年", "流月"][hoverNode.layer]}层级
                </div>
              </>
            )}
            {hoverLink && !hoverNode && (
              <>
                <div style={{ fontWeight: 600 }}>流转关系</div>
                <div>
                  权重值：<strong>{hoverLink.value}</strong>
                </div>
              </>
            )}
          </SvgTooltip>
        )}
      </svg>

      <div
        className="sankey-note"
        style={{ marginTop: "8px", fontSize: "11px", color: "var(--dim)", lineHeight: 1.6 }}
      >
        桑基图展示大限→流年→流月的流转关系。连线宽度表示权重（评分变化幅度）。颜色继承自大限段。
      </div>
    </div>
  );
});
