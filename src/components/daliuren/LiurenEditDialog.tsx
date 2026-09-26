/**
 * 编辑 Dialog
 * - 预填充现有数据，仅可修改：question、note、background、tags
 * - 不可修改起课时间与卦象数据
 */
import { useState, useEffect } from "react";
import { Dialog } from "../Dialog";
import { LiurenFormFields, EMPTY_LIUREN_FORM, type LiurenFormValues } from "./LiurenFormFields";
import { saveLiurenRecord } from "../../core/daliurenDb";
import type { LiurenRecord } from "../../core/personDb";
import { useI18n } from "../../core/i18n";

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
  const { t } = useI18n();
  const [values, setValues] = useState<LiurenFormValues>(EMPTY_LIUREN_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateValues = (patch: Partial<LiurenFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  // 打开时填充现有数据
  useEffect(() => {
    if (record && open) {
      setValues({
        question: record.question,
        note: record.note,
        background: record.background,
        tags: [...record.tags],
      });
      setError(null);
    }
  }, [record, open]);

  const handleSubmit = async () => {
    if (!record) {
      setError(t("daliuren.notFound"));
      return;
    }
    if (!values.question.trim()) {
      setError(t("daliuren.questionRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated: LiurenRecord = {
        ...record,
        question: values.question.trim(),
        note: values.note.trim(),
        background: values.background.trim(),
        tags: values.tags,
      };
      await saveLiurenRecord(updated);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("daliuren.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("daliuren.editTitle")}
      width={520}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <div className="liuren-dialog-form">
        {error && <div className="liuren-form-error" role="alert">{error}</div>}

        {/* 只读信息 */}
        <div className="liuren-form-field readonly">
          <label>{t("daliuren.courseTime")}</label>
          <div className="liuren-form-static">{record?.calculationTime}</div>
        </div>

        <LiurenFormFields values={values} onChange={updateValues} disabled={saving} />
      </div>
    </Dialog>
  );
}
