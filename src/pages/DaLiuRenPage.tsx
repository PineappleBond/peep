/**
 * 大六壬页面 - 左右分区布局
 * 左侧：历史列表区（30%宽度）
 * 右侧：盘面区（70%宽度）
 */
import { useState, useEffect } from "react";
import { LiurenList } from "../components/daliuren/LiurenList";
import { LiurenChart } from "../components/daliuren/LiurenChart";
import type { LiurenRecord } from "../core/personDb";
import { getDefaultPerson } from "../core/personDb";

export function DaLiuRenPage() {
  const [personId, setPersonId] = useState<number | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<LiurenRecord | null>(null);

  // 获取当前人物 ID（默认人物）
  useEffect(() => {
    getDefaultPerson().then((p) => {
      if (p.id != null) setPersonId(p.id);
    });
  }, []);

  // 占位操作（Dialog 后续实现）
  const handleNew = () => {
    alert("新建起课 Dialog 待实现");
  };

  const handleEdit = (record: LiurenRecord) => {
    alert(`编辑记录 #${record.id} Dialog 待实现`);
  };

  const handleDelete = (record: LiurenRecord) => {
    if (confirm(`确定要删除这条起课记录吗？\n占事：${record.question || "（无）"}\n此操作不可恢复。`)) {
      // 删除逻辑后续实现（Dialog 完成后）
      alert(`删除记录 #${record.id} 待实现`);
    }
  };

  const handleSelect = (record: LiurenRecord) => {
    setSelectedRecord(record);
  };

  if (personId === null) {
    return (
      <div className="liuren-page">
        <div className="liuren-loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="liuren-page">
      <div className="liuren-layout">
        <div className="liuren-left">
          <LiurenList
            personId={personId}
            selectedId={selectedRecord?.id ?? null}
            onSelect={handleSelect}
            onNewClick={handleNew}
            onEditClick={handleEdit}
            onDeleteClick={handleDelete}
          />
        </div>
        <div className="liuren-right">
          <LiurenChart record={selectedRecord} />
        </div>
      </div>
    </div>
  );
}
