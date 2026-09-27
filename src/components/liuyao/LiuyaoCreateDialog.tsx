/**
 * 新建起卦 Dialog
 * - 表单：占事问题（必填）、备注、背景信息、tags、六爻值输入
 * - 提交：调用 buildChart + locateYong，保存记录
 */
import { useState, useEffect, useRef } from "react";
import { Dialog } from "../Dialog";
import { LiuyaoFormFields, EMPTY_LIUYAO_FORM, type LiuyaoFormValues } from "./LiuyaoFormFields";
import { buildChart, locateYong } from "../../core/liuyao/core/chart";
import type { SixLines, YongTarget, LineValue } from "../../core/liuyao/core/types";
import { formatDate, formatDateTime } from "../../core/utils";
import { saveLiuyaoRecord } from "../../core/liuyaoDb";
import type { LiuyaoRecord, Person } from "../../core/personDb";
import { useI18n } from "../../core/i18n";
import { toast } from "../../core/toast";
import {
  useFormValidation,
  requiredRule,
  type ValidationRules,
} from "../../core/useFormValidation";

/** 六爻表单验证规则 */
const LIUYAO_VALIDATION_RULES: ValidationRules<LiuyaoFormValues> = {
  question: [requiredRule("validation.questionRequired")],
};

interface LiuyaoCreateDialogProps {
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
    lines?: SixLines;
    yongTarget?: YongTarget;
  };
  /** 调试 API：提交触发计数器 */
  submitTrigger?: number;
}

export function LiuyaoCreateDialog({
  open,
  onClose,
  person,
  onSaved,
  initialData,
  submitTrigger,
}: LiuyaoCreateDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<LiuyaoFormValues>(EMPTY_LIUYAO_FORM);
  const [lines, setLines] = useState<SixLines>([1, 1, 1, 1, 1, 1]); // 默认少阳
  const [yongTarget, setYongTarget] = useState<YongTarget>("自占");
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

  // 预填充表单
  useEffect(() => {
    if (open && initialData) {
      setValues({
        question: initialData.question,
        note: initialData.note,
        background: initialData.background,
        tags: initialData.tags,
      });
      if (initialData.lines) setLines(initialData.lines);
      if (initialData.yongTarget) setYongTarget(initialData.yongTarget);
    }
  }, [open, initialData]);

  // 调试 API：自动提交
  const prevSubmitTriggerRef = useRef<number | undefined>(undefined);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (
      submitTrigger !== undefined &&
      submitTrigger !== prevSubmitTriggerRef.current &&
      open &&
      !saving
    ) {
      prevSubmitTriggerRef.current = submitTrigger;
      setTimeout(() => {
        handleSubmit();
      }, 50);
    }
  }, [submitTrigger, open, saving]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const resetForm = () => {
    setValues(EMPTY_LIUYAO_FORM);
    setLines([1, 1, 1, 1, 1, 1]);
    setYongTarget("自占");
    setServerError(null);
    validation.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setServerError(null);

    if (!validation.validateAll(values)) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date();
      const dateStr = formatDate(now);
      const timeStr = formatDateTime(now.getTime(), true).split(" ")[1];
      const divinationTime = `${dateStr}T${timeStr}`;

      // 排盘
      const chart = buildChart({ lines, date: dateStr });
      const yong = locateYong(chart, yongTarget);

      const record: LiuyaoRecord = {
        personId: person.id!,
        divinationTime,
        question: values.question.trim(),
        background: values.background.trim(),
        note: values.note.trim(),
        tags: values.tags,
        lines,
        chart,
        yongTarget,
        yong,
        savedAt: Date.now(),
      };

      await saveLiuyaoRecord(record);
      toast.success(t("liuyao.saveSuccess") || "起卦记录已保存");
      onSaved();
      handleClose();
    } catch (err) {
      console.error("[LiuyaoCreateDialog] 排盘失败", err);
      setServerError(err instanceof Error ? err.message : "排盘失败，请检查输入");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("liuyao.create") || "新建起卦"}
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

      {/* 六爻值输入 */}
      <div className="liuyao-form-field">
        <label>{t("liuyao.linesInput") || "六爻值（0=老阴, 1=少阳, 2=少阴, 3=老阳）"}</label>
        <div className="liuyao-lines-input">
          {[5, 4, 3, 2, 1, 0].map(idx => (
            <div key={idx} className="liuyao-line-input-group">
              <label>第{idx + 1}爻</label>
              <select
                value={lines[idx]}
                onChange={e => {
                  const newLines = [...lines] as SixLines;
                  newLines[idx] = Number(e.target.value) as LineValue;
                  setLines(newLines);
                }}
                disabled={saving}
              >
                <option value={0}>0 (老阴)</option>
                <option value={1}>1 (少阳)</option>
                <option value={2}>2 (少阴)</option>
                <option value={3}>3 (老阳)</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 求测对象 */}
      <div className="liuyao-form-field">
        <label htmlFor="liuyao-yong-target">{t("liuyao.yongTarget") || "求测对象"}</label>
        <select
          id="liuyao-yong-target"
          value={yongTarget}
          onChange={e => setYongTarget(e.target.value as YongTarget)}
          disabled={saving}
        >
          <option value="自占">自占</option>
          <option value="父母">父母</option>
          <option value="子女">子女</option>
          <option value="配偶">配偶</option>
          <option value="兄弟">兄弟</option>
          <option value="医药">医药</option>
        </select>
      </div>
    </Dialog>
  );
}
