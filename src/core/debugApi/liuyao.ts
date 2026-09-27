/**
 * 调试 API - 六爻相关接口
 *
 * 包含：computeLiuyaoData, LiuYao, LiuYaoCreate, LiuYaoList, LiuYaoView
 */

import type { LiuyaoRecord } from "./types";
import type { LiuyaoListFilters } from "../liuyaoDb";
import { buildChart, locateYong, tossHexagram } from "../liuyao/core/chart";
import type { ChartJSON, SixLines, YongShen, YongTarget } from "../liuyao/core/types";
import {
  listLiuyaoRecords,
  getLiuyaoRecord,
  saveLiuyaoRecord,
  invalidateLiuyaoTagCache,
} from "../liuyaoDb";
import { getPerson } from "../personDb";
import { log, timer } from "./logger";
import { LiuyaoError, wrapError, ApiErrorCode } from "./errors";
import {
  getSelectPerson,
  getGetLiuyaoList,
  getSetLiuyaoListFilters,
  getOpenLiuyaoCreateDialog,
  getFillLiuyaoCreateForm,
  getSubmitLiuyaoCreateForm,
  getSelectLiuyaoRecord,
  getGetSelectedLiuyaoRecord,
  getGetPerson,
} from "./callbacks";
import { resolvePersonId } from "./person";
import {
  nextFrame,
  waitForStateUpdate,
  navigateToPage,
  selectPersonAndWait,
  waitForDialogReady,
  waitForLiuyaoCallbacks,
  waitForRecordSaved,
} from "./helpers";
import { parseDate } from "./ziwei";
import { formatDate, formatDateTime } from "../utils";
import { buildLiuyaoHbarData, type LiuyaoHbarVisible, type LiuyaoHbarPick } from "../liuyao/hbar";
import { computeVigorColumns } from "../liuyao/vigorColumns";
import type {
  LiuyaoComputedData,
  LiuyaoOptions,
  LiuyaoViewResult,
  LiuyaoCreateParams,
  LiuyaoListParams,
  LiuyaoViewParams,
} from "./types";
import {
  validateRecordId,
  validateNonEmptyString,
  validateTags,
  validatePagination,
} from "./validate";

/**
 * 验证六爻值数组：必须为 6 个 0-3 的整数
 */
