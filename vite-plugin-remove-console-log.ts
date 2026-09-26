import type { Plugin } from "vite";

/**
 * 轻量插件：生产构建时移除源码中的 console.log / console.debug / console.info 调用。
 * 保留 console.error / console.warn，因为这些通常用于生产环境错误捕获与排障。
 *
 * 为什么不用 vite-plugin-remove-console？
 * - 它依赖 gogocode（数百 KB 的 AST 库），对"仅移除 log/debug"场景过重。
 * - 本插件用平衡括号替换，零依赖、毫秒级完成，对本项目代码风格已足够。
 *
 * 注意：
 * - 仅作用于项目源码（src/），跳过 node_modules 与测试文件。
 * - 使用括号平衡算法匹配完整调用表达式（支持字符串、模板字符串、转义）。
 * - 不匹配 console.error / console.warn（保留用于生产错误报告）。
 */
export function removeConsoleCalls(): Plugin {
  let isBuild = false;
  return {
    name: "peep:remove-console-log",
    enforce: "post", // 在所有其他 transform 之后再处理，确保已是最终代码
    configResolved(config) {
      isBuild = config.command === "build";
    },
    transform(code, id) {
      // 仅在生产构建处理源码
      if (!isBuild) return;
      if (id.includes("node_modules")) return;
      if (!/\.(ts|tsx|js|jsx)$/.test(id)) return;
      if (/\.test\.(ts|tsx|js|jsx)$/.test(id)) return;

      // 快速路径：没有 console.(log|debug|info) 调用就跳过
      const pattern = /\bconsole\s*\.\s*(log|debug|info)\s*\(/g;
      if (!pattern.test(code)) return;
      pattern.lastIndex = 0;

      let result = "";
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        const start = match.index;
        // 找到匹配开始的 '(' 位置
        const parenStart = code.indexOf("(", start);
        if (parenStart === -1) continue;

        // 平衡括号，找到调用结束的 ')' 位置（正确处理字符串与转义）
        let depth = 0;
        let end = parenStart;
        let inString: string | null = null;
        let escape = false;
        for (let i = parenStart; i < code.length; i++) {
          const ch = code[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\") {
            escape = true;
            continue;
          }
          if (inString) {
            if (ch === inString) inString = null;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === "`") {
            inString = ch;
            continue;
          }
          if (ch === "(") depth++;
          else if (ch === ")") {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
        if (depth !== 0) continue; // 括号不平衡，跳过（保守策略）
        // 移除整段调用表达式
        result += code.slice(lastIndex, start);
        lastIndex = end;
      }
      result += code.slice(lastIndex);

      return { code: result, map: null };
    },
  };
}
