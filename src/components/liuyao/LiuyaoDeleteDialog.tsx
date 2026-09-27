/**
 * 六爻删除确认 Dialog
 */
import { useState } from "react";
import { Dialog } from "../Dialog";
import { deleteLiuyaoRecord } from "../../core/liuyaoDb";
import type { LiuyaoRecord } from "../../core/personDb";
import { useI18n } from "../../core/i18n";
import { toast } from "../../core/toast";

interface LiuyaoDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiuyaoRecord | null;
  onDeleted: () => void;
}

export function LiuyaoDeleteDialog({ open, onClose, record, onDeleted }: LiuyaoDeleteDialogProps) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!record) return;
    setDeleting(true);
    setServerError(null);

    try {
      await deleteLiuyaoRecord(record.id!);
      toast.success(t("liuyao.deleteSuccess") || "记录已删除");
      onDeleted();
      onClose();
    } catch (err) {
      console.error("[LiuyaoDeleteDialog] 删除失败", err);
      setServerError(err instanceof Error ? err.message : t("liuyao.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("liuyao.confirmDelete") || "确认删除"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={deleting}>
            {t("common.cancel")}
          </button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t("common.deleting") : t("common.delete")}
          </button>
        </>
      }
    >
      {serverError && <div className="form-error-banner">{serverError}</div>}
      <p>{t("liuyao.deleteConfirmMessage") || "确定要删除这条起卦记录吗？此操作不可撤销。"}</p>
      {record && (
        <div className="delete-record-preview">
          <strong>{record.question || t("liuyao.noQuestion") || "未命名占事"}</strong>
          <div className="record-meta">{record.divinationTime}</div>
        </div>
      )}
    </Dialog>
  );
}
