#!/usr/bin/env node
/* eslint-disable no-console, no-undef, @typescript-eslint/no-unused-vars */
/**
 * 代码质量报告生成脚本
 * 收集代码行数、文件分布、依赖关系、复杂度统计等信息，
 * 生成 Markdown 格式的 HTML 质量仪表板。
 *
 * 用法：node scripts/quality-report.js [--json]
 *   --json  仅输出 JSON 到 stdout（便于管道处理）
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// ──────────────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────────────

/** 递归遍历目录，返回所有文件路径 */
function walkDir(dir, extensions = null) {
  const results = [];
  if (!existsSync(dir)) return results;

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      // 跳过隐藏目录、node_modules、dist 等
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "coverage"
      )
        continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(fullPath);
        if (!extensions || extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/** 统计文件行数（跳过空行和纯注释行） */
function countLines(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let total = lines.length;
    let code = 0;
    let comment = 0;
    let blank = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        blank++;
        continue;
      }
      if (inBlockComment) {
        comment++;
        if (trimmed.endsWith("*/")) inBlockComment = false;
        continue;
      }
      if (trimmed.startsWith("/*")) {
        comment++;
        if (!trimmed.endsWith("*/")) inBlockComment = true;
        continue;
      }
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        comment++;
        continue;
      }
      code++;
    }
    return { total, code, comment, blank };
  } catch {
    return { total: 0, code: 0, comment: 0, blank: 0 };
  }
}

/** 安全执行命令，失败返回空字符串 */
function safeExec(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

// ──────────────────────────────────────────────────────
// 代码统计
// ──────────────────────────────────────────────────────

function collectCodeStats() {
  const tsFiles = walkDir(SRC, [".ts", ".tsx"]);
  const cssFiles = walkDir(SRC, [".css"]);
  const testFiles = tsFiles.filter(f => f.includes(".test."));
  const srcFiles = tsFiles.filter(f => !f.includes(".test."));

  let totalLines = 0,
    totalCode = 0,
    totalComment = 0,
    totalBlank = 0;
  const byDirectory = {};
  const byExtension = {};

  for (const file of [...tsFiles, ...cssFiles]) {
    const ext = extname(file);
    const lines = countLines(file);
    totalLines += lines.total;
    totalCode += lines.code;
    totalComment += lines.comment;
    totalBlank += lines.blank;

    // 按目录统计
    const dir = relative(SRC, file).split("/").slice(0, -1).join("/") || "root";
    if (!byDirectory[dir]) byDirectory[dir] = { files: 0, code: 0, comment: 0 };
    byDirectory[dir].files++;
    byDirectory[dir].code += lines.code;
    byDirectory[dir].comment += lines.comment;

    // 按扩展名统计
    byExtension[ext] = (byExtension[ext] || 0) + lines.code;
  }

  return {
    summary: {
      totalFiles: tsFiles.length + cssFiles.length,
      srcFiles: srcFiles.length,
      testFiles: testFiles.length,
      totalLines,
      codeLines: totalCode,
      commentLines: totalComment,
      blankLines: totalBlank,
      commentRatio: totalCode > 0 ? ((totalComment / totalCode) * 100).toFixed(1) : "0",
    },
    byDirectory,
    byExtension,
  };
}

// ──────────────────────────────────────────────────────
// 测试覆盖率统计
// ──────────────────────────────────────────────────────

function collectCoverageStats() {
  // v8 覆盖率生成 coverage-final.json（非 coverage-summary.json）
  const covJsonPath = join(ROOT, "coverage/coverage-final.json");
  if (!existsSync(covJsonPath)) {
    return { available: false, message: "未找到覆盖率报告，请先运行 npm run test:coverage" };
  }
  try {
    const data = JSON.parse(readFileSync(covJsonPath, "utf-8"));
    // 从 coverage-final.json 计算总体覆盖率
    let totalStmts = 0,
      coveredStmts = 0;
    let totalBranches = 0,
      coveredBranches = 0;
    let totalFunctions = 0,
      coveredFunctions = 0;
    let totalLines = 0,
      coveredLines = 0;

    for (const file of Object.values(data)) {
      // 语句覆盖
      const stmtMap = file.statementMap || {};
      const s = file.s || {};
      for (const key of Object.keys(stmtMap)) {
        totalStmts++;
        if (s[key] > 0) coveredStmts++;
      }
      // 分支覆盖
      const branchMap = file.branchMap || {};
      const b = file.b || {};
      for (const key of Object.keys(branchMap)) {
        const branches = b[key] || [];
        totalBranches += branches.length;
        coveredBranches += branches.filter(count => count > 0).length;
      }
      // 函数覆盖
      const fnMap = file.fnMap || {};
      const f = file.f || {};
      for (const key of Object.keys(fnMap)) {
        totalFunctions++;
        if (f[key] > 0) coveredFunctions++;
      }
      // 行覆盖
      const lineCounts = {};
      for (const [key, count] of Object.entries(s)) {
        const loc = stmtMap[key];
        if (loc?.start?.line) {
          const line = loc.start.line;
          lineCounts[line] = (lineCounts[line] || 0) + count;
        }
      }
      totalLines += Object.keys(lineCounts).length;
      coveredLines += Object.values(lineCounts).filter(c => c > 0).length;
    }

    return {
      available: true,
      statements: totalStmts > 0 ? parseFloat(((coveredStmts / totalStmts) * 100).toFixed(2)) : 0,
      branches: totalBranches > 0 ? parseFloat(((coveredBranches / totalBranches) * 100).toFixed(2)) : 0,
      functions: totalFunctions > 0 ? parseFloat(((coveredFunctions / totalFunctions) * 100).toFixed(2)) : 0,
      lines: totalLines > 0 ? parseFloat(((coveredLines / totalLines) * 100).toFixed(2)) : 0,
    };
  } catch (e) {
    return { available: false, message: `覆盖率 JSON 解析失败：${e.message}` };
  }
}

// ──────────────────────────────────────────────────────
// 依赖分析
// ──────────────────────────────────────────────────────

function collectDependencyStats() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  const deps = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name,
    version,
    type: "runtime",
  }));
  const devDeps = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
    name,
    version,
    type: "dev",
  }));
  return {
    runtime: deps,
    dev: devDeps,
    totalRuntime: deps.length,
    totalDev: devDeps.length,
  };
}

