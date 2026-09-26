/**
 * 人物库：使用 Dexie.js 管理 IndexedDB 存储
 * 主键 id 为数字自增，存储全部 BirthInput 字段
 */
import Dexie, { type Table } from "dexie";
import { DEFAULT_BIRTH_INPUT, type BirthInput } from "./useZwds";
import type { DaLiuRenResult } from "./daliuren/types";
import { t } from "./i18n";

/**
 * 人物档案类型：扩展 BirthInput，附加主键 id、保存时间戳、默认标志。
 * 主键 id 为数字自增。
 */
export type Person = {
  id?: number;
  /** 保存时间戳 */
  savedAt: number;
  /** 是否系统默认人物（仅一条） */
  isDefault: boolean;
} & BirthInput;

/**
 * 大六壬起课记录：关联人物、起课时间、占事问题、标签、完整卦象数据。
 * 存储在 IndexedDB 的 liurenRecords 表中。
 */
export interface LiurenRecord {
  id?: number;
  /** 关联人物 ID */
  personId: number;
  /** 起课时间（YYYY-MM-DD HH:mm:ss） */
  calculationTime: string;
  /** 占事问题 */
  question: string;
  /** 备注 */
  note: string;
  /** 背景信息 */
  background: string;
  /** 标签数组 */
  tags: string[];
  /** 完整卦象数据 */
  result: DaLiuRenResult;
  /** 保存时间戳 */
  savedAt: number;
}

/** Wiki 文档：关联人物、标题、Markdown 内容、标签、时间戳 */
export interface WikiDocument {
  id?: number;
  /** 关联人物 ID */
  personId: number;
  /** 标题 */
  title: string;
  /** 内容（Markdown） */
  content: string;
  /** 标签数组 */
  tags: string[];
  /** 保存时间戳（首次创建） */
  savedAt: number;
  /** 最近更新时间戳 */
  updatedAt: number;
}

/** Wiki 文档间链接关系：源文档→目标文档 */
export interface WikiLink {
  id?: number;
  /** 源文档 ID */
  sourceDocId: number;
  /** 目标文档 ID */
  targetDocId: number;
}

/**
 * 紫微斗数应用数据库（Dexie 封装 IndexedDB）。
 * 三版本迁移：v1 人物 → v2 + 大六壬记录 → v3 + Wiki 文档与链接。
 */
class PeepDatabase extends Dexie {
  persons!: Table<Person, number>;
  liurenRecords!: Table<LiurenRecord, number>;
  wikiDocs!: Table<WikiDocument, number>;
  wikiLinks!: Table<WikiLink, number>;

  constructor() {
    super("peep");
    this.version(1).stores({
      persons: "++id, savedAt, isDefault",
    });
    this.version(2).stores({
      persons: "++id, savedAt, isDefault",
      liurenRecords: "++id, personId, savedAt, calculationTime, *tags",
    });
    this.version(3).stores({
      persons: "++id, savedAt, isDefault",
      liurenRecords: "++id, personId, savedAt, calculationTime, *tags",
      wikiDocs: "++id, personId, updatedAt, savedAt, *tags",
      wikiLinks: "++id, sourceDocId, targetDocId",
    });
  }
}

/** Dexie 数据库实例：管理人物/大六壬记录/Wiki 文档/链接关系四张表 */
export const db = new PeepDatabase();

/** 清理旧版数据库（peep-persons → peep） */
try {
  indexedDB.deleteDatabase("peep-persons");
} catch {
  /* ignore */
}

/** 默认人物数据 */
const DEFAULT_PERSON: Omit<Person, "id"> = {
  ...DEFAULT_BIRTH_INPUT,
  name: "演示",
  date: "2000-08-16",
  timeIndex: 2,
  savedAt: Date.now(),
  isDefault: true,
};

/**
 * 确保默认人物存在（首次调用时自动种子，Promise 缓存防并发重复插入）。
 * 失败时清空缓存，允许下次调用重试，避免「一次失败，永久不可用」。
 */
let defaultPromise: Promise<Person> | null = null;

function ensureDefault(): Promise<Person> {
  if (!defaultPromise) {
    defaultPromise = (async () => {
      try {
        const defaults = await db.persons.filter(p => p.isDefault).toArray();
        if (defaults.length > 1) {
          // 去重：保留最早的一条（id 最小），删除其余
          defaults.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
          const [keep, ...dupes] = defaults;
          await db.persons.bulkDelete(dupes.map(d => d.id!));
          return keep;
        }
        if (defaults.length === 1) return defaults[0];
        const id = await db.persons.add(DEFAULT_PERSON);
        return { ...DEFAULT_PERSON, id };
      } catch (err) {
        // 失败时清空缓存，允许下次重试
        defaultPromise = null;
        console.error("[personDb] 初始化默认人物失败", err);
        throw new Error(t("db.initFailed"));
      }
    })();
  }
  return defaultPromise;
}

/** 获取全部人物列表 */
export async function listPersons(): Promise<Person[]> {
  try {
    await ensureDefault();
    return await db.persons.orderBy("savedAt").reverse().toArray();
  } catch (err) {
    console.error("[personDb] 获取人物列表失败", err);
    throw new Error(t("db.readPersonListFailed"));
  }
}

/** 获取单个人物 */
export async function getPerson(id: number): Promise<Person | undefined> {
  try {
    return await db.persons.get(id);
  } catch (err) {
    console.error("[personDb] 获取人物详情失败", err);
    throw new Error(t("db.readPersonFailed"));
  }
}

/**
 * 保存人物（新增或更新），isDefault 切换在事务内原子完成：
 * 设为默认时先清除其他默认标记，再写入当前记录。
 */
export async function savePerson(
  id: number | undefined,
  input: BirthInput,
  isDefault: boolean,
): Promise<Person> {
  try {
    return await db.transaction("rw", db.persons, async () => {
      if (isDefault) {
        // 事务内清除所有现有默认标记
        const currentDefaults = await db.persons.filter(p => p.isDefault).toArray();
        for (const d of currentDefaults) {
          if (d.id != null && d.id !== id) await db.persons.update(d.id, { isDefault: false });
        }
      }
      const now = Date.now();
      if (id != null) {
        await db.persons.update(id, { ...input, savedAt: now, isDefault });
        return { ...input, id, savedAt: now, isDefault };
      }
      const newId = await db.persons.add({ ...input, savedAt: now, isDefault });
      return { ...input, id: newId, savedAt: now, isDefault };
    });
  } catch (err) {
    console.error("[personDb] 保存人物失败", err);
    throw new Error(t("db.savePersonFailed"));
  }
}

/** 删除人物（默认人物不可删除） */
export async function deletePerson(id: number): Promise<void> {
  try {
    const person = await db.persons.get(id);
    if (person?.isDefault) throw new Error(t("db.defaultCannotDelete"));
    await db.persons.delete(id);
  } catch (err) {
    // 保留业务错误（默认人物不可删除），包装其他错误
    if (err instanceof Error && err.message === t("db.defaultCannotDelete")) throw err;
    console.error("[personDb] 删除人物失败", err);
    throw new Error(t("db.deletePersonFailed"));
  }
}

/** 获取默认人物 */
export async function getDefaultPerson(): Promise<Person> {
  return ensureDefault();
}
