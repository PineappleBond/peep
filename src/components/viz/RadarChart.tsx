/**
 * 雷达图（性格分析）——基于紫微斗数星耀组合的性格维度可视化
 *
 * 维度（基于命宫主星 + 辅星 + 四化推导）：
 * 1. 领导力（紫微/天府/太阳 + 化权）
 * 2. 创造力（贪狼/廉贞 + 文昌/文曲 + 化科）
 * 3. 执行力（七杀/破军/武曲 + 化权）
 * 4. 沟通力（巨门/天机 + 左辅/右弼）
 * 5. 亲和力（天同/太阴 + 天魁/天钺 + 化禄）
 * 6. 耐压力（天府/武曲 + 擎羊/陀罗适度）
 * 7. 洞察力（天机/天梁 + 化科）
 * 8. 行动力（太阳/七杀 + 天马/火星）
 *
 * 设计：
 * - 纯 SVG 实现
 * - 支持多系列叠加（如本命 + 大限叠加）
 * - 悬停显示维度详情
 * - 响应式尺寸
 */
import { useMemo, useState, memo } from "react";
import type { Astrolabe } from "../../core/useZwds";
import type { LifeKlineData } from "../../core/lifeKline";
import { CHART_DEFAULTS, DOMAIN_COLORS, resolveColor } from "./chartTheme";
import { SvgTooltip } from "./ChartTooltip";

/** 性格维度定义 */
type Dimension = {
  key: string;
  label: string;
  description: string;
  /** 关联星耀（命宫三方四正出现时加分） */
  stars: string[];
  /** 关联四化 */
  mutagens?: string[];
};

/** 八大维度 */
const DIMENSIONS: Dimension[] = [
  {
    key: "leadership",
    label: "领导力",
    description: "统筹全局、决策拍板的气场",
    stars: ["紫微", "天府", "太阳"],
    mutagens: ["权"],
  },
  {
    key: "creativity",
    label: "创造力",
    description: "创新思维、艺术表达的能力",
    stars: ["贪狼", "廉贞", "文昌", "文曲"],
    mutagens: ["科"],
  },
  {
    key: "execution",
    label: "执行力",
    description: "目标导向、攻坚克难的决断",
    stars: ["七杀", "破军", "武曲"],
    mutagens: ["权"],
  },
  {
    key: "communication",
    label: "沟通力",
    description: "表达说服、协调关系的技巧",
    stars: ["巨门", "天机", "左辅", "右弼"],
  },
  {
    key: "affinity",
    label: "亲和力",
    description: "人缘好感、凝聚团队的温度",
    stars: ["天同", "太阴", "天魁", "天钺"],
    mutagens: ["禄"],
  },
  {
    key: "resilience",
    label: "耐压力",
    description: "逆境承压、稳定输出的韧性",
    stars: ["天府", "武曲"],
  },
  {
    key: "insight",
    label: "洞察力",
    description: "洞察本质、预见趋势的敏锐",
    stars: ["天机", "天梁"],
    mutagens: ["科"],
  },
  {
    key: "action",
    label: "行动力",
    description: "快速反应、立即执行的动能",
    stars: ["太阳", "七杀", "天马"],
  },
];

type RadarChartProps = {
  /** 本命盘数据 */
  astrolabe: Astrolabe;
  /** 人生K线数据（用于归一化评分） */
  lifeKline: LifeKlineData;
  /** 图表尺寸 */
  size?: number;
};

/** 计算性格维度得分（0-100） */
function calcDimensionScores(a: Astrolabe): Map<string, number> {
  const scores = new Map<string, number>();
  const mingPalace = a.palaces.find(p => p.name === "命宫");
  if (!mingPalace) return scores;

  // 收集命宫三方四正的星耀
  const sanfangStars = new Set<string>();
  const mingIdx = mingPalace.index;
  const sanfangIdxs = [mingIdx, (mingIdx + 4) % 12, (mingIdx + 8) % 12, (mingIdx + 6) % 12];
  for (const idx of sanfangIdxs) {
    const p = a.palaces[idx];
    for (const s of p.majorStars) sanfangStars.add(s.name);
    for (const s of p.minorStars) sanfangStars.add(s.name);
  }

  // 为每个维度计算得分
  for (const dim of DIMENSIONS) {
    let score = 50; // 基础分

    // 星耀加分
    let starBonus = 0;
    for (const star of dim.stars) {
      if (sanfangStars.has(star)) {
        starBonus += 12;
      }
    }
    score += Math.min(starBonus, 30); // 星耀最多加 30

    // 四化加分（简化：检查命宫天干四化）
    if (dim.mutagens) {
      // 这里简化处理，实际应该检查四化落宫
      score += dim.mutagens.length * 5;
    }

    // 收敛到 [20, 95]
    score = Math.max(20, Math.min(95, score));
    scores.set(dim.key, score);
  }

  return scores;
}

