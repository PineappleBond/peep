/**
 * 缓存管理模块单元测试
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock personDb 的 db 实例
const mockDb = {
  persons: {
    filter: vi.fn(),
    orderBy: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
  },
  liurenRecords: {
    count: vi.fn().mockResolvedValue(0),
  },
  wikiDocs: {
    count: vi.fn().mockResolvedValue(0),
  },
  wikiLinks: {
    count: vi.fn().mockResolvedValue(0),
  },
};

vi.mock("./personDb", () => ({
  db: mockDb,
}));

vi.mock("./performance", () => ({
  recordDomainMetric: vi.fn(),
}));

describe("cacheManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDb.persons.count.mockResolvedValue(0);
    mockDb.liurenRecords.count.mockResolvedValue(0);
    mockDb.wikiDocs.count.mockResolvedValue(0);
    mockDb.wikiLinks.count.mockResolvedValue(0);
  });

  describe("estimateStorageUsage", () => {
    it("浏览器支持 navigator.storage.estimate 时返回浏览器数据", async () => {
      // 模拟浏览器支持
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 1024 * 1024,
            quota: 100 * 1024 * 1024,
          }),
          persist: vi.fn(),
          persisted: vi.fn(),
        },
        configurable: true,
      });

      const { estimateStorageUsage } = await import("./cacheManager");
      const result = await estimateStorageUsage();

      expect(result.usage).toBe(1024 * 1024);
      expect(result.quota).toBe(100 * 1024 * 1024);
      expect(result.source).toBe("browser");
      expect(result.usageRatio).toBeCloseTo(0.01, 2);

      // 恢复
      Object.defineProperty(navigator, "storage", {
        value: originalStorage,
        configurable: true,
      });
    });

    it("浏览器不支持时回退到估算", async () => {
      Object.defineProperty(navigator, "storage", {
        value: undefined,
        configurable: true,
      });
      mockDb.persons.count.mockResolvedValue(10);
      mockDb.liurenRecords.count.mockResolvedValue(5);
      mockDb.wikiDocs.count.mockResolvedValue(3);
      mockDb.wikiLinks.count.mockResolvedValue(2);

      const { estimateStorageUsage } = await import("./cacheManager");
      const result = await estimateStorageUsage();

      expect(result.source).toBe("estimated");
      // 20 条记录 × 1024 字节
      expect(result.usage).toBe(20 * 1024);
      expect(result.quota).toBe(500 * 1024 * 1024);
    });
  });

  describe("warmupCache", () => {
    it("首次调用执行预热查询", async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockToArray = vi.fn().mockResolvedValue([]);
      mockDb.persons.filter = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.persons.orderBy = vi.fn().mockReturnValue({
        reverse: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray: mockToArray }) }),
      });

      const { warmupCache } = await import("./cacheManager");
      await warmupCache();

      expect(mockFirst).toHaveBeenCalled();
      expect(mockToArray).toHaveBeenCalled();
    });

    it("多次调用仅预热一次", async () => {
      const mockFirst = vi.fn().mockResolvedValue(undefined);
      const mockToArray = vi.fn().mockResolvedValue([]);
      mockDb.persons.filter = vi.fn().mockReturnValue({ first: mockFirst });
      mockDb.persons.orderBy = vi.fn().mockReturnValue({
        reverse: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray: mockToArray }) }),
      });

      const { warmupCache } = await import("./cacheManager");
      await warmupCache();
      await warmupCache();
      await warmupCache();

      // 只调一次
      expect(mockFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanupRedundantData", () => {
    it("无重复默认人物时返回 0", async () => {
      mockDb.persons.filter = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{ id: 1, isDefault: true }]),
      });
      const { cleanupRedundantData } = await import("./cacheManager");
      const result = await cleanupRedundantData();
      expect(result.duplicateDefaultsRemoved).toBe(0);
    });

    it("清理重复的默认人物", async () => {
      const mockBulkDelete = vi.fn().mockResolvedValue(undefined);
      mockDb.persons.filter = vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 1, isDefault: true },
          { id: 5, isDefault: true },
          { id: 10, isDefault: true },
        ]),
      });
      mockDb.persons.bulkDelete = mockBulkDelete;

      const { cleanupRedundantData } = await import("./cacheManager");
      const result = await cleanupRedundantData();
      expect(result.duplicateDefaultsRemoved).toBe(2);
      expect(mockBulkDelete).toHaveBeenCalledWith([5, 10]);
    });
  });
});
