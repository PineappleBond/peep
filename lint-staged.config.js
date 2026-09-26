/**
 * lint-staged 配置——仅处理 git add 进来的文件，避免全量跑工具。
 * 顺序：Prettier 格式化 → ESLint 自动修复。
 */
export default {
  // 源文件：Prettier 格式化 + ESLint 自动修复
  "src/**/*.{ts,tsx,css}": ["prettier --write", "eslint --fix"],
  // Markdown / JSON：仅 Prettier 格式化
  "**/*.{md,json}": ["prettier --write"],
};
