/**
 * debugApi 新增 Function 单元测试
 *
 * 覆盖范围：
 * - PersonSetDefault：设置默认人物
 * - DaLiuRenUpdateTags / DaLiuRenUpdateNote：大六壬元数据更新
 * - LiuYaoUpdateTags / LiuYaoUpdateNote：六爻元数据更新
 * - WikiReplaceContent / WikiInsertContent：Wiki 细粒度编辑
 *
 * 所有 DB 模块通过 vi.mock() 隔离，纯 mock 测试。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── 模块级 mock ── */

// mock personDb
const mockListPersons = vi.fn();
const mockGetPerson = vi.fn();
const mockSavePerson = vi.fn();
const mockDeletePerson = vi.fn();
const mockGetDefaultPerson = vi.fn();

vi.mock("../personDb", () => ({
  listPersons: mockListPersons,
  getPerson: mockGetPerson,
  savePerson: mockSavePerson,
  deletePerson: mockDeletePerson,
  getDefaultPerson: mockGetDefaultPerson,
}));

// mock events
vi.mock("../events", () => ({
  globalEvents: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

// mock daliurenDb
const mockGetLiurenRecord = vi.fn();
const mockSaveLiurenRecord = vi.fn();
const mockDeleteLiurenRecord = vi.fn();
const mockInvalidateLiurenTagCache = vi.fn();

vi.mock("../daliurenDb", () => ({
  getLiurenRecord: mockGetLiurenRecord,
  saveLiurenRecord: mockSaveLiurenRecord,
  deleteLiurenRecord: mockDeleteLiurenRecord,
  invalidateLiurenTagCache: mockInvalidateLiurenTagCache,
  listLiurenRecords: vi.fn(),
}));

// mock liuyaoDb
const mockGetLiuyaoRecord = vi.fn();
const mockSaveLiuyaoRecord = vi.fn();
const mockDeleteLiuyaoRecord = vi.fn();
const mockInvalidateLiuyaoTagCache = vi.fn();

vi.mock("../liuyaoDb", () => ({
  getLiuyaoRecord: mockGetLiuyaoRecord,
  saveLiuyaoRecord: mockSaveLiuyaoRecord,
  deleteLiuyaoRecord: mockDeleteLiuyaoRecord,
  invalidateLiuyaoTagCache: mockInvalidateLiuyaoTagCache,
  listLiuyaoRecords: vi.fn(),
}));

// mock wikiDb
const mockGetWikiDoc = vi.fn();
const mockSaveWikiDoc = vi.fn();
const mockDeleteWikiDoc = vi.fn();
const mockListWikiDocs = vi.fn();
const mockGetWikiLinks = vi.fn();
const mockGetWikiBacklinks = vi.fn();
const mockSaveWikiLinks = vi.fn();

vi.mock("../wikiDb", () => ({
  getWikiDoc: mockGetWikiDoc,
  saveWikiDoc: mockSaveWikiDoc,
  deleteWikiDoc: mockDeleteWikiDoc,
  listWikiDocs: mockListWikiDocs,
  getWikiLinks: mockGetWikiLinks,
  getWikiBacklinks: mockGetWikiBacklinks,
  saveWikiLinks: mockSaveWikiLinks,
}));

/* ── 延迟导入（mock 生效后） ── */

const { PersonSetDefault } = await import("./person");
const { DaLiuRenUpdateTags, DaLiuRenUpdateNote } = await import("./daliuren");
const { LiuYaoUpdateTags, LiuYaoUpdateNote } = await import("./liuyao");
const { WikiReplaceContent, WikiInsertContent } = await import("./wiki");

/* ── 共享 fixture ── */

const TEST_PERSON_ID = 1;

const mockPerson = {
  id: TEST_PERSON_ID,
  name: "测试人物",
  gender: "男" as const,
  date: "1990-01-01",
  timeIndex: 0,
  isDefault: false,
  savedAt: Date.now(),
  calendar: "solar",
  isLeapMonth: false,
  algorithm: "heaven",
  yearDivide: "standard",
  mutagenTable: "default",
  dayDivide: "early",
  astroType: "heaven",
};

const mockLiurenRecord = {
  id: 100,
  personId: TEST_PERSON_ID,
  calculationTime: "2024-06-15 12:00:00",
  question: "测试问题",
  note: "原始备注",
  background: "原始背景",
  tags: ["原始标签"],
  result: {} as never,
  savedAt: Date.now(),
};

const mockLiuyaoRecord = {
  id: 200,
  personId: TEST_PERSON_ID,
  divinationTime: "2024-06-15T12:00:00",
  question: "测试问题",
  background: "原始背景",
  note: "原始备注",
  tags: ["原始标签"],
  lines: [1, 1, 1, 1, 1, 1] as [number, number, number, number, number, number],
  chart: {} as never,
  yongTarget: "自占" as const,
  yong: {} as never,
  savedAt: Date.now(),
};

const mockWikiDoc = {
  id: 300,
  personId: TEST_PERSON_ID,
  title: "测试文档",
  content: "这是第一行\n这是第二行\n这是第三行",
  tags: ["测试"],
  savedAt: Date.now(),
  updatedAt: Date.now(),
};

/* ── 测试前后清理 ── */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
 * 1. PersonSetDefault
 * ============================================================ */
describe("PersonSetDefault", () => {
  it("成功设置默认人物", async () => {
    mockGetPerson.mockResolvedValue(mockPerson);
    mockSavePerson.mockResolvedValue({ ...mockPerson, isDefault: true });

    const result = await PersonSetDefault(TEST_PERSON_ID);

    expect(result.isDefault).toBe(true);
    expect(mockGetPerson).toHaveBeenCalledWith(TEST_PERSON_ID);
    expect(mockSavePerson).toHaveBeenCalledWith(TEST_PERSON_ID, expect.any(Object), true);
  });

  it("人物不存在时抛出 NOT_FOUND", async () => {
    mockGetPerson.mockResolvedValue(undefined);

    await expect(PersonSetDefault(999)).rejects.toThrow();
  });

  it("personId 无效时抛出 INVALID_INPUT", async () => {
    await expect(PersonSetDefault(-1)).rejects.toThrow();
    await expect(PersonSetDefault(0)).rejects.toThrow();
    await expect(PersonSetDefault(1.5)).rejects.toThrow();
  });
});

/* ============================================================
 * 2. DaLiuRenUpdateTags
 * ============================================================ */
describe("DaLiuRenUpdateTags", () => {
  it("成功更新标签", async () => {
    mockGetLiurenRecord.mockResolvedValue(mockLiurenRecord);
    mockSaveLiurenRecord.mockResolvedValue(100);

    const newTags = ["新标签1", "新标签2"];
    const result = await DaLiuRenUpdateTags({ recordId: 100, tags: newTags });

    expect(result.tags).toEqual(newTags);
    expect(mockSaveLiurenRecord).toHaveBeenCalledWith({
      ...mockLiurenRecord,
      tags: newTags,
    });
    expect(mockInvalidateLiurenTagCache).toHaveBeenCalled();
  });

  it("记录不存在时抛出 NOT_FOUND", async () => {
    mockGetLiurenRecord.mockResolvedValue(undefined);

    await expect(DaLiuRenUpdateTags({ recordId: 999, tags: ["test"] })).rejects.toThrow();
  });

  it("recordId 无效时抛出 INVALID_INPUT", async () => {
    await expect(DaLiuRenUpdateTags({ recordId: -1, tags: ["test"] })).rejects.toThrow();
  });

  it("tags 为空数组时成功（清空标签）", async () => {
    mockGetLiurenRecord.mockResolvedValue(mockLiurenRecord);
    mockSaveLiurenRecord.mockResolvedValue(100);

    const result = await DaLiuRenUpdateTags({ recordId: 100, tags: [] });
    expect(result.tags).toEqual([]);
  });

  it("tags 包含空字符串时抛出 INVALID_INPUT", async () => {
    await expect(DaLiuRenUpdateTags({ recordId: 100, tags: ["valid", ""] })).rejects.toThrow();
  });
});

/* ============================================================
 * 3. DaLiuRenUpdateNote
 * ============================================================ */
describe("DaLiuRenUpdateNote", () => {
  it("成功更新 note 和 background", async () => {
    mockGetLiurenRecord.mockResolvedValue(mockLiurenRecord);
    mockSaveLiurenRecord.mockResolvedValue(100);

    const result = await DaLiuRenUpdateNote({
      recordId: 100,
      note: "新备注",
      background: "新背景",
    });

    expect(result.note).toBe("新备注");
    expect(result.background).toBe("新背景");
    expect(mockSaveLiurenRecord).toHaveBeenCalled();
  });

  it("只更新 note，保留原 background", async () => {
    mockGetLiurenRecord.mockResolvedValue(mockLiurenRecord);
    mockSaveLiurenRecord.mockResolvedValue(100);

    const result = await DaLiuRenUpdateNote({ recordId: 100, note: "新备注" });

    expect(result.note).toBe("新备注");
    expect(result.background).toBe(mockLiurenRecord.background);
  });

  it("只更新 background，保留原 note", async () => {
    mockGetLiurenRecord.mockResolvedValue(mockLiurenRecord);
    mockSaveLiurenRecord.mockResolvedValue(100);

    const result = await DaLiuRenUpdateNote({ recordId: 100, background: "新背景" });

    expect(result.note).toBe(mockLiurenRecord.note);
    expect(result.background).toBe("新背景");
  });

  it("记录不存在时抛出 NOT_FOUND", async () => {
    mockGetLiurenRecord.mockResolvedValue(undefined);

    await expect(DaLiuRenUpdateNote({ recordId: 999, note: "test" })).rejects.toThrow();
  });
});

/* ============================================================
 * 4. LiuYaoUpdateTags
 * ============================================================ */
describe("LiuYaoUpdateTags", () => {
  it("成功更新标签", async () => {
    mockGetLiuyaoRecord.mockResolvedValue(mockLiuyaoRecord);
    mockSaveLiuyaoRecord.mockResolvedValue(200);

    const newTags = ["财运", "考试"];
    const result = await LiuYaoUpdateTags({ recordId: 200, tags: newTags });

    expect(result.tags).toEqual(newTags);
    expect(mockSaveLiuyaoRecord).toHaveBeenCalledWith({
      ...mockLiuyaoRecord,
      tags: newTags,
    });
    expect(mockInvalidateLiuyaoTagCache).toHaveBeenCalled();
  });

  it("记录不存在时抛出 NOT_FOUND", async () => {
    mockGetLiuyaoRecord.mockResolvedValue(undefined);

    await expect(LiuYaoUpdateTags({ recordId: 999, tags: ["test"] })).rejects.toThrow();
  });

  it("recordId 无效时抛出 INVALID_INPUT", async () => {
    await expect(LiuYaoUpdateTags({ recordId: 0, tags: ["test"] })).rejects.toThrow();
  });
});

/* ============================================================
 * 5. LiuYaoUpdateNote
 * ============================================================ */
describe("LiuYaoUpdateNote", () => {
  it("成功更新 note 和 background", async () => {
    mockGetLiuyaoRecord.mockResolvedValue(mockLiuyaoRecord);
    mockSaveLiuyaoRecord.mockResolvedValue(200);

    const result = await LiuYaoUpdateNote({
      recordId: 200,
      note: "新备注",
      background: "新背景",
    });

    expect(result.note).toBe("新备注");
    expect(result.background).toBe("新背景");
  });

  it("只更新 note，保留原 background", async () => {
    mockGetLiuyaoRecord.mockResolvedValue(mockLiuyaoRecord);
    mockSaveLiuyaoRecord.mockResolvedValue(200);

    const result = await LiuYaoUpdateNote({ recordId: 200, note: "新备注" });

    expect(result.note).toBe("新备注");
    expect(result.background).toBe(mockLiuyaoRecord.background);
  });
});

/* ============================================================
 * 6. WikiReplaceContent
 * ============================================================ */
describe("WikiReplaceContent", () => {
  it("全局替换成功", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiReplaceContent({
      docId: 300,
      searchText: "这是",
      replaceText: "那是",
      isGlobal: true,
    });

    expect(result.content).toBe("那是第一行\n那是第二行\n那是第三行");
    expect(result.updatedAt).toBeGreaterThan(mockWikiDoc.updatedAt);
  });

  it("单次替换（isGlobal=false）只替换第一个匹配", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiReplaceContent({
      docId: 300,
      searchText: "这是",
      replaceText: "那是",
      isGlobal: false,
    });

    expect(result.content).toBe("那是第一行\n这是第二行\n这是第三行");
  });

  it("默认 isGlobal 为 true", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiReplaceContent({
      docId: 300,
      searchText: "这是",
      replaceText: "那是",
    });

    expect(result.content).toBe("那是第一行\n那是第二行\n那是第三行");
  });

  it("搜索文本不存在时内容不变", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiReplaceContent({
      docId: 300,
      searchText: "不存在的文本",
      replaceText: "替换文本",
    });

    expect(result.content).toBe(mockWikiDoc.content);
  });

  it("searchText 为空时抛出 INVALID_INPUT", async () => {
    await expect(
      WikiReplaceContent({ docId: 300, searchText: "", replaceText: "test" }),
    ).rejects.toThrow();
  });

  it("文档不存在时抛出 NOT_FOUND", async () => {
    mockGetWikiDoc.mockResolvedValue(undefined);

    await expect(
      WikiReplaceContent({ docId: 999, searchText: "test", replaceText: "new" }),
    ).rejects.toThrow();
  });
});

