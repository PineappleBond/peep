/**
 * 导入对话框：支持从 JSON 备份恢复、CSV 导入数据。
 *
 * 功能：
 * - 文件选择（支持拖拽）
 * - 格式自动检测（JSON / CSV）
 * - 数据预览
 * - 导入进度显示
 * - 导入统计结果展示
 */
import { useState, useCallback, useRef } from "react";
import { Dialog } from "./Dialog";
import { useI18n } from "../core/i18n";
import {
  importFromJson,
  importFromCsv,
  previewJsonBackup,
  previewCsvData,
  type ImportResult,
} from "../core/importData";
import { toast } from "../core/toast";

type ImportDialogProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 导入成功后的回调（刷新数据） */
  onImportSuccess?: () => void;
};

/** 导入状态 */
type ImportState = "idle" | "previewing" | "importing" | "done" | "error";

/** 文件预览数据 */
type PreviewData = {
  type: "json" | "csv";
  csvType?: "liuren" | "wiki";
  hasPerson: boolean;
  liurenCount: number;
  wikiCount: number;
  exportedAt?: string;
  csvHeaders?: string[];
  csvRowCount?: number;
  csvSampleRows?: string[][];
};

export function ImportDialog({ open, onClose, onImportSuccess }: ImportDialogProps) {
  const { t } = useI18n();
  const [state, setState] = useState<ImportState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState({ percent: 0, text: "" });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 重置状态 */
  const resetState = useCallback(() => {
    setState("idle");
    setFile(null);
    setPreview(null);
    setProgress({ percent: 0, text: "" });
    setResult(null);
    setError("");
  }, []);

  /** 关闭时重置状态 */
  const handleClose = useCallback(() => {
    if (state === "importing") return; // 导入中不允许关闭
    resetState();
    onClose();
  }, [state, resetState, onClose]);

  /** 处理文件选择 */
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setState("previewing");
    setError("");

    try {
      const fileName = selectedFile.name.toLowerCase();

      if (fileName.endsWith(".json")) {
        // JSON 备份预览
        const data = await previewJsonBackup(selectedFile);
        setPreview({
          type: "json",
          hasPerson: data.hasPerson,
          liurenCount: data.liurenCount,
          wikiCount: data.wikiCount,
          exportedAt: data.exportedAt,
        });
      } else if (fileName.endsWith(".csv")) {
        // CSV 预览
        const data = await previewCsvData(selectedFile);
        // 根据表头自动检测类型
        const csvType = data.headers.includes("占事") ? "liuren" : "wiki";
        setPreview({
          type: "csv",
          csvType,
          hasPerson: false,
          liurenCount: csvType === "liuren" ? data.rowCount : 0,
          wikiCount: csvType === "wiki" ? data.rowCount : 0,
          csvHeaders: data.headers,
          csvRowCount: data.rowCount,
          csvSampleRows: data.sampleRows,
        });
      } else {
        throw new Error("不支持的文件格式，请选择 JSON 或 CSV 文件");
      }

      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "文件解析失败");
      setState("error");
    }
  }, []);

  /** 拖拽处理 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect],
  );

  /** 执行导入 */
  const handleImport = useCallback(async () => {
    if (!file || !preview) return;

    setState("importing");
    setProgress({ percent: 0, text: "准备导入..." });

    try {
      let importResult: ImportResult;

      if (preview.type === "json") {
        importResult = await importFromJson(file, (percent, text) => {
          setProgress({ percent, text });
        });
      } else if (preview.type === "csv" && preview.csvType) {
        const count = await importFromCsv(file, preview.csvType, (percent, text) => {
          setProgress({ percent, text });
        });
        importResult = {
          persons: 0,
          liuren: preview.csvType === "liuren" ? count : 0,
          wiki: preview.csvType === "wiki" ? count : 0,
          errors: [],
        };
      } else {
        throw new Error("导入类型错误");
      }

      setResult(importResult);
      setState("done");

      if (importResult.errors.length === 0) {
        toast.success(t("import.success"));
        onImportSuccess?.();
      } else {
        toast.warn(t("import.partialSuccess"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
      setState("error");
      toast.error(t("import.failed"));
    }
  }, [file, preview, t, onImportSuccess]);

  /** 触发文件选择 */
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 文件输入变化 */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect],
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("import.title")}
      width={560}
      footer={
        <div className="dlg-buttons">
          <button className="btn-cancel" onClick={handleClose} disabled={state === "importing"}>
            {state === "done" ? t("common.close") : t("common.cancel")}
          </button>
          {preview && state !== "importing" && state !== "done" && (
            <button className="btn-primary" onClick={handleImport}>
              {t("import.start")}
            </button>
          )}
        </div>
      }
    >
      <div className="import-dialog">
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        {/* 初始状态：文件选择区 */}
        {state === "idle" && !preview && (
          <div
            className="import-dropzone"
            onClick={triggerFileSelect}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="import-dropzone-icon">📁</div>
            <div className="import-dropzone-text">{t("import.dropzone")}</div>
            <div className="import-dropzone-hint">{t("import.dropzoneHint")}</div>
          </div>
        )}

        {/* 错误状态 */}
        {state === "error" && (
          <div className="import-error">
            <div className="import-error-icon">⚠️</div>
            <div className="import-error-text">{error}</div>
            <button className="btn-primary" onClick={resetState}>
              {t("import.retry")}
            </button>
          </div>
        )}

        {/* 预览状态 */}
        {state === "idle" && preview && (
          <div className="import-preview">
            <div className="import-preview-header">
              <div className="import-preview-icon">📄</div>
              <div className="import-preview-info">
                <div className="import-preview-filename">{file?.name}</div>
                <div className="import-preview-type">
                  {preview.type === "json" ? "JSON 备份" : "CSV 数据"}
                </div>
              </div>
            </div>

            {/* 预览内容 */}
            <div className="import-preview-content">
              {preview.type === "json" && (
                <>
                  {preview.exportedAt && (
                    <div className="import-preview-item">
                      <span className="import-preview-label">导出时间：</span>
                      <span>{new Date(preview.exportedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {preview.hasPerson && (
                    <div className="import-preview-item">
                      <span className="import-preview-label">人物数据：</span>
                      <span>✓</span>
                    </div>
                  )}
                  {preview.liurenCount > 0 && (
                    <div className="import-preview-item">
                      <span className="import-preview-label">大六壬记录：</span>
                      <span>{preview.liurenCount} 条</span>
                    </div>
                  )}
                  {preview.wikiCount > 0 && (
                    <div className="import-preview-item">
                      <span className="import-preview-label">Wiki文档：</span>
                      <span>{preview.wikiCount} 篇</span>
                    </div>
                  )}
                </>
              )}

              {preview.type === "csv" && (
                <>
                  <div className="import-preview-item">
                    <span className="import-preview-label">数据类型：</span>
                    <span>{preview.csvType === "liuren" ? "大六壬记录" : "Wiki文档"}</span>
                  </div>
                  <div className="import-preview-item">
                    <span className="import-preview-label">数据行数：</span>
                    <span>{preview.csvRowCount} 行</span>
                  </div>
                  {preview.csvSampleRows && preview.csvSampleRows.length > 0 && (
                    <div className="import-preview-sample">
                      <div className="import-preview-sample-title">数据预览（前 5 行）：</div>
                      <div className="import-preview-table">
                        <div className="import-preview-table-header">
                          {preview.csvHeaders?.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                        {preview.csvSampleRows.map((row, i) => (
                          <div key={i} className="import-preview-table-row">
                            {row.map((cell, j) => (
                              <div key={j}>{cell}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="import-warning">
              <p>{t("import.warning")}</p>
            </div>
          </div>
        )}

        {/* 导入中：进度显示 */}
        {state === "importing" && (
          <div className="import-progress">
            <div className="import-progress-bar" style={{ width: `${progress.percent}%` }} />
            <div className="import-progress-text">{progress.text}</div>
          </div>
        )}

        {/* 导入完成：结果展示 */}
        {state === "done" && result && (
          <div className="import-result">
            <div className="import-result-icon">✓</div>
            <div className="import-result-title">{t("import.complete")}</div>
            <div className="import-result-stats">
              {result.persons > 0 && (
                <div className="import-result-stat">
                  <span>人物：</span>
                  <span>{result.persons}</span>
                </div>
              )}
              {result.liuren > 0 && (
                <div className="import-result-stat">
                  <span>大六壬记录：</span>
                  <span>{result.liuren}</span>
                </div>
              )}
              {result.wiki > 0 && (
                <div className="import-result-stat">
                  <span>Wiki文档：</span>
                  <span>{result.wiki}</span>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="import-result-errors">
                <div className="import-result-errors-title">部分数据导入失败：</div>
                <ul>
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
