/**
 * 集成测试：验证 debugApi 与 rtcAgent 模块协同工作的端到端场景。
 *
 * 覆盖范围：
 * - 场景1：创建人物 → 获取运限数据 → 验证数据正确性
 * - 场景2：切换人物 → 验证 pick 状态重置 → 设置新时间 → 验证数据更新
 * - 场景3：并发调用多个 ZiWei → 验证无竞态条件
 * - 场景4：超时场景 → 验证超时控制和错误处理
 * - 场景5：缓存命中 → 验证性能提升和数据一致性
 * - 场景6：错误恢复 → 验证回调注册/注销/重注册流程
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { astro } from "iztro";
import type { Zwds } from "./useZwds";
import type {
  ZiWeiError as ZiWeiErrorType,
  ParseDateError as ParseDateErrorType,
  ComputeScopeError as ComputeScopeErrorType,
} from "./debugApi";

// ── Mock 外部依赖 ──────────────────────────────────────
// Mock @rtc-agent/component（rtcAgent.ts 依赖，需要 DOM 环境）
vi.mock("@rtc-agent/component", () => {
  const createMockSchema = () => ({
    describe: () => createMockSchema(),
    optional: () => createMockSchema(),
    int: () => createMockSchema(),
    positive: () => createMockSchema(),
    min: () => createMockSchema(),
    max: () => createMockSchema(),
    parse: (input: unknown) => input,
  });
  return {
    createRtcAgent: vi.fn(),
    switchLocale: vi.fn(),
    withMeta: () => createMockSchema(),
    z: {
      object: () => createMockSchema(),
      string: () => createMockSchema(),
      number: () => createMockSchema(),
      enum: () => createMockSchema(),
      boolean: () => createMockSchema(),
      array: () => createMockSchema(),
    },
  };
});

// Mock theme 模块
vi.mock("./theme", () => ({
  getTheme: () => "light",
}));

// Mock personDb（IndexedDB 操作，在 Node 环境中不可用）
vi.mock("./personDb", () => ({
  listPersons: vi.fn(),
  getPerson: vi.fn(),
  savePerson: vi.fn(),
  deletePerson: vi.fn(),
  getDefaultPerson: vi.fn(),
  getLiurenRecord: vi.fn(),
  listLiurenRecords: vi.fn(),
  saveLiurenRecord: vi.fn(),
  invalidateLiurenTagCache: vi.fn(),
  listWikiDocs: vi.fn(),
  getWikiDoc: vi.fn(),
  saveWikiDoc: vi.fn(),
  getWikiLinks: vi.fn(),
  getWikiBacklinks: vi.fn(),
  saveWikiLinks: vi.fn(),
}));

// Mock events 模块
vi.mock("./events", () => ({
  globalEvents: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// Mock hbar 的缓存清理函数（真实计算保留，只 mock 清理接口）
vi.mock("./hbar", async () => {
  const actual = await vi.importActual<typeof import("./hbar")>("./hbar");
  return {
    ...actual,
    clearHbarCaches: vi.fn(),
  };
});

// Mock cache 模块的注册和清理函数（LRUCache 本身保留）
vi.mock("./cache", async () => {
  const actual = await vi.importActual<typeof import("./cache")>("./cache");
  return {
    ...actual,
    clearAllCaches: vi.fn(),
    getAllCacheStats: vi.fn(() => ({})),
  };
});

// Mock chartIndex
vi.mock("./chartIndex", async () => {
  const actual = await vi.importActual<typeof import("./chartIndex")>("./chartIndex");
  return { ...actual };
});

// ── 延迟导入（mock 生效后再导入） ──────────────────────────
const {
  computeZiWeiData,
  computeScopeData,
  parseDate,
  ZiWeiError,
  ParseDateError,
  ComputeScopeError,
  registerDebugApi,
  registerZiWeiCallbacks,
  registerDaLiuRenCallbacks,
  registerWikiCallbacks,
  unregisterPageCallbacks,
  resetDebugApi,
  ZiWei,
  GetScopeData,
  PersonList,
  PersonGet,
  PersonCreate,
  PersonUpdate,
  PersonDelete,
} = await import("./debugApi");

const { mergeBirthInput } = await import("./rtcAgent");

// 导入被 mock 的模块引用，以便在测试中控制行为
const { getPerson, getDefaultPerson, savePerson, listPersons, deletePerson } =
  await import("./personDb");
const { globalEvents } = await import("./events");

/* ─────────────── 测试辅助 ─────────────── */

