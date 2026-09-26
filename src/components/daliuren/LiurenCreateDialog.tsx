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
  /* eslint-disable react-hooks/exhaustive-deps -- handleSubmit 依赖 values/error 等表单状态，
     加入 deps 会在每次输入时触发 effect；当前通过 submitTrigger 变化驱动，刻意不依赖 handleSubmit */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  const resetForm = () => {
    setValues(EMPTY_LIUREN_FORM);
    setServerError(null);
    validation.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setServerError(null);

    // 使用统一验证
    if (!validation.validateAll(values)) {
      return;
    }

    if (person.date == null) {
      setServerError(t("daliuren.birthDateNotSet"));
      return;
    }

    setSaving(true);

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
      toast.success(t("common.saveSuccess"));
    } catch (e) {
      setServerError(e instanceof Error ? e.message : t("daliuren.createFailed"));
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
        {/* 服务端/业务逻辑错误仍用顶部 alert 显示 */}
        {serverError && (
          <div className="liuren-form-error" role="alert">
            {serverError}
          </div>
        )}
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
