/**
 * 调试 API - Wiki 相关接口
 *
 * 包含：WikiList, WikiCreate, WikiView
 */

import type { WikiDocument } from "./types";
import type { WikiListFilters } from "../wikiDb";
import {
  listWikiDocs,
  getWikiDoc,
  saveWikiDoc as saveWikiDocToDb,
  getWikiLinks,
  getWikiBacklinks,
  saveWikiLinks,
} from "../wikiDb";
import { getPerson } from "../personDb";
import { log, timer } from "./logger";
import { WikiError, wrapError, ApiErrorCode } from "./errors";
import {
  getSelectPerson,
  getGetWikiList,
  getSetWikiListFilters,
  getOpenWikiEditor,
  getSaveWikiDoc,
  getSelectWikiDoc,
  getGetSelectedWikiDoc,
} from "./callbacks";
import { resolvePersonId } from "./person";
import {
  waitForStateUpdate,
  navigateToPage,
  selectPersonAndWait,
  waitForDialogReady,
  waitForWikiCallbacks,
  waitForDocSaved,
} from "./helpers";
import type {
  WikiOptions,
  WikiViewResult,
  WikiCreateParams,
  WikiListParams,
  WikiViewParams,
} from "./types";
import {
  validateDocId,
  validateNonEmptyString,
  validateTags,
  validatePagination,
  validateIdArray,
} from "./validate";

/**
 * Wiki 文档列表调试接口——查询文档列表。
 *
 * skipUI=true 时：跳过所有 UI 操控，直接查询数据库。
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 查询参数（使用统一的 WikiListParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns Wiki 文档列表，包含 docs 数组和 total 总数
 * @throws WikiError 分页参数无效时（errorCode: INVALID_INPUT）
 *
 * @example
 * ```typescript
 * // 基本查询
 * const { docs, total } = await window.peep.WikiList({});
 *
 * // 搜索 + 标签过滤
 * const { docs, total } = await window.peep.WikiList({
 *   searchText: '紫微',
 *   tags: ['格局']
 * });
 * ```
 */
export async function WikiList(
  params: WikiListParams,
  options?: WikiOptions,
): Promise<{ docs: WikiDocument[]; total: number }> {
  const stop = timer("WikiList");
  try {
    // 参数验证
    validateTags(params.tags, "WikiList", WikiError);
    validatePagination(params, "WikiList", WikiError);

    const personId = await resolvePersonId(params.personId);
    log("info", "WikiList", "查询文档列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
      skipUI: !!options?.skipUI,
    });

    const filters: WikiListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const result = await listWikiDocs(personId, filters);
      log("info", "WikiList", "skipUI 模式查询成功", {
        total: result.total,
        returned: result.docs.length,
      });
      stop();
      return { docs: result.docs, total: result.total };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const selectPerson = getSelectPerson();
    const getWikiList = getGetWikiList();
    const setWikiListFilters = getSetWikiListFilters();

    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!selectPerson || !getWikiList) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiList", {
        context: {
          selectPersonReady: !!selectPerson,
          getWikiListReady: !!getWikiList,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (setWikiListFilters && (params.searchText || params.tags || params.page)) {
      setWikiListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      // 等待 UI 状态更新完成
      await waitForStateUpdate();
    }

    // 3. 获取列表
    const result = await getWikiList(filters);

    log("info", "WikiList", "查询成功", { total: result.total, returned: result.docs.length });
    stop();
    return { docs: result.docs, total: result.total };
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiList", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiList", "执行失败", err);
    stop();
    throw wrapError("WikiList", err, WikiError);
  }
}

/**
 * Wiki 文档创建调试接口——创建文档。
 *
 * skipUI=true 时：跳过所有 UI 操控，直接写入数据库。
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 文档参数（使用统一的 WikiCreateParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 创建的文档对象，包含分配的 id
 * @throws WikiError title/content 为空时（errorCode: INVALID_INPUT）
 * @throws WikiError 人物不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * const doc = await window.peep.WikiCreate({
 *   title: '紫府同宫格',
 *   content: '# 紫府同宫格\\n\\n紫府同宫是...',
 *   tags: ['格局', '紫微']
 * });
 * ```
 */
