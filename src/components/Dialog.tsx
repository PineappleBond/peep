/**
 * 通用模态弹窗：遮罩 + 面板 + 标题 + 关闭
 * 视觉风格匹配项目主题（深空黑蓝底、青蓝辉光、backdrop blur）
 */
import { useEffect, type ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 面板宽度，默认 480px */
  width?: number;
};

export function Dialog({ open, onClose, title, children, width = 480 }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dlg-mask" onClick={onClose}>
      <div
        className="dlg-panel"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dlg-head">
          <h2 className="dlg-title">{title}</h2>
          <button className="dlg-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  );
}
