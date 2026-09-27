/**
 * 六爻起卦表单公共字段（question / note / background / tags）
 * 供 LiuyaoCreateDialog 和 LiuyaoEditDialog 共用
 */
import { TagInput } from "../daliuren/TagInput";
import { useI18n } from "../../core/i18n";
import { FieldError } from "../FieldError";

export interface LiuyaoFormValues {
  question: string;
  note: string;
  background: string;
  tags: string[];
}

/** 表单初始空值 */
export const EMPTY_LIUYAO_FORM: LiuyaoFormValues = {
  question: "",
  note: "",
  background: "",
  tags: [],
};

interface LiuyaoFormFieldsProps {
  values: LiuyaoFormValues;
  onChange: (patch: Partial<LiuyaoFormValues>) => void;
  /** 是否禁用（保存中） */
  disabled?: boolean;
  /** 字段错误映射（翻译键） */
  errors?: Partial<Record<keyof LiuyaoFormValues, string>>;
  /** 判断是否应显示错误 */
  shouldShowError?: (field: keyof LiuyaoFormValues) => boolean;
  /** 字段失焦回调 */
  onBlur?: (field: keyof LiuyaoFormValues) => void;
}

export function LiuyaoFormFields({
  values,
  onChange,
  disabled,
  errors,
  shouldShowError,
  onBlur,
}: LiuyaoFormFieldsProps) {
  const { t } = useI18n();

  /** 判断字段是否有错误 */
  const hasError = (field: keyof LiuyaoFormValues) =>
    shouldShowError ? shouldShowError(field) : false;

  /** 获取错误文本 */
  const errorMsg = (field: keyof LiuyaoFormValues) => (errors?.[field] ? t(errors[field]) : null);

  return (
    <>
      <div className={`liuyao-form-field${hasError("question") ? " field-has-error" : ""}`}>
        <label htmlFor="liuyao-question">
          {t("liuyao.question") || "占事问题"}{" "}
          <span className="required">{t("common.required")}</span>
        </label>
        <input
          id="liuyao-question"
          type="text"
          value={values.question}
          onChange={e => onChange({ question: e.target.value })}
          onBlur={() => onBlur?.("question")}
          placeholder={t("liuyao.questionPlaceholder") || "请输入所占问题..."}
          maxLength={200}
          autoFocus
          disabled={disabled}
        />
        <FieldError shouldShow={hasError("question")} message={errorMsg("question")} />
      </div>
      <div className="liuyao-form-field">
        <label htmlFor="liuyao-note">{t("liuyao.note") || "备注"}</label>
        <input
          id="liuyao-note"
          type="text"
          value={values.note}
          onChange={e => onChange({ note: e.target.value })}
          onBlur={() => onBlur?.("note")}
          placeholder={t("liuyao.optional") || "选填"}
          maxLength={500}
          disabled={disabled}
        />
      </div>
      <div className="liuyao-form-field">
        <label htmlFor="liuyao-background">{t("liuyao.background") || "背景信息"}</label>
        <textarea
          id="liuyao-background"
          value={values.background}
          onChange={e => onChange({ background: e.target.value })}
          onBlur={() => onBlur?.("background")}
          placeholder={t("liuyao.backgroundPlaceholder") || "可选：提供背景信息..."}
          rows={3}
          maxLength={2000}
          disabled={disabled}
        />
      </div>
      <div className="liuyao-form-field">
        <label>{t("liuyao.tags") || "标签"}</label>
        <TagInput
          value={values.tags}
          onChange={tags => onChange({ tags })}
          placeholder={t("liuyao.tagsPlaceholder") || "输入后按回车添加标签"}
          disabled={disabled}
        />
      </div>
    </>
  );
}
