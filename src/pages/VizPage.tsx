/**
 * 可视化页面——独立路由页面，整合所有图表
 *
 * 路由：/viz
 * 功能：
 * 1. 从 localStorage 恢复输入数据
 * 2. 调用 useZwds 计算完整盘面
 * 3. 渲染 VizPanel 展示所有可视化
 */
import "../styles/viz.css";
import { useZwds, DEFAULT_BIRTH_INPUT } from "../core/useZwds";
import { VizPanel } from "../components/viz/VizPanel";
import { useI18n } from "../core/i18n";

export function VizPage() {
  const { t } = useI18n();

  // 尝试从 localStorage 恢复上次输入
  const savedInput = (() => {
    try {
      const stored = localStorage.getItem("zwds-input-v3");
      if (stored) return JSON.parse(stored);
    } catch {
      /* ignore */
    }
    return DEFAULT_BIRTH_INPUT;
  })();

  const z = useZwds(savedInput);

  if (!z.astrolabe) {
    return (
      <div className="viz-page viz-page-empty">
        <div className="viz-empty-notice">
          <h2>{t("viz.noData")}</h2>
          <p>{t("viz.goHome")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="viz-page">
      <div className="viz-page-header">
        <h1 className="viz-page-title">{t("viz.title")}</h1>
        <p className="viz-page-subtitle">{t("viz.subtitle")}</p>
      </div>
      <VizPanel z={z} />
    </div>
  );
}
