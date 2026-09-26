// @ts-check
/**
 * ESLint flat config（ESLint 9+）
 * 与项目既有风格对齐：中文代码注释、React 18 + TypeScript 严格模式。
 * 规则以"渐进严格"为原则——先抓真错误，再逐步收紧风格。
 */
import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // 全局忽略——构建产物 / 依赖 / 测试产物 / 文档目录 / 配置文件自身
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**", "docs/kb/**", "eslint.config.js", "prettier.config.js"] },

  // 推荐规则基线（ESLint 内建 + TS 推荐）
  js.configs.recommended,
  ...ts.configs.recommended,

  // React 相关规则
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React 相关
      "react/react-in-jsx-scope": "off", // React 17+ JSX 转换不需要引入 React
      "react/prop-types": "off", // TypeScript 已负责类型检查
      "react/display-name": "off", // 函数组件无需显式 displayName
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn", // warn 级：提示依赖缺失但不阻塞构建

      // TypeScript 相关
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      // @ts-ignore 在测试/第三方兼容场景仍有必要，warn 级即可
      "@typescript-eslint/ban-ts-comment": "warn",

      // 代码健壮性
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },

  // 测试文件放宽 no-console / no-explicit-any——测试需要灵活的断言与日志
  {
    files: ["**/*.test.{ts,tsx}", "**/testFixtures.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
