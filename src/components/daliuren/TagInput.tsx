/**
 * 标签输入组件
 * - 输入标签（回车或逗号分隔）
 * - 删除标签（点击 X）
 * - 显示已添加标签
 */
import { useState, type KeyboardEvent } from "react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder = "输入标签后按回车..." }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTags = (raw: string) => {
    const newTags = raw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (newTags.length > 0) {
      onChange([...value, ...newTags]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTags(input);
      setInput("");
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      // 空输入框时按退格删除最后一个标签
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input.trim()) {
      addTags(input);
      setInput("");
    }
  };

  const handleRemove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="tag-input">
      <div className="tag-input-tags">
        {value.map((tag) => (
          <span key={tag} className="tag-input-tag">
            <span className="tag-input-tag-text">{tag}</span>
            <button
              type="button"
              className="tag-input-tag-remove"
              onClick={() => handleRemove(tag)}
              aria-label={`删除 ${tag}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tag-input-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ""}
        />
      </div>
    </div>
  );
}