// ──────────────────────────────────────────────────────
// 大文件检测（潜在重构目标）
// ──────────────────────────────────────────────────────

function findLargeFiles(threshold = 300) {
  const tsFiles = walkDir(SRC, [".ts", ".tsx"]);
  const large = [];
  for (const file of tsFiles) {
    const lines = countLines(file);
    if (lines.code > threshold) {
      large.push({
        path: relative(ROOT, file),
        codeLines: lines.code,
        commentLines: lines.comment,
      });
    }
  }
  return large.sort((a, b) => b.codeLines - a.codeLines);
}

// ──────────────────────────────────────────────────────
// ESLint 统计
// ──────────────────────────────────────────────────────

function collectLintStats() {
  // 尝试读取 ESLint JSON 报告
  const lintJsonPath = join(ROOT, "coverage/lint-report.json");
  if (!existsSync(lintJsonPath)) {
    return { available: false, message: "未找到 lint 报告，请先运行 npm run lint:report" };
  }
  try {
    const data = JSON.parse(readFileSync(lintJsonPath, "utf-8"));
    let errors = 0,
      warnings = 0;
    const topFiles = [];
    for (const file of data) {
      errors += file.errorCount;
      warnings += file.warningCount;
      if (file.errorCount + file.warningCount > 0) {
        topFiles.push({
          path: relative(ROOT, file.filePath),
          errors: file.errorCount,
          warnings: file.warningCount,
        });
      }
    }
    topFiles.sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings));
    return {
      available: true,
      errors,
      warnings,
      topFiles: topFiles.slice(0, 10),
    };
  } catch {
    return { available: false, message: "Lint JSON 解析失败" };
  }
}

// ──────────────────────────────────────────────────────
// Git 统计
// ──────────────────────────────────────────────────────

