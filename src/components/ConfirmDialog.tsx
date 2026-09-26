/**
 * 确认弹窗：基于 Dialog 的二次确认
 * 视觉风格匹配项目主题
 */
import { Dialog } from "./Dialog";
import { useI18n } from "../core/i18n";

type ConfirmDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText,
  cancelText,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onCancel} title={title ?? t("confirm.title")} width={380}>
      <div className="confirm-content">
        <div className="confirm-icon" aria-hidden="true">
          ⚠
        </div>
        <p className="confirm-msg">{message}</p>
      </div>
      <div className="dlg-foot">
        <button className="btn-cancel" onClick={onCancel}>
          {cancelText ?? t("confirm.cancelText")}
        </button>
        <button className="btn-danger" onClick={onConfirm}>
          {confirmText ?? t("confirm.confirmText")}
        </button>
      </div>
    </Dialog>
  );
}
