/**
 * 冲突历史模块单元测试
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { BackupData } from "./importData";

// 内存 localStorage 模拟
let memStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => (k in memStore ? memStore[k] : null),
  setItem: (k: string, v: string) => {
    memStore[k] = v;
  },
  removeItem: (k: string) => {
    delete memStore[k];
  },
  get length() {
    return Object.keys(memStore).length;
  },
  key: (i: number) => Object.keys(memStore)[i] ?? null,
  clear: () => {
    memStore = {};
  },
};

function makeBackup(exportedAt?: string): BackupData {
  return {
    meta: {
      version: "1.0",
      exportedAt: exportedAt ?? new Date().toISOString(),
      scope: "all",
    },
    persons: [],
    liuren: [],
    wiki: [],
    wikiLinks: [],
  };
}

describe("conflictLog", () => {
  beforeEach(() => {
    vi.resetModules();
    memStore = {};
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("appendConflictRecord", () => {
    it("冲突总数 > 0 时写入记录", async () => {
      const { appendConflictRecord, loadConflictHistory } = await import("./conflictLog");
      const rec = appendConflictRecord({ persons: 1, liuren: 0, wiki: 2 });
      expect(rec).not.toBeNull();
      expect(rec!.total).toBe(3);
      expect(rec!.counts.persons).toBe(1);
      expect(rec!.counts.wiki).toBe(2);
      const all = loadConflictHistory();
      expect(all).toHaveLength(1);
    });

    it("冲突总数 = 0 时不写入", async () => {
      const { appendConflictRecord, loadConflictHistory } = await import("./conflictLog");
      const rec = appendConflictRecord({ persons: 0, liuren: 0, wiki: 0 });
      expect(rec).toBeNull();
      expect(loadConflictHistory()).toHaveLength(0);
    });

    it("保留 remoteExportedAt 元数据", async () => {
      const { appendConflictRecord, loadConflictHistory } = await import("./conflictLog");
      const ts = "2024-01-01T00:00:00.000Z";
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 }, { remoteExportedAt: ts });
      const all = loadConflictHistory();
      expect(all[0].remoteExportedAt).toBe(ts);
    });

    it("新记录插入到最前", async () => {
      const { appendConflictRecord, loadConflictHistory } = await import("./conflictLog");
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 });
      appendConflictRecord({ persons: 2, liuren: 0, wiki: 0 });
      const all = loadConflictHistory();
      expect(all).toHaveLength(2);
      expect(all[0].counts.persons).toBe(2);
      expect(all[1].counts.persons).toBe(1);
    });
  });

  describe("resolveLastConflict", () => {
    it("为最近一条未解决记录附加结果", async () => {
      const { appendConflictRecord, resolveLastConflict, loadConflictHistory } =
        await import("./conflictLog");
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 });
      resolveLastConflict("smart", { success: true });
      const all = loadConflictHistory();
      expect(all[0].resolution).toBe("smart");
      expect(all[0].success).toBe(true);
    });

    it("失败时记录错误信息", async () => {
      const { appendConflictRecord, resolveLastConflict, loadConflictHistory } =
        await import("./conflictLog");
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 });
      resolveLastConflict("cancelled", { success: false, error: "测试错误" });
      const all = loadConflictHistory();
      expect(all[0].resolution).toBe("cancelled");
      expect(all[0].success).toBe(false);
      expect(all[0].error).toBe("测试错误");
    });

    it("无未解决记录时忽略", async () => {
      const { appendConflictRecord, resolveLastConflict, loadConflictHistory } =
        await import("./conflictLog");
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 });
      resolveLastConflict("smart", { success: true });
      // 第二次 resolve 应该找不到未解决记录
      resolveLastConflict("merge", { success: true });
      const all = loadConflictHistory();
      // 第一条依然是 smart（未被覆盖）
      expect(all[0].resolution).toBe("smart");
    });
  });

  describe("logConflictFromPreview", () => {
    it("从备份数据提取 meta.exportedAt", async () => {
      const { logConflictFromPreview } = await import("./conflictLog");
      const backup = makeBackup("2024-06-15T12:00:00.000Z");
      const rec = logConflictFromPreview({ persons: 1, liuren: 2, wiki: 0 }, backup);
      expect(rec).not.toBeNull();
      expect(rec!.remoteExportedAt).toBe("2024-06-15T12:00:00.000Z");
    });
  });

  describe("clearConflictHistory", () => {
    it("清空所有记录", async () => {
      const { appendConflictRecord, clearConflictHistory, loadConflictHistory } =
        await import("./conflictLog");
      appendConflictRecord({ persons: 1, liuren: 0, wiki: 0 });
      appendConflictRecord({ persons: 2, liuren: 0, wiki: 0 });
      expect(loadConflictHistory()).toHaveLength(2);
      clearConflictHistory();
      expect(loadConflictHistory()).toHaveLength(0);
    });
  });

  describe("循环缓冲", () => {
    it("超过 MAX_RECORDS 时保留最新的", async () => {
      const { appendConflictRecord, loadConflictHistory } = await import("./conflictLog");
      for (let i = 0; i < 40; i++) {
        appendConflictRecord({ persons: i, liuren: 0, wiki: 0 });
      }
      const all = loadConflictHistory();
      // 最多保留 30 条
      expect(all.length).toBeLessThanOrEqual(30);
      // 最新的一条 persons = 39
      expect(all[0].counts.persons).toBe(39);
    });
  });
});
