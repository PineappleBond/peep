/**
 * 新建起课 Dialog
 * - 表单：占事问题（必填）、备注、背景信息、tags
 * - 提交：自动用当前时间 + 当前人物出生年调用 calculateDaLiuRen，保存记录
 */
import { useState, useEffect, useRef } from "react";
import { Dialog } from "../Dialog";
import { TagInput } from "./TagInput";
import { calculateDaLiuRen } from "../../core/daliuren/calculator";
import { saveLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord, Person } from "../../core/personDb";

interface LiurenCreateDialogProps {
  open: boolean;
  onClose: () => void;
  person: Person;
  onSaved: () => void;
  /** 调试 API：预填充的表单数据 */
  initialData?: {
    question: string;
    note: string;
    background: string;
    tags: string[];
  };
  /** 调试 API：提交触发计数器，变化时自动提交 */
  submitTrigger?: number;
}

export function LiurenCreateDialog({
  open,
  onClose,
  person,
  onSaved,
  initialData,
  submitTrigger,
}: LiurenCreateDialogProps) {
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [background, setBackground] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当 Dialog 打开且有 initialData 时，预填充表单
  useEffect(() => {
    if (open && initialData) {
      setQuestion(initialData.question);
      setNote(initialData.note);
      setBackground(initialData.background);
      setTags(initialData.tags);
    }
  }, [open, initialData]);

  // 调试 API：当 submitTrigger 变化时，自动提交
  const prevSubmitTriggerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (submitTrigger !== undefined && submitTrigger !== prevSubmitTriggerRef.current && open && !saving) {
      prevSubmitTriggerRef.current = submitTrigger;
      // 延迟一帧，确保 initialData 触发的表单状态更新已生效
      setTimeout(() => {
        handleSubmit();
      }, 50);
    }
  }, [submitTrigger, open, saving]);

  const resetForm = () => {
    setQuestion("");
    setNote("");
    setBackground("");
    setTags([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError("占事问题不能为空");
      return;
    }
    if (person.date == null) {
      setError("人物出生日期未设置");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      // 解析出生年份（防御性处理：格式异常时降级为 2000）
      const parsedYear = parseInt(person.date.split("-")[0], 10);
      const birthYear = Number.isFinite(parsedYear) ? parsedYear : 2000;
      const gender = (person.gender as "男" | "女") ?? "男";

      const result = calculateDaLiuRen(dateStr, timeStr, { birthYear, gender });

      const record: LiurenRecord = {
        personId: person.id!,
        calculationTime: `${dateStr} ${timeStr}`,
        question: question.trim(),
        note: note.trim(),
        background: background.trim(),
        tags,
        result,
        savedAt: Date.now(),
      };

      await saveLiurenRecord(record);
      resetForm();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "起课失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="新建起课"
      width={520}
      footer={
        <>
          <button className="btn-cancel" onClick={handleClose} disabled={saving}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "起课中..." : "起课并保存"}
          </button>
        </>
      }
    >
      <div className="liuren-dialog-form">
        {error && <div className="liuren-form-error">{error}</div>}
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
