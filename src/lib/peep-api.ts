/**
 * window.peep API - Agent-First 接口设计
 *
 * 设计原则：
 * 1. Agent-First: 所有 API 都是给 Agent 的，必须清晰、无歧义
 * 2. UI + 数据: Agent 既能操作数据，也能控制 UI（跳转页面、打开编辑器）
 * 3. 最小参数集: 每个方法只接收必要参数，无额外字段
 * 4. 一致返回: 返回类型可预测，无隐藏副作用
 *
 * API 分类：
 * - 数据操作: create, list, get, update, delete（纯数据，无 UI 副作用）
 * - UI 导航: view, open（数据操作 + 页面跳转）
 * - 内容编辑: edit, replace（文档内容修改）
 *
 * Agent 使用场景：
 * - "帮我创建一个新人物" → person.create()
 * - "查看这个人的八字" → bazi.calculate() + 跳转页面
 * - "打开最近的日记" → document.diary.list() + document.open()
 */

import { db, type Person, type DocumentRecord, type Folder, type LiuyaoRecord } from "@/lib/db";
import { buildTree, type FolderNode } from "@/modules/documents/hooks/useFolders";
import { baziAPI } from "@/lib/peep-api-bazi";
import { ziweiAPI, analysisAPI } from "@/lib/peep-api-ziwei";
import { liuyaoAPI } from "@/lib/peep-api-liuyao";
import { iztroAPI, lunarAPI, calendarAPI, utilsAPI } from "@/lib/peep-api-tools";
import { navigateTo } from "@/lib/utils";

// ── 类型导出 ──────────────────────────────────────
export type { Person, DocumentRecord, Folder, LiuyaoRecord, FolderNode };
export type { DocumentType } from "@/modules/documents/types";

// ── API 导出（供 rtc-agent-config 使用）────────────
export { baziAPI, ziweiAPI, liuyaoAPI, analysisAPI };

export interface HoroscopeScope {
  level: "dayun" | "liunian" | "liuyue" | "liuri" | "liushi";
  datetime: string; // 格式: "2026-09-11H12" (精确到小时)
}

// ── 分组接口 ──────────────────────────────────────
export interface PersonAPI {
  create(input: {
    name: string;
    gender: "male" | "female";
    birthDate: string;
    birthTime?: string;
    isLunar?: boolean;
    note?: string;
  }): Promise<Person>;
  update(id: number, changes: Partial<Person>): Promise<void>;
  delete(id: number): Promise<void>;
  get(id: number): Promise<Person | undefined>;
  list(opts?: { search?: string }): Promise<Person[]>;
}

// ── 文档类型 API（每种文档类型的独立接口）──────────
export interface DocumentTypeAPI {
  // 数据操作
  create(input: {
    title?: string;
    content?: string;
    personId?: number;
    folderId?: number;
    tags?: string[];
  }): Promise<number>;
  list(opts?: {
    personId?: number;
    folderId?: number;
    search?: string;
    tags?: string[];
  }): Promise<DocumentRecord[]>;

  // UI 导航（数据操作 + 页面跳转）
  view(id: number): Promise<DocumentRecord>;
  openNew(opts?: {
    personId?: number;
    folderId?: number;
    title?: string;
    content?: string;
  }): Promise<{
    type: DocumentRecord["type"];
    title: string;
    content: string;
    personId: number | null;
    folderId: number | null;
  }>;
  openList(opts?: {
    personId?: number;
  }): Promise<DocumentRecord[]>;
}

// ── 文档 API（跨类型通用方法）────────────────────
export interface DocumentAPI {
  // 按类型分组
  recall: DocumentTypeAPI;
  diary: DocumentTypeAPI;
  notes: DocumentTypeAPI;

  // 通用方法（跨类型）
  get(id: number): Promise<DocumentRecord | undefined>;
  update(id: number, changes: Partial<DocumentRecord>): Promise<void>;
  delete(id: number): Promise<void>;

  // 内容编辑
  edit(id: number, startLine: number, endLine: number, content: string): Promise<void>;
  replace(id: number, keyword: string, replacement: string): Promise<{ count: number }>;

  // UI 导航
  open(id: number): Promise<DocumentRecord>;
}

export interface FolderAPI {
  create(title: string, parentId?: number | null): Promise<Folder>;
  update(id: number, changes: Partial<Folder>): Promise<void>;
  delete(id: number): Promise<void>;
  get(id: number): Promise<Folder | undefined>;
  list(): Promise<Folder[]>;
  tree(): Promise<FolderNode[]>;
}

