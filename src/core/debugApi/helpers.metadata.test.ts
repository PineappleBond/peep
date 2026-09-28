/**
 * updateRecordMetadata 辅助函数单元测试
 *
 * 覆盖范围：
 * - 正常更新场景（成功获取、更新、保存记录）
 * - 记录不存在场景（返回 null）
 * - 缓存失效调用验证
 * - 错误处理（ErrorClass 抛出的错误）
 *
 * 设计原则：
 * - 纯 mock 测试，隔离数据库依赖
 * - 验证辅助函数的单一职责
 * - 覆盖边缘场景（空记录、无效 ID 等）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateRecordMetadata } from "./helpers";
import { ZiWeiError } from "./errors";

/* ── Mock 函数 ── */

const mockGetRecord = vi.fn();
const mockSaveRecord = vi.fn();
const mockInvalidateCache = vi.fn();

/* ── 测试夹具 ── */

interface TestRecord {
  id: number;
  name: string;
  tags: string[];
}

const createMockRecord = (id: number, tags: string[] = []): TestRecord => ({
  id,
  name: `记录${id}`,
  tags,
});

/* ── 测试套件 ── */

describe("updateRecordMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常更新场景", () => {
    it("成功更新记录标签", async () => {
      const recordId = 1;
      const originalRecord = createMockRecord(recordId, ["旧标签"]);
      const newTags = ["新标签1", "新标签2"];

      mockGetRecord.mockResolvedValue(originalRecord);
      mockSaveRecord.mockResolvedValue(undefined);

      const result = await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => ({ ...record, tags: newTags }),
        mockInvalidateCache,
        ZiWeiError,
        "testUpdate",
      );

      expect(mockGetRecord).toHaveBeenCalledWith(recordId);
      expect(mockSaveRecord).toHaveBeenCalledWith({ ...originalRecord, tags: newTags });
      expect(mockInvalidateCache).toHaveBeenCalled();
      expect(result.tags).toEqual(newTags);
    });

    it("成功更新记录备注", async () => {
      const recordId = 2;
      const originalRecord = createMockRecord(recordId);
      const newNote = "新的备注信息";

      mockGetRecord.mockResolvedValue(originalRecord);
      mockSaveRecord.mockResolvedValue(undefined);

      const result = await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => ({ ...record, name: newNote }),
        undefined, // 不失效缓存
        ZiWeiError,
        "testUpdateNote",
      );

      expect(mockGetRecord).toHaveBeenCalledWith(recordId);
      expect(mockSaveRecord).toHaveBeenCalled();
      expect(mockInvalidateCache).not.toHaveBeenCalled(); // 未提供缓存失效函数
      expect(result.name).toBe(newNote);
    });

    it("支持复杂字段更新（多字段同时更新）", async () => {
      const recordId = 3;
      const originalRecord = createMockRecord(recordId, ["标签A"]);

      mockGetRecord.mockResolvedValue(originalRecord);
      mockSaveRecord.mockResolvedValue(undefined);

      const result = await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => ({
          ...record,
          name: "新名称",
          tags: ["标签A", "标签B", "标签C"],
        }),
        mockInvalidateCache,
        ZiWeiError,
        "testComplexUpdate",
      );

      expect(result.name).toBe("新名称");
      expect(result.tags).toEqual(["标签A", "标签B", "标签C"]);
    });
  });

  describe("记录不存在场景", () => {
    it("记录不存在时抛出错误（带 ErrorClass）", async () => {
      const recordId = 999;
      mockGetRecord.mockResolvedValue(null);

      await expect(
        updateRecordMetadata<TestRecord>(
          recordId,
          mockGetRecord,
          mockSaveRecord,
          record => record,
          undefined,
          ZiWeiError,
          "testNotFound",
        ),
      ).rejects.toThrow(/记录 999 不存在/);

      expect(mockSaveRecord).not.toHaveBeenCalled();
      expect(mockInvalidateCache).not.toHaveBeenCalled();
    });

    it("记录不存在时抛出普通错误（无 ErrorClass）", async () => {
      const recordId = 888;
      mockGetRecord.mockResolvedValue(null);

      await expect(
        updateRecordMetadata<TestRecord>(
          recordId,
          mockGetRecord,
          mockSaveRecord,
          record => record,
          undefined,
          undefined, // 不提供 ErrorClass
          "testPlainError",
        ),
      ).rejects.toThrow(/记录 888 不存在/);

      expect(mockSaveRecord).not.toHaveBeenCalled();
    });
  });

  describe("缓存失效调用验证", () => {
    it("提供 invalidateCache 时调用", async () => {
      const recordId = 10;
      mockGetRecord.mockResolvedValue(createMockRecord(recordId));
      mockSaveRecord.mockResolvedValue(undefined);

      await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => record,
        mockInvalidateCache,
        ZiWeiError,
        "testCacheInvalidation",
      );

      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
    });

    it("未提供 invalidateCache 时不调用", async () => {
      const recordId = 11;
      mockGetRecord.mockResolvedValue(createMockRecord(recordId));
      mockSaveRecord.mockResolvedValue(undefined);

      await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => record,
        undefined,
        ZiWeiError,
        "testNoCacheInvalidaton",
      );

      expect(mockInvalidateCache).not.toHaveBeenCalled();
    });
  });

  describe("错误处理", () => {
    it("getRecord 抛出错误时正确传播", async () => {
      const recordId = 12;
      const dbError = new Error("数据库连接失败");
      mockGetRecord.mockRejectedValue(dbError);

      await expect(
        updateRecordMetadata<TestRecord>(
          recordId,
          mockGetRecord,
          mockSaveRecord,
          record => record,
          undefined,
          ZiWeiError,
          "testGetError",
        ),
      ).rejects.toThrow("数据库连接失败");

      expect(mockSaveRecord).not.toHaveBeenCalled();
    });

    it("saveRecord 抛出错误时正确传播", async () => {
      const recordId = 13;
      mockGetRecord.mockResolvedValue(createMockRecord(recordId));
      const saveError = new Error("保存失败");
      mockSaveRecord.mockRejectedValue(saveError);

      await expect(
        updateRecordMetadata<TestRecord>(
          recordId,
          mockGetRecord,
          mockSaveRecord,
          record => record,
          mockInvalidateCache,
          ZiWeiError,
          "testSaveError",
        ),
      ).rejects.toThrow("保存失败");

      // 保存失败时不应调用缓存失效
      expect(mockInvalidateCache).not.toHaveBeenCalled();
    });

    it("updateFn 抛出错误时正确传播", async () => {
      const recordId = 14;
      mockGetRecord.mockResolvedValue(createMockRecord(recordId));

      const updateError = new Error("更新逻辑错误");
      const failingUpdateFn = () => {
        throw updateError;
      };

      await expect(
        updateRecordMetadata<TestRecord>(
          recordId,
          mockGetRecord,
          mockSaveRecord,
          failingUpdateFn,
          undefined,
          ZiWeiError,
          "testUpdateFnError",
        ),
      ).rejects.toThrow("更新逻辑错误");

      expect(mockSaveRecord).not.toHaveBeenCalled();
    });
  });

  describe("边缘场景", () => {
    it("空记录（id=0）也能正常处理", async () => {
      const recordId = 0;
      const record = createMockRecord(recordId);
      mockGetRecord.mockResolvedValue(record);
      mockSaveRecord.mockResolvedValue(undefined);

      const result = await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        r => ({ ...r, name: "更新后" }),
        undefined,
        ZiWeiError,
        "testZeroId",
      );

      expect(result.name).toBe("更新后");
    });

    it("updateFn 返回完全相同的对象引用也能正常保存", async () => {
      const recordId = 15;
      const originalRecord = createMockRecord(recordId);
      mockGetRecord.mockResolvedValue(originalRecord);
      mockSaveRecord.mockResolvedValue(undefined);

      const result = await updateRecordMetadata<TestRecord>(
        recordId,
        mockGetRecord,
        mockSaveRecord,
        record => record, // 不修改，直接返回原对象
        mockInvalidateCache,
        ZiWeiError,
        "testNoChange",
      );

      expect(mockSaveRecord).toHaveBeenCalledWith(originalRecord);
      expect(result).toBe(originalRecord);
    });
  });
});
