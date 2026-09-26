/**
 * 可视化面板——整合所有图表，提供 Tab 切换、全屏模式、导出功能
 *
 * 功能：
 * 1. Tab 切换不同图表类型
 * 2. 全屏模式（ESC 退出）
 * 3. 导出 PNG/SVG
 * 4. 域选择器（跨图表共享）
 * 5. 年份选择器（热力图用）
 * 6. 响应式布局
 */
import { useCallback, useEffect, useRef, useState, memo } from "react";
import type { Zwds } from "../../core/useZwds";
import type { LifeKlineData } from "../../core/lifeKline";
import { KlineChart } from "./KlineChart";
import { RadarChart } from "./RadarChart";
import { HeatmapChart } from "./HeatmapChart";
import { SankeyChart } from "./SankeyChart";
import { useI18n } from "../../core/i18n";

/** 图表类型 */
type ChartType = "kline" | "radar" | "heatmap" | "sankey";

type VizPanelProps = {
  /** 排盘数据 */
  z: Zwds;
};

export const VizPanel = memo(function VizPanel({ z }: VizPanelProps) {
  const { t } = useI18n();
  const lifeKline = z.lifeKline;

  const [activeTab, setActiveTab] = useState<ChartType>("kline");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("p0"); // 命宫
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const panelRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // 键盘快捷键（ESC 退出全屏）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isFullscreen]);

  // 导出 PNG
  const handleExportPNG = useCallback(() => {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2; // 2x for retina
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `chart-${activeTab}-${Date.now()}.png`;
      link.href = pngUrl;
      link.click();
    };
    img.src = url;
  }, [activeTab]);

  // 导出 SVG
  const handleExportSVG = useCallback(() => {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const link = document.createElement("a");
    link.download = `chart-${activeTab}-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeTab]);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(v => !v);
  }, []);

  if (!lifeKline) {
    return (
      <div className="viz-panel viz-empty">
        <div className="viz-placeholder">{t("viz.noData")}</div>
      </div>
    );
  }

  const tabs: { key: ChartType; label: string; icon: string }[] = [
    { key: "kline", label: "人生K线", icon: "📈" },
    { key: "radar", label: "性格分析", icon: "🎯" },
    { key: "heatmap", label: "流日吉凶", icon: "📅" },
    { key: "sankey", label: "大运流转", icon: "🌊" },
  ];

  return (
    <div
      ref={panelRef}
      className={`viz-panel ${isFullscreen ? "viz-fullscreen" : ""}`}
      role="region"
      aria-label="数据可视化面板"
    >
      {/* 控制栏 */}
      <div className="viz-header">
        <div className="viz-tabs" role="tablist" aria-label="图表类型切换">
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              id={`viz-tab-${tab.key}`}
              className={`viz-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              aria-selected={activeTab === tab.key}
              aria-controls={`viz-panel-${tab.key}`}
            >
              <span className="tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="viz-actions">
          {/* 域选择器（K线/热力图/桑基图共用） */}
          {activeTab !== "radar" && (
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              aria-label="选择宫位域"
              className="viz-select"
            >
              {lifeKline.domains.map(d => (
                <option key={d.key} value={d.key}>
                  {d.label}
                  {d.isBody ? "（身宫）" : ""}
                </option>
              ))}
            </select>
          )}

          {/* 年份选择器（热力图用） */}
          {activeTab === "heatmap" && (
            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              min={lifeKline.domains[0]?.years[0]?.year ?? 1900}
              max={lifeKline.domains[0]?.years[lifeKline.domains[0].years.length - 1]?.year ?? 2100}
              className="viz-year-input"
              aria-label="选择年份"
            />
          )}

          <button
            className="viz-action-btn"
            onClick={handleExportPNG}
            title="导出 PNG"
            aria-label="导出为 PNG 图片"
          >
            📷
          </button>
          <button
            className="viz-action-btn"
            onClick={handleExportSVG}
            title="导出 SVG"
            aria-label="导出为 SVG 矢量图"
          >
            🖼️
          </button>
          <button
            className="viz-action-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "退出全屏" : "全屏模式"}
            aria-label={isFullscreen ? "退出全屏" : "进入全屏模式"}
          >
            {isFullscreen ? "⊙" : "⛶"}
          </button>
        </div>
      </div>

      {/* 图表区域 */}
      <div
        ref={chartRef}
        className="viz-content"
        role="tabpanel"
        id={`viz-panel-${activeTab}`}
        aria-labelledby={`viz-tab-${activeTab}`}
      >
        {activeTab === "kline" && (
          <KlineChart data={lifeKline} initialDomain="命宫" width={900} height={420} />
        )}
        {activeTab === "radar" && z.astrolabe && (
          <RadarChart astrolabe={z.astrolabe} lifeKline={lifeKline} size={400} />
        )}
        {activeTab === "heatmap" && (
          <HeatmapChart
            lifeKline={lifeKline}
            domainKey={selectedDomain}
            year={selectedYear}
            width={800}
          />
        )}
        {activeTab === "sankey" && (
          <SankeyChart lifeKline={lifeKline} domainKey={selectedDomain} width={900} height={500} />
        )}
      </div>

      {/* 底部说明 */}
      <div className="viz-footer">
        <div className="viz-note">{lifeKline.note}</div>
      </div>
    </div>
  );
});