export interface TagAPI {
  list(): Promise<{ name: string; count: number }[]>;
  add(docId: number, tag: string): Promise<void>;
  remove(docId: number, tag: string): Promise<void>;
}

// ── 主 API 接口 ────────────────────────────────────
export interface PeepAPI {
  person: PersonAPI;
  document: DocumentAPI;
  folder: FolderAPI;
  tag: TagAPI;
  bazi: typeof baziAPI;
  ziwei: typeof ziweiAPI;
  liuyao: typeof liuyaoAPI;
  // 工具代理
  iztro: typeof iztroAPI;
  lunar: typeof lunarAPI;
  calendar: typeof calendarAPI;
  analysis: typeof analysisAPI;
  utils: typeof utilsAPI;
}

// ── person CRUD ─────────────────────────────────────
export const personAPI: PersonAPI = {
  async create(input) {
    const now = Date.now();
    const id = await db.persons.add({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return { ...input, id, createdAt: now, updatedAt: now };
  },
  async update(id, changes) {
    await db.persons.update(id, { ...changes, updatedAt: Date.now() });
  },
  async delete(id) {
    await db.persons.update(id, { deletedAt: Date.now() });
  },
  async get(id) {
    const person = await db.persons.get(id);
    return person?.deletedAt ? undefined : person;
  },
  async list(opts) {
    let results = await db.persons.orderBy("createdAt").reverse().toArray();
    results = results.filter((p) => !p.deletedAt);
    if (opts?.search) {
      const q = opts.search.toLowerCase();
      results = results.filter((p) => p.name.toLowerCase().includes(q));
    }
    return results;
  },
};

// ── 创建单个文档类型的 API ──────────────────────────

/** 过滤出指定类型且未删除的文档 */
function filterActiveDocs(docs: DocumentRecord[], type: DocumentRecord["type"]): DocumentRecord[] {
  return docs.filter((d) => d.type === type && !d.deletedAt);
}

function createDocumentTypeAPI(type: DocumentRecord["type"]): DocumentTypeAPI {
  return {
    async create(input) {
      const now = Date.now();
      const id = await db.documents.add({
        type,
        title: input.title || "无标题",
        content: input.content || "",
        tags: input.tags || [],
        personId: input.personId ?? null,
        folderId: input.folderId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return id!;
    },

    async list(opts) {
      // 优先使用 Dexie 索引过滤（personId 有索引），减少全表扫描内存开销
      let results: DocumentRecord[];
      if (opts?.personId !== undefined) {
        results = await db.documents.where("personId").equals(opts.personId).toArray();
      } else {
        results = await db.documents.toArray();
      }
      results = filterActiveDocs(results, type);
      if (opts?.folderId !== undefined) {
        if (opts.folderId === null) {
          results = results.filter((d) => !d.folderId);
        } else {
          results = results.filter((d) => d.folderId === opts.folderId);
        }
      }
      if (opts?.search) {
        const q = opts.search.toLowerCase();
        results = results.filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q));
      }
      if (opts?.tags?.length) {
        results = results.filter((d) => opts.tags!.some((t) => d.tags.includes(t)));
      }
      return results.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async view(id) {
      const doc = await db.documents.get(id);
      if (!doc) throw new Error(`Document ${id} not found`);
      if (doc.type !== type) throw new Error(`Document ${id} is not of type ${type}`);

      // 跳转到文档编辑页面
      await navigateTo(`/documents/edit/${id}`, undefined, true);

      return doc;
    },

    async openNew(opts) {
      // 跳转到新建文档页面，带查询参数
      const search: Record<string, string> = { type };
      if (opts?.personId !== undefined) search.personId = String(opts.personId);
      if (opts?.folderId) search.folderId = String(opts.folderId);

      await navigateTo("/documents/new", search, true);

      return {
        type,
        title: opts?.title || "",
        content: opts?.content || "",
        personId: opts?.personId ?? null,
        folderId: opts?.folderId ?? null,
      };
    },

    async openList(opts) {
      // 跳转到文档列表页面
      const search: Record<string, string> | undefined =
        opts?.personId !== undefined ? { personId: String(opts.personId) } : undefined;

      await navigateTo(`/documents/${type}`, search, true);

      // 返回文档列表
      let results = await db.documents.toArray();
      results = filterActiveDocs(results, type);
      if (opts?.personId !== undefined) results = results.filter((d) => d.personId === opts.personId);
      return results.sort((a, b) => b.updatedAt - a.updatedAt);
    },
  };
}

// ── document CRUD + 工作流 ──────────────────────────
export const documentAPI: DocumentAPI = {
  // 按类型分组的 API
  recall: createDocumentTypeAPI("recall"),
  diary: createDocumentTypeAPI("diary"),
  notes: createDocumentTypeAPI("notes"),

  // 通用方法（跨类型）
  async get(id) {
    const doc = await db.documents.get(id);
    return doc?.deletedAt ? undefined : doc;
  },

  async update(id, changes) {
    await db.documents.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id) {
    await db.documents.update(id, { deletedAt: Date.now() });
  },

  async edit(id, startLine, endLine, content) {
    const doc = await db.documents.get(id);
    if (!doc) throw new Error(`Document ${id} not found`);
    const lines = doc.content.split("\n");
    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const newContent = [...before, content, ...after].join("\n");
    await db.documents.update(id, { content: newContent, updatedAt: Date.now() });
  },

  async replace(id, keyword, replacement) {
    const doc = await db.documents.get(id);
    if (!doc) throw new Error(`Document ${id} not found`);
    const regex = new RegExp(escapeRegex(keyword), "g");
    const matches = doc.content.match(regex);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      await db.documents.update(id, {
        content: doc.content.replace(regex, replacement),
        updatedAt: Date.now(),
      });
    }
    return { count };
  },

  async open(id) {
    const doc = await db.documents.get(id);
    if (!doc) throw new Error(`Document ${id} not found`);

    // 跳转到文档编辑页面
    await navigateTo(`/documents/edit/${id}`, undefined, true);

    return doc;
  },
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── folder CRUD ─────────────────────────────────────
export const folderAPI: FolderAPI = {
  async create(title, parentId = null) {
    const now = Date.now();
    const id = await db.folders.add({ title, parentId, createdAt: now, updatedAt: now });
    return { id, title, parentId, createdAt: now, updatedAt: now };
  },
  async update(id, changes) {
    await db.folders.update(id, { ...changes, updatedAt: Date.now() });
  },
  async delete(id) {
    await db.folders.delete(id);
  },
  async get(id) {
    return db.folders.get(id);
  },
  async list() {
    return db.folders.toArray();
  },
  async tree() {
    const folders = await db.folders.toArray();
    const docs = await db.documents.toArray();
    const docCounts = new Map<number, number>();
    for (const doc of docs) {
      if (doc.folderId && !doc.deletedAt) {
        docCounts.set(doc.folderId, (docCounts.get(doc.folderId) ?? 0) + 1);
      }
    }
    return buildTree(folders, docCounts);
  },
};

// ── tag ─────────────────────────────────────────────
export const tagAPI: TagAPI = {
  async list() {
    const docs = await db.documents.toArray();
    // 过滤软删除文档
    const activeDocs = docs.filter((doc) => !doc.deletedAt);
    const tagMap = new Map<string, number>();
    activeDocs.forEach((doc) => {
      doc.tags.forEach((tag) => tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1));
    });
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },
  async add(docId, tag) {
    const doc = await db.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);
    if (!doc.tags.includes(tag)) {
      await db.documents.update(docId, { tags: [...doc.tags, tag], updatedAt: Date.now() });
    }
  },
  async remove(docId, tag) {
    const doc = await db.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);
    await db.documents.update(docId, { tags: doc.tags.filter((t) => t !== tag), updatedAt: Date.now() });
  },
};

// ── 挂载到 window ──────────────────────────────────
export function installPeepAPI(): void {
  const api: PeepAPI = {
    person: personAPI,
    document: documentAPI,
    folder: folderAPI,
    tag: tagAPI,
    bazi: baziAPI,
    ziwei: ziweiAPI,
    liuyao: liuyaoAPI,
    iztro: iztroAPI,
    lunar: lunarAPI,
    calendar: calendarAPI,
    analysis: analysisAPI,
    utils: utilsAPI,
  };

  // Window.peep 类型声明见 rtc-agent.d.ts
  window.peep = api;
  if (import.meta.env.DEV) {
    console.debug("[peep] API installed at window.peep");
  }
}