export async function WikiCreate(
  params: WikiCreateParams,
  options?: WikiOptions,
): Promise<WikiDocument> {
  const stop = timer("WikiCreate");
  try {
    // 参数验证
    validateNonEmptyString(params.title, "title", "WikiCreate", WikiError);
    validateNonEmptyString(params.content, "content", "WikiCreate", WikiError);
    validateTags(params.tags, "WikiCreate", WikiError);
    validateIdArray(params.linkTargetIds, "linkTargetIds", "WikiCreate", WikiError);

    const personId = await resolvePersonId(params.personId);
    log("info", "WikiCreate", "创建文档", {
      personId,
      title: params.title,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接写入数据库，不操控 UI ── */
    if (options?.skipUI) {
      // 验证人物存在
      const personCheck = await getPerson(personId);
      if (!personCheck) {
        throw new WikiError(`人物 ${personId} 不存在`, "WikiCreate", {
          context: { personId },
          suggestion: "请检查人物 ID 是否正确。可调用 PersonList() 查看可用的人物列表",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }

      // 构造文档并写入数据库
      const now = Date.now();
      const doc: WikiDocument = {
        personId,
        title: params.title,
        content: params.content,
        tags: params.tags || [],
        savedAt: now,
        updatedAt: now,
      };

      const id = await saveWikiDocToDb(doc);

      // 保存链接关系（如果有）
      if (params.linkTargetIds && params.linkTargetIds.length > 0) {
        await saveWikiLinks(id, params.linkTargetIds);
      }

      // 验证文档已保存
      await waitForDocSaved(id, 2000);

      log("info", "WikiCreate", "skipUI 模式创建成功", { docId: id });
      stop();
      return { ...doc, id };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const selectPerson = getSelectPerson();
    const openWikiEditor = getOpenWikiEditor();
    const saveWikiDoc = getSaveWikiDoc();

    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!selectPerson || !openWikiEditor || !saveWikiDoc) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiCreate", {
        context: {
          selectPersonReady: !!selectPerson,
          openWikiEditorReady: !!openWikiEditor,
          saveWikiDocReady: !!saveWikiDoc,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 打开编辑器
    openWikiEditor();
    // 等待 Dialog DOM 渲染完成（双 rAF 替代盲等）
    await waitForDialogReady();

    // 3. 构造文档并保存
    const now = Date.now();
    const doc: WikiDocument = {
      personId,
      title: params.title,
      content: params.content,
      tags: params.tags || [],
      savedAt: now,
      updatedAt: now,
    };

    const saved = await saveWikiDoc(doc, params.linkTargetIds || []);

    // 4. 等待保存完成并验证文档存在
    await waitForDocSaved(saved.id, 2000);

    log("info", "WikiCreate", "创建成功", { docId: saved.id });
    stop();
    return saved;
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiCreate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiCreate", "执行失败", err);
    stop();
    throw wrapError("WikiCreate", err, WikiError);
  }
}

/**
 * Wiki 文档详情调试接口——查看文档详情。
 *
 * skipUI=true 时：直接查询数据库获取文档，并查询链接关系。
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 查看参数（使用统一的 WikiViewParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 文档详情，包含正文、正向链接和可选的反向链接
 * @throws WikiError docId 无效时（errorCode: INVALID_INPUT）
 * @throws WikiError 文档不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 基本查看
 * const doc = await window.peep.WikiView({ docId: 456 });
 * console.log("标题:", doc.title);
 * console.log("正文:", doc.content);
 *
 * // 含反向链接
 * const doc = await window.peep.WikiView({ docId: 456, includeBacklinks: true });
 * console.log("反向链接:", doc.backlinkSourceIds);
 * ```
 */
export async function WikiView(
  params: WikiViewParams,
  options?: WikiOptions,
): Promise<WikiViewResult> {
  const stop = timer("WikiView");
  try {
    // 参数验证
    validateDocId(params.docId, "WikiView");

    const personId = await resolvePersonId(params.personId);
    log("info", "WikiView", "查看文档", {
      personId,
      docId: params.docId,
      includeBacklinks: !!params.includeBacklinks,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const doc = await getWikiDoc(params.docId);
      if (!doc) {
        throw new WikiError(`文档 ${params.docId} 不存在`, "WikiView", {
          context: { docId: params.docId },
          suggestion: "请检查文档 ID 是否正确，该文档可能已被删除。可调用 WikiList() 查看可用文档",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }

      // 查询正向链接目标 ID
      const linkTargetIds = doc.id ? await getWikiLinks(doc.id) : [];

      // 可选：查询反向链接源 ID
      let backlinkSourceIds: number[] | undefined;
      if (params.includeBacklinks && doc.id) {
        backlinkSourceIds = await getWikiBacklinks(doc.id);
      }

      log("info", "WikiView", "skipUI 模式查看成功", {
        docId: doc.id,
        links: linkTargetIds.length,
        backlinks: backlinkSourceIds?.length ?? 0,
      });
      stop();
      return { ...doc, linkTargetIds, backlinkSourceIds };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const selectPerson = getSelectPerson();
    const selectWikiDoc = getSelectWikiDoc();
    const getSelectedWikiDoc = getGetSelectedWikiDoc();

    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    if (!selectPerson || !selectWikiDoc || !getSelectedWikiDoc) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiView", {
        context: {
          selectPersonReady: !!selectPerson,
          selectWikiDocReady: !!selectWikiDoc,
          getSelectedWikiDocReady: !!getSelectedWikiDoc,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 打开指定文档（selectWikiDoc 直接返回文档数据）
    const doc = await selectWikiDoc(params.docId);
    await waitForStateUpdate();

    // 3. 获取详情（优先使用 selectWikiDoc 返回值，回退到 getSelectedWikiDoc）
    const selectedDoc = doc ?? getSelectedWikiDoc();
    if (!selectedDoc) {
      throw new WikiError(`文档 ${params.docId} 未找到或加载失败`, "WikiView", {
        context: { docId: params.docId, selectWikiDocReturned: !!doc },
        suggestion: "请检查文档 ID 是否正确，或尝试刷新页面后重试",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 4. 查询正向链接目标 ID，附加到返回结果
    const linkTargetIds = selectedDoc.id ? await getWikiLinks(selectedDoc.id) : [];

    // 5. 可选：查询反向链接源 ID
    let backlinkSourceIds: number[] | undefined;
    if (params.includeBacklinks && selectedDoc.id) {
      backlinkSourceIds = await getWikiBacklinks(selectedDoc.id);
    }

    log("info", "WikiView", "查看成功", {
      docId: selectedDoc.id,
      links: linkTargetIds.length,
      backlinks: backlinkSourceIds?.length ?? 0,
    });
    stop();
    return { ...selectedDoc, linkTargetIds, backlinkSourceIds };
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiView", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiView", "执行失败", err);
    stop();
    throw wrapError("WikiView", err, WikiError);
  }
}
