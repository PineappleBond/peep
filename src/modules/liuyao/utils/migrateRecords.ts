import { db } from "@/lib/db";

const LEGACY_STORAGE_KEY = "peep-liuyao-records";

interface LegacyLiuyaoRecord {
  id: string;
  timestamp: number;
  date: string;
  lines: [number, number, number, number, number, number];
  scenarioId: string;
  yongTarget: string;
  extras: Record<string, string>;
  question: string;
  background?: string;
  chart: unknown;
  personId?: string;
  personName?: string;
}

/**
 * 迁移 localStorage 中的六爻记录到 IndexedDB
 * 一次性操作，迁移后删除 localStorage 数据
 *
 * @returns 迁移结果：包含成功数量和可能的错误信息
 */
export async function migrateLiuyaoRecordsFromLocalStorage(): Promise<{ count: number; error?: string }> {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) {
      return { count: 0 };
    }

    const legacyRecords: LegacyLiuyaoRecord[] = JSON.parse(saved);
    if (legacyRecords.length === 0) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return { count: 0 };
    }

    // 检查是否已经迁移过（避免重复迁移）
    const existingCount = await db.liuyaoRecords.count();
    if (existingCount > 0) {
      // IndexedDB 中已有数据，跳过迁移但清理 localStorage 防止下次重复检测。
      // 注意：localStorage 中的记录不会合并到 IndexedDB，因为两端数据可能不一致，
      // 以 IndexedDB 为准。
      console.warn(
        `[Liuyao Migration] IndexedDB already has ${existingCount} records; ` +
        `skipping migration of ${legacyRecords.length} localStorage records. ` +
        `LocalStorage data will be discarded.`,
      );
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return { count: 0 };
    }

    // 批量插入记录 - 转换 ID 类型从 string 到 number（让数据库自动生成）
    // 并转换 personId 从 string 到 number，时间戳从 Date 到 number
    const recordsToInsert = legacyRecords.map(({ id: _legacyId, personId, ...rest }) => ({
      ...rest,
      personId: personId ? Number(personId) : null,
      createdAt: rest.timestamp,
      updatedAt: rest.timestamp,
    }));

    await db.liuyaoRecords.bulkAdd(recordsToInsert);

    // 迁移成功后删除 localStorage 数据
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    const msg = `Successfully migrated ${recordsToInsert.length} records from localStorage to IndexedDB`;
    console.info(`[Liuyao Migration] ${msg}`);
    return { count: recordsToInsert.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Liuyao Migration] Failed to migrate records:", error);
    return { count: 0, error: errorMsg };
  }
}

/**
 * 检查是否有需要迁移的旧数据
 */
export function hasLegacyLiuyaoRecords(): boolean {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
    return !!saved && JSON.parse(saved).length > 0;
  } catch {
    return false;
  }
}
