import { useCallback, useRef, useEffect } from "react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";

const plugins = [gfm()];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 增强 Markdown 编辑器
 * - 快捷键支持 (Ctrl+B/I/K/L/1/2/3)
 * - 图片粘贴支持
 * - 主题适配
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "开始书写...",
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 找到 ByteMD 内部的 textarea
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const ta = el.querySelector("textarea");
    if (ta) {
      textareaRef.current = ta;
    }
  }, []);

  // 快捷键处理
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const ta = textareaRef.current;
      if (!ta) return;

      const { selectionStart, selectionEnd } = ta;
      const selected = value.substring(selectionStart, selectionEnd);
      const before = value.substring(0, selectionStart);
      const after = value.substring(selectionEnd);

      let replacement = "";
      let cursorOffset = 0;
      let selectNew = false;

      switch (e.key.toLowerCase()) {
        case "b": // 加粗
          replacement = `**${selected || "粗体文本"}**`;
          cursorOffset = selected ? replacement.length : 2;
          selectNew = !selected;
          break;
        case "i": // 斜体
          replacement = `*${selected || "斜体文本"}*`;
          cursorOffset = selected ? replacement.length : 1;
          selectNew = !selected;
          break;
        case "k": // 链接
          if (selected) {
            replacement = `[${selected}](url)`;
            cursorOffset = replacement.length - 4;
          } else {
            replacement = "[链接文本](url)";
            cursorOffset = 1;
            selectNew = true;
          }
          break;
        case "l": {
          // 无序列表
          const prefix = "- ";
          if (selected) {
            replacement = selected
              .split("\n")
              .map((line) => `${prefix}${line}`)
              .join("\n");
          } else {
            replacement = "- ";
          }
          cursorOffset = replacement.length;
          break;
        }
        case "1":
        case "2":
        case "3": {
          let level = parseInt(e.key, 10);
          if (level < 1 || level > 3) return;
          const hashes = "#".repeat(level) + " ";
          if (selected) {
            replacement = `${hashes}${selected}`;
          } else {
            replacement = `${hashes}标题`;
            selectNew = true;
          }
          cursorOffset = replacement.length;
          break;
        }
        default:
          return;
      }

      e.preventDefault();
      const newValue = before + replacement + after;
      onChange(newValue);

      // 恢复光标位置
      requestAnimationFrame(() => {
        if (selectNew && !selected) {
          // 选中新插入的占位文本
          const start = selectionStart + cursorOffset;
          const end = selectionStart + replacement.length - cursorOffset;
          ta.setSelectionRange(start, end);
        } else {
          const newPos = selectionStart + cursorOffset;
          ta.setSelectionRange(newPos, newPos);
        }
        ta.focus();
      });
    },
    [value, onChange]
  );

  // 图片粘贴处理
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          // 将图片转为 base64 data URL
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const ta = textareaRef.current;
            const pos = ta ? ta.selectionStart : value.length;
            const beforeVal = value.substring(0, pos);
            const afterVal = value.substring(pos);
            const imgMarkdown = `\n![image](${dataUrl})\n`;
            onChange(beforeVal + imgMarkdown + afterVal);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [value, onChange]
  );

  // 绑定键盘和粘贴事件
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.addEventListener("keydown", handleKeyDown, true);
    el.addEventListener("paste", handlePaste, true);
    return () => {
      el.removeEventListener("keydown", handleKeyDown, true);
      el.removeEventListener("paste", handlePaste, true);
    };
  }, [handleKeyDown, handlePaste]);

  return (
    <div className="bytemd-wrapper" ref={editorRef}>
      <Editor
        value={value}
        plugins={plugins}
        onChange={onChange}
        placeholder={placeholder}
      />
      <style>{`
        .bytemd-wrapper .bytemd {
          height: calc(100vh - 280px);
          min-height: 400px;
          border-color: hsl(var(--border));
          border-radius: var(--radius);
        }
        .bytemd-wrapper .bytemd-body {
          font-family: inherit;
        }
        /* 工具栏 */
        .bytemd-wrapper .bytemd-toolbar {
          border-color: hsl(var(--border));
          background: hsl(var(--muted) / 0.3);
        }
        .bytemd-wrapper .bytemd-toolbar-icon {
          color: hsl(var(--muted-foreground));
        }
        .bytemd-wrapper .bytemd-toolbar-icon:hover {
          color: hsl(var(--foreground));
          background: hsl(var(--accent) / 0.1);
        }
        /* 编辑区域 */
        .bytemd-wrapper .bytemd-editor textarea {
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 13px;
          line-height: 1.6;
          background: hsl(var(--card));
          color: hsl(var(--foreground));
        }
        /* 预览区域 */
        .bytemd-wrapper .bytemd-preview {
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          padding: 16px 20px;
        }
        .bytemd-wrapper .bytemd-preview h1,
        .bytemd-wrapper .bytemd-preview h2,
        .bytemd-wrapper .bytemd-preview h3 {
          border-color: hsl(var(--border));
        }
        .bytemd-wrapper .bytemd-preview code {
          background: hsl(var(--muted));
          color: hsl(var(--foreground));
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.85em;
        }
        .bytemd-wrapper .bytemd-preview pre {
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          padding: 12px;
        }
        .bytemd-wrapper .bytemd-preview pre code {
          background: transparent;
          padding: 0;
        }
        .bytemd-wrapper .bytemd-preview blockquote {
          border-left-color: hsl(var(--primary));
          color: hsl(var(--muted-foreground));
          background: hsl(var(--muted) / 0.3);
          padding: 8px 16px;
          margin: 12px 0;
          border-radius: 0 6px 6px 0;
        }
        .bytemd-wrapper .bytemd-preview table {
          border-color: hsl(var(--border));
        }
        .bytemd-wrapper .bytemd-preview th,
        .bytemd-wrapper .bytemd-preview td {
          border-color: hsl(var(--border));
          padding: 6px 12px;
        }
        .bytemd-wrapper .bytemd-preview th {
          background: hsl(var(--muted) / 0.5);
        }
        .bytemd-wrapper .bytemd-preview a {
          color: hsl(var(--primary));
        }
        .bytemd-wrapper .bytemd-preview hr {
          border-color: hsl(var(--border));
        }
        .bytemd-wrapper .bytemd-preview img {
          max-width: 100%;
          border-radius: 6px;
        }
        /* 分屏分割线 */
        .bytemd-wrapper .bytemd-split {
          border-color: hsl(var(--border));
        }
        /* 状态栏 */
        .bytemd-wrapper .bytemd-status {
          color: hsl(var(--muted-foreground));
          font-size: 11px;
          border-color: hsl(var(--border));
        }
      `}</style>
    </div>
  );
}
