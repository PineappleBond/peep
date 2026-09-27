/**
 * 六爻调试 API UI 模式 E2E 测试
 *
 * 测试范围：
 * 1. LiuYaoCreate UI 模式（fillCreateForm → openCreateDialog → submitCreateForm）
 * 2. LiuYaoList UI 模式（navigateToPage → selectPersonAndWait → setListFilters → getLiuyaoList）
 * 3. LiuYaoView UI 模式（navigateToPage → selectPersonAndWait → selectRecord → computed 构建）
 *
 * 所有 DB 模块通过 vi.mock() 隔离，回调通过 registerLiuyaoCallbacks / registerDebugApi 注入。
 * 不依赖 IndexedDB，纯 mock 测试。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerLiuyaoCallbacks, registerDebugApi, resetCallbacks } from "./callbacks";
import { LiuYaoCreate, LiuYaoList, LiuYaoView } from "./liuyao";
import { LiuyaoError } from "./errors";
import type { LiuyaoRecord } from "../personDb";
import type { LiuyaoListResult } from "../liuyaoDb";
import type { SixLines, YongTarget } from "../liuyao/core/types";

/* ── 模块级 mock ── */

// mock 掉 liuyaoDb，避免 IndexedDB 依赖
vi.mock("../liuyaoDb", () => ({
  listLiuyaoRecords: vi.fn(),
  getLiuyaoRecord: vi.fn(),
  saveLiuyaoRecord: vi.fn(),
  invalidateLiuyaoTagCache: vi.fn(),
}));

// mock 掉 personDb，避免 IndexedDB 依赖
vi.mock("../personDb", () => ({
  getPerson: vi.fn(),
  getDefaultPerson: vi.fn(),
}));

// mock 掉 tossHexagram，固定返回非乾卦（避免默认 [1,1,1,1,1,1] 永远乾为天）
// 使用 [0,0,0,0,0,0]（坤为地），便于断言"自动摇卦的结果不是乾卦"
vi.mock("../liuyao/core/chart", async importOriginal => {
  const actual = await importOriginal<typeof import("../liuyao/core/chart")>();
  return {
    ...actual,
    tossHexagram: vi.fn().mockReturnValue([0, 0, 0, 0, 0, 0] as SixLines),
  };
});

/* ── 共享 fixture ── */

const TEST_PERSON_ID = 1;
const TEST_RECORD_ID = 42;

/** 构建一个最小合法的 mock LiuyaoRecord */
function buildMockRecord(overrides: Partial<LiuyaoRecord> = {}): LiuyaoRecord {
  return {
    id: TEST_RECORD_ID,
    personId: TEST_PERSON_ID,
    divinationTime: "2026-09-27T12:00:00",
    question: "测试问题",
    background: "测试背景",
    note: "测试备注",
    tags: ["测试"],
    lines: [1, 1, 1, 1, 1, 1] as SixLines,
    chart: {
      name: "乾为天",
      palace: "乾",
      month: 9,
      day: 27,
      lines: [],
      changed: null,
    } as unknown as LiuyaoRecord["chart"],
    yongTarget: "自占" as YongTarget,
    yong: { rel: "兄弟", pos: 1, hide: [] } as unknown as LiuyaoRecord["yong"],
    savedAt: Date.now(),
    ...overrides,
  };
}