function collectGitStats() {
  const commitCount = safeExec("git rev-list --count HEAD");
  const lastCommit = safeExec("git log -1 --format=%ci");
  const branchName = safeExec("git branch --show-current");
  const contributors = safeExec("git shortlog -sn --no-merges | head -5");
  return {
    commitCount: commitCount || "N/A",
    lastCommit: lastCommit || "N/A",
    branch: branchName || "N/A",
    topContributors: contributors || "N/A",
  };
}

// ──────────────────────────────────────────────────────
// 质量评分
// ──────────────────────────────────────────────────────

function computeQualityScore(codeStats, covStats, lintStats, largeFiles) {
  let score = 0;
  const factors = [];

  // 1. 测试覆盖率（满分 30 分）
  if (covStats.available) {
    const avgCov =
      (covStats.statements + covStats.branches + covStats.functions + covStats.lines) / 4;
    const covScore = Math.min(30, (avgCov / 100) * 30);
    score += covScore;
    factors.push({
      name: "测试覆盖率",
      score: covScore.toFixed(1),
      max: 30,
      detail: `语句 ${covStats.statements}% | 分支 ${covStats.branches}% | 函数 ${covStats.functions}% | 行 ${covStats.lines}%`,
    });
  } else {
    factors.push({ name: "测试覆盖率", score: "0", max: 30, detail: "未生成覆盖率报告" });
  }

  // 2. 代码注释率（满分 15 分，15-25% 最佳）
  const commentRatio = parseFloat(codeStats.summary.commentRatio);
  let commentScore = 0;
  if (commentRatio >= 15 && commentRatio <= 25) commentScore = 15;
  else if (commentRatio >= 10 && commentRatio <= 30) commentScore = 10;
  else if (commentRatio > 0) commentScore = 5;
  score += commentScore;
  factors.push({
    name: "注释率",
    score: commentScore.toString(),
    max: 15,
    detail: `${commentRatio}%（${codeStats.summary.commentLines} 行注释 / ${codeStats.summary.codeLines} 行代码）`,
  });

  // 3. Lint 质量（满分 25 分）
  if (lintStats.available) {
    const _totalIssues = lintStats.errors + lintStats.warnings;
    let lintScore = 25;
    lintScore -= Math.min(25, lintStats.errors * 2);
    lintScore -= Math.min(10, lintStats.warnings * 0.5);
    lintScore = Math.max(0, lintScore);
    score += lintScore;
    factors.push({
      name: "Lint 质量",
      score: lintScore.toFixed(1),
      max: 25,
      detail: `${lintStats.errors} 错误 / ${lintStats.warnings} 警告`,
    });
  } else {
    factors.push({ name: "Lint 质量", score: "0", max: 25, detail: "未生成 lint 报告" });
  }

  // 4. 代码规模健康度（满分 15 分，大文件越少越好）
  const largeFileScore = Math.max(0, 15 - largeFiles.length * 2);
  score += largeFileScore;
  factors.push({
    name: "代码规模",
    score: largeFileScore.toFixed(1),
    max: 15,
    detail: `${largeFiles.length} 个超过 300 行的大文件`,
  });

  // 5. 测试文件比例（满分 15 分，测试文件占总文件 30% 以上为满分）
  const testRatio = codeStats.summary.testFiles / codeStats.summary.totalFiles;
  const testScore = Math.min(15, (testRatio / 0.3) * 15);
  score += testScore;
  factors.push({
    name: "测试覆盖广度",
    score: testScore.toFixed(1),
    max: 15,
    detail: `${codeStats.summary.testFiles} / ${codeStats.summary.totalFiles} 文件为测试文件（${(testRatio * 100).toFixed(1)}%）`,
  });

  return {
    total: score.toFixed(1),
    max: 100,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F",
    factors,
  };
}

// ──────────────────────────────────────────────────────
// 报告生成
// ──────────────────────────────────────────────────────

