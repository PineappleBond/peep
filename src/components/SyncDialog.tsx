/**
 * 同步对话框：多设备数据同步 UI
 *
 * 功能：
 * - 生成加密同步链接（URL 哈希携带密文）
 * - 粘贴链接并解密还原数据
 * - 同步历史查看
 * - 配置管理（默认密码、自动同步）
 *
 * 安全性：
 * - 密码仅本地使用，不进入 URL
 * - 采用 AES-GCM 端到端加密
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import { useI18n } from "../core/i18n";
import { toast } from "../core/toast";
import {
  generateSyncLink,
  restoreFromLink,
  previewFromLink,
  clearSyncLinkFromUrl,
  parseSyncLink,
  detectConflicts,
  estimateSnapshotSize,
  loadSyncConfig,
  saveSyncConfig,
  loadSyncHistory,
  clearSyncHistory,
  type SyncRecord,
  type SyncConfig,
  type RestoreMode,
  LINK_KEY,
} from "../core/sync";
import type { BackupData } from "../core/importData";

type SyncDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 数据还原成功后的回调 */
  onRestored?: () => void;
};

type Tab = "upload" | "download" | "history" | "settings";

/** 上传阶段状态 */
type UploadState = "idle" | "generating" | "done" | "error";

/** 下载阶段状态 */
type DownloadState = "idle" | "previewing" | "ready" | "restoring" | "done" | "error";

