/**
 * 新建起课 Dialog
 * - 表单：占事问题（必填）、备注、背景信息、tags
 * - 提交：自动用当前时间 + 当前人物出生年调用 calculateDaLiuRen，保存记录
 */
import { useState, useEffect, useRef } from "react";
import { Dialog } from "../Dialog";
import { LiurenFormFields, EMPTY_LIUREN_FORM, type LiurenFormValues } from "./LiurenFormFields";
import { calculateDaLiuRen } from "../../core/daliuren/calculator";
import { formatDate, formatDateTime } from "../../core/utils";
import { saveLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord, Person } from "../../core/personDb";
import { useI18n } from "../../core/i18n";

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
  const { t } = useI18n();
  const [values, setValues] = useState<LiurenFormValues>(EMPTY_LIUREN_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateValues = (patch: Partial<LiurenFormValues>) => {
    setValues(prev => ({ ...prev, ...patch }));
  };

  // 当 Dialog 打开且有 initialData 时，预填充表单
  useEffect(() => {
    if (open && initialData) {
      setValues({
        question: initialData.question,
        note: initialData.note,
        background: initialData.background,
        tags: initialData.tags,
      });
    }
  }, [open, initialData]);

  // 调试 API：当 submitTrigger 变化时，自动提交
  const prevSubmitTriggerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      submitTrigger !== undefined &&
      submitTrigger !== prevSubmitTriggerRef.current &&
      open &&
      !saving
    ) {
      prevSubmitTriggerRef.current = submitTrigger;
      // 延迟一帧，确保 initialData 触发的表单状态更新已生效
      setTimeout(() => {
        handleSubmit();
      }, 50);
    }
  }, [submitTrigger, open, saving]);

  const resetForm = () => {
    setValues(EMPTY_LIUREN_FORM);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!values.question.trim()) {
      setError(t("daliuren.questionRequired"));
      return;
    }
    if (person.date == null) {
      setError(t("daliuren.birthDateNotSet"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date();
      const dateStr = formatDate(now);
      const timeStr = formatDateTime(now.getTime(), true).split(" ")[1];

      // 解析出生年份（防御性处理：格式异常时降级为 2000）
      const parsedYear = parseInt(person.date.split("-")[0], 10);
      const birthYear = Number.isFinite(parsedYear) ? parsedYear : 2000;
      const gender = (person.gender as "男" | "女") ?? "男";

      const result = calculateDaLiuRen(dateStr, timeStr, { birthYear, gender });

      const record: LiurenRecord = {
        personId: person.id!,
        calculationTime: `${dateStr} ${timeStr}`,
        question: values.question.trim(),
        note: values.note.trim(),
        background: values.background.trim(),
        tags: values.tags,
        result,
        savedAt: Date.now(),
      };

      await saveLiurenRecord(record);
      resetForm();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("daliuren.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("daliuren.create")}
      width={520}
      footer={
        <>
          <button className="btn-cancel" onClick={handleClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("daliuren.creating") : t("daliuren.createAndSave")}
          </button>
        </>
      }
    >
      <div className="liuren-dialog-form">
        {error && (
          <div className="liuren-form-error" role="alert">
            {error}
          </div>
        )}
        <LiurenFormFields values={values} onChange={updateValues} disabled={saving} />
      </div>
    </Dialog>
  );
}
