/**
 * 标签输入组件
 * - 输入标签（回车或逗号分隔）
 * - 删除标签（点击 X）
 * - 显示已添加标签
 * - 可选建议列表（suggestions），输入时自动过滤匹配项并展示下拉
 */
import { useState, useRef, type KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** 是否禁用（保存中等场景） */
  disabled?: boolean;
  /** 可选的已有标签列表，输入时展示过滤后的建议 */
  suggestions?: string[];
}

export function TagInput({ value, onChange, placeholder = "输入标签后按回车...", disabled, suggestions }: TagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTags = (raw: string) => {
    const newTags = raw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (newTags.length > 0) {
      onChange([...value, ...newTags]);
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
        (t) => t.toLowerCase().includes(val.toLowerCase()) && !value.includes(t)
      );
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleRemove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  // 计算建议列表
  const filteredSuggestions = suggestions
    ? suggestions
        .filter(
          (t) =>
            t.toLowerCase().includes(input.toLowerCase()) && !value.includes(t)
        )
        .slice(0, 10)
    : [];

  return (
    <div className="tag-input">
      <div className="tag-input-tags" role="group" aria-label="标签列表">
        {value.map((tag) => (
          <span key={tag} className="tag-input-tag">
            <span className="tag-input-tag-text">{tag}</span>
            <button
              type="button"
              className="tag-input-tag-remove"
              onClick={() => handleRemove(tag)}
              aria-label={`删除 ${tag}`}
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
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ""}
          aria-label="添加标签"
          disabled={disabled}
        />
      </div>
      {/* 标签建议下拉 */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="tag-input-suggestions">
          {filteredSuggestions.map((t) => (
            <div
              key={t}
              className="tag-input-suggestion-item"
              onClick={() => addTags(t)}
              role="option"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  addTags(t);
                }
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
