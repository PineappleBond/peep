/**
 * 删除确认 Dialog
 * - 二次确认："确定要删除这条起课记录吗？此操作不可恢复。"
 */
import { useState } from "react";
import { Dialog } from "../Dialog";
import { deleteLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord } from "../../core/personDb";
import { useI18n } from "../../core/i18n";
import { toast } from "../../core/toast";

interface LiurenDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiurenRecord | null;
  onDeleted: () => void;
}

export function LiurenDeleteDialog({ open, onClose, record, onDeleted }: LiurenDeleteDialogProps) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!record?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteLiurenRecord(record.id);
      onDeleted();
      onClose();
      toast.success(t("common.deleteSuccess"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("daliuren.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("daliuren.deleteTitle")}
      width={420}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose} disabled={deleting}>
            {t("common.cancel")}
          </button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? t("common.deleting") : t("daliuren.confirmDelete")}
          </button>
        </>
      }
    >
      <div className="liuren-delete-confirm">
        {error && (
          <div className="liuren-form-error" role="alert">
            {error}
          </div>
        )}
        <p className="liuren-delete-msg">{t("daliuren.deleteMessage")}</p>
        {record && (
          <div className="liuren-delete-info">
            <div>
              <strong>
                {t("common.labelValue", {
                  label: t("daliuren.courseTime"),
                  value: record.calculationTime,
                })}
              </strong>
            </div>
            {record.question && (
              <div>
                <strong>
                  {t("common.labelValue", {
                    label: t("daliuren.questionLabel"),
                    value: record.question,
                  })}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