/* ============================================================
 * 7. WikiInsertContent
 * ============================================================ */
describe("WikiInsertContent", () => {
  it("在文档末尾插入（默认）", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "新内容",
    });

    expect(result.content).toBe(mockWikiDoc.content + "\n新内容");
  });

  it("在文档开头插入", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "新标题",
      position: "start",
    });

    expect(result.content).toBe("新标题\n" + mockWikiDoc.content);
  });

  it("在指定行之前插入（1-based）", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "插入行",
      position: 2,
    });

    const expectedLines = ["这是第一行", "插入行", "这是第二行", "这是第三行"];
    expect(result.content).toBe(expectedLines.join("\n"));
  });

  it("行号超出范围时插入到末尾", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "追加",
      position: 999,
    });

    expect(result.content).toBe(mockWikiDoc.content + "\n追加");
  });

  it("插入多行内容", async () => {
    mockGetWikiDoc.mockResolvedValue(mockWikiDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "新行1\n新行2\n新行3",
      position: "end",
    });

    expect(result.content).toBe(mockWikiDoc.content + "\n新行1\n新行2\n新行3");
  });

  it("content 为空时抛出 INVALID_INPUT", async () => {
    await expect(WikiInsertContent({ docId: 300, content: "" })).rejects.toThrow();
  });

  it("文档不存在时抛出 NOT_FOUND", async () => {
    mockGetWikiDoc.mockResolvedValue(undefined);

    await expect(WikiInsertContent({ docId: 999, content: "test" })).rejects.toThrow();
  });

  it("updatedAt 时间戳更新", async () => {
    const oldDoc = { ...mockWikiDoc, updatedAt: Date.now() - 10000 };
    mockGetWikiDoc.mockResolvedValue(oldDoc);
    mockSaveWikiDoc.mockResolvedValue(300);

    const result = await WikiInsertContent({
      docId: 300,
      content: "新内容",
    });

    expect(result.updatedAt).toBeGreaterThan(oldDoc.updatedAt);
  });
});