/** 注册完整的全套回调（UI 模式所需） */
function registerAllMocks(opts: {
  /** submitCreateForm 返回的 record（LiuYaoCreate 用） */
  submitRecord?: LiuyaoRecord;
  /** getLiuyaoList 返回的结果（LiuYaoList 用） */
  listResult?: LiuyaoListResult;
  /** selectRecord 返回的 record（LiuYaoView 用） */
  selectedRecord?: LiuyaoRecord | null;
  /** getSelectedRecord 返回的 record（LiuYaoView 回退用） */
  fallbackRecord?: LiuyaoRecord | null;
  /** 自定义 navigate（默认空函数） */
  navigate?: (path: string) => void;
  /** 自定义 selectPerson（默认 resolve 空函数） */
  selectPerson?: (personId: number) => Promise<void>;
  /** getPerson 返回的人物（用于 waitForPersonMatch 验证） */
  personObj?: { id: number; name: string } | null;
}) {
  const submitRecord = opts.submitRecord ?? buildMockRecord();
  const listResult = opts.listResult ?? { records: [], total: 0 };
  const personObj = opts.personObj ?? { id: TEST_PERSON_ID, name: "测试人物" };

  // 六爻页面专属回调
  registerLiuyaoCallbacks({
    getLiuyaoList: vi.fn().mockResolvedValue(listResult),
    setListFilters: vi.fn(),
    openCreateDialog: vi.fn(),
    fillCreateForm: vi.fn(),
    submitCreateForm: vi.fn().mockResolvedValue(submitRecord),
    selectRecord: vi.fn().mockResolvedValue(opts.selectedRecord ?? buildMockRecord()),
    getSelectedRecord: vi.fn().mockReturnValue(opts.fallbackRecord ?? buildMockRecord()),
    setHbarVisibility: vi.fn(),
    pickTime: vi.fn(),
    getHbarState: vi
      .fn()
      .mockReturnValue({ yearly: true, monthly: true, daily: true, hourly: true }),
  });

  // 全局共享回调（navigate / selectPerson / getPerson）
  registerDebugApi({
    navigate: opts.navigate ?? vi.fn(),
    selectPerson: opts.selectPerson ?? vi.fn().mockResolvedValue(undefined),
    getPerson: () => personObj,
  });
}

/* ── 测试前后清理 ── */
beforeEach(() => {
  resetCallbacks();
});
afterEach(() => {
  resetCallbacks();
});

/* ============================================================
 * 1. LiuYaoCreate UI 模式
 * ============================================================ */
