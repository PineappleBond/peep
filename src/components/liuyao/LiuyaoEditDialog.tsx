/**
 * 六爻编辑 Dialog - 编辑占事、背景、备注、标签（不可编辑卦象数据）
 */
import { useState, useEffect } from "react";
import { Dialog } from "../Dialog";
import { LiuyaoFormFields, type LiuyaoFormValues } from "./LiuyaoFormFields";
import { saveLiuyaoRecord } from "../../core/liuyaoDb";
import type { LiuyaoRecord } from "../../core/personDb";
import { useI18n } from "../../core/i18n";
import { toast } from "../../core/toast";
import {
  useFormValidation,
  requiredRule,
  type ValidationRules,
} from "../../core/useFormValidation";

const LIUYAO_VALIDATION_RULES: ValidationRules<LiuyaoFormValues> = {
  question: [requiredRule("validation.questionRequired")],
};

interface LiuyaoEditDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiuyaoRecord | null;
  onSaved: () => void;
}

export function LiuyaoEditDialog({ open, onClose, record, onSaved }: LiuyaoEditDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<LiuyaoFormValues>({
    question: "",
    note: "",
    background: "",
    tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validation = useFormValidation<LiuyaoFormValues>(LIUYAO_VALIDATION_RULES);

  const updateValues = (patch: Partial<LiuyaoFormValues>) => {
    setValues(prev => {
      const next = { ...prev, ...patch };
      for (const key of Object.keys(patch) as (keyof LiuyaoFormValues)[]) {
        if (validation.touched[key]) {
          requestAnimationFrame(() => validation.validateField(key, next));
        }
      }
      return next;
    });
  };

  const handleBlur = (field: keyof LiuyaoFormValues) => {
    validation.touchField(field);
    validation.validateField(field, values);
  };

  // 加载记录数据
  useEffect(() => {
    if (open && record) {
      setValues({
        question: record.question,
        note: record.note,
        background: record.background,
        tags: record.tags,
      });
    }
  }, [open, record]);

  const resetForm = () => {
    setValues({ question: "", note: "", background: "", tags: [] });
    setServerError(null);
    validation.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!record) return;
    setServerError(null);

    if (!validation.validateAll(values)) {
      return;
    }

    setSaving(true);

    try {
      const updated: LiuyaoRecord = {
        ...record,
        question: values.question.trim(),
        note: values.note.trim(),
        background: values.background.trim(),
        tags: values.tags,
      };

      await saveLiuyaoRecord(updated);
      toast.success(t("liuyao.updateSuccess") || "记录已更新");
      onSaved();
      handleClose();
    } catch (err) {
      console.error("[LiuyaoEditDialog] 更新失败", err);
      setServerError(err instanceof Error ? err.message : t("liuyao.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("liuyao.edit") || "编辑起卦记录"}
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      {serverError && <div className="form-error-banner">{serverError}</div>}
      <LiuyaoFormFields
        values={values}
        onChange={updateValues}
        disabled={saving}
        errors={validation.errors}
        shouldShowError={validation.shouldShowError}
        onBlur={handleBlur}
      />
    </Dialog>
  );
}
