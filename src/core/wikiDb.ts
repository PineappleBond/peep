/**
 * Wiki 文档数据库 CRUD 操作
 * 提供文档增删改查、分页列表、标签查询、链接关系管理
 */
import { db, type WikiDocument, type WikiLink } from "./personDb";
import { createTagCache } from "./tagCache";
import { filterAndPaginate } from "./dbUtils";
import { t } from "./i18n";

/** 标签缓存：避免每次打开列表都全表扫描提取 tags */
const tagCache = createTagCache(
  (personId: number) =>
    db.wikiDocs.where("personId").equals(personId).toArray(),
  (d: WikiDocument) => d.tags
);

/** 写入/删除后使标签缓存失效 */
function invalidateTagCache() {
  tagCache.invalidate();
}

/** Wiki 列表查询过滤条件 */
export interface WikiListFilters {
  /** 文本搜索（匹配 title、content） */
  searchText?: string;
  /** 标签筛选（多值匹配，文档包含任一选中的 tag 即可） */
  tags?: string[];
  /** 分页：当前页码（1-based） */
  page?: number;
  /** 分页：每页条数 */
  pageSize?: number;
}

/** Wiki 列表查询结果 */
export interface WikiListResult {
  /** 文档列表 */
  docs: WikiDocument[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/**
 * 查询 Wiki 文档列表
 * 支持分页、文本搜索（匹配 title + content）、tag 筛选，按 updatedAt 倒序
 */
export async function listWikiDocs(
  personId: number,
  filters: WikiListFilters = {}
): Promise<WikiListResult> {
  try {
    const allDocs = await db.wikiDocs
      .where("personId")
      .equals(personId)
      .toArray();

    const result = filterAndPaginate<WikiDocument>({
      records: allDocs,
      sortField: "updatedAt",
      searchFields: ["title", "content"],
      filters,
    });

    return { docs: result.items, total: result.total, page: result.page, pageSize: result.pageSize };
  } catch (err) {
    console.error("[wikiDb] 查询文档列表失败", err);
    throw new Error(t("db.readWikiListFailed"));
  }
}

/**
 * 获取单条 Wiki 文档
 */
export async function getWikiDoc(id: number): Promise<WikiDocument | undefined> {
  try {
    return await db.wikiDocs.get(id);
  } catch (err) {
    console.error("[wikiDb] 获取文档详情失败", err);
    throw new Error(t("db.readWikiFailed"));
  }
}

/**
 * 保存 Wiki 文档（新增或更新）
 * 自动维护 savedAt（首次创建）和 updatedAt（每次保存）
 */
export async function saveWikiDoc(doc: WikiDocument): Promise<number> {
  try {
    const now = Date.now();
    if (doc.id != null) {
      // 更新：保留原 savedAt，更新 updatedAt
      await db.wikiDocs.update(doc.id, { ...doc, updatedAt: now });
      invalidateTagCache();
      return doc.id;
    }
    // 新增：设置 savedAt 和 updatedAt
    const newDoc = { ...doc, savedAt: now, updatedAt: now };
    const id = await db.wikiDocs.add(newDoc);
    invalidateTagCache();
    return id;
  } catch (err) {
    console.error("[wikiDb] 保存文档失败", err);
    throw new Error(t("db.saveWikiFailed"));
  }
}

/**
 * 删除 Wiki 文档（级联删除关联的 wikiLinks）
 */
export async function deleteWikiDoc(id: number): Promise<void> {
  try {
    return await db.transaction("rw", db.wikiDocs, db.wikiLinks, async () => {
      // 删除以该文档为源或目标的链接
      await db.wikiLinks
        .where("sourceDocId")
        .equals(id)
        .delete();
      await db.wikiLinks
        .where("targetDocId")
        .equals(id)
        .delete();
      // 删除文档本身
      await db.wikiDocs.delete(id);
    });
  } catch (err) {
    console.error("[wikiDb] 删除文档失败", err);
    throw new Error(t("db.deleteWikiFailed"));
  } finally {
    invalidateTagCache();
  }
}

/**
 * 获取某人物下所有已使用的标签（用于 tag 筛选下拉）
 * 使用内存缓存避免每次全表扫描；写入/删除后自动失效
 */
export async function getAllWikiTags(personId: number): Promise<string[]> {
  try {
    return await tagCache.get(personId);
  } catch (err) {
    console.error("[wikiDb] 获取标签列表失败", err);
    return [];
  }
}

/**
 * 获取文档的正向链接目标文档 ID 列表
 * @param docId 源文档 ID
 * @returns 目标文档 ID 数组
 */
export async function getWikiLinks(docId: number): Promise<number[]> {
  try {
    const links = await db.wikiLinks
      .where("sourceDocId")
      .equals(docId)
      .toArray();
    return links.map((l) => l.targetDocId);
  } catch (err) {
    console.error("[wikiDb] 获取文档链接失败", err);
    return [];
  }
}

/**
 * 获取文档的反向链接源文档 ID 列表（谁链接到了本文档）
 * @param docId 目标文档 ID
 * @returns 源文档 ID 数组
 */
export async function getWikiBacklinks(docId: number): Promise<number[]> {
  try {
    const links = await db.wikiLinks
      .where("targetDocId")
      .equals(docId)
      .toArray();
    return links.map((l) => l.sourceDocId);
  } catch (err) {
    console.error("[wikiDb] 获取反向链接失败", err);
    return [];
  }
}

/**
 * 保存文档的链接关系（先删除旧链接，再插入新链接）
 * @param sourceDocId 源文档 ID
 * @param targetDocIds 目标文档 ID 数组
 */
export async function saveWikiLinks(
  sourceDocId: number,
  targetDocIds: number[]
): Promise<void> {
  try {
    return await db.transaction("rw", db.wikiLinks, async () => {
      // 删除该源文档的所有旧链接
      await db.wikiLinks
        .where("sourceDocId")
        .equals(sourceDocId)
        .delete();
      // 插入新链接
      if (targetDocIds.length > 0) {
        const newLinks: WikiLink[] = targetDocIds.map((targetDocId) => ({
          sourceDocId,
          targetDocId,
        }));
        await db.wikiLinks.bulkAdd(newLinks);
      }
    });
  } catch (err) {
    console.error("[wikiDb] 保存文档链接失败", err);
    throw new Error(t("db.saveWikiLinkFailed"));
  }
}
