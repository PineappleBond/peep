/**
 * 调试 API - Wiki 相关接口
 *
 * 包含：WikiList, WikiCreate, WikiView, WikiLink, WikiDelete
 */

import type { WikiDocument } from "./types";
import type { WikiListFilters } from "../wikiDb";
import {
  listWikiDocs,
  getWikiDoc,
  saveWikiDoc as saveWikiDocToDb,
  deleteWikiDoc,
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
  getUiState,
  updateUiState,
} from "./helpers";
import type {
  WikiOptions,
  WikiViewResult,
  WikiCreateParams,
  WikiUpdateParams,
  WikiListParams,
  WikiViewParams,
  WikiLinkParams,
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
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const getWikiList = getGetWikiList();
    const setWikiListFilters = getSetWikiListFilters();

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
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const openWikiEditor = getOpenWikiEditor();
    const saveWikiDoc = getSaveWikiDoc();

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
 * Wiki 文档更新调试接口——更新已有文档。
 *
 * skipUI=true 时：直接更新数据库，不操控 UI。
 * skipUI=false 时（默认）：执行完整 UI 流程（导航、选择、保存）。
 *
 * @param params 更新参数（使用 WikiUpdateParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 更新后的文档对象
 * @throws WikiError docId 无效时（errorCode: INVALID_INPUT）
 * @throws WikiError 文档不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 更新标题和标签
 * const doc = await window.peep.WikiUpdate({
 *   docId: 123,
 *   title: '新标题',
 *   tags: ['格局', '紫微']
 * });
 *
 * // 更新内容
 * const doc = await window.peep.WikiUpdate({
 *   docId: 123,
 *   content: '# 更新后的内容\n\n...'
 * });
 * ```
 */
export async function WikiUpdate(
  params: WikiUpdateParams,
  options?: WikiOptions,
): Promise<WikiDocument> {
  const stop = timer("WikiUpdate");
  try {
    // 参数验证
    validateDocId(params.docId, "WikiUpdate");

    const personId = await resolvePersonId(params.personId);
    log("info", "WikiUpdate", "更新文档", {
      personId,
      docId: params.docId,
      skipUI: !!options?.skipUI,
      updateFields: {
        title: params.title !== undefined,
        content: params.content !== undefined,
        tags: params.tags !== undefined,
        linkTargetIds: params.linkTargetIds !== undefined,
      },
    });

    /* ── skipUI 模式：直接更新数据库，不操控 UI ── */
    if (options?.skipUI) {
      // 获取原文档
      const existingDoc = await getWikiDoc(params.docId);
      if (!existingDoc) {
        throw new WikiError(`文档 ${params.docId} 不存在`, "WikiUpdate", {
          context: { docId: params.docId },
          suggestion: "请检查文档 ID 是否正确，该文档可能已被删除。可调用 WikiList() 查看可用文档",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }

      // 合并更新字段
      const now = Date.now();
      const updatedDoc: WikiDocument = {
        ...existingDoc,
        title: params.title ?? existingDoc.title,
        content: params.content ?? existingDoc.content,
        tags: params.tags ?? existingDoc.tags,
        updatedAt: now,
      };

      // 验证标题非空
      if (!updatedDoc.title || !updatedDoc.title.trim()) {
        throw new WikiError("title 不能为空", "WikiUpdate", {
          context: { docId: params.docId },
          suggestion: "请提供有效的文档标题",
          errorCode: ApiErrorCode.INVALID_INPUT,
        });
      }

      // 保存更新
      await saveWikiDocToDb(updatedDoc);

      // 更新链接关系（如果提供了）
      if (params.linkTargetIds !== undefined) {
        await saveWikiLinks(params.docId, params.linkTargetIds);
      }

      // 验证更新成功
      await waitForDocSaved(params.docId, 2000);

      log("info", "WikiUpdate", "skipUI 模式更新成功", { docId: params.docId });
      stop();
      return updatedDoc;
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const selectWikiDoc = getSelectWikiDoc();
    const getSelectedWikiDoc = getGetSelectedWikiDoc();
    const saveWikiDoc = getSaveWikiDoc();

    if (!selectPerson || !selectWikiDoc || !getSelectedWikiDoc || !saveWikiDoc) {
      throw new WikiError("Wiki 调试 API 未初始化", "WikiUpdate", {
        context: {
          selectPersonReady: !!selectPerson,
          selectWikiDocReady: !!selectWikiDoc,
          getSelectedWikiDocReady: !!getSelectedWikiDoc,
          saveWikiDocReady: !!saveWikiDoc,
        },
        suggestion: "请确认 WikiPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 选择要更新的文档
    await selectWikiDoc(params.docId);
    updateUiState({ wikiDocId: params.docId });
    await waitForStateUpdate();

    // 3. 获取当前文档内容
    const currentDoc = getSelectedWikiDoc();
    if (!currentDoc) {
      throw new WikiError(`文档 ${params.docId} 未找到或加载失败`, "WikiUpdate", {
        context: { docId: params.docId },
        suggestion: "请检查文档 ID 是否正确，或尝试刷新页面后重试",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 4. 构造更新后的文档
    const now = Date.now();
    const updatedDoc: WikiDocument = {
      ...currentDoc,
      title: params.title ?? currentDoc.title,
      content: params.content ?? currentDoc.content,
      tags: params.tags ?? currentDoc.tags,
      updatedAt: now,
    };

    // 验证标题非空
    if (!updatedDoc.title || !updatedDoc.title.trim()) {
      throw new WikiError("title 不能为空", "WikiUpdate", {
        context: { docId: params.docId },
        suggestion: "请提供有效的文档标题",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }

    // 5. 保存更新
    const saved = await saveWikiDoc(updatedDoc, params.linkTargetIds ?? []);

    // 6. 等待保存完成
    await waitForDocSaved(params.docId, 2000);

    log("info", "WikiUpdate", "更新成功", { docId: saved.id });
    stop();
    return saved;
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiUpdate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiUpdate", "执行失败", err);
    stop();
    throw wrapError("WikiUpdate", err, WikiError);
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
    // 跳转到 /wiki 页面并等待回调注册
    await navigateToPage("/wiki", "wiki");
    await waitForWikiCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const selectWikiDoc = getSelectWikiDoc();
    const getSelectedWikiDoc = getGetSelectedWikiDoc();

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

    // 2. 检查是否已选中目标文档（性能优化：避免重复选择）
    const currentUiState = getUiState();
    const isSameDoc = currentUiState.currentWikiDocId === params.docId;

    let doc: WikiDocument | null | undefined;
    if (!isSameDoc) {
      // 打开指定文档（selectWikiDoc 直接返回文档数据）
      doc = await selectWikiDoc(params.docId);
      // 更新 UI 状态追踪
      updateUiState({ wikiDocId: params.docId });
    } else {
      // 已选中目标文档，使用当前选中的文档
      log("debug", "WikiView", "已选中目标文档，跳过选择", { docId: params.docId });
      doc = getSelectedWikiDoc();
    }

    // 3. 等待 UI 更新（仅在切换文档时等待）
    if (!isSameDoc) {
      await waitForStateUpdate();
    }

    // 4. 获取详情（优先使用 selectWikiDoc 返回值，回退到 getSelectedWikiDoc）
    const selectedDoc = doc ?? getSelectedWikiDoc();
    if (!selectedDoc) {
      throw new WikiError(`文档 ${params.docId} 未找到或加载失败`, "WikiView", {
        context: { docId: params.docId, selectWikiDocReturned: !!doc },
        suggestion: "请检查文档 ID 是否正确，或尝试刷新页面后重试",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 5. 查询正向链接目标 ID，附加到返回结果
    const linkTargetIds = selectedDoc.id ? await getWikiLinks(selectedDoc.id) : [];

    // 6. 可选：查询反向链接源 ID
    let backlinkSourceIds: number[] | undefined;
    if (params.includeBacklinks && selectedDoc.id) {
      backlinkSourceIds = await getWikiBacklinks(selectedDoc.id);
    }

    log("info", "WikiView", "查看成功", {
      docId: selectedDoc.id,
      links: linkTargetIds.length,
      backlinks: backlinkSourceIds?.length ?? 0,
      skippedUI: isSameDoc,
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

/**
 * Wiki 关联管理调试接口——为已存在的文档建立关联关系。
 *
 * 支持两种模式：
 * - 替换模式（默认）：清除源文档的所有现有链接，重新建立指定链接
 * - 追加模式：在现有链接基础上追加新链接
 *
 * skipUI=true 时：直接操作数据库，不操控 UI。
 * skipUI=false 时（默认）：当前仅支持 skipUI 模式，UI 模式待实现。
 *
 * @param params 关联参数（使用 WikiLinkParams 类型）
 * @param options 可选配置项（目前仅支持 skipUI=true）
 * @returns 操作结果，包含源文档 ID 和最终的目标文档 ID 列表
 * @throws WikiError sourceDocId 或 targetDocIds 无效时（errorCode: INVALID_INPUT）
 * @throws WikiError 文档不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 替换模式：清除文档 1 的所有链接，建立到文档 2,3,4 的链接
 * await window.peep.WikiLink({
 *   sourceDocId: 1,
 *   targetDocIds: [2, 3, 4]
 * }, { skipUI: true });
 *
 * // 追加模式：在文档 1 现有链接基础上追加到文档 5 的链接
 * await window.peep.WikiLink({
 *   sourceDocId: 1,
 *   targetDocIds: [5],
 *   append: true
 * }, { skipUI: true });
 * ```
 */
export async function WikiLink(
  params: WikiLinkParams,
  options?: WikiOptions,
): Promise<{ sourceDocId: number; targetDocIds: number[] }> {
  const stop = timer("WikiLink");
  try {
    // 参数验证
    validateDocId(params.sourceDocId, "WikiLink");
    validateIdArray(params.targetDocIds, "targetDocIds", "WikiLink", WikiError);

    if (!options?.skipUI) {
      throw new WikiError("WikiLink 当前仅支持 skipUI=true 模式", "WikiLink", {
        context: { skipUI: false },
        suggestion: "请使用 { skipUI: true } 选项调用 WikiLink",
        errorCode: ApiErrorCode.NOT_IMPLEMENTED,
      });
    }

    const personId = await resolvePersonId(params.personId);
    log("info", "WikiLink", "管理文档关联", {
      personId,
      sourceDocId: params.sourceDocId,
      targetDocIds: params.targetDocIds,
      append: !!params.append,
    });

    // 验证源文档存在
    const sourceDoc = await getWikiDoc(params.sourceDocId);
    if (!sourceDoc) {
      throw new WikiError(`源文档 ${params.sourceDocId} 不存在`, "WikiLink", {
        context: { sourceDocId: params.sourceDocId },
        suggestion: "请检查源文档 ID 是否正确，该文档可能已被删除。可调用 WikiList() 查看可用文档",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 验证所有目标文档存在
    for (const targetId of params.targetDocIds) {
      const targetDoc = await getWikiDoc(targetId);
      if (!targetDoc) {
        throw new WikiError(`目标文档 ${targetId} 不存在`, "WikiLink", {
          context: { sourceDocId: params.sourceDocId, targetDocId: targetId },
          suggestion: `目标文档 ${targetId} 不存在，请检查 ID 是否正确`,
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }
    }

    // 确定最终的链接列表
    let finalTargetIds: number[];
    if (params.append) {
      // 追加模式：获取现有链接，合并新链接（去重）
      const existingLinks = await getWikiLinks(params.sourceDocId);
      const linkSet = new Set([...existingLinks, ...params.targetDocIds]);
      finalTargetIds = Array.from(linkSet);
    } else {
      // 替换模式：直接使用新链接
      finalTargetIds = [...params.targetDocIds];
    }

    // 保存链接关系
    await saveWikiLinks(params.sourceDocId, finalTargetIds);

    log("info", "WikiLink", "关联管理成功", {
      sourceDocId: params.sourceDocId,
      targetDocIds: finalTargetIds,
      count: finalTargetIds.length,
    });

    stop();
    return {
      sourceDocId: params.sourceDocId,
      targetDocIds: finalTargetIds,
    };
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiLink", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiLink", "执行失败", err);
    stop();
    throw wrapError("WikiLink", err, WikiError);
  }
}

/**
 * Wiki 文档删除调试接口——删除指定文档。
 *
 * 仅支持 skipUI=true 模式（删除操作无需 UI 交互）。
 *
 * @param params 删除参数
 * @param options 可选配置项（仅支持 skipUI=true）
 * @throws WikiError docId 无效时（errorCode: INVALID_INPUT）
 * @throws WikiError 文档不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * await window.peep.WikiDelete({ docId: 123 }, { skipUI: true });
 * ```
 */
export async function WikiDelete(params: { docId: number }, options?: WikiOptions): Promise<void> {
  const stop = timer("WikiDelete");
  try {
    validateDocId(params.docId, "WikiDelete");

    if (!options?.skipUI) {
      throw new WikiError("WikiDelete 当前仅支持 skipUI=true 模式", "WikiDelete", {
        context: { skipUI: false },
        suggestion: "请使用 { skipUI: true } 选项调用 WikiDelete",
        errorCode: ApiErrorCode.NOT_IMPLEMENTED,
      });
    }

    log("info", "WikiDelete", "删除文档", { docId: params.docId });

    // 验证文档存在
    const doc = await getWikiDoc(params.docId);
    if (!doc) {
      throw new WikiError(`文档 ${params.docId} 不存在`, "WikiDelete", {
        context: { docId: params.docId },
        suggestion: "请检查文档 ID 是否正确，该文档可能已被删除。可调用 WikiList() 查看可用文档",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    await deleteWikiDoc(params.docId);

    log("info", "WikiDelete", "删除成功", { docId: params.docId });
    stop();
  } catch (err) {
    if (err instanceof WikiError) {
      log("error", "WikiDelete", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "WikiDelete", "执行失败", err);
    stop();
    throw wrapError("WikiDelete", err, WikiError);
  }
}
