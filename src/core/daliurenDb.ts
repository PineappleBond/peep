/**
 * 大六壬数据库 CRUD 操作
 */
import Dexie from "dexie";
import { db, type LiurenRecord } from "./personDb";

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
  const { searchText = "", tags = [], page = 1, pageSize = 20 } = filters;

  // 基础查询：按人物 ID 过滤
  let query = db.liurenRecords.where("personId").equals(personId);

  // 收集所有匹配的记录
  let allRecords = await query.reverse().sortBy("savedAt");

  // 文本搜索：匹配 question、note、background
  if (searchText.trim()) {
    const keyword = searchText.trim().toLowerCase();
    allRecords = allRecords.filter(
      (r) =>
        r.question.toLowerCase().includes(keyword) ||
        r.note.toLowerCase().includes(keyword) ||
        r.background.toLowerCase().includes(keyword)
    );
  }

  // Tag 筛选：多值匹配（记录包含任一选中的 tag）
  if (tags.length > 0) {
    allRecords = allRecords.filter((r) =>
      r.tags.some((t) => tags.includes(t))
    );
  }

  const total = allRecords.length;

  // 分页
  const start = (page - 1) * pageSize;
  const records = allRecords.slice(start, start + pageSize);

  return { records, total, page, pageSize };
}

/**
 * 获取单条大六壬记录
 */
export async function getLiurenRecord(id: number): Promise<LiurenRecord | undefined> {
  return db.liurenRecords.get(id);
}

/**
 * 保存大六壬记录（新增或更新）
 */
export async function saveLiurenRecord(record: LiurenRecord): Promise<number> {
  // put：有 id 则更新，无 id 则新增
  const id = await db.liurenRecords.put(record);
  return id;
}

/**
 * 删除大六壬记录
 */
export async function deleteLiurenRecord(id: number): Promise<void> {
  await db.liurenRecords.delete(id);
}

/**
 * 获取所有已使用的标签（用于 tag 筛选下拉）
 */
export async function getAllLiurenTags(personId: number): Promise<string[]> {
  const records = await db.liurenRecords
    .where("personId")
    .equals(personId)
    .toArray();

  const tagSet = new Set<string>();
  for (const r of records) {
    for (const t of r.tags) {
      tagSet.add(t);
    }
  }
  return Array.from(tagSet).sort();
}
