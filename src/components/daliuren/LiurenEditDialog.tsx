/**
 * 编辑 Dialog
 * - 预填充现有数据，仅可修改：question、note、background、tags
 * - 不可修改起课时间与卦象数据
 */
import { useState, useEffect } from "react";
import { Dialog } from "../Dialog";
import { TagInput } from "./TagInput";
import { saveLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord } from "../../core/personDb";

interface LiurenEditDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiurenRecord | null;
  onSaved: () => void;
}

export function LiurenEditDialog({
  open,
  onClose,
  record,
  onSaved,
}: LiurenEditDialogProps) {
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [background, setBackground] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时填充现有数据
  useEffect(() => {
    if (record && open) {
      setQuestion(record.question);
      setNote(record.note);
      setBackground(record.background);
      setTags([...record.tags]);
      setError(null);
    }
  }, [record, open]);

  const handleSubmit = async () => {
    if (!record) {
      setError("未找到要编辑的记录");
      return;
    }
    if (!question.trim()) {
      setError("占事问题不能为空");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated: LiurenRecord = {
        ...record,
        question: question.trim(),
        note: note.trim(),
        background: background.trim(),
        tags,
      };
      await saveLiurenRecord(updated);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="编辑起课信息"
      width={520}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <div className="liuren-dialog-form">
        {error && <div className="liuren-form-error" role="alert">{error}</div>}

        {/* 只读信息 */}
        <div className="liuren-form-field readonly">
          <label>起课时间</label>
          <div className="liuren-form-static">{record?.calculationTime}</div>
        </div>

        <div className="liuren-form-field">
          <label>
            占事问题 <span className="required">*</span>
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：问事业、问感情..."
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="liuren-form-field">
          <label>备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="选填"
            maxLength={500}
          />
        </div>
        <div className="liuren-form-field">
          <label>背景信息</label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="选填，可描述当前背景..."
            rows={3}
            maxLength={2000}
          />
        </div>
        <div className="liuren-form-field">
          <label>标签</label>
          <TagInput value={tags} onChange={setTags} placeholder="输入标签后按回车..." />
        </div>
      </div>
    </Dialog>
  );
}
