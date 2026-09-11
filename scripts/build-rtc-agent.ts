#!/usr/bin/env tsx
/**
 * 构建 rtc-agent 组件并复制到 peep 的 public 目录
 *
 * 用途：在 peep 构建前自动执行，确保使用最新的 rtc-agent 组件
 */

import { execSync } from 'child_process';
import { cpSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const webComponentDir = resolve(rootDir, '../../rtc-agent/web-components/packages/component');
const targetDir = resolve(rootDir, 'public/rtc-agent-local');

console.log('🔨 构建 rtc-agent 组件...');

try {
  // 构建 web-component
  execSync('npm run build', {
    cwd: webComponentDir,
    stdio: 'inherit'
  });

  console.log('📦 复制编译产物到 peep...');

  // 清理旧的目标目录
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true });
  }

  // 复制 dist 目录
  const sourceDir = resolve(webComponentDir, 'dist');
  cpSync(sourceDir, targetDir, { recursive: true });

  console.log('✅ rtc-agent 组件已更新到 public/rtc-agent-local/');
} catch (error) {
  console.error('❌ 构建失败:', error);
  process.exit(1);
}
