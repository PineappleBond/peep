/**
 * 六爻查看详情 Dialog - 复用 LiuyaoChart 展示完整卦象
 */
import { Dialog } from "../Dialog";
import { LiuyaoChart } from "./LiuyaoChart";
import type { LiuyaoRecord } from "../../core/personDb";
import { useI18n } from "../../core/i18n";

interface LiuyaoViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiuyaoRecord | null;
}

export function LiuyaoViewDialog({ open, onClose, record }: LiuyaoViewDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("liuyao.viewDetail") || "卦象详情"}
      footer={
        <button className="btn-secondary" onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      <LiuyaoChart record={record} vigorColumns={null} />
    </Dialog>
  );
}