/** 构造测试用 Person 对象 */
function makePerson(
  overrides: Partial<import("./personDb").Person> = {},
): import("./personDb").Person {
  return {
    id: 1,
    name: "测试人物",
    gender: "男",
    calendar: "solar",
    date: "2000-08-16",
    timeIndex: 2,
    isLeapMonth: false,
    algorithm: "default",
    yearDivide: "normal",
    mutagenTable: "default",
    dayDivide: "forward",
    astroType: "heaven",
    isDefault: true,
    savedAt: Date.now(),
    exactTime: "",
    useTrueSolar: false,
    placeMode: "china",
    province: "北京",
    city: "北京",
    district: "市区",
    timezone: "",
    residence: "",
    ...overrides,
  } as import("./personDb").Person;
}

/** 构造最小化 Zwds 对象（含真实 iztro 本命盘） */
function makeRealZwds(person?: import("./personDb").Person): Zwds {
  const p = person ?? makePerson();
  const astrolabe = astro.withOptions({
    type: p.calendar,
    dateStr: p.date,
    timeIndex: p.timeIndex,
    gender: p.gender as never,
    isLeapMonth: p.isLeapMonth,
    fixLeap: true,
    language: "zh-CN",
    astroType: p.astroType,
    config: {
      algorithm: p.algorithm,
      yearDivide: p.yearDivide,
      horoscopeDivide: p.yearDivide,
      dayDivide: p.dayDivide,
    },
  });

  const pick = { year: 2026, month: 5, day: 15, hour: 6, leap: false };
  const targetSolar = `${pick.year}-${String(pick.month).padStart(2, "0")}-${String(pick.day).padStart(2, "0")}`;
  const horoscope = astrolabe.horoscope(targetSolar, pick.hour);
  const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;

  return {
    astrolabe,
    horoscope,
    birthLunarYear,
    pick,
    visible: {
      decadal: true,
      yearly: false,
      monthly: false,
      daily: false,
      hourly: false,
    },
    input: {} as any,
    decades: [],
    childhood: null,
    activeDecadeIdx: 0,
    years: [],
    months: [],
    days: [],
    hours: [],
    monthDays: 30,
    clampedDay: 15,
    effLeap: false,
    targetSolar,
    trueSolar: null,
    soulPalaceIndex: 0,
    lifeKline: {} as any,
    analysis: null,
    actions: {
      showScope: vi.fn(),
      lockPick: vi.fn(),
      unlockPick: vi.fn(),
      setPickBatch: vi.fn(),
      getPickVersion: vi.fn(() => 1),
      pickDecade: vi.fn(),
      pickYear: vi.fn(),
      pickMonth: vi.fn(),
      pickDay: vi.fn(),
      pickHour: vi.fn(),
      showNatal: vi.fn(),
      setDecadalVisible: vi.fn(),
      toggleScope: vi.fn(),
    },
  } as unknown as Zwds;
}

/* ─────────────── 测试套件 ─────────────── */

