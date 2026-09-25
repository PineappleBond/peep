/**
 * 人物库：使用 Dexie.js 管理 IndexedDB 存储
 * 主键 id 为数字自增，存储全部 BirthInput 字段
 */
import Dexie, { type Table } from "dexie";
import { DEFAULT_BIRTH_INPUT, type BirthInput } from "./useZwds";
import type { DaLiuRenResult } from "./daliuren/types";

export type Person = {
  id?: number;
  /** 保存时间戳 */
  savedAt: number;
  /** 是否系统默认人物（仅一条） */
  isDefault: boolean;
} & BirthInput;

/** 大六壬起课记录 */
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

/** Wiki 文档 */
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

/** Wiki 链接关系 */
export interface WikiLink {
  id?: number;
  /** 源文档 ID */
  sourceDocId: number;
  /** 目标文档 ID */
  targetDocId: number;
}

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

/** 确保默认人物存在（首次调用时自动种子，Promise 缓存防并发重复插入） */
let defaultPromise: Promise<Person> | null = null;

function ensureDefault(): Promise<Person> {
  if (!defaultPromise) {
    defaultPromise = (async () => {
      const defaults = await db.persons.filter((p) => p.isDefault).toArray();
      if (defaults.length > 1) {
        // 去重：保留最早的一条（id 最小），删除其余
        defaults.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        const [keep, ...dupes] = defaults;
        await db.persons.bulkDelete(dupes.map((d) => d.id!));
        return keep;
      }
      if (defaults.length === 1) return defaults[0];
      const id = await db.persons.add(DEFAULT_PERSON);
      return { ...DEFAULT_PERSON, id };
    })();
  }
  return defaultPromise;
}

/** 获取全部人物列表 */
export async function listPersons(): Promise<Person[]> {
  await ensureDefault();
  return db.persons.orderBy("savedAt").reverse().toArray();
}

/** 获取单个人物 */
export async function getPerson(id: number): Promise<Person | undefined> {
  return db.persons.get(id);
}

/**
 * 保存人物（新增或更新），isDefault 切换在事务内原子完成：
 * 设为默认时先清除其他默认标记，再写入当前记录。
 */
export async function savePerson(
  id: number | undefined,
  input: BirthInput,
  isDefault: boolean
): Promise<Person> {
  return db.transaction("rw", db.persons, async () => {
    if (isDefault) {
      // 事务内清除所有现有默认标记
      const currentDefaults = await db.persons.filter((p) => p.isDefault).toArray();
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
}

/** 删除人物（默认人物不可删除） */
export async function deletePerson(id: number): Promise<void> {
  const person = await db.persons.get(id);
  if (person?.isDefault) throw new Error("默认人物不可删除");
  await db.persons.delete(id);
}

/** 获取默认人物 */
export async function getDefaultPerson(): Promise<Person> {
  return ensureDefault();
}
