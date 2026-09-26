/**
 * 大六壬起课表单公共字段（question / note / background / tags）
 * 供 LiurenCreateDialog 和 LiurenEditDialog 共用，消除重复 JSX。
 *
 * 只渲染字段本身；错误提示、readonly 信息、Dialog 外壳由各调用方自行添加。
 */
import { TagInput } from "./TagInput";
import { useI18n } from "../../core/i18n";
import { FieldError } from "../FieldError";

export interface LiurenFormValues {
  question: string;
  note: string;
  background: string;
  tags: string[];
}

/** 表单初始空值（CreateDialog 重置 / EditDialog 初始共用） */
export const EMPTY_LIUREN_FORM: LiurenFormValues = {
  question: "",
  note: "",
  background: "",
  tags: [],
};

interface LiurenFormFieldsProps {
  values: LiurenFormValues;
  onChange: (patch: Partial<LiurenFormValues>) => void;
  /** 是否禁用（保存中） */
  disabled?: boolean;
  /** 字段错误映射（翻译键） */
  errors?: Partial<Record<keyof LiurenFormValues, string>>;
  /** 判断是否应显示错误 */
  shouldShowError?: (field: keyof LiurenFormValues) => boolean;
  /** 字段失焦回调 */
  onBlur?: (field: keyof LiurenFormValues) => void;
}

export function LiurenFormFields({
  values,
  onChange,
  disabled,
  errors,
  shouldShowError,
  onBlur,
}: LiurenFormFieldsProps) {
  const { t } = useI18n();

  /** 判断字段是否有错误（兼容不传 errors 的场景） */
  const hasError = (field: keyof LiurenFormValues) =>
    shouldShowError ? shouldShowError(field) : false;

  /** 获取错误文本（翻译键 -> 翻译文本） */
  const errorMsg = (field: keyof LiurenFormValues) => (errors?.[field] ? t(errors[field]) : null);

  return (
    <>
      <div className={`liuren-form-field${hasError("question") ? " field-has-error" : ""}`}>
        <label htmlFor="liuren-question">
          {t("daliuren.question")} <span className="required">{t("common.required")}</span>
        </label>
        <input
          id="liuren-question"
          type="text"
          value={values.question}
          onChange={e => onChange({ question: e.target.value })}
          onBlur={() => onBlur?.("question")}
          placeholder={t("daliuren.questionPlaceholder")}
          maxLength={200}
          autoFocus
          disabled={disabled}
        />
        <FieldError shouldShow={hasError("question")} message={errorMsg("question")} />
      </div>
      <div className="liuren-form-field">
        <label htmlFor="liuren-note">{t("daliuren.note")}</label>
        <input
          id="liuren-note"
          type="text"
          value={values.note}
          onChange={e => onChange({ note: e.target.value })}
          onBlur={() => onBlur?.("note")}
          placeholder={t("daliuren.optional")}
          maxLength={500}
          disabled={disabled}
        />
      </div>
      <div className="liuren-form-field">
        <label htmlFor="liuren-background">{t("daliuren.background")}</label>
        <textarea
          id="liuren-background"
          value={values.background}
          onChange={e => onChange({ background: e.target.value })}
          onBlur={() => onBlur?.("background")}
          placeholder={t("daliuren.backgroundPlaceholder")}
          rows={3}
          maxLength={2000}
          disabled={disabled}
        />
      </div>
      <div className="liuren-form-field">
        <label>{t("daliuren.tags")}</label>
        <TagInput
          value={values.tags}
          onChange={tags => onChange({ tags })}
          placeholder={t("daliuren.tagsPlaceholder")}
          disabled={disabled}
        />
      </div>
    </>
  );
}