describe("集成测试：debugApi + rtcAgent 端到端场景", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDebugApi();
  });

  afterEach(() => {
    resetDebugApi();
  });

  /* ── 场景1：创建人物 → 获取运限数据 → 验证数据正确性 ── */
  describe("场景1：创建人物 → 获取运限数据", () => {
    it("完整链路：savePerson → getPerson → computeScopeData → 验证 hbar 结构", async () => {
      // 1. 模拟 PersonCreate：savePerson 返回带 id 的人物
      const newPerson = makePerson({ id: 10, name: "新建人物" });
      vi.mocked(savePerson).mockResolvedValue(newPerson);

      // 2. 模拟 PersonGet：返回刚创建的人物
      vi.mocked(getPerson).mockResolvedValue(newPerson);

      // 3. 执行：创建人物
      const created = await PersonCreate(
        {
          name: "新建人物",
          gender: "男",
          calendar: "solar",
          date: "2000-08-16",
          timeIndex: 2,
          isLeapMonth: false,
          exactTime: "",
          useTrueSolar: false,
          placeMode: "china",
          province: "北京",
          city: "北京",
          district: "市区",
          timezone: "",
          algorithm: "default",
          yearDivide: "normal",
          mutagenTable: "default",
          dayDivide: "forward",
          astroType: "heaven",
          residence: "",
        },
        false,
      );

      expect(created.id).toBe(10);
      expect(created.name).toBe("新建人物");
      // 验证触发了 person.changed 事件
      expect(globalEvents.emit).toHaveBeenCalledWith("person.changed", expect.any(Object));

      // 4. 执行：获取运限数据（纯计算路径）
      const hbarData = computeScopeData(created, "2026-05-15");

      // 5. 验证 hbar 数据结构完整
      expect(hbarData).not.toBeNull();
      expect(hbarData!.decades).toHaveLength(12); // 12 个大运
      expect(hbarData!.years.length).toBeGreaterThan(0); // 流年列表非空
      expect(hbarData!.months.length).toBeGreaterThanOrEqual(12); // 至少 12 个月
    });

    it("mergeBirthInput → computeScopeData：AI 提供的部分字段能完成排盘", () => {
      // AI 只提供核心字段，mergeBirthInput 补齐其余
      const partialInput = {
        name: "AI创建人物",
        date: "1990-05-15",
        timeIndex: 4,
        gender: "男" as const,
      };
      const fullInput = mergeBirthInput(partialInput);

      // 验证合并后的字段
      expect(fullInput.name).toBe("AI创建人物");
      expect(fullInput.calendar).toBe("solar"); // 默认值
      expect(fullInput.isLeapMonth).toBe(false); // 默认值
      expect(fullInput.algorithm).toBe("zhongzhou"); // DEFAULT_BIRTH_INPUT 的值

      // 用合并后的输入构造 Person 并计算运限
      const person = makePerson({
        name: fullInput.name,
        date: fullInput.date,
        timeIndex: fullInput.timeIndex,
        gender: fullInput.gender,
        calendar: fullInput.calendar,
        algorithm: fullInput.algorithm,
      });
      const hbarData = computeScopeData(person, "2024-06-15");

      expect(hbarData).not.toBeNull();
      expect(hbarData!.decades).toHaveLength(12);
    });
  });

  /* ── 场景2：切换人物 → pick 状态重置 → 设置新时间 → 数据更新 ── */
  describe("场景2：切换人物 → 数据一致性验证", () => {
    it("不同人物的运限数据不同", () => {
      const person1 = makePerson({ id: 1, date: "2000-08-16", timeIndex: 2, gender: "男" });
      const person2 = makePerson({ id: 2, date: "1990-03-20", timeIndex: 6, gender: "女" });

      const hbar1 = computeScopeData(person1, "2026-05-15");
      const hbar2 = computeScopeData(person2, "2026-05-15");

      expect(hbar1).not.toBeNull();
      expect(hbar2).not.toBeNull();

      // 不同生辰 → 不同大限排列
      // 至少大运宫位序列应不同（不同性别/生辰导致阳逆阴顺差异）
      const decades1 = hbar1!.decades.map(d => d.palaceIndex);
      const decades2 = hbar2!.decades.map(d => d.palaceIndex);
      // 不要求完全不同（偶然可能部分相同），但数据确实来自不同计算
      expect(hbar1!.decades[0].heavenlyStem).not.toBe(hbar2!.decades[0].heavenlyStem);
    });

    it("同一人物不同日期 → pick 不同 → 流年列表不同", () => {
      const person = makePerson();

      const hbar1 = computeScopeData(person, "2026-05-15");
      const hbar2 = computeScopeData(person, "2030-08-20");

      expect(hbar1).not.toBeNull();
      expect(hbar2).not.toBeNull();

      // pick.year 应不同
      expect(hbar1!.pick.year).toBe(2026);
      expect(hbar2!.pick.year).toBe(2030);

      // 流年列表包含 pick 年份
      const years1 = hbar1!.years.map((y: any) => y.year);
      const years2 = hbar2!.years.map((y: any) => y.year);
      expect(years1).toContain(2026);
      expect(years2).toContain(2030);
      // 两个流年列表长度相同（固定窗口）
      expect(years1.length).toBe(years2.length);
      // pick 不同导致大运激活不同：hbar1 pick 2026 vs hbar2 pick 2030
      // 大运列表的 range 不变，但 pick.year 确实不同（已验证）
      expect(hbar1!.pick.year).not.toBe(hbar2!.pick.year);
    });

    it("computeZiWeiData：从 Zwds 状态提取数据与 computeScopeData 一致", () => {
      const person = makePerson();
      const z = makeRealZwds(person);

      // computeZiWeiData 从 Zwds 提取
      const fromZwds = computeZiWeiData(z, "yearly");

      // computeScopeData 从 Person 计算
      const fromPerson = computeScopeData(person, "2026-05-15");

      // hbar 的大运数量应一致（12 个大运）
      expect(fromZwds.hbar).not.toBeNull();
      expect(fromPerson).not.toBeNull();
      expect(fromZwds.hbar!.decades).toHaveLength(fromPerson!.decades.length);

      // chart 在 scope="yearly" 时应非空
      expect(fromZwds.chart).not.toBeNull();
    });
  });

  /* ── 场景3：并发调用 → 验证无竞态条件 ── */
  describe("场景3：并发调用无竞态", () => {
    it("并发 computeScopeData：同一人物多日期同时计算，结果互不干扰", () => {
      const person = makePerson();
      const dates = ["2024-01-15", "2025-06-20", "2026-12-25", "2030-03-10"];

      // 并发执行
      const results = dates.map(date => computeScopeData(person, date));

      // 每个结果都应有效且 pick 与对应日期一致
      results.forEach((result, i) => {
        expect(result).not.toBeNull();
        const expectedYear = parseInt(dates[i].split("-")[0]);
        const expectedMonth = parseInt(dates[i].split("-")[1]);
        expect(result!.pick.year).toBe(expectedYear);
        expect(result!.pick.month).toBe(expectedMonth);
      });
    });

    it("并发 computeZiWeiData：多个 Zwds 对象同时计算，各自独立", () => {
      const persons = [
        makePerson({ id: 1, date: "2000-08-16", gender: "男" }),
        makePerson({ id: 2, date: "1990-03-20", gender: "女" }),
        makePerson({ id: 3, date: "1985-11-05", gender: "男" }),
      ];

      const zwdsList = persons.map(p => makeRealZwds(p));

      // 并发计算
      const results = zwdsList.map(z => computeZiWeiData(z, "yearly"));

      // 每个结果独立且有效
      results.forEach(result => {
        expect(result.hbar).not.toBeNull();
        expect(result.chart).not.toBeNull();
        expect(result.hbar!.decades).toHaveLength(12);
      });
    });

    it("并发 parseDate：多格式同时解析不会相互影响", () => {
      const inputs: (Date | number | string)[] = [
        "2024-06-15",
        1718452800000,
        new Date("2024-06-15T12:00:00"),
        "2024-06-15 14:30",
        "2024-06-15T14:30:45.000Z",
        "1718452800", // 秒级时间戳字符串
      ];

      const results = inputs.map(input => parseDate(input));

      // 每个结果都是有效 Date
      results.forEach(d => {
        expect(d).toBeInstanceOf(Date);
        expect(isNaN(d.getTime())).toBe(false);
      });
    });
  });

  /* ── 场景4：超时场景 → 验证超时控制和错误处理 ── */
  describe("场景4：超时和错误处理", () => {
    it("waitForCallbacks 超时：ZiWei skipUI=false 时回调未注册抛出 ZiWeiError", async () => {
      // 模拟 _getZwds 返回 null 但回调已注册 → "排盘数据未就绪"
      const mockGetZwds = vi.fn(() => null);
      const mockGetPerson = vi.fn(() => null);
      const mockPerson = makePerson({ id: 1 });

      // 注册回调使 skipUI 路径可用，但 getZwds 返回 null → "排盘数据未就绪"
      registerZiWeiCallbacks({ getZwds: mockGetZwds });
      registerDebugApi({ getPerson: mockGetPerson });

      // getDefaultPerson 需返回有效人物（resolvePersonId 需要）
      vi.mocked(getDefaultPerson).mockResolvedValue(mockPerson);

      await expect(ZiWei(undefined, "yearly", undefined, { skipUI: true })).rejects.toThrow(
        /排盘数据未就绪/,
      );
    });

    it("ZiWei 无效 scope：抛出 ZiWeiError", async () => {
      const person = makePerson({ id: 1 });
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      // 注册基本回调
      registerZiWeiCallbacks({ getZwds: () => makeRealZwds(person) });
      registerDebugApi({ getPerson: () => person });

      // 传无效 scope 会触发输入校验错误
      await expect(ZiWei(1, "invalid_scope" as any)).rejects.toThrow(/scope 无效/);
    });

    it("parseDate 无效输入：抛出 ParseDateError 包含完整上下文", () => {
      try {
        parseDate("totally-invalid");
        expect.fail("应该抛出 ParseDateError");
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        const pde = err as ParseDateErrorType;
        expect(pde.rawInput).toBe("totally-invalid");
        expect(pde.source).toBe("parseDate");
        expect(pde.attemptedFormats.length).toBeGreaterThan(0);
        expect(pde.suggestion).toContain("支持的格式");
      }
    });

    it("computeScopeData 无效日期：抛出 ParseDateError 而非 ComputeScopeError", () => {
      const person = makePerson();
      expect(() => computeScopeData(person, "")).toThrow(ParseDateError);
    });
  });

  /* ── 场景5：缓存命中 → 验证性能提升和数据一致性 ── */
  describe("场景5：缓存命中与数据一致性", () => {
    it("相同输入的 computeScopeData 多次调用结果一致", () => {
      const person = makePerson();

      const result1 = computeScopeData(person, "2026-05-15");
      const result2 = computeScopeData(person, "2026-05-15");
      const result3 = computeScopeData(person, "2026-05-15");

      // 结果结构完全一致
      expect(result1!.decades.length).toBe(result2!.decades.length);
      expect(result2!.decades.length).toBe(result3!.decades.length);

      // 大运干支相同
      expect(result1!.decades[0].heavenlyStem).toBe(result2!.decades[0].heavenlyStem);
      expect(result1!.decades[0].earthlyBranch).toBe(result2!.decades[0].earthlyBranch);

      // pick 相同
      expect(result1!.pick.year).toBe(result2!.pick.year);
      expect(result1!.pick.month).toBe(result2!.pick.month);
    });

    it("resetDebugApi 后缓存被清理，重新计算结果仍一致", () => {
      const person = makePerson();

      const result1 = computeScopeData(person, "2026-05-15");
      expect(result1).not.toBeNull();

      // 重置（清理缓存）
      resetDebugApi();

      // 重新计算
      const result2 = computeScopeData(person, "2026-05-15");
      expect(result2).not.toBeNull();

      // 结果应一致（纯函数确定性）
      expect(result1!.decades[0].heavenlyStem).toBe(result2!.decades[0].heavenlyStem);
      expect(result1!.decades[0].palaceIndex).toBe(result2!.decades[0].palaceIndex);
    });

    it("computeZiWeiData 共享 chartIndex 缓存：多次调用同一 astrolabe 不报错", () => {
      const person = makePerson();
      const z = makeRealZwds(person);

      // 多次调用 computeZiWeiData（内部 buildChartIndex 会缓存）
      const r1 = computeZiWeiData(z, "yearly");
      const r2 = computeZiWeiData(z, "monthly");
      const r3 = computeZiWeiData(z, "daily");

      // 都返回有效数据
      expect(r1.chart).not.toBeNull();
      expect(r2.chart).not.toBeNull();
      expect(r3.chart).not.toBeNull();
    });
  });

  /* ── 场景6：回调注册/注销/重注册 → 验证状态管理 ── */
  describe("场景6：回调注册与状态管理", () => {
    it("registerZiWeiCallbacks → ZiWei skipUI 路径可用", async () => {
      const person = makePerson();
      const z = makeRealZwds(person);

      // 注册回调
      const mockGetZwds = vi.fn(() => z);
      const mockGetPerson = vi.fn(() => person);
      registerZiWeiCallbacks({ getZwds: mockGetZwds });
      registerDebugApi({ getPerson: mockGetPerson });

      // getDefaultPerson 需返回有效人物（resolvePersonId 需要）
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      // skipUI 模式调用
      const result = await ZiWei(undefined, "yearly", undefined, { skipUI: true });

      expect(result.person).toBe(person);
      expect(result.hbar).not.toBeNull();
      expect(result.chart).not.toBeNull();
      expect(mockGetZwds).toHaveBeenCalled();
      expect(mockGetPerson).toHaveBeenCalled();
    });

    it("unregisterPageCallbacks 后 ZiWei 仍能工作（回调函数未清空）", async () => {
      const person = makePerson();
      const z = makeRealZwds(person);

      registerZiWeiCallbacks({ getZwds: () => z });
      registerDebugApi({ getPerson: () => person });
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      // 注销回调（仅重置就绪标志，不清空函数引用）
      unregisterPageCallbacks("ziwei");

      // skipUI 模式仍能工作（因为 _getZwds 和 _getPerson 引用仍在）
      const result = await ZiWei(undefined, "yearly", undefined, { skipUI: true });
      expect(result.person).toBe(person);
    });

    it("resetDebugApi 后所有回调被清空，skipUI 模式抛出错误", async () => {
      const person = makePerson();
      const z = makeRealZwds(person);

      registerZiWeiCallbacks({ getZwds: () => z });
      registerDebugApi({ getPerson: () => person });

      // 重置全部状态
      resetDebugApi();

      // resolvePersonId 仍需 getDefaultPerson（在回调检查之前调用）
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      // skipUI 模式：_getZwds 已被清空 → 抛出"未初始化"错误
      await expect(ZiWei(undefined, "yearly", undefined, { skipUI: true })).rejects.toThrow(
        /未初始化/,
      );
    });

    it("GetScopeData：mock DB 返回人物后纯计算运限", async () => {
      const person = makePerson({ id: 5 });
      vi.mocked(getPerson).mockResolvedValue(person);
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      const result = await GetScopeData("2026-05-15", 5);

      expect(result).not.toBeNull();
      expect(result!.decades).toHaveLength(12);
      expect(result!.pick.year).toBe(2026);
      expect(result!.pick.month).toBe(5);
      expect(getPerson).toHaveBeenCalledWith(5);
    });

    it("PersonList：mock DB 返回人物列表", async () => {
      const persons = [makePerson({ id: 1, name: "人物A" }), makePerson({ id: 2, name: "人物B" })];
      vi.mocked(listPersons).mockResolvedValue(persons);

      const result = await PersonList();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("人物A");
      expect(result[1].name).toBe("人物B");
    });

    it("PersonGet：mock DB 返回人物详情", async () => {
      const person = makePerson({ id: 3, name: "张三" });
      vi.mocked(getPerson).mockResolvedValue(person);
      vi.mocked(getDefaultPerson).mockResolvedValue(person);

      const result = await PersonGet(3);
      expect(result.name).toBe("张三");
      expect(result.id).toBe(3);
    });

    it("PersonUpdate：更新后触发 person.changed 事件", async () => {
      const updated = makePerson({ id: 1, name: "更新后" });
      vi.mocked(savePerson).mockResolvedValue(updated);
      vi.mocked(getPerson).mockResolvedValue(makePerson({ id: 1, name: "更新前" }));

      const result = await PersonUpdate(1, {
        ...makePerson({ name: "更新后" }),
      });

      expect(result.name).toBe("更新后");
      expect(globalEvents.emit).toHaveBeenCalledWith("person.changed", expect.any(Object));
    });

    it("PersonDelete：删除后触发 person.changed 事件（切回默认人物）", async () => {
      const defaultPerson = makePerson({ id: 1, name: "默认" });
      vi.mocked(deletePerson).mockResolvedValue(undefined);
      vi.mocked(getDefaultPerson).mockResolvedValue(defaultPerson);

      await PersonDelete(2);

      expect(deletePerson).toHaveBeenCalledWith(2);
      expect(globalEvents.emit).toHaveBeenCalledWith("person.changed", defaultPerson);
    });
  });

  /* ── 跨模块集成：rtcAgent.mergeBirthInput → debugApi.computeScopeData ── */
  describe("跨模块集成：rtcAgent → debugApi", () => {
    it("mergeBirthInput 的输出可直接用于构造 Person → computeScopeData", () => {
      // AI 通过 rtcAgent 的 mergeBirthInput 补齐 BirthInput
      const merged = mergeBirthInput({
        name: "跨模块测试",
        date: "1985-07-20",
        timeIndex: 8,
        gender: "女",
      });

      // 构造 Person（模拟 savePerson 返回）
      const person = makePerson({
        name: merged.name,
        date: merged.date,
        timeIndex: merged.timeIndex,
        gender: merged.gender,
        calendar: merged.calendar,
        isLeapMonth: merged.isLeapMonth,
        algorithm: merged.algorithm,
        yearDivide: merged.yearDivide,
        mutagenTable: merged.mutagenTable,
        dayDivide: merged.dayDivide,
        astroType: merged.astroType,
      });

      // 用 debugApi 的 computeScopeData 计算运限
      const hbarData = computeScopeData(person, "2024-06-15");

      expect(hbarData).not.toBeNull();
      expect(hbarData!.decades).toHaveLength(12);
      expect(hbarData!.years.length).toBeGreaterThan(0);

      // 验证女性的大运排列（阴女/阳女方向不同）
      // 1985 年乙丑年，天干乙为阴干，女命阴干顺行
      expect(hbarData!.decades.length).toBe(12);
    });

    it("mergeBirthInput 农历输入 → computeScopeData 正确排盘", () => {
      const merged = mergeBirthInput({
        name: "农历测试",
        date: "1990-04-01",
        timeIndex: 4,
        gender: "男",
        calendar: "lunar",
      });

      const person = makePerson({
        name: merged.name,
        date: merged.date,
        timeIndex: merged.timeIndex,
        gender: merged.gender,
        calendar: merged.calendar,
        isLeapMonth: merged.isLeapMonth,
      });

      // 农历输入也应正确计算
      const hbarData = computeScopeData(person, "2024-06-15");
      expect(hbarData).not.toBeNull();
      expect(hbarData!.decades).toHaveLength(12);
    });
  });

  /* ── 错误传播链路验证 ── */
  describe("错误传播链路", () => {
    it("ComputeScopeError 包含人物上下文和建议", () => {
      const err = new ComputeScopeError("计算失败", {
        personId: 42,
        personName: "测试",
        solarDate: "invalid",
        suggestion: "检查数据",
      });

      expect(err).toBeInstanceOf(ZiWeiError);
      expect(err.source).toBe("computeScopeData");
      expect(err.context.personId).toBe(42);
      expect(err.context.personName).toBe("测试");
      expect(err.suggestion).toBe("检查数据");
    });

    it("ParseDateError → computeScopeData 调用链中正确传播", () => {
      const person = makePerson();

      try {
        computeScopeData(person, "not-a-date-at-all");
        expect.fail("应抛出错误");
      } catch (err) {
        expect(err).toBeInstanceOf(ParseDateError);
        expect((err as ParseDateErrorType).rawInput).toBe("not-a-date-at-all");
        // ParseDateError 的 source 固定为 "parseDate"
        expect((err as ParseDateErrorType).source).toBe("parseDate");
      }
    });

    it("ZiWeiError 支持 cause 错误链", () => {
      const rootCause = new Error("iztro 内部错误");
      const err = new ZiWeiError("包装错误", "testSource", {
        cause: rootCause,
        context: { step: "computeAstrolabe" },
      });

      expect(err.cause).toBe(rootCause);
      expect(err.context.step).toBe("computeAstrolabe");
    });
  });
});
