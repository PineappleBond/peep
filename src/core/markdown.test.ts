/** Markdown 渲染器测试：各语法（标题/段落/粗体/斜体/代码/列表/引用/链接/分隔线） */
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown HTML 转义", () => {
  it("转义尖括号和 &，防止 XSS", () => {
    const html = renderMarkdown("Hello <script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("转义代码块内的 HTML 特殊字符", () => {
    const html = renderMarkdown("```\n<div>test</div>\n```");
    expect(html).toContain("&lt;div&gt;");
  });
});

describe("renderMarkdown 标题", () => {
  it("H1 ~ H6 正确渲染", () => {
    expect(renderMarkdown("# 标题1")).toBe("<h1>标题1</h1>");
    expect(renderMarkdown("## 标题2")).toBe("<h2>标题2</h2>");
    expect(renderMarkdown("### 标题3")).toBe("<h3>标题3</h3>");
    expect(renderMarkdown("#### 标题4")).toBe("<h4>标题4</h4>");
    expect(renderMarkdown("##### 标题5")).toBe("<h5>标题5</h5>");
    expect(renderMarkdown("###### 标题6")).toBe("<h6>标题6</h6>");
  });
});

describe("renderMarkdown 段落与行内格式", () => {
  it("普通段落包裹 <p>", () => {
    expect(renderMarkdown("hello world")).toBe("<p>hello world</p>");
  });

  it("多行段落用 <br /> 连接", () => {
    const html = renderMarkdown("line1\nline2");
    expect(html).toBe("<p>line1<br />line2</p>");
  });

  it("空行分段", () => {
    const html = renderMarkdown("para1\n\npara2");
    expect(html).toContain("<p>para1</p>");
    expect(html).toContain("<p>para2</p>");
  });

  it("**粗体** → <strong>", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("*斜体* → <em>", () => {
    expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
  });

  it("`行内代码` → <code>", () => {
    expect(renderMarkdown("use `code` here")).toContain("<code>code</code>");
  });

  it("[链接](url) → <a target=_blank>", () => {
    const html = renderMarkdown("[click](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">click</a>");
  });
});

describe("renderMarkdown 代码块", () => {
  it("``` 代码块 → <pre><code>", () => {
    const html = renderMarkdown("```js\nconst x = 1;\nconsole.log(x);\n```");
    expect(html).toContain("<pre><code>");
    expect(html).toContain("</code></pre>");
    expect(html).toContain("const x = 1;");
  });
});

describe("renderMarkdown 引用", () => {
  it("> 引用 → <blockquote>", () => {
    const html = renderMarkdown("> quote line1\n> quote line2");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quote line1");
    expect(html).toContain("<br />");
  });
});

describe("renderMarkdown 列表", () => {
  it("- 无序列表 → <ul><li>", () => {
    const html = renderMarkdown("- item1\n- item2\n- item3");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item1</li>");
    expect(html).toContain("<li>item2</li>");
    expect(html).toContain("<li>item3</li>");
    expect(html).toContain("</ul>");
  });

  it("1. 有序列表 → <ol><li>", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
    expect(html).toContain("</ol>");
  });
});

describe("renderMarkdown 分隔线", () => {
  it("--- → <hr />", () => {
    expect(renderMarkdown("---")).toBe("<hr />");
    expect(renderMarkdown("----")).toBe("<hr />");
  });
});

describe("renderMarkdown 综合文档", () => {
  it("多语法混合文档正确渲染", () => {
    const md = `# 标题

段落 **粗体** 与 *斜体*。

- 列表1
- 列表2

> 引用

---

\`\`\`
代码
\`\`\``;
    const html = renderMarkdown(md);
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain("<em>斜体</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<pre><code>");
  });
});
