/**
 * Prettier 配置——与 ESLint 不冲突，仅负责"格式"（缩进/引号/换行）。
 * 代码质量问题（未使用变量/any 等）交给 ESLint。
 */
export default {
  // 行宽 100——比默认 80 更宽松，适合中文注释和长链式调用
  printWidth: 100,
  // 2 空格缩进（与项目现有风格一致）
  tabWidth: 2,
  // 使用空格而非 tab
  useTabs: false,
  // 语句末尾加分号——TS 生态主流，避免 ASI 陷阱
  semi: true,
  // 双引号——与项目现有风格一致
  singleQuote: false,
  // 尾随逗号（ES5 允许范围）——减少 git diff
  trailingComma: "es5",
  // 对象字面量括号空格：{ foo: bar }
  bracketSpacing: true,
  // JSX 括号不换行：<div foo="bar" />
  bracketSameLine: false,
  // 单参数箭头函数不加括号：x => x
  arrowParens: "avoid",
  // 换行符 LF（Unix 风格，与 git core.autocrlf 配合更佳）
  endOfLine: "lf",
  // Markdown 换行：保持源文件的换行（便于 diff）
  proseWrap: "preserve",
};
