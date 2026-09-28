/**
 * E2E 测试共享工具
 *
 * 提供 console 日志拦截等通用功能，确保测试过程中能捕获浏览器控制台输出，
 * 便于排查问题——错误日志会导致测试失败，警告日志会被记录但不阻断。
 */
import { type Page } from "@playwright/test";

/**
 * 拦截浏览器 console 日志。
 *
 * - error 级别：收集并可在测试中断言，用于发现运行时异常
 * - warning 级别：收集但不阻断测试
 * - 其他级别（log/info/debug）：静默忽略
 *
 * 使用方式：在测试开始时调用 `const logs = captureConsoleLogs(page);`，
 * 测试结束时通过 `logs.errors` / `logs.warnings` 检查是否有异常。
 *
 * @param page Playwright 页面对象
 * @returns 日志收集器，包含 errors 和 warnings 数组
 */
export function captureConsoleLogs(page: Page): {
  errors: string[];
  warnings: string[];
} {
  const logs = {
    errors: [] as string[],
    warnings: [] as string[],
  };

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      logs.errors.push(text);
    } else if (msg.type() === "warning") {
      logs.warnings.push(text);
    }
  });

  // 捕获页面未处理的异常（如未捕获的 Promise rejection）
  page.on("pageerror", (error) => {
    logs.errors.push(`[PageError] ${error.message}`);
  });

  return logs;
}

/**
 * 断言没有 error 级别的 console 日志。
 * 排除已知的可忽略错误（如第三方库的非致命警告）。
 *
 * @param logs captureConsoleLogs 返回的日志收集器
 * @param ignorePatterns 可选的忽略模式数组——匹配这些正则的 error 会被过滤掉
 */
export function assertNoConsoleErrors(logs: { errors: string[] }, ignorePatterns?: RegExp[]): void {
  const patterns = ignorePatterns ?? [
    // 忽略常见的第三方库非致命警告
    /Download the React DevTools/i,
    // 忽略开发环境特有的 warning
    /ReactDOM.render is no longer supported/i,
  ];

  const filtered = logs.errors.filter(
    (msg) => !patterns.some((p) => p.test(msg)),
  );

  if (filtered.length > 0) {
    throw new Error(
      `浏览器控制台出现 ${filtered.length} 个错误日志：\n${filtered.map((m) => `  - ${m}`).join("\n")}`,
    );
  }
}