/** 格式化字节数 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 格式化时间 */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function SyncDialog({ open, onClose, onRestored }: SyncDialogProps) {
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>("upload");
  const [config, setConfig] = useState<SyncConfig>(() => loadSyncConfig());

  // 上传
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, text: "" });
  const [generatedLink, setGeneratedLink] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [password, setPassword] = useState("");

  // 下载
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [inputLink, setInputLink] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [conflicts, setConflicts] = useState<{
    persons: number;
    liuren: number;
    wiki: number;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("overwrite");
  const [downloadError, setDownloadError] = useState("");
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, text: "" });

  // 历史
  const [history, setHistory] = useState<SyncRecord[]>(() => loadSyncHistory());

  // 对话框打开时检测 URL 中的同步载荷
  useEffect(() => {
    if (!open) return;
    const parsed = parseSyncLink();
    if (parsed) {
      // 自动跳到下载页，并把链接填入
      setInputLink(globalThis.location.href);
      setTab("download");
    }
  }, [open]);

  // 重置上传状态
  const resetUpload = useCallback(() => {
    setUploadState("idle");
    setUploadProgress({ percent: 0, text: "" });
    setGeneratedLink("");
    setUploadError("");
  }, []);

  // 重置下载状态
  const resetDownload = useCallback(() => {
    setDownloadState("idle");
    setDownloadProgress({ percent: 0, text: "" });
    setPreviewData(null);
    setConflicts(null);
    setDownloadError("");
  }, []);

  // 关闭：如果正在操作中则禁止
  const handleClose = useCallback(() => {
    if (uploadState === "generating" || downloadState === "restoring") return;
    onClose();
  }, [uploadState, downloadState, onClose]);

  /* ── 生成同步链接 ── */
  const handleGenerate = useCallback(async () => {
    setUploadState("generating");
    setUploadError("");
    setGeneratedLink("");
    try {
      const pwd = password || config.defaultPassword;
      const link = await generateSyncLink(
        pwd,
        (percent, text) => {
          setUploadProgress({ percent, text });
        },
        t,
      );
      setGeneratedLink(link);
      setUploadState("done");
      setHistory(loadSyncHistory());
      toast.success(t("sync.linkGenerated"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      setUploadState("error");
      toast.error(t("sync.failed"));
    }
  }, [password, config.defaultPassword, t]);

  /* ── 复制链接 ── */
  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success(t("common.copied"));
    } catch {
      // 回退：选中输入框让用户手动复制
      toast.error(t("common.operationFailed"));
    }
  }, [generatedLink, t]);

  /* ── 解析下载链接 ── */
  const handleParseLink = useCallback(async () => {
    if (!inputLink.trim()) return;
    setDownloadState("previewing");
    setDownloadError("");
    setPreviewData(null);
    setConflicts(null);
    try {
      const data = await previewFromLink(inputLink, inputPassword, t);
      setPreviewData(data);
      const c = await detectConflicts(data);
      setConflicts(c);
      setDownloadState("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadError(msg);
      setDownloadState("error");
    }
  }, [inputLink, inputPassword, t]);

  /* ── 执行还原 ── */
  const handleRestore = useCallback(async () => {
    if (!previewData) return;
    setDownloadState("restoring");
    setDownloadError("");
    setDownloadProgress({ percent: 30, text: t("sync.restoring") });
    try {
      await restoreFromLink(inputLink, inputPassword, restoreMode, t);
      setDownloadProgress({ percent: 100, text: t("sync.restoreComplete") });
      setDownloadState("done");
      setHistory(loadSyncHistory());
      // 移除 URL 中的同步载荷，避免重复触发
      clearSyncLinkFromUrl();
      toast.success(t("sync.restoreSuccess"));
      onRestored?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadError(msg);
      setDownloadState("error");
      toast.error(t("sync.restoreFailed"));
    }
  }, [inputLink, inputPassword, previewData, restoreMode, t, onRestored]);

  /* ── 保存配置 ── */
  const handleSaveConfig = useCallback(
    (patch: Partial<SyncConfig>) => {
      const next = { ...config, ...patch };
      setConfig(next);
      saveSyncConfig(next);
    },
    [config],
  );

  /* ── 清空历史 ── */
  const handleClearHistory = useCallback(() => {
    clearSyncHistory();
    setHistory([]);
    toast.success(t("sync.historyCleared"));
  }, [t]);

  /* ── 预览摘要 ── */
  const previewSummary = useMemo(() => {
    if (!previewData) return null;
    return {
      persons: previewData.persons?.length ?? 0,
      liuren: previewData.liuren?.length ?? 0,
      wiki: previewData.wiki?.length ?? 0,
      wikiLinks: previewData.wikiLinks?.length ?? 0,
      exportedAt: previewData.meta?.exportedAt,
    };
  }, [previewData]);

  // 估算快照大小（用于提示）
  const [snapshotSize, setSnapshotSize] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    estimateSnapshotSize()
      .then(setSnapshotSize)
      .catch(() => {
        /* 估算失败不影响功能，snapshotSize 保持 undefined */
      });
  }, [open]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "upload", label: t("sync.tab.upload") },
    { id: "download", label: t("sync.tab.download") },
    { id: "history", label: t("sync.tab.history") },
    { id: "settings", label: t("sync.tab.settings") },
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("sync.title")}
      width={580}
      footer={
        <div className="dlg-buttons">
          <button
            className="btn-cancel"
            onClick={handleClose}
            disabled={uploadState === "generating" || downloadState === "restoring"}
          >
            {t("common.close")}
          </button>
        </div>
      }
    >
      <div className="sync-dialog">
        {/* 标签页 */}
        <div className="sync-tabs" role="tablist" aria-label={t("sync.title")}>
          {tabs.map(tb => (
            <button
              key={tb.id}
              role="tab"
              id={`sync-tab-${tb.id}`}
              className={`sync-tab${tab === tb.id ? " active" : ""}`}
              aria-selected={tab === tb.id}
              aria-controls={`sync-panel-${tb.id}`}
              onClick={() => setTab(tb.id)}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* ────── 上传面板 ────── */}
        {tab === "upload" && (
          <div
            className="sync-panel"
            role="tabpanel"
            id="sync-panel-upload"
            aria-labelledby="sync-tab-upload"
          >
            <p className="sync-hint">{t("sync.uploadHint")}</p>

            <div className="sync-field">
              <label className="sync-label" htmlFor="sync-upload-password">
                {t("sync.password")}
              </label>
              <input
                id="sync-upload-password"
                type="password"
                className="sync-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={
                  config.defaultPassword ? t("sync.defaultPasswordHint") : t("sync.noPasswordHint")
                }
                disabled={uploadState === "generating"}
              />
            </div>

            {snapshotSize != null && (
              <p className="sync-meta">
                {t("sync.dataSize")}：{formatBytes(snapshotSize)}
                {snapshotSize > 1_000_000 && ` · ${t("sync.largeWarning")}`}
              </p>
            )}

            {uploadState !== "done" && (
              <button
                className="btn-primary"
                onClick={handleGenerate}
                disabled={uploadState === "generating"}
              >
                {uploadState === "generating"
                  ? `${t("sync.generating")} ${uploadProgress.percent}%`
                  : t("sync.generateLink")}
              </button>
            )}

            {uploadState === "generating" && (
              <div
                className="sync-progress"
                role="progressbar"
                aria-valuenow={uploadProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("sync.uploading")}
              >
                <div
                  className="sync-progress-bar"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
                <div className="sync-progress-text">{uploadProgress.text}</div>
              </div>
            )}

            {uploadState === "done" && generatedLink && (
              <div className="sync-result">
                <div className="sync-result-title">{t("sync.linkGenerated")}</div>
                <textarea
                  className="sync-link-textarea"
                  value={generatedLink}
                  readOnly
                  rows={4}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
                <div className="sync-result-actions">
                  <button className="btn-primary" onClick={handleCopyLink}>
                    {t("sync.copyLink")}
                  </button>
                  <button className="btn-cancel" onClick={resetUpload}>
                    {t("sync.regenerate")}
                  </button>
                </div>
                <p className="sync-hint">{t("sync.linkHint")}</p>
              </div>
            )}

            {uploadState === "error" && (
              <div className="sync-error" role="alert">
                <span className="sync-error-icon" aria-hidden="true">
                  ⚠️
                </span>
                <span>{uploadError}</span>
                <button className="btn-cancel" onClick={resetUpload}>
                  {t("common.retry")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ────── 下载面板 ── */}
        {tab === "download" && (
          <div
            className="sync-panel"
            role="tabpanel"
            id="sync-panel-download"
            aria-labelledby="sync-tab-download"
          >
            <p className="sync-hint">{t("sync.downloadHint")}</p>

            <div className="sync-field">
              <label className="sync-label" htmlFor="sync-download-link">
                {t("sync.pasteLink")}
              </label>
              <textarea
                id="sync-download-link"
                className="sync-link-textarea"
                value={inputLink}
                onChange={e => setInputLink(e.target.value)}
                rows={3}
                placeholder={`${globalThis.location?.origin ?? ""}/#${LINK_KEY}=...`}
                disabled={downloadState === "previewing" || downloadState === "restoring"}
              />
            </div>

            <div className="sync-field">
              <label className="sync-label" htmlFor="sync-download-password">
                {t("sync.password")}
              </label>
              <input
                id="sync-download-password"
                type="password"
                className="sync-input"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder={t("sync.passwordPlaceholder")}
                disabled={downloadState === "previewing" || downloadState === "restoring"}
              />
            </div>

            {downloadState === "idle" && (
              <button
                className="btn-primary"
                onClick={handleParseLink}
                disabled={!inputLink.trim()}
              >
                {t("sync.parseLink")}
              </button>
            )}

            {downloadState === "previewing" && (
              <div
                className="sync-progress"
                role="progressbar"
                aria-valuenow={50}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("sync.parsing")}
              >
                <div className="sync-progress-bar" style={{ width: "50%" }} />
                <div className="sync-progress-text">{t("sync.parsing")}</div>
              </div>
            )}

            {downloadState === "ready" && previewSummary && (
              <div className="sync-preview">
                <div className="sync-preview-title">{t("sync.dataPreview")}</div>
                {previewSummary.exportedAt && (
                  <div className="sync-preview-item">
                    <span className="sync-preview-label">{t("sync.exportedAt")}：</span>
                    <span>{formatTime(new Date(previewSummary.exportedAt).getTime())}</span>
                  </div>
                )}
                <div className="sync-preview-item">
                  <span className="sync-preview-label">{t("sync.personsCount")}：</span>
                  <span>{previewSummary.persons}</span>
                </div>
                <div className="sync-preview-item">
                  <span className="sync-preview-label">{t("sync.liurenCount")}：</span>
                  <span>{previewSummary.liuren}</span>
                </div>
                <div className="sync-preview-item">
                  <span className="sync-preview-label">{t("sync.wikiCount")}：</span>
                  <span>{previewSummary.wiki}</span>
                </div>
                {conflicts &&
                  (conflicts.persons > 0 || conflicts.liuren > 0 || conflicts.wiki > 0) && (
                    <div className="sync-conflict-warning">
                      {t("sync.conflictsDetected")}：{conflicts.persons} 人物 / {conflicts.liuren}{" "}
                      六壬 / {conflicts.wiki} Wiki
                    </div>
                  )}

                <div className="sync-field">
                  <label className="sync-label">{t("sync.restoreMode")}</label>
                  <div className="sync-radio-group">
                    <label className="sync-radio">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="overwrite"
                        checked={restoreMode === "overwrite"}
                        onChange={() => setRestoreMode("overwrite")}
                      />
                      <span>{t("sync.overwriteMode")}</span>
                    </label>
                    <label className="sync-radio">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                      />
                      <span>{t("sync.mergeMode")}</span>
                    </label>
                  </div>
                </div>

                <div className="sync-result-actions">
                  <button className="btn-primary" onClick={handleRestore}>
                    {t("sync.startRestore")}
                  </button>
                  <button className="btn-cancel" onClick={resetDownload}>
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            {downloadState === "restoring" && (
              <div
                className="sync-progress"
                role="progressbar"
                aria-valuenow={downloadProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("sync.restoring")}
              >
                <div
                  className="sync-progress-bar"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
                <div className="sync-progress-text">{downloadProgress.text}</div>
              </div>
            )}

            {downloadState === "done" && (
              <div className="sync-result">
                <div className="sync-result-title">{t("sync.restoreComplete")}</div>
                <p className="sync-hint">{t("sync.refreshHint")}</p>
                <button
                  className="btn-primary"
                  onClick={() => {
                    resetDownload();
                    setTab("upload");
                  }}
                >
                  {t("common.close")}
                </button>
              </div>
            )}

            {downloadState === "error" && (
              <div className="sync-error" role="alert">
                <span className="sync-error-icon" aria-hidden="true">
                  ⚠️
                </span>
                <span>{downloadError}</span>
                <button className="btn-cancel" onClick={resetDownload}>
                  {t("common.retry")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ────── 历史面板 ────── */}
        {tab === "history" && (
          <div
            className="sync-panel"
            role="tabpanel"
            id="sync-panel-history"
            aria-labelledby="sync-tab-history"
          >
            {history.length === 0 ? (
              <p className="sync-empty">{t("sync.noHistory")}</p>
            ) : (
              <>
                <div className="sync-history-list">
                  {history.map((rec, i) => (
                    <div
                      key={`${rec.at}-${i}`}
                      className={`sync-history-item sync-history-${rec.event}${
                        !rec.success ? " sync-history-fail" : ""
                      }`}
                    >
                      <div className="sync-history-icon" aria-hidden="true">
                        {rec.event === "upload" ? "↑" : "↓"}
                      </div>
                      <div className="sync-history-main">
                        <div className="sync-history-time">{formatTime(rec.at)}</div>
                        <div className="sync-history-meta">
                          {rec.event === "upload" ? t("sync.upload") : t("sync.download")} ·{" "}
                          {formatBytes(rec.size)} ·{" "}
                          {rec.encrypted ? t("sync.encrypted") : t("sync.plain")}
                        </div>
                      </div>
                      {!rec.success && rec.error && (
                        <div
                          className="sync-history-error"
                          title={rec.error}
                          aria-label={rec.error}
                        >
                          ⚠️
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button className="btn-cancel" onClick={handleClearHistory}>
                  {t("sync.clearHistory")}
                </button>
              </>
            )}
          </div>
        )}

        {/* ────── 设置面板 ────── */}
        {tab === "settings" && (
          <div
            className="sync-panel"
            role="tabpanel"
            id="sync-panel-settings"
            aria-labelledby="sync-tab-settings"
          >
            <div className="sync-field">
              <label className="sync-label" htmlFor="sync-settings-password">
                {t("sync.defaultPassword")}
              </label>
              <input
                id="sync-settings-password"
                type="password"
                className="sync-input"
                value={config.defaultPassword}
                onChange={e => handleSaveConfig({ defaultPassword: e.target.value })}
                placeholder={t("sync.defaultPasswordHint")}
              />
              <p className="sync-hint">{t("sync.defaultPasswordHelp")}</p>
            </div>

            <div className="sync-field">
              <span className="sync-label" id="sync-auto-sync-label">
                {t("sync.autoSync")}
              </span>
              <label className="sync-radio">
                <input
                  type="checkbox"
                  checked={config.autoUpload}
                  onChange={e => handleSaveConfig({ autoUpload: e.target.checked })}
                  aria-labelledby="sync-auto-sync-label"
                />
                <span>{t("sync.autoUpload")}</span>
              </label>
            </div>

            <div className="sync-about">
              <div className="sync-about-title">{t("sync.about")}</div>
              <p className="sync-hint">{t("sync.aboutText")}</p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
