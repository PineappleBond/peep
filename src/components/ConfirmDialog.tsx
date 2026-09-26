/**
 * 确认弹窗：基于 Dialog 的二次确认
 * 视觉风格匹配项目主题
 */
import { Dialog } from "./Dialog";

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
  title = "确认操作",
  message,
  confirmText = "确定",
  cancelText = "取消",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} width={380}>
      <div className="confirm-content">
        <div className="confirm-icon" aria-hidden="true">⚠</div>
        <p className="confirm-msg">{message}</p>
      </div>
      <div className="dlg-foot">
        <button className="btn-cancel" onClick={onCancel}>
          {cancelText}
        </button>
        <button className="btn-danger" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
}
