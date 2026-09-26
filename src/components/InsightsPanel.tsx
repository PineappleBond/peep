/**
 * 数据洞察面板：展示智能分析结果
 *
 * 功能：
 * 1. 摘要统计卡（总记录、标签数、活跃天数等）
 * 2. 高频标签条形图
 * 3. 近 6 个月活跃度迷你柱图
 * 4. 按类型分组的洞察卡片（模式/异常/趋势/建议）
 * 5. 导出 Markdown 报告
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { db, type LiurenRecord, type WikiDocument } from "../core/personDb";
import {
  generateInsights,
  generateMarkdownReport,
  type Insight,
  type InsightsResult,
} from "../core/dataInsights";
import { useI18n } from "../core/i18n";
import { Spinner } from "./Spinner";

/** 严重程度排序权重（高 → 低） */
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/** 洞察类型图标 */
const TYPE_ICONS: Record<Insight["type"], string> = {
  pattern: "🔁",
  anomaly: "⚠️",
  trend: "📈",
  suggestion: "💡",
};

/** 洞察类型分组顺序 */
const TYPE_ORDER: Insight["type"][] = ["anomaly", "trend", "pattern", "suggestion"];

interface InsightsPanelProps {
  /** 限制分析范围到某个人物（不传则分析所有人物） */
  personId?: number;
  /** 外部触发的刷新键（变化时重新加载） */
  refreshKey?: number;
}

export function InsightsPanel({ personId, refreshKey = 0 }: InsightsPanelProps) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载数据并生成洞察
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 并行读取两张表
        const [liurenRecords, wikiDocs] = await Promise.all([
          personId
            ? db.liurenRecords.where("personId").equals(personId).toArray()
            : db.liurenRecords.toArray(),
          personId
            ? db.wikiDocs.where("personId").equals(personId).toArray()
            : db.wikiDocs.toArray(),
        ]);

        if (cancelled) return;

        const insightsResult = generateInsights({ liurenRecords, wikiDocs });
        if (cancelled) return;
        setResult(insightsResult);
      } catch (err) {
        if (cancelled) return;
        console.error("[InsightsPanel] 生成洞察失败", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [personId, refreshKey]);

  // 按类型分组洞察（按严重程度排序）
  const groupedInsights = useMemo(() => {
    if (!result) return new Map<Insight["type"], Insight[]>();
    const groups = new Map<Insight["type"], Insight[]>();
    for (const type of TYPE_ORDER) groups.set(type, []);
    for (const ins of result.insights) {
      groups.get(ins.type)?.push(ins);
    }
    // 每组内按严重程度排序
    for (const [, arr] of groups) {
      arr.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    }
    return groups;
  }, [result]);

  // 导出 Markdown
  const handleExportMarkdown = useCallback(() => {
    if (!result) return;
    const md = generateMarkdownReport(result, t, locale as "zh-CN" | "en-US");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `insights-${new Date().toISOString().slice(0, 10)}.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [result, t, locale]);

  if (loading) {
    return (
      <div className="insights-loading" role="status">
        <Spinner size="md" text={t("insights.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-empty">
        <div className="insights-empty-icon">⚠️</div>
        <div>{error}</div>
      </div>
    );
  }

  if (
    !result ||
    (result.insights.length === 0 && result.summary.totalLiuren + result.summary.totalWiki === 0)
  ) {
    return (
      <div className="insights-empty">
        <div className="insights-empty-icon">📊</div>
        <div>{t("insights.empty")}</div>
      </div>
    );
  }

  return (
    <div className="insights-panel">
      {/* 摘要统计 */}
      <div className="insights-summary">
        <SummaryCard value={result.summary.totalLiuren} label={t("insights.stat.liurenCount")} />
        <SummaryCard value={result.summary.totalWiki} label={t("insights.stat.wikiCount")} />
        <SummaryCard value={result.summary.totalTags} label={t("insights.stat.tagCount")} />
        <SummaryCard value={result.summary.activeDays} label={t("insights.stat.activeDays")} />
      </div>

      {/* 高频标签 */}
      {result.tagFrequencies.length > 0 && (
        <section>
          <h3 className="insights-group-title">{t("insights.tagFreq")}</h3>
          <TagFreqChart data={result.tagFrequencies.slice(0, 10)} />
        </section>
      )}

      {/* 月度活跃 */}
      <section>
        <h3 className="insights-group-title">{t("insights.monthlyActivity")}</h3>
        <MonthlyChart data={result.monthlyActivity} />
      </section>

      {/* 洞察分组 */}
      {TYPE_ORDER.map(type => {
        const group = groupedInsights.get(type);
        if (!group || group.length === 0) return null;
        const groupLabelKey =
          type === "pattern"
            ? "insights.group.pattern"
            : type === "anomaly"
              ? "insights.group.anomaly"
              : type === "trend"
                ? "insights.group.trend"
                : "insights.group.suggestion";
        return (
          <section key={type} className="insights-group">
            <h3 className="insights-group-title">{t(groupLabelKey)}</h3>
            {group.map((ins, idx) => (
              <InsightCard key={`${type}-${idx}`} insight={ins} t={t} />
            ))}
          </section>
        );
      })}

      {/* 操作栏 */}
      <div className="insights-actions">
        <button type="button" className="insights-btn primary" onClick={handleExportMarkdown}>
          {t("insights.exportMarkdown")}
        </button>
      </div>
    </div>
  );
}

/* ──────────────── 子组件 ──────────────── */

/** 摘要统计卡 */
function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="insights-summary-card">
      <div className="insights-summary-value">{value}</div>
      <div className="insights-summary-label">{label}</div>
    </div>
  );
}

/** 标签频次条形图 */
function TagFreqChart({ data }: { data: Array<{ tag: string; count: number }> }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="insights-tag-freq">
      {data.map(d => (
        <div key={d.tag} className="insights-tag-row">
          <span className="insights-tag-name" title={d.tag}>
            {d.tag}
          </span>
          <div className="insights-tag-bar-wrap">
            <div className="insights-tag-bar" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="insights-tag-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/** 月度活跃迷你柱图 */
function MonthlyChart({
  data,
}: {
  data: Array<{ month: string; liurenCount: number; wikiCount: number }>;
}) {
  const max = Math.max(...data.map(d => Math.max(d.liurenCount, d.wikiCount)), 1);
  return (
    <div className="insights-monthly">
      {data.map(d => (
        <div key={d.month} className="insights-monthly-col">
          <div className="insights-monthly-bar-wrap">
            <div
              className="insights-monthly-bar liuren"
              style={{ height: `${(d.liurenCount / max) * 100}%` }}
              title={`六壬: ${d.liurenCount}`}
            />
            <div
              className="insights-monthly-bar wiki"
              style={{ height: `${(d.wikiCount / max) * 100}%` }}
              title={`Wiki: ${d.wikiCount}`}
            />
          </div>
          <span className="insights-monthly-label">
            {/* 只显示月份 MM */}
            {d.month.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 单条洞察卡片 */
function InsightCard({
  insight,
  t,
}: {
  insight: Insight;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const icon = TYPE_ICONS[insight.type] ?? "•";
  const title = t(insight.titleKey, insight.titleParams);
  const description = t(insight.descriptionKey, insight.descriptionParams);
  return (
    <div className={`insight-card severity-${insight.severity}`}>
      <div className="insight-icon" aria-hidden>
        {icon}
      </div>
      <div className="insight-body">
        <div className="insight-title">{title}</div>
        <div className="insight-desc">{description}</div>
      </div>
    </div>
  );
}
