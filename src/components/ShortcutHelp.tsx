/**
 * 快捷键帮助弹窗
 * 展示所有已注册的可用快捷键，按分组排列
 * 按 "?" 键打开/关闭
 */
import { useEffect, useState } from "react";
import { useI18n } from "../core/i18n";
import {
  getRegisteredShortcuts,
  onHelpVisibility,
  isHelpVisible,
  type ShortcutDef,
} from "../core/shortcuts";
import { useFocusTrap } from "../core/useFocusTrap";

/** 将快捷键键名渲染为用户友好的格式 */
function formatKeyCombo(key: string): string {
  return key
    .split("+")
    .map(part => {
      switch (part) {
        case "Ctrl":
          return "⌃";
        case "Shift":
          return "⇧";
        case "Alt":
          return "⌥";
        case "Escape":
          return "Esc";
        case "Enter":
          return "↵";
        case "ArrowUp":
          return "↑";
        case "ArrowDown":
          return "↓";
        case "ArrowLeft":
          return "←";
        case "ArrowRight":
          return "→";
        default:
          return part;
      }
    })
    .join("");
}

/** 按分组整理快捷键 */
function groupShortcuts(shortcuts: ShortcutDef[]): Map<string, ShortcutDef[]> {
  const groups = new Map<string, ShortcutDef[]>();
  for (const sc of shortcuts) {
    const group = sc.group || "common.other";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(sc);
  }
  return groups;
}

export function ShortcutHelp() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(isHelpVisible);
  const titleId = "shortcut-help-title";

  // 使用通用焦点陷阱 hook（ESC 关闭 + 焦点循环 + 自动聚焦）
  const panelRef = useFocusTrap<HTMLDivElement>(visible, {
    autoFocus: true,
    returnFocus: true,
  });

  useEffect(() => {
    return onHelpVisibility(setVisible);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [visible]);

  if (!visible) return null;

  const shortcuts = getRegisteredShortcuts();
  const groups = groupShortcuts(shortcuts);

  // 分组的显示顺序
  const groupOrder = [
    "shortcut.group.nav",
    "shortcut.group.general",
    "shortcut.group.ziwei",
    "shortcut.group.daliuren",
    "shortcut.group.wiki",
    "common.other",
  ];

  // 按预定义顺序排列分组，未列出的分组追加到末尾
  const sortedGroups: [string, ShortcutDef[]][] = [];
  for (const key of groupOrder) {
    if (groups.has(key)) {
      sortedGroups.push([key, groups.get(key)!]);
      groups.delete(key);
    }
  }
  // 剩余分组
  for (const [key, defs] of groups) {
    sortedGroups.push([key, defs]);
  }

  return (
    <div className="shortcut-help-mask" onClick={() => setVisible(false)}>
      <div
        ref={panelRef}
        className="shortcut-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="shortcut-help-head">
          <h2 className="shortcut-help-title" id={titleId}>
            {t("shortcut.helpTitle")}
          </h2>
          <button
            className="shortcut-help-close"
            onClick={() => setVisible(false)}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
        <div className="shortcut-help-body">
          {sortedGroups.map(([groupKey, defs]) => (
            <div key={groupKey} className="shortcut-group">
              <h3 className="shortcut-group-title">{t(groupKey)}</h3>
              <dl className="shortcut-list">
                {defs.map(def => (
                  <div key={def.key} className="shortcut-item">
                    <dt className="shortcut-desc">{def.description}</dt>
                    <dd className="shortcut-key">
                      <kbd>{formatKeyCombo(def.key)}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="shortcut-help-foot">
          <span className="shortcut-hint">{t("shortcut.hintPress")}</span>
          <kbd>?</kbd>
          <span className="shortcut-hint">{t("shortcut.hintToggle")}</span>
        </div>
      </div>
    </div>
  );
}
