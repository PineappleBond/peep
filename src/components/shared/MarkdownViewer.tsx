import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  value: string;
  className?: string;
}

// Stable reference — never re-created
const remarkPlugins = [remarkGfm];

/**
 * 共享 Markdown 渲染组件
 * 基于 react-markdown + remark-gfm，提供一致的排版效果
 */
const MarkdownViewer = memo(function MarkdownViewer({ value, className = "" }: MarkdownViewerProps) {
  const content = useMemo(() => value.trim(), [value]);

  if (!content) {
    return null;
  }

  return (
    <div className={`md-prose ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins}>{content}</ReactMarkdown>
    </div>
  );
});

export default MarkdownViewer;