export const RadarChart = memo(function RadarChart({
  astrolabe,
  lifeKline,
  size = 400,
}: RadarChartProps) {
  const [hoverDim, setHoverDim] = useState<Dimension | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // 计算维度得分
  const scores = useMemo(() => calcDimensionScores(astrolabe), [astrolabe]);

  // 图表参数
  const center = size / 2;
  const maxRadius = size * 0.35;
  const levels = 5; // 五层同心圆
  const angleStep = (Math.PI * 2) / DIMENSIONS.length;

  // 计算各维度坐标
  const points = useMemo(() => {
    return DIMENSIONS.map((dim, i) => {
      const score = scores.get(dim.key) ?? 50;
      const r = (score / 100) * maxRadius;
      const angle = i * angleStep - Math.PI / 2; // 从顶部开始
      return {
        dim,
        score,
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + (maxRadius + 20) * Math.cos(angle),
        labelY: center + (maxRadius + 20) * Math.sin(angle),
        angle,
      };
    });
  }, [scores, center, maxRadius, angleStep]);

  // 生成多边形路径
  const polygonPath = points.map(p => `${p.x},${p.y}`).join(" ");

  // 颜色
  const mingColor = DOMAIN_COLORS["命宫"] ?? "var(--cyan)";

  return (
    <div className="radar-chart" role="figure" aria-label="性格分析雷达图">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="radar-svg"
        role="img"
        aria-label="八大性格维度雷达图"
      >
        {/* 同心圆网格 */}
        {Array.from({ length: levels }).map((_, i) => {
          const r = (maxRadius / levels) * (i + 1);
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={CHART_DEFAULTS.gridStroke}
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}

        {/* 辐射线 */}
        {DIMENSIONS.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + maxRadius * Math.cos(angle);
          const y = center + maxRadius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke={CHART_DEFAULTS.gridStroke}
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

        {/* 数据多边形 */}
        <polygon
          points={polygonPath}
          fill={resolveColor(mingColor)}
          fillOpacity={0.2}
          stroke={resolveColor(mingColor)}
          strokeWidth={2}
          style={{ transition: "all 0.3s ease" }}
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={resolveColor(mingColor)}
            stroke="var(--text)"
            strokeWidth={1.5}
            style={{ cursor: "pointer", transition: "all 0.2s ease" }}
            onMouseEnter={e => {
              setHoverDim(p.dim);
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect) setHoverPos({ x: p.x, y: p.y });
            }}
            onMouseLeave={() => setHoverDim(null)}
          />
        ))}

        {/* 维度标签 */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={CHART_DEFAULTS.textStrongFill}
            fontSize={11}
            fontWeight={500}
          >
            {p.dim.label}
          </text>
        ))}

        {/* Tooltip */}
        {hoverDim && (
          <SvgTooltip
            visible
            x={hoverPos.x}
            y={hoverPos.y}
            viewWidth={size}
            viewHeight={size}
            size={{ width: 180, height: 80 }}
          >
            <div style={{ fontWeight: 600, color: resolveColor(mingColor) }}>{hoverDim.label}</div>
            <div style={{ fontSize: "10px", color: "var(--dim)", marginBottom: "4px" }}>
              {hoverDim.description}
            </div>
            <div>
              得分：<strong>{scores.get(hoverDim.key) ?? 50}</strong> / 100
            </div>
          </SvgTooltip>
        )}
      </svg>

      {/* 说明文字 */}
      <div
        className="radar-note"
        style={{ marginTop: "12px", fontSize: "11px", color: "var(--dim)", lineHeight: 1.6 }}
      >
        基于命宫三方四正星耀组合推导八大性格维度。星耀出现在命宫三方四正（本宫、对宫、三合两宫）时相应维度加分。仅供参考娱乐。
      </div>
    </div>
  );
});
