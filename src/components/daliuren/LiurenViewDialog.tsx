/**
 * 查看详情 Dialog
 * - 复用 LiurenChart 的渲染逻辑，以 Dialog 形式展示完整盘面
 */
import { Dialog } from "../Dialog";
import { LiurenChart } from "./LiurenChart";
import type { LiurenRecord } from "../../core/personDb";

interface LiurenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiurenRecord | null;
}

export function LiurenViewDialog({ open, onClose, record }: LiurenViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onClose={onClose} title="查看盘面详情" width={720}>
      <div className="liuren-view-dialog-content">
        <LiurenChart record={record} />
      </div>
    </Dialog>
  );
}
