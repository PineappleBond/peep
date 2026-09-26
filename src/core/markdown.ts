/**
 * 简易 Markdown 渲染器
 *
 * 支持的语法：H1-H6、段落、粗体、斜体、行内代码、代码块、引用、
 * 无序列表、有序列表、链接、分隔线。
 *
 * 注意：对输入文本先做 HTML 转义，防止 XSS。
 */

/** 转义 HTML 特殊字符，防止 XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 校验链接 URL 是否安全。
 * 仅允许 http/https/mailto 协议，拒绝 javascript: / data: / vbscript: 等危险协议。
 * 防止通过 Markdown 链接语法注入可执行脚本（XSS）。
 */
function isSafeUrl(url: string): boolean {
  // 去除转义后的空白字符（攻击者可能插入编码后的空白绕过检测）
  const cleaned = url.replace(/%20|\s/g, "").toLowerCase();
  // 仅允许 http:// https:// mailto: 开头，或相对路径（以 / 或 # 或字母数字开头）
  if (/^(https?:\/\/|mailto:|\/|#|[a-z0-9])/.test(cleaned)) {
    // 显式拒绝 javascript: / data: / vbscript: 等危险协议
    if (/^(javascript|data|vbscript):/i.test(cleaned)) {
      return false;
    }
    return true;
  }
  return false;
}

/** 处理行内格式：粗体、斜体、行内代码、链接 */
function renderInline(text: string): string {
  // 行内代码（先处理，避免内部被其他规则匹配）
  text = text.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  // 粗体 **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 斜体 *text*（排除已处理的粗体）
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  // 链接 [text](url)——仅允许安全协议（http/https/mailto/相对路径），拒绝 javascript: 等
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, linkText, rawUrl) => {
      // rawUrl 已被 escapeHtml 转义，需还原后再校验协议
      const decodedUrl = rawUrl
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      if (!isSafeUrl(decodedUrl)) {
        // 不安全 URL：仅渲染文本，不生成链接
        return linkText;
      }
      return `<a href="${rawUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    }
  );
  return text;
}

/**
 * 将 Markdown 文本渲染为 HTML 字符串
 * @param md Markdown 源文本
 * @returns HTML 字符串
 */
export function renderMarkdown(md: string): string {
  // 先整体转义 HTML
  const escaped = escapeHtml(md);
  const lines = escaped.split("\n");
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```（需匹配转义后的字符）
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束的 ```
      htmlParts.push(
        `<pre><code>${codeLines.join("\n")}</code></pre>`
      );
      continue;
    }

    // 分隔线 ---（转义后仍是 ---）
    if (/^---+$/.test(line)) {
      htmlParts.push("<hr />");
      i++;
      continue;
    }

    // 标题 # ~ ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      htmlParts.push(`<h${level}>${content}</h${level}>`);
      i++;
      continue;
    }

    // 引用 >
    if (line.startsWith("&gt; ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("&gt; ")) {
        quoteLines.push(lines[i].slice(5)); // 去掉 &gt; 前缀（5个字符）
        i++;
      }
      htmlParts.push(
        `<blockquote>${quoteLines.map(renderInline).join("<br />")}</blockquote>`
      );
      continue;
    }

    // 无序列表 -
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(renderInline(lines[i].slice(2)));
        i++;
      }
      htmlParts.push(
        `<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`
      );
      continue;
    }

    // 有序列表 1.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\d+\.\s+/, "");
        items.push(renderInline(content));
        i++;
      }
      htmlParts.push(
        `<ol>${items.map((t) => `<li>${t}</li>`).join("")}</ol>`
      );
      continue;
    }

    // 空行：跳过（用作段落分隔）
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 普通段落：收集连续非空行
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("&gt; ") &&
      !/^-\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      htmlParts.push(`<p>${renderInline(paraLines.join("<br />"))}</p>`);
    }
  }

  return htmlParts.join("\n");
}