function generateHtmlReport(report) {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>紫微斗数排盘 - 代码质量报告</title>
<style>
  :root {
    --bg: #0a0e1a;
    --surface: #141824;
    --border: #2a3040;
    --text: #e8eaf0;
    --text-dim: #8890a4;
    --accent: #6366f1;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.3rem; margin: 2rem 0 1rem; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
  .meta { color: var(--text-dim); font-size: 0.9rem; margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.2rem;
  }
  .card h3 { font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .card .value { font-size: 2rem; font-weight: 700; }
  .card .sub { font-size: 0.85rem; color: var(--text-dim); margin-top: 0.3rem; }
  .score-badge {
    display: inline-block;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .score-A { background: #22c55e30; color: #22c55e; }
  .score-B { background: #6366f130; color: #6366f1; }
  .score-C { background: #f59e0b30; color: #f59e0b; }
  .score-D { background: #f9730030; color: #f97300; }
  .score-F { background: #ef444430; color: #ef4444; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { text-align: left; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--border); }
  th { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar { display: inline-block; height: 6px; border-radius: 3px; background: var(--accent); margin-right: 0.5rem; vertical-align: middle; }
  .factors-list { list-style: none; }
  .factors-list li { padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
  .factors-list .factor-name { font-weight: 600; }
  .factors-list .factor-score { color: var(--accent); }
  .factors-list .factor-detail { color: var(--text-dim); font-size: 0.9rem; }
</style>
</head>
<body>
<div class="container">
  <h1>🔮 代码质量报告</h1>
  <div class="meta">紫微斗数排盘 (peep-v2) · 生成于 ${now} · 分支: ${report.git.branch}</div>

  <h2>综合评分</h2>
  <div class="card" style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem;">
    <div>
      <span class="score-badge score-${report.quality.grade}">${report.quality.total} / 100 · 等级 ${report.quality.grade}</span>
    </div>
    <div style="flex: 1;">
      <ul class="factors-list">
        ${report.quality.factors.map(f => `<li>
          <span class="factor-name">${f.name}</span>:
          <span class="factor-score">${f.score} / ${f.max}</span>
          <span class="factor-detail">— ${f.detail}</span>
        </li>`).join("\n        ")}
      </ul>
    </div>
  </div>

  <h2>代码规模</h2>
  <div class="grid">
    <div class="card">
      <h3>源文件数</h3>
      <div class="value">${report.code.summary.srcFiles}</div>
      <div class="sub">+ ${report.code.summary.testFiles} 测试文件</div>
    </div>
    <div class="card">
      <h3>代码行数</h3>
      <div class="value">${report.code.summary.codeLines.toLocaleString()}</div>
      <div class="sub">注释 ${report.code.summary.commentLines.toLocaleString()} 行 (${report.code.summary.commentRatio}%)</div>
    </div>
    <div class="card">
      <h3>总行数</h3>
      <div class="value">${report.code.summary.totalLines.toLocaleString()}</div>
      <div class="sub">含空行 ${report.code.summary.blankLines.toLocaleString()}</div>
    </div>
    <div class="card">
      <h3>依赖数量</h3>
      <div class="value">${report.deps.totalRuntime}</div>
      <div class="sub">运行时 + ${report.deps.totalDev} 开发</div>
    </div>
  </div>

  <h2>目录分布</h2>
  <table>
    <thead><tr><th>目录</th><th>文件数</th><th>代码行</th><th>注释行</th></tr></thead>
    <tbody>
      ${Object.entries(report.code.byDirectory)
        .sort((a, b) => b[1].code - a[1].code)
        .map(
          ([dir, data]) => `<tr>
          <td>${dir}</td>
          <td class="num">${data.files}</td>
          <td class="num">${data.code.toLocaleString()}</td>
          <td class="num">${data.comment.toLocaleString()}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <h2>测试覆盖率</h2>
  ${
    report.coverage.available
      ? `<div class="grid">
      <div class="card"><h3>语句覆盖</h3><div class="value">${report.coverage.statements}%</div></div>
      <div class="card"><h3>分支覆盖</h3><div class="value">${report.coverage.branches}%</div></div>
      <div class="card"><h3>函数覆盖</h3><div class="value">${report.coverage.functions}%</div></div>
      <div class="card"><h3>行覆盖</h3><div class="value">${report.coverage.lines}%</div></div>
    </div>`
      : `<div class="card"><p style="color:var(--text-dim);">${report.coverage.message}</p></div>`
  }

  <h2>Lint 结果</h2>
  ${
    report.lint.available
      ? `<div class="grid">
      <div class="card"><h3>错误</h3><div class="value" style="color:var(--error);">${report.lint.errors}</div></div>
      <div class="card"><h3>警告</h3><div class="value" style="color:var(--warning);">${report.lint.warnings}</div></div>
    </div>
    ${report.lint.topFiles.length > 0 ? `<h3 style="font-size:1rem;margin-top:1rem;">Top 问题文件</h3>
    <table><thead><tr><th>文件</th><th>错误</th><th>警告</th></tr></thead><tbody>
    ${report.lint.topFiles.map(f => `<tr><td>${f.path}</td><td class="num">${f.errors}</td><td class="num">${f.warnings}</td></tr>`).join("")}
    </tbody></table>` : ""}`
      : `<div class="card"><p style="color:var(--text-dim);">${report.lint.message}</p></div>`
  }

  <h2>大文件清单（>300 行代码）</h2>
  ${
    report.largeFiles.length > 0
      ? `<table><thead><tr><th>文件</th><th>代码行</th><th>注释行</th></tr></thead><tbody>
      ${report.largeFiles.map(f => `<tr><td>${f.path}</td><td class="num">${f.codeLines}</td><td class="num">${f.commentLines}</td></tr>`).join("")}
      </tbody></table>`
      : `<div class="card"><p style="color:var(--success);">✓ 无超过 300 行的大文件</p></div>`
  }

  <h2>Git 信息</h2>
  <div class="card">
    <div class="sub">总提交数：${report.git.commitCount}</div>
    <div class="sub">最近提交：${report.git.lastCommit}</div>
    <div class="sub">当前分支：${report.git.branch}</div>
    <div class="sub">主要贡献者：<pre style="margin-top:0.3rem;font-size:0.85rem;">${report.git.topContributors}</pre></div>
  </div>
</div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────
// 主流程
// ──────────────────────────────────────────────────────

function main() {
  console.log("📊 正在收集代码质量指标...\n");

  const codeStats = collectCodeStats();
  console.log("  ✓ 代码统计完成");

  const coverageStats = collectCoverageStats();
  console.log(
    coverageStats.available ? "  ✓ 覆盖率数据已加载" : `  ⚠ ${coverageStats.message}`
  );

  const lintStats = collectLintStats();
  console.log(lintStats.available ? "  ✓ Lint 数据已加载" : `  ⚠ ${lintStats.message}`);

  const depStats = collectDependencyStats();
  console.log("  ✓ 依赖统计完成");

  const largeFiles = findLargeFiles(300);
  console.log(`  ✓ 发现 ${largeFiles.length} 个大文件 (>300 行)`);

  const gitStats = collectGitStats();
  console.log("  ✓ Git 信息收集完成");

  const qualityScore = computeQualityScore(codeStats, coverageStats, lintStats, largeFiles);
  console.log(`\n🎯 综合评分：${qualityScore.total} / 100（等级 ${qualityScore.grade}）\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    code: codeStats,
    coverage: coverageStats,
    lint: lintStats,
    deps: depStats,
    largeFiles,
    git: gitStats,
    quality: qualityScore,
  };

  // JSON 模式：输出到 stdout
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // HTML 报告
  const coverageDir = join(ROOT, "coverage");
  if (!existsSync(coverageDir)) {
    mkdirSync(coverageDir, { recursive: true });
  }
  const htmlPath = join(ROOT, "coverage/quality-report.html");
  const html = generateHtmlReport(report);
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`📄 HTML 报告已生成：${htmlPath}`);

  // JSON 数据
  const jsonPath = join(ROOT, "coverage/quality-data.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`📋 JSON 数据已保存：${jsonPath}`);
}

main();
