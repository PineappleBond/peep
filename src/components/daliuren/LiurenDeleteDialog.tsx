/**
 * 删除确认 Dialog
 * - 二次确认："确定要删除这条起课记录吗？此操作不可恢复。"
 */
import { useState } from "react";
import { Dialog } from "../Dialog";
import { deleteLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord } from "../../core/personDb";

interface LiurenDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiurenRecord | null;
  onDeleted: () => void;
}

export function LiurenDeleteDialog({
  open,
  onClose,
  record,
  onDeleted,
}: LiurenDeleteDialogProps) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="删除确认"
      width={420}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose} disabled={deleting}>
            取消
          </button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "删除中..." : "确定删除"}
          </button>
        </>
      }
    >
      <div className="liuren-delete-confirm">
        {error && <div className="liuren-form-error">{error}</div>}
        <p className="liuren-delete-msg">确定要删除这条起课记录吗？此操作不可恢复。</p>
        {record && (
          <div className="liuren-delete-info">
            <div>
              <strong>起课时间：</strong>
              {record.calculationTime}
            </div>
            {record.question && (
              <div>
                <strong>占事：</strong>
                {record.question}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
