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
import { toast } from "../../core/toast";
import {
  useFormValidation,
  requiredRule,
  type ValidationRules,
} from "../../core/useFormValidation";

/** 大六壬表单验证规则 */
const LIUREN_VALIDATION_RULES: ValidationRules<LiurenFormValues> = {
  question: [requiredRule("validation.questionRequired")],
};

interface LiurenEditDialogProps {
  open: boolean;
  onClose: () => void;
  record: LiurenRecord | null;
  onSaved: () => void;
}

export function LiurenEditDialog({ open, onClose, record, onSaved }: LiurenEditDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<LiurenFormValues>(EMPTY_LIUREN_FORM);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 统一表单验证
  const validation = useFormValidation<LiurenFormValues>(LIUREN_VALIDATION_RULES);

  const updateValues = (patch: Partial<LiurenFormValues>) => {
    setValues(prev => {
      const next = { ...prev, ...patch };
      // 如果字段已触碰过，实时验证
      for (const key of Object.keys(patch) as (keyof LiurenFormValues)[]) {
        if (validation.touched[key]) {
          requestAnimationFrame(() => validation.validateField(key, next));
        }
      }
      return next;
    });
  };

  /** 字段失焦时触发验证 */
  const handleBlur = (field: keyof LiurenFormValues) => {
    validation.touchField(field);
    validation.validateField(field, values);
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
      setServerError(null);
      validation.reset();
    }
  }, [record, open]);

  const handleSubmit = async () => {
    setServerError(null);

    if (!record) {
      setServerError(t("daliuren.notFound"));
      return;
    }

    // 使用统一验证
    if (!validation.validateAll(values)) {
      return;
    }

    setSaving(true);

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
      toast.success(t("common.saveSuccess"));
    } catch (e) {
      setServerError(e instanceof Error ? e.message : t("daliuren.saveFailed"));
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
        {/* 服务端/业务逻辑错误仍用顶部 alert 显示 */}
        {serverError && (
          <div className="liuren-form-error" role="alert">
            {serverError}
          </div>
        )}

        {/* 只读信息 */}
        <div className="liuren-form-field readonly">
          <label>{t("daliuren.courseTime")}</label>
          <div className="liuren-form-static">{record?.calculationTime}</div>
        </div>

        <LiurenFormFields
          values={values}
          onChange={updateValues}
          disabled={saving}
          errors={validation.errors}
          shouldShowError={validation.shouldShowError}
          onBlur={handleBlur}
        />
      </div>
    </Dialog>
  );
}
