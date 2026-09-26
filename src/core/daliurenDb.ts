/**
 * 大六壬数据库 CRUD 操作
 */
import { db, type LiurenRecord } from "./personDb";
import { createTagCache } from "./tagCache";
import { filterAndPaginate } from "./dbUtils";
import { t } from "./i18n";

/** 标签缓存：避免每次打开列表都全表扫描提取 tags */
const tagCache = createTagCache(
  (personId: number) =>
    db.liurenRecords.where("personId").equals(personId).toArray(),
  (r: LiurenRecord) => r.tags
);

/** 写入/删除后使标签缓存失效 */
export function invalidateLiurenTagCache() {
  tagCache.invalidate();
}

/** 列表查询过滤条件 */
export interface LiurenListFilters {
  /** 文本搜索（匹配 question、note、background） */
  searchText?: string;
  /** 标签筛选（多值匹配，记录包含任一选中的 tag 即可） */
  tags?: string[];
  /** 分页：当前页码（1-based） */
  page?: number;
  /** 分页：每页条数 */
  pageSize?: number;
}

/** 列表查询结果 */
export interface LiurenListResult {
  /** 记录列表 */
  records: LiurenRecord[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/**
 * 查询大六壬记录列表
 * 支持分页、文本搜索、tag 筛选，按 savedAt 倒序
 */
export async function listLiurenRecords(
  personId: number,
  filters: LiurenListFilters = {}
): Promise<LiurenListResult> {
  try {
    const allRecords = await db.liurenRecords
      .where("personId")
      .equals(personId)
      .toArray();

    const result = filterAndPaginate<LiurenRecord>({
      records: allRecords,
      sortField: "savedAt",
      searchFields: ["question", "note", "background"],
      filters,
    });

    return { records: result.items, total: result.total, page: result.page, pageSize: result.pageSize };
  } catch (err) {
    console.error("[daliurenDb] 查询记录列表失败", err);
    throw new Error(t("db.readLiurenListFailed"));
  }
}

/**
 * 获取单条大六壬记录
 */
export async function getLiurenRecord(id: number): Promise<LiurenRecord | undefined> {
  try {
    return await db.liurenRecords.get(id);
  } catch (err) {
    console.error("[daliurenDb] 获取记录详情失败", err);
    throw new Error(t("db.readLiurenFailed"));
  }
}

/**
 * 保存大六壬记录（新增或更新）
 */
export async function saveLiurenRecord(record: LiurenRecord): Promise<number> {
  try {
    // put：有 id 则更新，无 id 则新增
    const id = await db.liurenRecords.put(record);
    invalidateLiurenTagCache();
    return id;
  } catch (err) {
    console.error("[daliurenDb] 保存记录失败", err);
    throw new Error(t("db.saveLiurenFailed"));
  }
}

/**
 * 删除大六壬记录
 */
export async function deleteLiurenRecord(id: number): Promise<void> {
  try {
    await db.liurenRecords.delete(id);
    invalidateLiurenTagCache();
  } catch (err) {
    console.error("[daliurenDb] 删除记录失败", err);
    throw new Error(t("db.deleteLiurenFailed"));
  }
}

/**
 * 获取所有已使用的标签（用于 tag 筛选下拉）
 * 使用内存缓存避免每次全表扫描；写入/删除后自动失效
 */
export async function getAllLiurenTags(personId: number): Promise<string[]> {
  try {
    return await tagCache.get(personId);
  } catch (err) {
    console.error("[daliurenDb] 获取标签列表失败", err);
    return [];
  }
}
