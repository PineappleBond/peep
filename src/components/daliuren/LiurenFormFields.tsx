/**
 * 大六壬起课表单公共字段（question / note / background / tags）
 * 供 LiurenCreateDialog 和 LiurenEditDialog 共用，消除重复 JSX。
 *
 * 只渲染字段本身；错误提示、readonly 信息、Dialog 外壳由各调用方自行添加。
 */
import { TagInput } from "./TagInput";
import { useI18n } from "../../core/i18n";

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
}

export function LiurenFormFields({ values, onChange, disabled }: LiurenFormFieldsProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="liuren-form-field">
        <label>
          {t("daliuren.question")} <span className="required">{t("common.required")}</span>
        </label>
        <input
          type="text"
          value={values.question}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder={t("daliuren.questionPlaceholder")}
          maxLength={200}
          autoFocus
          disabled={disabled}
        />
      </div>
      <div className="liuren-form-field">
        <label>{t("daliuren.note")}</label>
        <input
          type="text"
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder={t("daliuren.optional")}
          maxLength={500}
          disabled={disabled}
        />
      </div>
      <div className="liuren-form-field">
        <label>{t("daliuren.background")}</label>
        <textarea
          value={values.background}
          onChange={(e) => onChange({ background: e.target.value })}
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
          onChange={(tags) => onChange({ tags })}
          placeholder={t("daliuren.tagsPlaceholder")}
          disabled={disabled}
        />
      </div>
    </>
  );
}
