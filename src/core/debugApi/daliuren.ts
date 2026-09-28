/**
 * 调试 API - 大六壬相关接口
 *
 * 包含：computeDaLiuRenData, DaLiuRen, DaLiuRenCreate, DaLiuRenList, DaLiuRenView
 */

import type { LiurenRecord, DaLiuRenResult } from "./types";
import type { LiurenListFilters } from "../daliurenDb";
import { calculateDaLiuRen } from "../daliuren/calculator";
import {
  getLiurenRecord,
  listLiurenRecords,
  saveLiurenRecord,
  deleteLiurenRecord,
  invalidateLiurenTagCache,
} from "../daliurenDb";
import { getPerson } from "../personDb";
import { log, timer } from "./logger";
import { DaLiuRenError, wrapError, ApiErrorCode } from "./errors";
import {
  getSelectPerson,
  getGetDaLiuRenList,
  getSetListFilters,
  getOpenCreateDialog,
  getFillCreateForm,
  getSubmitCreateForm,
  getSelectRecord,
  getGetSelectedRecord,
  getGetPerson,
} from "./callbacks";
import { resolvePersonId } from "./person";
import {
  nextFrame,
  waitForStateUpdate,
  navigateToPage,
  selectPersonAndWait,
  waitForDialogReady,
  waitForDaLiuRenCallbacks,
  waitForRecordSaved,
  getUiState,
  updateUiState,
} from "./helpers";
import { parseDate } from "./ziwei";
import type {
  DaLiuRenComputedData,
  DaLiuRenOptions,
  DaLiuRenViewResult,
  DaLiuRenCreateParams,
  DaLiuRenListParams,
  DaLiuRenViewParams,
} from "./types";
import {
  validateRecordId,
  validateNonEmptyString,
  validateTags,
  validatePagination,
} from "./validate";

/**
 * 纯计算函数：大六壬排盘（不操控 UI，不依赖 React 状态）。
 *
 * 对 calculateDaLiuRen 的薄包装：增加日志、计时、DaLiuRenError 错误处理。
 * 可在任意上下文调用（RTC Agent、自动化测试、控制台调试）。
 *
 * @param date 公历日期（YYYY-MM-DD 或 YYYY/MM/DD）
 * @param time 时间（HH:mm 或 HH:mm:ss）
 * @param fateInput 可选：生年与性别（用于计算命宫行年）
 * @returns 完整大六壬排盘结果
 * @throws DaLiuRenError 排盘失败时抛出，包含输入上下文和恢复建议
 */
export function computeDaLiuRenData(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" },
): DaLiuRenResult {
  const stop = timer("computeDaLiuRenData");
  try {
    log("info", "computeDaLiuRenData", "纯计算排盘", { date, time, fateInput });
    const result = calculateDaLiuRen(date, time, fateInput);
    log("info", "computeDaLiuRenData", "排盘成功", {
      calculationTime: result.calculationTime,
      hasFate: !!result.fate,
    });
    stop();
    return result;
  } catch (err) {
    stop();
    if (err instanceof DaLiuRenError) throw err;
    log("error", "computeDaLiuRenData", "排盘失败", err);
    throw new DaLiuRenError("大六壬排盘计算失败", "computeDaLiuRenData", {
      context: { date, time, fateInput },
      suggestion: "请检查日期格式（YYYY-MM-DD）和时间格式（HH:mm 或 HH:mm:ss）是否正确",
      cause: err,
    });
  }
}

/**
 * 大六壬排盘调试接口（向后兼容）
 *
 * 直接调用 computeDaLiuRenData 纯计算函数。
 * 保留原签名以兼容已有调用方，推荐新代码直接使用 computeDaLiuRenData。
 */
export function DaLiuRen(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" },
): DaLiuRenResult {
  return computeDaLiuRenData(date, time, fateInput);
}

