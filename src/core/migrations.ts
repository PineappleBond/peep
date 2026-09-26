/**
 * IndexedDB 数据迁移系统
 * 管理数据库版本升级，确保数据结构变更时用户数据不丢失
 */
import type Dexie from "dexie";

/** 迁移函数类型 */
export type MigrationFn = (db: Dexie) => Promise<void>;

/** 迁移注册表：版本号 -> 迁移函数 */
const migrations: Map<number, MigrationFn> = new Map();

/** 迁移日志：记录每次迁移的执行情况 */
interface MigrationLog {
  version: number;
  timestamp: number;
  status: "success" | "failed";
  duration: number;
  error?: string;
}

const MIGRATION_LOG_KEY = "peep_migration_log";

/** 读取迁移日志 */
function getMigrationLogs(): MigrationLog[] {
  try {
    const logs = localStorage.getItem(MIGRATION_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
}

/** 写入迁移日志 */
function saveMigrationLog(log: MigrationLog): void {
  try {
    const logs = getMigrationLogs();
    logs.push(log);
    // 只保留最近 50 条日志
    if (logs.length > 50) logs.splice(0, logs.length - 50);
    localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error("[migration] 保存迁移日志失败", err);
  }
}

/**
 * 注册迁移函数
 * @param version 目标版本号
 * @param fn 迁移函数（必须是幂等的）
 */
export function registerMigration(version: number, fn: MigrationFn): void {
  if (migrations.has(version)) {
    console.warn(`[migration] 版本 ${version} 的迁移已注册，将被覆盖`);
  }
  migrations.set(version, fn);
}

/**
 * 执行版本迁移
 * @param db Dexie 数据库实例
 * @param fromVersion 起始版本（不包含）
 * @param toVersion 目标版本（包含）
 */
export async function runMigrations(
  db: Dexie,
  fromVersion: number,
  toVersion: number,
): Promise<void> {
  if (fromVersion >= toVersion) {
    console.warn(`[migration] 无需迁移（当前版本 ${fromVersion}）`);
    return;
  }

  console.warn(`[migration] 开始迁移：v${fromVersion} → v${toVersion}`);

  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const fn = migrations.get(v);
    if (!fn) {
      console.warn(`[migration] 版本 ${v} 无迁移函数，跳过`);
      continue;
    }

    const startTime = Date.now();
    console.warn(`[migration] 执行版本 ${v} 迁移...`);

    try {
      await fn(db);
      const duration = Date.now() - startTime;

      console.warn(`[migration] 版本 ${v} 迁移成功（${duration}ms）`);
      saveMigrationLog({
        version: v,
        timestamp: Date.now(),
        status: "success",
        duration,
      });
    } catch (err) {
      const duration = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.error(`[migration] 版本 ${v} 迁移失败（${duration}ms）`, err);
      saveMigrationLog({
        version: v,
        timestamp: Date.now(),
        status: "failed",
        duration,
        error: errorMsg,
      });

      throw new Error(`数据库迁移到版本 ${v} 失败：${errorMsg}。请清除浏览器数据后重试。`);
    }
  }

  console.warn(`[migration] 迁移完成：v${toVersion}`);
}

/**
 * 数据完整性检查
 * 验证数据库结构和数据是否有效
 */
export async function checkDataIntegrity(db: Dexie): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // 检查表是否存在
    const tables = db.tables.map(t => t.name);
    const requiredTables = ["persons", "liurenRecords", "wikiDocs", "wikiLinks"];

    for (const table of requiredTables) {
      if (!tables.includes(table)) {
        issues.push(`缺少必需表：${table}`);
      }
    }

    // 检查 persons 表
    if (tables.includes("persons")) {
      const persons = await db.table("persons").toArray();
      const defaults = persons.filter((p: Record<string, unknown>) => p.isDefault);

      if (defaults.length === 0) {
        issues.push("缺少默认人物");
      } else if (defaults.length > 1) {
        issues.push(`存在 ${defaults.length} 个默认人物（应只有 1 个）`);
      }

      // 检查必需字段
      for (const person of persons) {
        if (!person.id) issues.push("人物记录缺少 id");
        if (!person.savedAt) issues.push(`人物 ${person.id} 缺少 savedAt`);
        if (person.isDefault === undefined) issues.push(`人物 ${person.id} 缺少 isDefault`);
      }
    }

    // 检查 wikiLinks 外键关系
    if (tables.includes("wikiDocs") && tables.includes("wikiLinks")) {
      const docs = await db.table("wikiDocs").toArray();
      const links = await db.table("wikiLinks").toArray();
      const docIds = new Set(docs.map((d: Record<string, unknown>) => d.id as string));

      for (const link of links) {
        if (!docIds.has(link.sourceDocId)) {
          issues.push(`链接 ${link.id} 的源文档 ${link.sourceDocId} 不存在`);
        }
        if (!docIds.has(link.targetDocId)) {
          issues.push(`链接 ${link.id} 的目标文档 ${link.targetDocId} 不存在`);
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    issues.push(`完整性检查过程出错：${errorMsg}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * 获取迁移日志
 */
export function getMigrationHistory(): MigrationLog[] {
  return getMigrationLogs();
}

/**
 * 清空迁移日志（仅用于测试）
 */
export function clearMigrationHistory(): void {
  try {
    localStorage.removeItem(MIGRATION_LOG_KEY);
  } catch {
    /* ignore */
  }
}
