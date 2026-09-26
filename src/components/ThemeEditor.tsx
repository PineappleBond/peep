/**
 * 主题编辑器弹窗
 *
 * 功能：
 * - 颜色选择器（HEX 输入 + 原生 color picker）
 * - 预设主题快速切换（根据当前亮暗模式显示对应分组）
 * - 实时预览（修改立即应用到 :root CSS 变量）
 * - 重置为默认
 * - 导出/导入主题 JSON
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog } from "./Dialog";
import { useI18n } from "../core/i18n";
import { toast } from "../core/toast";
import {
  EDITABLE_COLOR_KEYS,
  getPresetThemesForCurrentMode,
  getCustomTheme,
  saveCustomTheme,
  clearCustomTheme,
  importTheme,
  type CustomTheme,
  type PresetTheme,
  type ThemeColors,
} from "../core/themeEditor";

type ThemeEditorProps = {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
};

/** 解析颜色值为 HEX 格式（用于 color picker） */
function colorToHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return "#000000";
}

/** 默认主题颜色（用于重置对比） */
const DEFAULT_COLORS: ThemeColors = {
  bg: "#04060d",
  panel: "rgba(13, 20, 40, 0.72)",
  line: "rgba(96, 165, 250, 0.14)",
  "line-strong": "rgba(125, 211, 252, 0.42)",
  text: "#d9e4ff",
  dim: "#7787a8",
  faint: "#586888",
  gold: "#f3c96b",
  "gold-deep": "#c9992e",
  cyan: "#55d7ff",
  danger: "#f87171",
  rose: "#ff4d6d",
};

export function ThemeEditor({ open, onClose }: ThemeEditorProps) {
  const { t } = useI18n();
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS);
  const [themeName, setThemeName] = useState("自定义主题");
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const saved = getCustomTheme();
      if (saved) {
        setColors(saved.colors);
        setThemeName(saved.name);
      } else {
        setColors(DEFAULT_COLORS);
        setThemeName("自定义主题");
      }
      setIsDirty(false);
    }
  }, [open]);

  const updateColor = useCallback((key: keyof ThemeColors, value: string) => {
    setColors(prev => {
      const next = { ...prev, [key]: value };
      document.documentElement.style.setProperty(`--${key}`, value);
      return next;
    });
    setIsDirty(true);
  }, []);

  /** 应用预设主题 */
  const applyPreset = useCallback((preset: PresetTheme) => {
    setColors(preset.colors);
    setThemeName(preset.name);
    for (const [key, value] of Object.entries(preset.colors)) {
      document.documentElement.style.setProperty(`--${key}`, value);
    }
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    const theme: CustomTheme = { name: themeName, colors };
    saveCustomTheme(theme);
    setIsDirty(false);
    toast.success(t("themeEditor.saved"));
  }, [themeName, colors, t]);

  const handleReset = useCallback(() => {
    clearCustomTheme();
    setColors(DEFAULT_COLORS);
    setThemeName("自定义主题");
    setIsDirty(false);
    toast.info(t("themeEditor.reset"));
  }, [t]);

  const handleExport = useCallback(() => {
    const theme: CustomTheme = { name: themeName, colors };
    const json = JSON.stringify(theme, null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        toast.success(t("themeEditor.exportCopied"));
      })
      .catch(() => {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `theme-${themeName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("themeEditor.exportDownloaded"));
      });
  }, [themeName, colors, t]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = importTheme(reader.result as string);
          setColors(imported.colors);
          setThemeName(imported.name);
          setIsDirty(false);
          toast.success(t("themeEditor.imported"));
        } catch {
          toast.error(t("themeEditor.importFailed"));
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [t],
  );

  // 获取当前模式的预设主题
  const currentPresets = getPresetThemesForCurrentMode();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("themeEditor.title")}
      width={520}
      footer={
        <div className="te-footer">
          <button className="te-btn te-btn-ghost" onClick={handleReset}>
            {t("themeEditor.resetBtn")}
          </button>
          <div className="te-footer-right">
            <button className="te-btn te-btn-ghost" onClick={handleImportClick}>
              {t("themeEditor.importBtn")}
            </button>
            <button className="te-btn te-btn-ghost" onClick={handleExport}>
              {t("themeEditor.exportBtn")}
            </button>
            <button className="te-btn te-btn-primary" onClick={handleSave} disabled={!isDirty}>
              {t("themeEditor.saveBtn")}
            </button>
          </div>
        </div>
      }
    >
      <div className="te-body">
        <div className="te-section">
          <label className="te-label" htmlFor="te-name">
            {t("themeEditor.nameLabel")}
          </label>
          <input
            id="te-name"
            className="te-input"
            type="text"
            value={themeName}
            onChange={e => {
              setThemeName(e.target.value);
              setIsDirty(true);
            }}
            placeholder={t("themeEditor.namePlaceholder")}
          />
        </div>

        <div className="te-section">
          <label className="te-label">{t("themeEditor.presets")}</label>
          <div className="te-presets">
            {currentPresets.map(preset => (
              <button
                key={preset.name}
                className="te-preset"
                onClick={() => applyPreset(preset)}
                title={preset.name}
              >
                <div className="te-preset-swatch">
                  <span style={{ background: preset.colors.bg }} />
                  <span style={{ background: preset.colors.gold }} />
                  <span style={{ background: preset.colors.cyan }} />
                  <span style={{ background: preset.colors.text }} />
                </div>
                <span className="te-preset-name">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="te-section">
          <label className="te-label">{t("themeEditor.colors")}</label>
          <div className="te-colors">
            {EDITABLE_COLOR_KEYS.map(({ key, label }) => (
              <div key={key} className="te-color-row">
                <span className="te-color-label" id={`te-color-label-${key}`}>
                  {t(label)}
                </span>
                <div className="te-color-inputs">
                  <input
                    type="color"
                    className="te-color-picker"
                    value={colorToHex(colors[key])}
                    onChange={e => updateColor(key, e.target.value)}
                    title={t("themeEditor.pickColor")}
                    aria-labelledby={`te-color-label-${key}`}
                  />
                  <input
                    type="text"
                    className="te-color-text"
                    value={colors[key]}
                    onChange={e => updateColor(key, e.target.value)}
                    placeholder="#000000"
                    aria-label={`${t(label)} 颜色值`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
      </div>
    </Dialog>
  );
}