function validateSixLines(lines: unknown, source: string): asserts lines is SixLines {
  if (!Array.isArray(lines) || lines.length !== 6) {
    throw new LiuyaoError(`lines 必须为长度为 6 的数组（六爻值）`, source, {
      context: { lines, type: typeof lines, length: Array.isArray(lines) ? lines.length : -1 },
      suggestion: "lines 应为 6 个 0-3 的整数数组，如 [1,1,1,1,1,1]。0=老阴,1=少阳,2=少阴,3=老阳",
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
  for (let i = 0; i < 6; i++) {
    if (
      typeof lines[i] !== "number" ||
      !Number.isInteger(lines[i]) ||
      lines[i] < 0 ||
      lines[i] > 3
    ) {
      throw new LiuyaoError(`lines[${i}] 无效：${lines[i]}，需为 0-3 的整数`, source, {
        context: { index: i, value: lines[i] },
        suggestion: "每个爻值必须为 0（老阴）、1（少阳）、2（少阴）或 3（老阳）",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
  }
}

/**
 * 验证 yongTarget 值
 */
function validateYongTarget(target: unknown, source: string): asserts target is YongTarget {
  const valid: YongTarget[] = ["自占", "父母", "子女", "配偶", "兄弟", "医药"];
  if (typeof target !== "string" || !valid.includes(target as YongTarget)) {
    throw new LiuyaoError(`yongTarget 无效：${target}，需为 ${valid.join("/")} 之一`, source, {
      context: { target, validTargets: valid },
      suggestion: `请使用有效的求测对象：${valid.join("、")}`,
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
}

/**
 * 纯计算函数：六爻排盘（不操控 UI，不依赖 React 状态）。
 *
 * 对 buildChart + locateYong 的薄包装：增加日志、计时、LiuyaoError 错误处理。
 * 可在任意上下文调用（RTC Agent、自动化测试、控制台调试）。
 *
 * @param lines 六爻值数组（6 个 0-3 的整数），省略则自动摇卦
 * @param date 公历日期（YYYY-MM-DD）
 * @param yongTarget 求测对象——决定用神六亲，默认"自占"
 * @param time 时间（HH:mm:ss，可选，仅用于日志记录）
 * @returns 完整卦象 + 用神定位结果
 * @throws LiuyaoError 排盘失败时抛出，包含输入上下文和恢复建议
 */
export function computeLiuyaoData(
  lines: SixLines | undefined,
  date: string,
  yongTarget: YongTarget = "自占",
  time?: string,
): { chart: ChartJSON; yong: YongShen; lines: SixLines } {
  const stop = timer("computeLiuyaoData");
  try {
    // 如果 lines 未提供，自动摇卦
    const finalLines: SixLines = lines ?? tossHexagram();
    log("info", "computeLiuyaoData", "纯计算排盘", {
      date,
      time,
      yongTarget,
      linesProvided: !!lines,
    });

    const chart = buildChart({ lines: finalLines, date });
    const yong = locateYong(chart, yongTarget);

    log("info", "computeLiuyaoData", "排盘成功", {
      hexagramName: chart.name,
      palace: chart.palace,
      yongRel: yong.rel,
      yongPos: yong.pos,
    });
    stop();
    return { chart, yong, lines: finalLines };
  } catch (err) {
    stop();
    if (err instanceof LiuyaoError) throw err;
    log("error", "computeLiuyaoData", "排盘失败", err);
    throw new LiuyaoError("六爻排盘计算失败", "computeLiuyaoData", {
      context: { date, time, yongTarget, lines },
      suggestion: "请检查日期格式（YYYY-MM-DD）是否正确，以及六爻值是否为有效的 0-3 整数数组",
      cause: err,
    });
  }
}

/**
 * 六爻排盘调试接口（向后兼容）
 *
 * 直接调用 computeLiuyaoData 纯计算函数。
 * 保留原签名以兼容已有调用方，推荐新代码直接使用 computeLiuyaoData。
 */
export function LiuYao(
  lines: SixLines | undefined,
  date: string,
  yongTarget: YongTarget = "自占",
  time?: string,
): LiuyaoComputedData {
  const result = computeLiuyaoData(lines, date, yongTarget, time);

  // 构建 divinationTime
  const divinationTime = time ? `${date}T${time}` : `${date}T00:00:00`;

  // 计算 hbarData（基于起卦时间，默认 pick 为起卦时间）
  const dt = new Date(divinationTime);
  const pick: LiuyaoHbarPick = {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
    hour: 0,
  };
  const hbarData = buildLiuyaoHbarData(divinationTime, pick);
  const visible: LiuyaoHbarVisible = { yearly: true, monthly: true, daily: true, hourly: true };
  const vigorColumns = computeVigorColumns(result.chart, visible, pick);

  return {
    divinationTime,
    chart: result.chart,
    yong: result.yong,
    person: null,
    hbarData,
    vigorColumns,
  };
}

/**
 * 六爻起卦调试接口——创建起卦记录。
 *
 * skipUI=true 时：跳过所有 UI 操控，直接计算排盘结果并写入数据库。
 * skipUI=false 时（默认）：执行完整 UI 流程。
 *
 * @param params 起卦参数（使用统一的 LiuyaoCreateParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 创建后的起卦记录，包含 id 和完整排盘结果
 * @throws LiuyaoError question 为空时（errorCode: INVALID_INPUT）
 * @throws LiuyaoError 人物不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 默认人物起卦（自动摇卦）
 * const record = await window.peep.LiuYaoCreate({ question: '这笔生意能不能做？' });
 *
 * // 指定人物 + 手动六爻值
 * const record = await window.peep.LiuYaoCreate({
 *   personId: 1,
 *   question: '考试能否通过？',
 *   lines: [1, 2, 3, 0, 1, 2],
 *   yongTarget: '自占',
 *   tags: ['考试', '学业']
 * });
 * ```
 */
export async function LiuYaoCreate(
  params: LiuyaoCreateParams,
  options?: LiuyaoOptions,
): Promise<LiuyaoRecord> {
  const stop = timer("LiuYaoCreate");
  try {
    // 参数验证
    validateNonEmptyString(params.question, "question", "LiuYaoCreate", LiuyaoError);
    validateTags(params.tags, "LiuYaoCreate", LiuyaoError);
    if (params.lines !== undefined) {
      validateSixLines(params.lines, "LiuYaoCreate");
    }
    if (params.yongTarget !== undefined) {
      validateYongTarget(params.yongTarget, "LiuYaoCreate");
    }

    const personId = await resolvePersonId(params.personId);
    const yongTarget = params.yongTarget ?? "自占";
    log("info", "LiuYaoCreate", "开始创建起卦", {
      personId,
      question: params.question,
      skipUI: !!options?.skipUI,
      linesProvided: !!params.lines,
      yongTarget,
    });

    /* ── skipUI 模式：纯计算 + DB 写入，不操控 UI ── */
    if (options?.skipUI) {
      // 验证人物存在
      const personCheck = await getPerson(personId);
      if (!personCheck) {
        throw new LiuyaoError(`人物 ${personId} 不存在`, "LiuYaoCreate", {
          context: { personId },
          suggestion: "请检查人物 ID 是否正确。可调用 PersonList() 查看可用的人物列表",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }

      // 解析起卦时间（有自定义时间则用之，否则用当前时间）
      let divinationTime: string;
      let dateStr: string;
      if (params.divinationTime) {
        const parsed = parseDate(params.divinationTime);
        divinationTime =
          formatDate(parsed) + "T" + formatDateTime(parsed.getTime(), true).split(" ")[1];
        dateStr = formatDate(parsed);
      } else {
        const now = new Date();
        dateStr = formatDate(now);
        const timeStr = formatDateTime(now.getTime(), true).split(" ")[1];
        divinationTime = `${dateStr}T${timeStr}`;
      }

      // 纯计算排盘（lines 省略则自动摇卦）
      const result = computeLiuyaoData(params.lines, dateStr, yongTarget);

      // 构造记录并写入数据库
      const record: LiuyaoRecord = {
        personId,
        divinationTime,
        question: params.question.trim(),
        background: params.background?.trim() ?? "",
        note: params.note?.trim() ?? "",
        tags: params.tags ?? [],
        lines: result.lines,
        chart: result.chart,
        yongTarget,
        yong: result.yong,
        savedAt: Date.now(),
      };
      const id = await saveLiuyaoRecord(record);
      invalidateLiuyaoTagCache();

      log("info", "LiuYaoCreate", "skipUI 模式创建成功", { recordId: id });
      stop();
      return { ...record, id };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const openCreateDialog = getOpenLiuyaoCreateDialog();
    const fillCreateForm = getFillLiuyaoCreateForm();
    const submitCreateForm = getSubmitLiuyaoCreateForm();

    // 跳转到 /liuyao 页面并等待回调注册
    await navigateToPage("/liuyao", "liuyao");
    await waitForLiuyaoCallbacks();

    if (!openCreateDialog || !fillCreateForm || !submitCreateForm) {
      throw new LiuyaoError("六爻调试 API 未初始化", "LiuYaoCreate", {
        context: {
          openCreateDialogReady: !!openCreateDialog,
          fillCreateFormReady: !!fillCreateForm,
          submitCreateFormReady: !!submitCreateForm,
        },
        suggestion: "请确认 LiuyaoPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // lines 未提供时先摇卦——避免 Dialog 使用默认值 [1,1,1,1,1,1]（永远是乾卦）
    const finalLines = params.lines ?? tossHexagram();

    // 1. 填写表单（在打开 Dialog 之前设置初始数据）
    fillCreateForm({
      question: params.question,
      note: params.note ?? "",
      background: params.background ?? "",
      tags: params.tags ?? [],
      lines: finalLines,
      yongTarget,
    });
    // 等待表单状态更新完成（双 rAF 替代盲等）
    await nextFrame();
    await nextFrame();

    // 2. 打开新建 Dialog（Dialog 打开时会读取已设置的初始数据）
    openCreateDialog();
    // 等待 Dialog DOM 渲染完成（轮询检测替代盲等）
    await waitForDialogReady();

    // 3. 提交表单
    const record = await submitCreateForm();

    // 4. 等待保存完成并验证记录存在
    await waitForRecordSaved(record.id, 2000);

    log("info", "LiuYaoCreate", "创建成功", { recordId: record.id });
    stop();
    return record;
  } catch (err) {
    if (err instanceof LiuyaoError) {
      log("error", "LiuYaoCreate", "执行失败（不重试）", {
        errorType: err.name,
        message: err.message.split("\n")[0],
      });
      stop();
      throw err;
    }
    log("error", "LiuYaoCreate", "执行失败", err);
    stop();
    throw wrapError("LiuYaoCreate", err, LiuyaoError);
  }
}

/**
 * 六爻起卦列表调试接口——查询起卦记录列表。
 *
 * skipUI=true 时：直接查询数据库，不导航页面、不切换人物。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 设置 UI 过滤条件 + 查询。
 *
 * @param params 查询参数（使用统一的 LiuyaoListParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 起卦记录列表，包含 records 数组和 total 总数
 * @throws LiuyaoError 分页参数无效时（errorCode: INVALID_INPUT）
 *
 * @example
 * ```typescript
 * // 基本查询
 * const { records, total } = await window.peep.LiuYaoList({});
 *
 * // 搜索 + 分页
 * const { records, total } = await window.peep.LiuYaoList({
 *   searchText: '考试',
 *   page: 1,
 *   pageSize: 10
 * });
 * ```
 */
export async function LiuYaoList(
  params: LiuyaoListParams,
  options?: LiuyaoOptions,
): Promise<{ records: LiuyaoRecord[]; total: number }> {
  const stop = timer("LiuYaoList");
  try {
    // 参数验证
    validateTags(params.tags, "LiuYaoList", LiuyaoError);
    validatePagination(params, "LiuYaoList", LiuyaoError);

    const personId = await resolvePersonId(params.personId);
    log("info", "LiuYaoList", "查询列表", {
      personId,
      searchText: params.searchText,
      tags: params.tags,
      skipUI: !!options?.skipUI,
    });

    const filters: LiuyaoListFilters = {
      searchText: params.searchText,
      tags: params.tags,
      page: params.page,
      pageSize: params.pageSize,
    };

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const result = await listLiuyaoRecords(personId, filters);
      log("info", "LiuYaoList", "skipUI 模式查询成功", {
        total: result.total,
        returned: result.records.length,
      });
      stop();
      return { records: result.records, total: result.total };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const selectPerson = getSelectPerson();
    const getLiuyaoList = getGetLiuyaoList();
    const setListFilters = getSetLiuyaoListFilters();

    // 跳转到 /liuyao 页面并等待回调注册
    await navigateToPage("/liuyao", "liuyao");
    await waitForLiuyaoCallbacks();

    if (!selectPerson || !getLiuyaoList) {
      throw new LiuyaoError("六爻调试 API 未初始化", "LiuYaoList", {
        context: {
          selectPersonReady: !!selectPerson,
          getLiuyaoListReady: !!getLiuyaoList,
        },
        suggestion: "请确认 LiuyaoPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 设置 UI 过滤条件
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
    const result = await getLiuyaoList(filters);

    log("info", "LiuYaoList", "查询成功", {
      total: result.total,
      returned: result.records.length,
    });
    stop();
    return { records: result.records, total: result.total };
  } catch (err) {
    if (err instanceof LiuyaoError) {
      stop();
      throw err;
    }
    log("error", "LiuYaoList", "执行失败", err);
    stop();
    throw wrapError("LiuYaoList", err, LiuyaoError);
  }
}

/**
 * 六爻起卦详情调试接口——查看单条起卦记录。
 *
 * skipUI=true 时：直接查询数据库获取记录，并附带纯计算数据（hbar + 旺衰列）。
 * skipUI=false 时（默认）：导航页面 + 切换人物 + 选择记录 + 返回详情。
 *
 * @param params 查看参数（使用统一的 LiuyaoViewParams 类型）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 起卦记录详情，包含完整卦象 + hbar + 旺衰列数据
 * @throws LiuyaoError recordId 无效时（errorCode: INVALID_INPUT）
 * @throws LiuyaoError 记录不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * const detail = await window.peep.LiuYaoView({ recordId: 123 });
 * console.log("问题:", detail.question);
 * console.log("卦名:", detail.chart.name);
 * console.log("用神:", detail.yong.rel);
 * ```
 */
export async function LiuYaoView(
  params: LiuyaoViewParams,
  options?: LiuyaoOptions,
): Promise<LiuyaoViewResult> {
  const stop = timer("LiuYaoView");
  try {
    // 参数验证
    validateRecordId(params.recordId, "LiuYaoView");

    const personId = await resolvePersonId(params.personId);
    log("info", "LiuYaoView", "查看详情", {
      personId,
      recordId: params.recordId,
      skipUI: !!options?.skipUI,
    });

    /* ── skipUI 模式：直接查询数据库，不操控 UI ── */
    if (options?.skipUI) {
      const record = await getLiuyaoRecord(params.recordId);
      if (!record) {
        throw new LiuyaoError(`记录 ${params.recordId} 不存在`, "LiuYaoView", {
          context: { recordId: params.recordId },
          suggestion:
            "请检查记录 ID 是否正确，该记录可能已被删除。可调用 LiuYaoList() 查看可用记录",
          errorCode: ApiErrorCode.NOT_FOUND,
        });
      }
      // 附带纯计算数据（hbar + 旺衰列）
      const computed = buildLiuyaoComputedData(record);
      log("info", "LiuYaoView", "skipUI 模式查看成功", { recordId: record.id });
      stop();
      return { ...record, computed };
    }

    /* ── 正常模式：执行 UI 操控 ── */
    const selectPerson = getSelectPerson();
    const selectRecord = getSelectLiuyaoRecord();
    const getSelectedRecord = getGetSelectedLiuyaoRecord();
    const getPersonFn = getGetPerson();

    // 跳转到 /liuyao 页面并等待回调注册
    await navigateToPage("/liuyao", "liuyao");
    await waitForLiuyaoCallbacks();

    if (!selectPerson || !selectRecord || !getSelectedRecord) {
      throw new LiuyaoError("六爻调试 API 未初始化", "LiuYaoView", {
        context: {
          selectPersonReady: !!selectPerson,
          selectRecordReady: !!selectRecord,
          getSelectedRecordReady: !!getSelectedRecord,
        },
        suggestion: "请确认 LiuyaoPage 组件已正确挂载并注册回调",
        errorCode: ApiErrorCode.NOT_INITIALIZED,
      });
    }

    // 1. 选择人物（带状态验证）
    await selectPersonAndWait(personId);

    // 2. 选择记录（带重试验证）
    const record = await selectRecord(params.recordId);
    await waitForStateUpdate();

    // 3. 获取详情（优先使用 selectRecord 返回值，回退到 getSelectedRecord）
    const selectedRecord = record ?? getSelectedRecord();
    if (!selectedRecord) {
      throw new LiuyaoError(`记录 ${params.recordId} 未找到或加载失败`, "LiuYaoView", {
        context: { recordId: params.recordId, selectRecordReturned: !!record },
        suggestion: "请检查记录 ID 是否正确，或尝试刷新页面后重试",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    // 4. 附带纯计算数据
    const computed: LiuyaoComputedData = {
      divinationTime: selectedRecord.divinationTime,
      chart: selectedRecord.chart,
      yong: selectedRecord.yong,
      person: getPersonFn?.() ?? null,
      hbarData: buildLiuyaoHbarData(selectedRecord.divinationTime, {
        year: new Date(selectedRecord.divinationTime).getFullYear(),
        month: new Date(selectedRecord.divinationTime).getMonth() + 1,
        day: new Date(selectedRecord.divinationTime).getDate(),
        hour: 0,
      }),
      vigorColumns: computeVigorColumns(
        selectedRecord.chart,
        {
          yearly: true,
          monthly: true,
          daily: true,
          hourly: true,
        },
        {
          year: new Date(selectedRecord.divinationTime).getFullYear(),
          month: new Date(selectedRecord.divinationTime).getMonth() + 1,
          day: new Date(selectedRecord.divinationTime).getDate(),
          hour: 0,
        },
      ),
    };

    log("info", "LiuYaoView", "查看成功", { recordId: selectedRecord.id });
    stop();
    return { ...selectedRecord, computed };
  } catch (err) {
    if (err instanceof LiuyaoError) {
      stop();
      throw err;
    }
    log("error", "LiuYaoView", "执行失败", err);
    stop();
    throw wrapError("LiuYaoView", err, LiuyaoError);
  }
}

/**
 * 辅助函数：基于记录构建 LiuyaoComputedData
 */
function buildLiuyaoComputedData(record: LiuyaoRecord): LiuyaoComputedData {
  const dt = new Date(record.divinationTime);
  const pick: LiuyaoHbarPick = {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
    hour: 0,
  };
  const visible: LiuyaoHbarVisible = {
    yearly: true,
    monthly: true,
    daily: true,
    hourly: true,
  };

  return {
    divinationTime: record.divinationTime,
    chart: record.chart,
    yong: record.yong,
    person: null, // skipUI 模式下需要额外查询
    hbarData: buildLiuyaoHbarData(record.divinationTime, pick),
    vigorColumns: computeVigorColumns(record.chart, visible, pick),
  };
}
