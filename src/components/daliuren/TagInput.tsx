/**
 * 标签输入组件
 * - 输入标签（回车或逗号分隔）
 * - 删除标签（点击 X）
 * - 显示已添加标签
 * - 可选建议列表（suggestions），输入时自动过滤匹配项并展示下拉
 */
import { useState, useRef, type KeyboardEvent } from "react";
import { useI18n } from "../../core/i18n";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** 是否禁用（保存中等场景） */
  disabled?: boolean;
  /** 可选的已有标签列表，输入时展示过滤后的建议 */
  suggestions?: string[];
  /** 单个标签最大字符数（默认 30） */
  maxTagLength?: number;
  /** 标签最大数量（默认 20） */
  maxTags?: number;
}

/** 单个标签最大长度 */
const DEFAULT_MAX_TAG_LENGTH = 30;
/** 标签最大数量 */
const DEFAULT_MAX_TAGS = 20;

export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  suggestions,
  maxTagLength = DEFAULT_MAX_TAG_LENGTH,
  maxTags = DEFAULT_MAX_TAGS,
}: TagInputProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("tagInput.placeholder");
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTags = (raw: string) => {
    const newTags = raw
      .split(/[,，]/)
      .map(s => s.trim())
      // 过滤空标签、超长标签、重复标签
      .filter(s => s && s.length <= maxTagLength && !value.includes(s));
    // 限制标签总数
    const remaining = maxTags - value.length;
    const toAdd = newTags.slice(0, remaining);
    if (toAdd.length > 0) {
      onChange([...value, ...toAdd]);
    }
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.trim()) {
        addTags(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      // 空输入框时按退格删除最后一个标签
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    // 延迟隐藏建议，让点击建议项的事件先触发
    setTimeout(() => setShowSuggestions(false), 200);
    if (input.trim()) {
      addTags(input);
    }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (suggestions && val.trim()) {
      const filtered = suggestions.filter(
        s => s.toLowerCase().includes(val.toLowerCase()) && !value.includes(s),
      );
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleRemove = (tag: string) => {
    onChange(value.filter(s => s !== tag));
  };

  // 计算建议列表
  const filteredSuggestions = suggestions
    ? suggestions
        .filter(s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s))
        .slice(0, 10)
    : [];

  return (
    <div className="tag-input">
      <div className="tag-input-tags" role="group" aria-label={t("tagInput.tagList")}>
        {value.map(tag => (
          <span key={tag} className="tag-input-tag">
            <span className="tag-input-tag-text">{tag}</span>
            <button
              type="button"
              className="tag-input-tag-remove"
              onClick={() => handleRemove(tag)}
              aria-label={t("tagInput.deleteTag", { tag })}
              disabled={disabled}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input-field"
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? resolvedPlaceholder : ""}
          aria-label={t("tagInput.addTag")}
          disabled={disabled || value.length >= maxTags}
          maxLength={maxTagLength}
        />
      </div>
      {/* 标签建议下拉 */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="tag-input-suggestions"
          role="listbox"
          aria-label={t("tagInput.suggestions")}
        >
          {filteredSuggestions.map(s => (
            <div
              key={s}
              className="tag-input-suggestion-item"
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => addTags(s)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  addTags(s);
                }
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
