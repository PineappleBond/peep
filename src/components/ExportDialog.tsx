/**
 * 导出对话框：用户选择导出格式、数据范围、附加选项。
 * 支持 MD / JSON / CSV 三种格式。
 */
import { useState, useCallback } from "react";
import { Dialog } from "./Dialog";
import { useI18n } from "../core/i18n";
import {
  performExport,
  type ExportFormat,
  type ExportScope,
  type ExportOptions,
} from "../core/exportData";
import { toast } from "../core/toast";
import type { Zwds } from "../core/useZwds";
import type { Person, LiurenRecord, WikiDocument } from "../core/personDb";

type ExportDialogProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 当前人物 */
  person: Person | null;
  /** 当前紫微盘数据（可选） */
  zwds?: Zwds | null;
  /** 大六壬记录（可选） */
  liurenRecords?: LiurenRecord[];
  /** Wiki 文档（可选） */
  wikiDocs?: WikiDocument[];
};

/** 导出进度状态 */
type ExportProgress = {
  /** 是否正在导出 */
  exporting: boolean;
  /** 进度百分比 0~100 */
  percent: number;
  /** 进度文字 */
  text: string;
};

export function ExportDialog({
  open,
  onClose,
  person,
  zwds,
  liurenRecords,
  wikiDocs,
}: ExportDialogProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState<ExportFormat>("md");
  const [scope, setScope] = useState<ExportScope>("currentPerson");
  const [includeMeta, setIncludeMeta] = useState(true);
  const [includeDaily, setIncludeDaily] = useState(false);
  const [includeHourly, setIncludeHourly] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    exporting: false,
    percent: 0,
    text: "",
  });

  // 当前可用的数据源
  const hasZiwei = !!zwds?.astrolabe;
  const hasLiuren = !!liurenRecords && liurenRecords.length > 0;
  const hasWiki = !!wikiDocs && wikiDocs.length > 0;
  const hasData = hasZiwei || hasLiuren || hasWiki;

  /** 执行导出 */
  const handleExport = useCallback(async () => {
    if (!person) {
      toast.warn(t("export.noPerson"));
      return;
    }

    if (!hasData) {
      toast.warn(t("export.noData"));
      return;
    }

    setProgress({ exporting: true, percent: 10, text: t("export.preparing") });

    // 模拟进度（避免瞬间完成，提升感知）
    const progressTimer = setTimeout(() => {
      setProgress({ exporting: true, percent: 50, text: t("export.processing") });
    }, 100);

    // 异步执行，避免阻塞 UI
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const options: ExportOptions = {
        format,
        scope,
        includeMeta,
        includeDaily,
        includeHourly,
        currentPerson: person,
        zwds,
        liurenRecords,
        wikiDocs,
      };

      setProgress({ exporting: true, percent: 80, text: t("export.generating") });

      const result = performExport(options);

      clearTimeout(progressTimer);
      setProgress({ exporting: true, percent: 100, text: t("export.downloading") });

      // 触发下载
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      await new Promise(resolve => setTimeout(resolve, 200));
      toast.success(t("common.exportSuccess"));
      onClose();
    } catch (err) {
      console.error("[ExportDialog] 导出失败", err);
      toast.error(t("export.failed"));
    } finally {
      clearTimeout(progressTimer);
      setProgress({ exporting: false, percent: 0, text: "" });
    }
  }, [
    person,
    format,
    scope,
    includeMeta,
    includeDaily,
    includeHourly,
    zwds,
    liurenRecords,
    wikiDocs,
    hasData,
    t,
    onClose,
  ]);

  /** 关闭时重置状态 */
  const handleClose = useCallback(() => {
    if (progress.exporting) return; // 导出中不允许关闭
    onClose();
  }, [progress.exporting, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("export.title")}
      width={520}
      footer={
        <div className="dlg-buttons">
          <button className="btn-cancel" onClick={handleClose} disabled={progress.exporting}>
            {t("common.cancel")}
          </button>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={!hasData || progress.exporting}
          >
            {progress.exporting ? t("export.exporting") : t("export.start")}
          </button>
        </div>
      }
    >
      <div className="export-dialog">
        {/* 进度条 */}
        {progress.exporting && (
          <div
            className="export-progress"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("export.exporting")}
          >
            <div className="export-progress-bar" style={{ width: `${progress.percent}%` }} />
            <span className="export-progress-text">
              {progress.text} {progress.percent}%
            </span>
          </div>
        )}

        {/* 无数据提示 */}
        {!hasData && (
          <div className="export-warning">
            <p>{t("export.noDataHint")}</p>
          </div>
        )}

        {/* 格式选择 */}
        <div className="export-section">
          <label className="export-label">{t("export.format")}</label>
          <div className="export-radio-group">
            <label className="export-radio">
              <input
                type="radio"
                name="format"
                value="md"
                checked={format === "md"}
                onChange={() => setFormat("md")}
                disabled={progress.exporting}
              />
              <span>Markdown</span>
            </label>
            <label className="export-radio">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
                disabled={progress.exporting}
              />
              <span>JSON</span>
            </label>
            <label className="export-radio">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                disabled={progress.exporting}
              />
              <span>CSV</span>
            </label>
          </div>
        </div>

        {/* 数据范围 */}
        <div className="export-section">
          <label className="export-label">{t("export.scope")}</label>
          <div className="export-radio-group">
            <label className="export-radio">
              <input
                type="radio"
                name="scope"
                value="currentPerson"
                checked={scope === "currentPerson"}
                onChange={() => setScope("currentPerson")}
                disabled={progress.exporting}
              />
              <span>{t("export.currentPerson")}</span>
            </label>
            <label className="export-radio">
              <input
                type="radio"
                name="scope"
                value="currentPage"
                checked={scope === "currentPage"}
                onChange={() => setScope("currentPage")}
                disabled={progress.exporting}
              />
              <span>{t("export.currentPage")}</span>
            </label>
          </div>
        </div>

        {/* 附加选项 */}
        <div className="export-section">
          <label className="export-label">{t("export.options")}</label>
          <div className="export-checkbox-group">
            <label className="export-checkbox">
              <input
                type="checkbox"
                checked={includeMeta}
                onChange={e => setIncludeMeta(e.target.checked)}
                disabled={progress.exporting}
              />
              <span>{t("export.includeMeta")}</span>
            </label>
            {hasZiwei && (
              <>
                <label className="export-checkbox">
                  <input
                    type="checkbox"
                    checked={includeDaily}
                    onChange={e => setIncludeDaily(e.target.checked)}
                    disabled={progress.exporting}
                  />
                  <span>{t("export.includeDaily")}</span>
                </label>
                <label className="export-checkbox">
                  <input
                    type="checkbox"
                    checked={includeHourly}
                    onChange={e => setIncludeHourly(e.target.checked)}
                    disabled={progress.exporting}
                  />
                  <span>{t("export.includeHourly")}</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* 数据预览 */}
        <div className="export-section export-preview">
          <label className="export-label">{t("export.dataPreview")}</label>
          <div className="export-data-list">
            {hasZiwei && <span className="export-data-tag">{t("export.ziwei")}</span>}
            {hasLiuren && (
              <span className="export-data-tag">
                {t("export.liuren", { count: liurenRecords!.length })}
              </span>
            )}
            {hasWiki && (
              <span className="export-data-tag">
                {t("export.wiki", { count: wikiDocs!.length })}
              </span>
            )}
          </div>
        </div>

        {/* 口径提示 */}
        <div className="export-hint">
          <p>{t("export.hint.kline")}</p>
          <p>{t("export.hint.daily")}</p>
          <p>{t("export.hint.xiaoxian")}</p>
          <p>{t("export.hint.zayao")}</p>
        </div>
      </div>
    </Dialog>
  );
}
