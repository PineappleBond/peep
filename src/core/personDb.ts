/**
 * 人物库：使用 Dexie.js 管理 IndexedDB 存储
 * 主键 id 为数字自增，存储全部 BirthInput 字段
 */
import Dexie, { type Table } from "dexie";
import { DEFAULT_BIRTH_INPUT, type BirthInput } from "./useZwds";

export type Person = {
  id?: number;
  /** 保存时间戳 */
  savedAt: number;
  /** 是否系统默认人物（仅一条） */
  isDefault: boolean;
} & BirthInput;

class PeepDatabase extends Dexie {
  persons!: Table<Person, number>;

  constructor() {
    super("peep");
    this.version(1).stores({
      persons: "++id, savedAt, isDefault",
    });
  }
}

const db = new PeepDatabase();

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

/** 确保默认人物存在（首次调用时自动种子） */
async function ensureDefault(): Promise<Person> {
  const existing = await db.persons.filter((p) => p.isDefault).first();
  if (existing) return existing;
  const id = await db.persons.add(DEFAULT_PERSON);
  return { ...DEFAULT_PERSON, id };
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

/** 新增人物 */
export async function addPerson(input: BirthInput): Promise<Person> {
  const id = await db.persons.add({
    ...input,
    savedAt: Date.now(),
    isDefault: false,
  });
  return { ...input, id, savedAt: Date.now(), isDefault: false };
}

/** 更新人物 */
export async function updatePerson(id: number, input: BirthInput): Promise<void> {
  await db.persons.update(id, { ...input, savedAt: Date.now() });
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
