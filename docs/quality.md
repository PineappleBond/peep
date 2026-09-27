# 代码质量标准与指南

本文档描述 `peep-v2`（紫微斗数排盘）项目的代码质量规范、工具链和最佳实践。

## 快速开始

```bash
# 运行所有质量检查
npm run quality

# 生成代码覆盖率报告
npm run test:coverage

# 生成质量仪表板
npm run quality:report

# 仅 lint 检查
npm run lint

# 类型检查
npm run typecheck
```

## 质量工具链

### 1. TypeScript 严格模式

项目启用 `strict: true`，这是 TypeScript 最严格的类型检查：

- `strictNullChecks`: 所有变量默认不可为 null/undefined
- `noImplicitAny`: 禁止隐式 any 类型
- `strictFunctionTypes`: 函数参数严格类型检查
- `strictBindCallApply`: bind/call/apply 严格检查

**指南**：

- 新代码必须通过类型检查，不使用 `any`（除非有明确注释说明原因）
- 使用 `@ts-expect-error` 代替 `@ts-ignore`（类型修复后会自动报错）
- 优先使用 `unknown` 代替 `any`，再通过类型守卫收窄

### 2. ESLint 规则

规则配置见 `eslint.config.js`，关键规则：

| 规则                                 | 级别            | 说明                                  |
| ------------------------------------ | --------------- | ------------------------------------- |
| `complexity`                         | warn (max: 15)  | 圈复杂度，超过 15 提示拆分            |
| `max-lines-per-function`             | warn (max: 200) | 函数最大行数                          |
| `max-depth`                          | warn (max: 4)   | 嵌套深度，超过 4 层提示提取子函数     |
| `max-params`                         | warn (max: 5)   | 函数参数数量，超过 5 个建议用对象参数 |
| `@typescript-eslint/no-explicit-any` | warn            | 避免显式 any                          |
| `no-console`                         | warn            | 禁止 console.log（允许 warn/error）   |
| `eqeqeq`                             | error           | 强制使用 === 和 !==                   |

**渐进式改进**：规则级别以 warn 为主，不阻塞构建。随着代码质量提升，逐步将 warn 升级为 error。

### 3. 代码覆盖率

使用 `@vitest/coverage-v8`（V8 原生覆盖率），零性能损耗。

**阈值**（初始基线）：

- 语句覆盖：≥ 40%
- 分支覆盖：≥ 30%
- 函数覆盖：≥ 40%
- 行覆盖：≥ 40%

**报告位置**：`coverage/` 目录

- `index.html`: 可视化报告
- `coverage-summary.json`: 机器可读摘要
- `lcov.info`: CI 集成

**指南**：

- 新功能必须附带测试
- 修复 bug 时先写失败测试，再修复
- 优先为核心逻辑（`src/core/`）编写测试
- 测试文件命名：`*.test.ts` 或 `*.test.tsx`

### 4. 代码格式化

使用 Prettier，配置见 `prettier.config.js`：

- 行宽 100（适合中文注释）
- 2 空格缩进
- 双引号
- 尾随逗号（all）
- LF 换行符

**Pre-commit hook**：通过 `lint-staged` + `husky`，提交前自动格式化。

## 质量报告

### 生成报告

```bash
# HTML + JSON 报告
npm run quality:report

# 仅 JSON（便于管道处理）
node scripts/quality-report.js --json
```

报告位置：`coverage/quality-report.html`

### 评分维度

质量评分（满分 100）由以下维度组成：

| 维度         | 满分 | 说明                                 |
| ------------ | ---- | ------------------------------------ |
| 测试覆盖率   | 30   | 平均覆盖率 × 30                      |
| Lint 质量    | 25   | 基础 25 分，错误 -2/个，警告 -0.5/个 |
| 注释率       | 15   | 15-25% 满分，10-30% 10 分            |
| 代码规模     | 15   | 大文件（>300 行）越少越好            |
| 测试覆盖广度 | 15   | 测试文件占比 ≥30% 满分               |

**等级划分**：

- A: 90-100 分
- B: 75-89 分
- C: 60-74 分
- D: 40-59 分
- F: < 40 分

## 最佳实践

### 函数设计