describe("LiuYaoCreate UI 模式", () => {
  it("完整 UI 流程：fillCreateForm → openCreateDialog → submitCreateForm", async () => {
    const submitRecord = buildMockRecord({ id: 100 });
    registerAllMocks({ submitRecord });

    // 通过回调 getter 拿到 mock 函数引用，便于后续断言
    const { getFillLiuyaoCreateForm, getOpenLiuyaoCreateDialog, getSubmitLiuyaoCreateForm } =
      await import("./callbacks");
    const fillCreateForm = getFillLiuyaoCreateForm()!;
    const openCreateDialog = getOpenLiuyaoCreateDialog()!;
    const submitCreateForm = getSubmitLiuyaoCreateForm()!;

    const result = await LiuYaoCreate(
      {
        personId: TEST_PERSON_ID,
        question: "这笔生意能不能做？",
        background: "背景信息",
        note: "备注",
        tags: ["财运"],
        lines: [1, 2, 3, 0, 1, 2],
        yongTarget: "自占",
      },
      { skipUI: false },
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(100);
    expect(result.question).toBe("这笔生意能不能做？");
    expect(fillCreateForm).toHaveBeenCalledTimes(1);
    expect(openCreateDialog).toHaveBeenCalledTimes(1);
    expect(submitCreateForm).toHaveBeenCalledTimes(1);
    // 验证 fillCreateForm 被传入了正确的 lines
    const fillArg = (fillCreateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fillArg.lines).toEqual([1, 2, 3, 0, 1, 2]);
    expect(fillArg.question).toBe("这笔生意能不能做？");
    expect(fillArg.tags).toEqual(["财运"]);
    expect(fillArg.yongTarget).toBe("自占");
  });

  it("lines 未提供时自动摇卦——结果不是乾卦（tossHexagram mock 返回坤卦）", async () => {
    const submitRecord = buildMockRecord({ id: 200 });
    registerAllMocks({ submitRecord });

    const { getFillLiuyaoCreateForm } = await import("./callbacks");
    const fillCreateForm = getFillLiuyaoCreateForm()!;

    await LiuYaoCreate({ personId: TEST_PERSON_ID, question: "自动摇卦测试" }, { skipUI: false });

    const fillArg = (fillCreateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // tossHexagram mock 返回 [0,0,0,0,0,0]（坤为地），而非 [1,1,1,1,1,1]（乾为天）
    expect(fillArg.lines).toEqual([0, 0, 0, 0, 0, 0]);
    expect(fillArg.lines).not.toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("fillCreateForm 被调用时 lines 已生成（非 undefined）", async () => {
    registerAllMocks({ submitRecord: buildMockRecord() });

    const { getFillLiuyaoCreateForm } = await import("./callbacks");
    const fillCreateForm = getFillLiuyaoCreateForm()!;

    await LiuYaoCreate({ personId: TEST_PERSON_ID, question: "测试 lines 非空" });

    const fillArg = (fillCreateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fillArg.lines).toBeDefined();
    expect(Array.isArray(fillArg.lines)).toBe(true);
    expect(fillArg.lines).toHaveLength(6);
  });

  it("回调未注册时抛出 LiuyaoError（NOT_INITIALIZED）", async () => {
    // 不注册任何回调——resetCallbacks 已在 beforeEach 调用
    // 但需要等 waitForLiuyaoCallbacks 超时，该函数默认 1000ms 超时后继续执行，
    // 接着因 openCreateDialog / fillCreateForm / submitCreateForm 为 null 抛出 NOT_INITIALIZED
    await expect(
      LiuYaoCreate({ personId: TEST_PERSON_ID, question: "未初始化测试" }),
    ).rejects.toThrow(LiuyaoError);

    try {
      await LiuYaoCreate({ personId: TEST_PERSON_ID, question: "未初始化测试" });
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe("NOT_INITIALIZED");
    }
  });

  it("submitCreateForm 超时/拒绝时抛出错误", async () => {
    const failingRecord = buildMockRecord();
    registerAllMocks({ submitRecord: failingRecord });

    // 覆盖 submitCreateForm 为一个永远 pending 的 promise（模拟挂起）
    const { getSubmitLiuyaoCreateForm } = await import("./callbacks");
    // 由于 submitCreateForm 在 LiuYaoCreate 内部读取，这里改用注册新的回调
    // 但 registerLiuyaoCallbacks 会覆盖，所以直接重新注册
    registerLiuyaoCallbacks({
      getLiuyaoList: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      openCreateDialog: vi.fn(),
      fillCreateForm: vi.fn(),
      submitCreateForm: vi.fn().mockRejectedValue(new Error("提交失败")),
      selectRecord: vi.fn().mockResolvedValue(null),
      getSelectedRecord: vi.fn().mockReturnValue(null),
      setHbarVisibility: vi.fn(),
      pickTime: vi.fn(),
      getHbarState: vi
        .fn()
        .mockReturnValue({ yearly: true, monthly: true, daily: true, hourly: true }),
    });

    await expect(
      LiuYaoCreate({ personId: TEST_PERSON_ID, question: "超时测试" }),
    ).rejects.toThrow();
  });

  it("调用顺序：先 fillCreateForm，再 openCreateDialog，最后 submitCreateForm", async () => {
    const callOrder: string[] = [];
    registerLiuyaoCallbacks({
      getLiuyaoList: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      openCreateDialog: vi.fn().mockImplementation(() => callOrder.push("open")),
      fillCreateForm: vi.fn().mockImplementation(() => callOrder.push("fill")),
      submitCreateForm: vi.fn().mockImplementation(() => {
        callOrder.push("submit");
        return Promise.resolve(buildMockRecord());
      }),
      selectRecord: vi.fn().mockResolvedValue(null),
      getSelectedRecord: vi.fn().mockReturnValue(null),
      setHbarVisibility: vi.fn(),
      pickTime: vi.fn(),
      getHbarState: vi
        .fn()
        .mockReturnValue({ yearly: true, monthly: true, daily: true, hourly: true }),
    });
    registerDebugApi({
      navigate: vi.fn(),
      selectPerson: vi.fn().mockResolvedValue(undefined),
      getPerson: () => ({ id: TEST_PERSON_ID, name: "测试" }),
    });

    await LiuYaoCreate({ personId: TEST_PERSON_ID, question: "顺序测试" });

    expect(callOrder).toEqual(["fill", "open", "submit"]);
  });
});

/* ============================================================
 * 2. LiuYaoList UI 模式
 * ============================================================ */
describe("LiuYaoList UI 模式", () => {
  it("完整 UI 流程：navigate → selectPerson → setListFilters → getLiuyaoList", async () => {
    const mockRecords = [buildMockRecord({ id: 1 }), buildMockRecord({ id: 2 })];
    const listResult: LiuyaoListResult = { records: mockRecords, total: 2 };
    registerAllMocks({ listResult });

    const { getGetLiuyaoList, getSetLiuyaoListFilters, getSelectPerson } =
      await import("./callbacks");
    const getLiuyaoList = getGetLiuyaoList()!;
    const setListFilters = getSetLiuyaoListFilters()!;
    const selectPerson = getSelectPerson()!;

    const result = await LiuYaoList(
      {
        personId: TEST_PERSON_ID,
        searchText: "考试",
        tags: ["学业"],
        page: 1,
        pageSize: 10,
      },
      { skipUI: false },
    );

    expect(result.records).toEqual(mockRecords);
    expect(result.total).toBe(2);
    expect(selectPerson).toHaveBeenCalledWith(TEST_PERSON_ID);
    expect(setListFilters).toHaveBeenCalledTimes(1);
    expect(getLiuyaoList).toHaveBeenCalledTimes(1);

    // 验证 setListFilters 传参
    const filterArg = (setListFilters as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(filterArg.searchText).toBe("考试");
    expect(filterArg.tags).toEqual(["学业"]);
    expect(filterArg.page).toBe(1);

    // 验证 getLiuyaoList 传参（含 pageSize）
    const listArg = (getLiuyaoList as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(listArg.searchText).toBe("考试");
    expect(listArg.tags).toEqual(["学业"]);
    expect(listArg.page).toBe(1);
    expect(listArg.pageSize).toBe(10);
  });

  it("无搜索条件时不调用 setListFilters", async () => {
    registerAllMocks({ listResult: { records: [], total: 0 } });

    const { getSetLiuyaoListFilters } = await import("./callbacks");
    const setListFilters = getSetLiuyaoListFilters()!;

    await LiuYaoList({ personId: TEST_PERSON_ID });

    expect(setListFilters).not.toHaveBeenCalled();
  });

  it("参数正确传递：分页 + 搜索 + 标签", async () => {
    registerAllMocks({ listResult: { records: [buildMockRecord()], total: 1 } });

    const { getGetLiuyaoList } = await import("./callbacks");
    const getLiuyaoList = getGetLiuyaoList()!;

    const result = await LiuYaoList(
      {
        personId: TEST_PERSON_ID,
        searchText: "财运",
        tags: ["投资", "决策"],
        page: 2,
        pageSize: 20,
      },
      { skipUI: false },
    );

    expect(result.total).toBe(1);
    const listArg = (getLiuyaoList as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(listArg.searchText).toBe("财运");
    expect(listArg.tags).toEqual(["投资", "决策"]);
    expect(listArg.page).toBe(2);
    expect(listArg.pageSize).toBe(20);
  });

  it("回调未注册时抛出 LiuyaoError（NOT_INITIALIZED）", async () => {
    // 不注册任何回调
    await expect(LiuYaoList({ personId: TEST_PERSON_ID })).rejects.toThrow(LiuyaoError);

    try {
      await LiuYaoList({ personId: TEST_PERSON_ID });
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe("NOT_INITIALIZED");
    }
  });

  it("selectPerson 回调未注册时抛出错误", async () => {
    // 注册六爻回调但不注册全局 selectPerson
    registerLiuyaoCallbacks({
      getLiuyaoList: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      openCreateDialog: vi.fn(),
      fillCreateForm: vi.fn(),
      submitCreateForm: vi.fn().mockResolvedValue(buildMockRecord()),
      selectRecord: vi.fn().mockResolvedValue(null),
      getSelectedRecord: vi.fn().mockReturnValue(null),
      setHbarVisibility: vi.fn(),
      pickTime: vi.fn(),
      getHbarState: vi
        .fn()
        .mockReturnValue({ yearly: true, monthly: true, daily: true, hourly: true }),
    });
    // registerDebugApi 不传 selectPerson

    await expect(LiuYaoList({ personId: TEST_PERSON_ID })).rejects.toThrow();
  });
});

/* ============================================================
 * 3. LiuYaoView UI 模式
 * ============================================================ */
describe("LiuYaoView UI 模式", () => {
  it("完整 UI 流程：navigate → selectPerson → selectRecord → 构建 computed", async () => {
    const mockRecord = buildMockRecord({ id: TEST_RECORD_ID });
    registerAllMocks({ selectedRecord: mockRecord });

    const { getSelectLiuyaoRecord, getGetSelectedLiuyaoRecord, getSelectPerson } =
      await import("./callbacks");
    const selectRecord = getSelectLiuyaoRecord()!;
    const selectPerson = getSelectPerson()!;

    const result = await LiuYaoView(
      { recordId: TEST_RECORD_ID, personId: TEST_PERSON_ID },
      { skipUI: false },
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(TEST_RECORD_ID);
    expect(result.question).toBe("测试问题");
    expect(selectPerson).toHaveBeenCalledWith(TEST_PERSON_ID);
    expect(selectRecord).toHaveBeenCalledWith(TEST_RECORD_ID);
    // computed 字段必须存在
    expect(result.computed).toBeDefined();
    expect(result.computed.divinationTime).toBe("2026-09-27T12:00:00");
    expect(result.computed.chart).toBeDefined();
    expect(result.computed.yong).toBeDefined();
    expect(result.computed.hbarData).toBeDefined();
    expect(result.computed.vigorColumns).toBeDefined();
  });

  it("selectRecord 返回 null 时回退到 getSelectedRecord", async () => {
    const fallbackRecord = buildMockRecord({ id: 99 });
    registerAllMocks({ selectedRecord: null, fallbackRecord });

    const { getSelectLiuyaoRecord, getGetSelectedLiuyaoRecord } = await import("./callbacks");
    const selectRecord = getSelectLiuyaoRecord()!;
    const getSelectedRecord = getGetSelectedLiuyaoRecord()!;

    const result = await LiuYaoView({ recordId: 99, personId: TEST_PERSON_ID }, { skipUI: false });

    expect(selectRecord).toHaveBeenCalledWith(99);
    expect(getSelectedRecord).toHaveBeenCalled();
    expect(result.id).toBe(99);
    expect(result.computed).toBeDefined();
  });

  it("selectRecord 和 getSelectedRecord 都返回 null 时抛出 NOT_FOUND", async () => {
    registerAllMocks({ selectedRecord: null, fallbackRecord: null });

    await expect(LiuYaoView({ recordId: 999, personId: TEST_PERSON_ID })).rejects.toThrow(
      LiuyaoError,
    );

    try {
      await LiuYaoView({ recordId: 999, personId: TEST_PERSON_ID });
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe("NOT_FOUND");
    }
  });

  it("computed 字段正确构建：包含 divinationTime/chart/yong/hbarData/vigorColumns", async () => {
    const mockRecord = buildMockRecord({
      id: TEST_RECORD_ID,
      divinationTime: "2024-06-15T08:30:00",
    });
    registerAllMocks({ selectedRecord: mockRecord });

    const result = await LiuYaoView(
      { recordId: TEST_RECORD_ID, personId: TEST_PERSON_ID },
      { skipUI: false },
    );

    expect(result.computed.divinationTime).toBe("2024-06-15T08:30:00");
    expect(result.computed.chart).toBe(mockRecord.chart);
    expect(result.computed.yong).toBe(mockRecord.yong);
    // hbarData 结构包含四柱
    expect(result.computed.hbarData).toBeDefined();
    if (result.computed.hbarData) {
      expect(result.computed.hbarData.years).toBeDefined();
      expect(result.computed.hbarData.months).toBeDefined();
      expect(result.computed.hbarData.days).toBeDefined();
      expect(result.computed.hbarData.hours).toBeDefined();
    }
    // vigorColumns 包含 8 列
    expect(result.computed.vigorColumns).toBeDefined();
    if (result.computed.vigorColumns) {
      expect(result.computed.vigorColumns.columns).toBeDefined();
    }
    // person 字段：来自 getPerson 回调
    expect(result.computed.person).toBeDefined();
  });

  it("回调未注册时抛出 LiuyaoError（NOT_INITIALIZED）", async () => {
    await expect(
      LiuYaoView({ recordId: TEST_RECORD_ID, personId: TEST_PERSON_ID }),
    ).rejects.toThrow(LiuyaoError);

    try {
      await LiuYaoView({ recordId: TEST_RECORD_ID, personId: TEST_PERSON_ID });
    } catch (err) {
      expect(err).toBeInstanceOf(LiuyaoError);
      expect((err as LiuyaoError).errorCode).toBe("NOT_INITIALIZED");
    }
  });

  it("recordId 无效时抛出错误（不进入 UI 流程）", async () => {
    registerAllMocks();

    await expect(LiuYaoView({ recordId: -1, personId: TEST_PERSON_ID })).rejects.toThrow();

    // selectRecord 不应被调用（验证在早期被拦截）
    const { getSelectLiuyaoRecord } = await import("./callbacks");
    const selectRecord = getSelectLiuyaoRecord();
    // 如果回调注册了，验证没被调用；若为 null 说明已被拦截
    if (selectRecord) {
      expect(selectRecord).not.toHaveBeenCalled();
    }
  });
});
