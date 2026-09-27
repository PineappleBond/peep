/**
 * 六爻数据库 CRUD 操作
 */
import { db, type LiuyaoRecord } from "./personDb";
import { createTagCache } from "./tagCache";
import { createDbOperation, filterAndPaginate } from "./dbUtils";
import { t } from "./i18n";

/** 标签缓存：避免每次打开列表都全表扫描提取 tags */
const tagCache = createTagCache(
  (personId: number) => db.liuyaoRecords.where("personId").equals(personId).toArray(),
  (r: LiuyaoRecord) => r.tags,
);

/** 写入/删除后使标签缓存失效 */
export function invalidateLiuyaoTagCache() {
  tagCache.invalidate();
}

/** 本模块的数据库操作包装器（统一错误日志与错误包装） */
const dbOp = createDbOperation("liuyaoDb");

/** 列表查询过滤条件 */
export interface LiuyaoListFilters {
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
export interface LiuyaoListResult {
  /** 记录列表 */
  records: LiuyaoRecord[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/**
 * 查询六爻记录列表
 * 支持分页、文本搜索、tag 筛选，按 savedAt 倒序
 */
export async function listLiuyaoRecords(
  personId: number,
  filters: LiuyaoListFilters = {},
): Promise<LiuyaoListResult> {
  return dbOp(t("db.readLiuyaoListFailed"), async () => {
    const allRecords = await db.liuyaoRecords.where("personId").equals(personId).toArray();

    const result = filterAndPaginate<LiuyaoRecord>({
      records: allRecords,
      sortField: "savedAt",
      searchFields: ["question", "note", "background"],
      filters,
    });

    return {
      records: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  });
}

/**
 * 获取单条六爻记录
 */
export async function getLiuyaoRecord(id: number): Promise<LiuyaoRecord | undefined> {
  return dbOp(t("db.readLiuyaoFailed"), () => db.liuyaoRecords.get(id));
}

/**
 * 保存六爻记录（新增或更新）。
 * 新增时自动设置 savedAt 时间戳；更新时保留原 savedAt。
 * 不修改入参对象，返回新对象写入数据库。
 */
export async function saveLiuyaoRecord(record: LiuyaoRecord): Promise<number> {
  return dbOp(t("db.saveLiuyaoFailed"), async () => {
    // 新增时自动设置 savedAt（不修改入参）
    const data = record.id == null && !record.savedAt ? { ...record, savedAt: Date.now() } : record;
    // put：有 id 则更新，无 id 则新增
    const id = await db.liuyaoRecords.put(data);
    invalidateLiuyaoTagCache();
    return id;
  });
}

/**
 * 删除六爻记录
 */
export async function deleteLiuyaoRecord(id: number): Promise<void> {
  return dbOp(t("db.deleteLiuyaoFailed"), async () => {
    await db.liuyaoRecords.delete(id);
    invalidateLiuyaoTagCache();
  });
}

/**
 * 获取所有已使用的标签（用于 tag 筛选下拉）
 * 使用内存缓存避免每次全表扫描；写入/删除后自动失效
 */
export async function getAllLiuyaoTags(personId: number): Promise<string[]> {
  try {
    return await tagCache.get(personId);
  } catch (err) {
    console.error("[liuyaoDb] 获取标签列表失败", err);
    return [];
  }
}