/**
 * 大六壬起课调试接口——创建起课记录。
 *
 * skipUI=true 时：跳过所有 UI 操控，直接计算排盘结果并写入数据库。
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 起课参数（使用统一的 DaLiuRenCreateParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 创建后的起课记录，包含 id 和完整排盘结果
 * @throws DaLiuRenError question 为空时（errorCode: INVALID_INPUT）
 * @throws DaLiuRenError 人物不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 默认人物起课
 * const record = await window.peep.DaLiuRenCreate({ question: '这笔生意能不能做？' });
 *
 * // 指定人物 + 标签
 * const record = await window.peep.DaLiuRenCreate({
 *   personId: 1,
 *   question: '考试能否通过？',
 *   tags: ['考试', '学业']
 * });
 * ```
 */
export async function DaLiuRenCreate(
  params: DaLiuRenCreateParams,
  options?: DaLiuRenOptions,
): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenCreate");
  try {
    // 参数验证
    validateNonEmptyString(params.question, "question", "DaLiuRenCreate", DaLiuRenError);
    validateTags(params.tags, "DaLiuRenCreate", DaLiuRenError);

    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenCreate", "开始创建起课", {
      personId,
      question: params.question,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：纯计算 + DB 写入，不操控 UI ── */
    if (options?.skipUI) {
      // 验证人物存在
      const personCheck = await getPerson(personId);
      if (!personCheck) {
        throw new DaLiuRenError(`人物 ${personId} 不存在`, "DaLiuRenCreate", {
          context: { personId },
          suggestion: "请检查人物 ID 是否正确。可调用 PersonList() 查看可用的人物列表",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }

      // 计算排盘结果（有自定义时间则用之，否则用当前时间）
      const parsed = params.calculationTime ? parseDate(params.calculationTime) : new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
      const calcResult = computeDaLiuRenData(date, time);
      const calculationTime = `${date} ${time}`;

      // 构造记录并写入数据库
      const record: LiurenRecord = {
        personId,
        calculationTime,
        question: params.question,
        note: params.note ?? "",
        background: params.background ?? "",
        tags: params.tags ?? [],
        result: calcResult,
        savedAt: Date.now(),
      };
      const id = await saveLiurenRecord(record);
      invalidateLiurenTagCache();

      log("info", "DaLiuRenCreate", "skipUI 模式创建成功", { recordId: id });
      stop();
      return { ...record, id };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");
    await waitForDaLiuRenCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const openCreateDialog = getOpenCreateDialog();
    const fillCreateForm = getFillCreateForm();
    const submitCreateForm = getSubmitCreateForm();

    if (!selectPerson || !openCreateDialog || !fillCreateForm || !submitCreateForm) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenCreate", {
        context: {
          selectPersonReady: !!selectPerson,
          openCreateDialogReady: !!openCreateDialog,
          fillCreateFormReady: !!fillCreateForm,
          submitCreateFormReady: !!submitCreateForm,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 填写表单（在打开 Dialog 之前设置初始数据）
    fillCreateForm({
      question: params.question,
      note: params.note ?? "",
      background: params.background ?? "",
      tags: params.tags ?? [],
    });
    // 等待表单状态更新完成（双 rAF 替代盲等）
    await nextFrame();
    await nextFrame();

    // 3. 打开新建 Dialog（Dialog 打开时会读取已设置的初始数据）
    openCreateDialog();
    // 等待 Dialog DOM 渲染完成（轮询检测替代盲等）
    await waitForDialogReady();

    // 4. 提交表单
    const record = await submitCreateForm();

    // 5. 等待保存完成并验证记录存在
    await waitForRecordSaved(record.id, 2000);

    log("info", "DaLiuRenCreate", "创建成功", { recordId: record.id });
    stop();
    return record;
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      log("error", "DaLiuRenCreate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "DaLiuRenCreate", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenCreate", err, DaLiuRenError);
  }
}

/**
 * 大六壬起课列表调试接口——查询起课记录列表。
 *
 * skipUI=true 时：直接查询数据库，不导航页面、不切换人物。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 设置 UI 过滤条件 + 查询。
 *
 * @param params 查询参数（使用统一的 DaLiuRenListParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 起课记录列表，包含 records 数组和 total 总数
 * @throws DaLiuRenError 分页参数无效时（errorCode: INVALID_INPUT）
 *
 * @example
 * ```typescript
 * // 基本查询
 * const { records, total } = await window.peep.DaLiuRenList({});
 *
 * // 搜索 + 分页
 * const { records, total } = await window.peep.DaLiuRenList({
 *   searchText: '合作',
 *   page: 1,
 *   pageSize: 10
 * });
 * ```
 */
export async function DaLiuRenList(
  params: DaLiuRenListParams,
  options?: DaLiuRenOptions,
): Promise<{ records: LiurenRecord[]; total: number }> {
  const stop = timer("DaLiuRenList");
  try {
    // 参数验证
    validateTags(params.tags, "DaLiuRenList", DaLiuRenError);
    validatePagination(params, "DaLiuRenList", DaLiuRenError);

    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenList", "查询列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
      skipUI: !!options?.skipUI,
    });

    const filters: LiurenListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const result = await listLiurenRecords(personId, filters);
      log("info", "DaLiuRenList", "skipUI 模式查询成功", {
        total: result.total,
        returned: result.records.length,
      });
      stop();
      return { records: result.records, total: result.total };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");
    await waitForDaLiuRenCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const getDaLiuRenList = getGetDaLiuRenList();
    const setListFilters = getSetListFilters();

    if (!selectPerson || !getDaLiuRenList) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenList", {
        context: {
          selectPersonReady: !!selectPerson,
          getDaLiuRenListReady: !!getDaLiuRenList,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 设置 UI 过滤条件（同步搜索框和标签筛选的显示状态）
    if (setListFilters && (params.searchText || params.tags || params.page)) {
      setListFilters({
        searchText: params.searchText,
        tags: params.tags,
        page: params.page,
      });
      // 等待 UI 状态更新完成
      await waitForStateUpdate();
    }

    // 3. 获取列表
    const result = await getDaLiuRenList(filters);

    log("info", "DaLiuRenList", "查询成功", {
      total: result.total,
      returned: result.records.length,
    });
    stop();
    return { records: result.records, total: result.total };
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenList", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenList", err, DaLiuRenError);
  }
}

/**
 * 大六壬起课详情调试接口——查看单条起课记录。
 *
 * skipUI=true 时：直接查询数据库获取记录，并附带纯计算数据。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 选择记录 + 返回详情。
 *
 * @param params 查看参数（使用统一的 DaLiuRenViewParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 起课记录详情，包含完整排盘结果
 * @throws DaLiuRenError recordId 无效时（errorCode: INVALID_INPUT）
 * @throws DaLiuRenError 记录不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * const detail = await window.peep.DaLiuRenView({ recordId: 123 });
 * console.log("问题:", detail.question);
 * console.log("四课:", detail.result.siKe);
 * ```
 */
export async function DaLiuRenView(
  params: DaLiuRenViewParams,
  options?: DaLiuRenOptions,
): Promise<DaLiuRenViewResult> {
  const stop = timer("DaLiuRenView");
  try {
    // 参数验证
    validateRecordId(params.recordId, "DaLiuRenView");

    const personId = await resolvePersonId(params.personId);
    log("info", "DaLiuRenView", "查看详情", {
      personId,
      recordId: params.recordId,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const record = await getLiurenRecord(params.recordId);
      if (!record) {
        throw new DaLiuRenError(`记录 ${params.recordId} 不存在`, "DaLiuRenView", {
          context: { recordId: params.recordId },
          suggestion:
            "请检查记录 ID 是否正确，该记录可能已被删除。可调用 DaLiuRenList() 查看可用记录",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }
      // 附带纯计算数据（验证 result 结构完整性）
      const computed: DaLiuRenComputedData = {
        calculationTime: record.calculationTime,
        result: record.result,
        person: (await getPerson(record.personId)) ?? null,
      };
      log("info", "DaLiuRenView", "skipUI 模式查看成功", { recordId: record.id });
      stop();
      return { ...record, computed };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    // 跳转到 /liuren 页面并等待回调注册
    await navigateToPage("/liuren", "daliuren");
    await waitForDaLiuRenCallbacks();

    // 导航完成后再获取回调
    const selectPerson = getSelectPerson();
    const selectRecord = getSelectRecord();
    const getSelectedRecord = getGetSelectedRecord();
    const getPersonFn = getGetPerson();

    if (!selectPerson || !selectRecord || !getSelectedRecord) {
      throw new DaLiuRenError("大六壬调试 API 未初始化", "DaLiuRenView", {
        context: {
          selectPersonReady: !!selectPerson,
          selectRecordReady: !!selectRecord,
          getSelectedRecordReady: !!getSelectedRecord,
        },
        suggestion: "请确认 DaLiuRenPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 检查是否已选中目标记录（性能优化：避免重复选择）
    const currentUiState = getUiState();
    const isSameRecord = currentUiState.currentDaLiuRenRecordId === params.recordId;

    let record: LiurenRecord | null | undefined;
    if (!isSameRecord) {
      // 选择记录（带重试验证）
      record = await selectRecord(params.recordId);
      // 更新 UI 状态追踪
      updateUiState({ daliurenRecordId: params.recordId });
    } else {
      // 已选中目标记录，使用当前选中的记录
      log("debug", "DaLiuRenView", "已选中目标记录，跳过选择", { recordId: params.recordId });
      record = getSelectedRecord();
    }

    // 3. 等待 UI 更新（仅在切换记录时等待）
    if (!isSameRecord) {
      await waitForStateUpdate();
    }

    // 4. 获取详情（优先使用 selectRecord 返回值，回退到 getSelectedRecord）
    const selectedRecord = record ?? getSelectedRecord();
    if (!selectedRecord) {
      throw new DaLiuRenError(`记录 ${params.recordId} 未找到或加载失败`, "DaLiuRenView", {
        context: { recordId: params.recordId, selectRecordReturned: !!record },
        suggestion: "请检查记录 ID 是否正确，或尝试刷新页面后重试",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 5. 附带纯计算数据
    const computed: DaLiuRenComputedData = {
      calculationTime: selectedRecord.calculationTime,
      result: selectedRecord.result,
      person: getPersonFn?.() ?? null,
    };

    log("info", "DaLiuRenView", "查看成功", {
      recordId: selectedRecord.id,
      skippedUI: isSameRecord,
    });
    stop();
    return { ...selectedRecord, computed };
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenView", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenView", err, DaLiuRenError);
  }
}

/**
 * 大六壬记录删除调试接口——删除指定记录。
 *
 * 仅支持 skipUI=true 模式（删除操作无需 UI 交互）。
 *
 * @param params 删除参数
 * @param options 可选配置项（仅支持 skipUI=true）
 * @throws DaLiuRenError recordId 无效时（errorCode: INVALID_INPUT）
 * @throws DaLiuRenError 记录不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * await window.peep.DaLiuRenDelete({ recordId: 123 }, { skipUI: true });
 * ```
 */
export async function DaLiuRenDelete(
  params: { recordId: number },
  options?: { skipUI?: boolean },
): Promise<void> {
  const stop = timer("DaLiuRenDelete");
  try {
    validateRecordId(params.recordId, "DaLiuRenDelete");

    if (!options?.skipUI) {
      throw new DaLiuRenError("DaLiuRenDelete 当前仅支持 skipUI=true 模式", "DaLiuRenDelete", {
        context: { skipUI: false },
        suggestion: "请使用 { skipUI: true } 选项调用 DaLiuRenDelete",
        errorCode: ApiErrorCode.NOT_IMPLEMENTED,
      });
    }

    log("info", "DaLiuRenDelete", "删除记录", { recordId: params.recordId });

    // 验证记录存在
    const record = await getLiurenRecord(params.recordId);
    if (!record) {
      throw new DaLiuRenError(`记录 ${params.recordId} 不存在`, "DaLiuRenDelete", {
        context: { recordId: params.recordId },
        suggestion:
          "请检查记录 ID 是否正确，该记录可能已被删除。可调用 DaLiuRenList() 查看可用记录",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    await deleteLiurenRecord(params.recordId);

    log("info", "DaLiuRenDelete", "删除成功", { recordId: params.recordId });
    stop();
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      log("error", "DaLiuRenDelete", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "DaLiuRenDelete", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenDelete", err, DaLiuRenError);
  }
}

/**
 * 大六壬记录更新标签调试接口——仅更新元数据标签。
 *
 * 起课记录一旦创建不可修改卦象数据，但支持更新标签。
 *
 * @param params 更新参数：recordId, tags
 * @throws DaLiuRenError recordId 无效时（errorCode: INVALID_INPUT）
 * @throws DaLiuRenError 记录不存在时（errorCode: NOT_FOUND）
 * @returns 更新后的记录
 *
 * @example
 * ```typescript
 * const updated = await window.peep.DaLiuRenUpdateTags({ recordId: 123, tags: ['财运', '合作'] });
 * ```
 */
export async function DaLiuRenUpdateTags(params: {
  recordId: number;
  tags: string[];
}): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenUpdateTags");
  try {
    validateRecordId(params.recordId, "DaLiuRenUpdateTags");
    validateTags(params.tags, "DaLiuRenUpdateTags", DaLiuRenError);

    log("info", "DaLiuRenUpdateTags", "更新标签", { recordId: params.recordId, tags: params.tags });

    // 获取记录
    const record = await getLiurenRecord(params.recordId);
    if (!record) {
      throw new DaLiuRenError(`记录 ${params.recordId} 不存在`, "DaLiuRenUpdateTags", {
        context: { recordId: params.recordId },
        suggestion: "请检查记录 ID 是否正确。可调用 DaLiuRenList() 查看可用记录",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 更新标签并保存
    const updated: LiurenRecord = { ...record, tags: params.tags };
    await saveLiurenRecord(updated);
    invalidateLiurenTagCache();

    log("info", "DaLiuRenUpdateTags", "更新成功", { recordId: params.recordId });
    stop();
    return updated;
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenUpdateTags", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenUpdateTags", err, DaLiuRenError);
  }
}

/**
 * 大六壬记录更新备注调试接口——仅更新元数据 note 和 background。
 *
 * 起课记录一旦创建不可修改卦象数据，但支持更新备注和背景信息。
 *
 * @param params 更新参数：recordId, note?, background?
 * @throws DaLiuRenError recordId 无效时（errorCode: INVALID_INPUT）
 * @throws DaLiuRenError 记录不存在时（errorCode: NOT_FOUND）
 * @returns 更新后的记录
 *
 * @example
 * ```typescript
 * const updated = await window.peep.DaLiuRenUpdateNote({
 *   recordId: 123,
 *   note: '后续反馈：准确',
 *   background: '补充背景信息'
 * });
 * ```
 */
export async function DaLiuRenUpdateNote(params: {
  recordId: number;
  note?: string;
  background?: string;
}): Promise<LiurenRecord> {
  const stop = timer("DaLiuRenUpdateNote");
  try {
    validateRecordId(params.recordId, "DaLiuRenUpdateNote");

    log("info", "DaLiuRenUpdateNote", "更新备注", {
      recordId: params.recordId,
      hasNote: params.note !== undefined,
      hasBackground: params.background !== undefined,
    });

    // 获取记录
    const record = await getLiurenRecord(params.recordId);
    if (!record) {
      throw new DaLiuRenError(`记录 ${params.recordId} 不存在`, "DaLiuRenUpdateNote", {
        context: { recordId: params.recordId },
        suggestion: "请检查记录 ID 是否正确。可调用 DaLiuRenList() 查看可用记录",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 更新备注/背景并保存
    const updated: LiurenRecord = {
      ...record,
      note: params.note ?? record.note,
      background: params.background ?? record.background,
    };
    await saveLiurenRecord(updated);

    log("info", "DaLiuRenUpdateNote", "更新成功", { recordId: params.recordId });
    stop();
    return updated;
  } catch (err) {
    if (err instanceof DaLiuRenError) {
      stop();
      throw err;
    }
    log("error", "DaLiuRenUpdateNote", "执行失败", err);
    stop();
    throw wrapError("DaLiuRenUpdateNote", err, DaLiuRenError);
  }
}
