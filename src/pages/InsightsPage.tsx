/**
 * 数据洞察页面——独立的分析入口
 *
 * 路由：/insights
 * 功能：展示全局数据洞察（跨人物聚合）
 */
import "../styles/insights.css";
import { InsightsPanel } from "../components/InsightsPanel";
import { useI18n } from "../core/i18n";

export function InsightsPage() {
  const { t } = useI18n();

  return (
    <div className="insights-page">
      <div className="viz-page-header">
        <h1 className="viz-page-title">{t("insights.pageTitle")}</h1>
        <p className="viz-page-subtitle">{t("insights.pageSubtitle")}</p>
      </div>
      <InsightsPanel />
    </div>
  );
}