1. **单一职责**：一个函数只做一件事
2. **参数不超过 5 个**：超过时用对象参数
   ```typescript
   // 不好
   function createUser(name: string, age: number, email: string, phone: string, address: string) {}

   // 好
   function createUser(params: {
     name: string;
     age: number;
     email: string;
     phone?: string;
     address?: string;
   }) {}
   ```
3. **嵌套不超过 4 层**：用早返回、提取子函数降低嵌套
   ```typescript
   // 不好
   function process(data) {
     if (data) {
       if (data.items) {
         data.items.forEach(item => {
           if (item.valid) {
             // 处理逻辑
           }
         });
       }
     }
   }

   // 好
   function process(data) {
     if (!data?.items) return;
     data.items.forEach(item => {
       if (item.valid) processItem(item);
     });
   }
   ```
4. **圈复杂度不超过 15**：超过时拆分为多个小函数

### 代码组织

1. **文件不超过 300 行**：超过时考虑拆分
2. **按功能组织**：相关文件放在一起（`src/core/`、`src/components/`）
3. **导出清晰的公共 API**：使用 `index.ts` 统一导出

### 测试策略

1. **单元测试**：核心逻辑（`src/core/`）
2. **组件测试**：复杂交互组件
3. **E2E 测试**：关键用户流程（Playwright）
4. **测试命名**：描述性命名，说明测试场景和预期结果
   ```typescript
   it("当输入无效日期时返回错误提示", () => {
     // ...
   });
   ```

### Git 提交规范

格式：`类别：概述——细节`

类别：

- `功能`：新功能
- `修`：bug 修复
- `文档`：文档更新
- `重构`：代码重构（不改变功能）
- `测试`：测试相关
- `样式`：格式调整（不影响代码逻辑）
- `构建`：构建系统或外部依赖变更

示例：

```
功能：添加代码质量报告——集成覆盖率、复杂度分析
修：修复空指针异常——当 input 为 null 时提前返回
重构：拆分大函数——将 processChart 拆分为 3 个子函数
```

## 持续改进

### 渐进式提升阈值

当前阈值为初始基线，随测试覆盖率提升逐步收紧：

```json
{
  "statements": 40, // 目标：60% → 80%
  "branches": 30, // 目标：50% → 70%
  "functions": 40, // 目标：60% → 80%
  "lines": 40 // 目标：60% → 80%
}
```

### 定期回顾

- 每周查看质量报告，关注评分变化
- 每月回顾 lint 警告，逐步修复
- 每季度评估阈值，适当提升

### 重构建议

1. **高复杂度函数**：拆分为多个小函数，每个函数单一职责
2. **大文件**：按功能拆分，提取公共逻辑到独立文件
3. **重复代码**：提取为共享工具函数（`src/core/utils.ts`）
4. **深层嵌套**：用早返回、提取子函数降低嵌套

## 工具参考

| 工具              | 用途              | 命令                     |
| ----------------- | ----------------- | ------------------------ |
| TypeScript        | 类型检查          | `npm run typecheck`      |
| ESLint            | 代码质量检查      | `npm run lint`           |
| Prettier          | 代码格式化        | `npm run format`         |
| Vitest            | 单元测试 + 覆盖率 | `npm run test:coverage`  |
| quality-report.js | 质量报告生成      | `npm run quality:report` |

## 故障排查

### 覆盖率阈值失败

如果测试通过但覆盖率阈值不达标：

1. 查看 `coverage/index.html` 定位未覆盖代码
2. 为未覆盖的核心逻辑补充测试
3. 如果是合理的排除项（如类型声明），在 `vite.config.ts` 的 `coverage.exclude` 中添加

### ESLint 警告过多

1. 优先修复 error 级别问题
2. warn 级别可分批修复，不必一次性解决
3. 如果是误报，使用行内注释禁用：
   ```typescript
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const data: any = fetchData();
   ```

### 质量报告生成失败

1. 确保先运行 `npm run test:coverage` 生成覆盖率数据
2. 确保先运行 `npm run lint:report` 生成 lint 报告
3. 检查 `coverage/` 目录是否存在且有写入权限

## 相关文档

- [CLAUDE.md](../CLAUDE.md)：项目开发约定
- [vite.config.ts](../vite.config.ts)：覆盖率配置
- [eslint.config.js](../eslint.config.js)：ESLint 规则
- [scripts/quality-report.js](../scripts/quality-report.js)：质量报告脚本
