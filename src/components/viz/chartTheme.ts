/**
 * 图表主题工具——复用 CSS 变量，提供图表专用色板与辅助函数
 *
 * 设计原则：
 * 1. 图表色从现有 CSS 变量派生，与玄空霓虹主题一致
 * 2. 分类色（categorical）按优先级排序，避免相邻色相似
 * 3. 提供深色/浅色主题感知的颜色查询
 * 4. 纯函数设计，便于服务端/测试环境复用
 */

/** 图表分类色板（按推荐顺序使用，避免相邻相似） */
export const CHART_CATEGORY_COLORS = [
  "var(--cyan)", // 青
  "var(--gold)", // 金
  "var(--c-decadal)", // 绿
  "var(--c-yearly)", // 蓝
  "var(--c-monthly)", // 橙
  "var(--c-daily)", // 紫
  "var(--c-hourly)", // 粉
  "var(--rose)", // 玫红
  "var(--m-lu)", // 禄绿
  "var(--m-ji)", // 忌紫红
];

/** 十二域专用色（按十二宫顺序，与星耀分类色呼应） */
export const DOMAIN_COLORS: Record<string, string> = {
  命宫: "var(--gold)",
  官禄: "var(--c-decadal)",
  事业: "var(--c-decadal)",
  财帛: "var(--m-lu)",
  夫妻: "var(--c-hourly)",
  疾厄: "var(--m-ji)",
  福德: "var(--c-daily)",
  田宅: "var(--c-monthly)",
  迁移: "var(--cyan)",
  交友: "var(--c-yearly)",
  仆役: "var(--c-yearly)",
  兄弟: "var(--star-soft)",
  子女: "var(--star-flower)",
  父母: "var(--star-helper)",
};

/** 图表基础配置 */
export const CHART_DEFAULTS = {
  /** 边距（上/右/下/左） */
  margin: { top: 32, right: 24, bottom: 48, left: 56 },
  /** 网格线样式 */
  gridStroke: "var(--line)",
  /** 坐标轴样式 */
  axisStroke: "var(--line-strong)",
  /** 文字颜色 */
  textFill: "var(--dim)",
  /** 强调文字 */
  textStrongFill: "var(--text)",
  /** tooltip 背景 */
  tooltipBg: "var(--glass-bg-deep)",
  /** tooltip 边框 */
  tooltipBorder: "var(--line-strong)",
  /** 动画过渡 */
  transition: "all 0.2s ease",
};

/** 评分 → 颜色（吉凶语义） */
export function scoreColor(score: number, mid = 50): string {
  if (score >= mid + 15) return "var(--m-lu)"; // 大吉
  if (score >= mid + 5) return "var(--c-decadal)"; // 吉
  if (score <= mid - 15) return "var(--m-ji)"; // 大凶
  if (score <= mid - 5) return "var(--danger)"; // 凶
  return "var(--gold)"; // 中
}

/** 将 CSS 变量解析为具体的 rgba 字符串（用于 SVG 渐变/导出） */
export function resolveColor(varExpr: string, _isDark = true): string {
  // 暗色主题预设值（与 base.css 一致）
  const darkMap: Record<string, string> = {
    "var(--cyan)": "#55d7ff",
    "var(--gold)": "#f3c96b",
    "var(--c-decadal)": "#2ee6c8",
    "var(--c-yearly)": "#5ba0ff",
    "var(--c-monthly)": "#ffa14e",
    "var(--c-daily)": "#c78bff",
    "var(--c-hourly)": "#ff77b7",
    "var(--rose)": "#ff4d6d",
    "var(--m-lu)": "#34d399",
    "var(--m-quan)": "#38bdf8",
    "var(--m-ke)": "#fbbf24",
    "var(--m-ji)": "#e35bd8",
    "var(--danger)": "#f87171",
    "var(--text)": "#d9e4ff",
    "var(--dim)": "#7787a8",
    "var(--faint)": "#586888",
    "var(--line)": "rgba(96, 165, 250, 0.14)",
    "var(--line-strong)": "rgba(125, 211, 252, 0.42)",
    "var(--star-soft)": "#7dd3fc",
    "var(--star-flower)": "#f9a8d4",
    "var(--star-helper)": "#9fb2d8",
  };
  return darkMap[varExpr] ?? varExpr;
}

/** 格式化数字（带正负号） */
export function fmtSigned(n: number): string {
  return `${n > 0 ? "+" : ""}${Math.round(n)}`;
}

/** 格式化数字（无符号） */
export function fmtNum(n: number, digits = 0): string {
  return n.toFixed(digits);
}

/** 生成等距数列 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i += step) result.push(i);
  return result;
}

/** 线性比例尺：domain → range 映射 */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const dSpan = d1 - d0 || 1;
  const rSpan = r1 - r0;
  return (value: number) => r0 + ((value - d0) / dSpan) * rSpan;
}

/** band 比例尺：类别 → 位置（等宽分块） */
export function bandScale(
  categories: string[],
  range: [number, number],
  padding = 0.1,
): ((cat: string) => number) & { bandwidth: number } {
  const [r0, r1] = range;
  const total = r1 - r0;
  const n = categories.length || 1;
  const step = total / n;
  const bandwidth = step * (1 - padding);
  const offset = (step - bandwidth) / 2;
  const idx = new Map(categories.map((c, i) => [c, i]));
  const fn = ((cat: string) => {
    const i = idx.get(cat) ?? 0;
    return r0 + i * step + offset;
  }) as ((cat: string) => number) & { bandwidth: number };
  fn.bandwidth = bandwidth;
  return fn;
}

/** 生成合理的刻度值（nice tick values） */
export function niceTickValues(min: number, max: number, target = 5): number[] {
  if (min >= max) return [min];
  const span = max - min;
  const rawStep = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / mag;
  let step: number;
  if (residual <= 1.5) step = mag;
  else if (residual <= 3) step = 2 * mag;
  else if (residual <= 7) step = 5 * mag;
  else step = 10 * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.01; v += step) {
    ticks.push(Math.round(v * 1e10) / 1e10);
  }
  return ticks;
}
