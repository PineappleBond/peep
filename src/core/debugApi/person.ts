/**
 * 调试 API - Person CRUD 操作
 *
 * 人物列表、获取、创建、更新、删除
 */

import type { Person, BirthInput } from "./types";
import { listPersons, getPerson, savePerson, deletePerson, getDefaultPerson } from "../personDb";
import { globalEvents } from "../events";
import { log, timer } from "./logger";
import { ZiWeiError, wrapError, ApiErrorCode } from "./errors";
import { validatePersonId } from "./validate";

/** localStorage 中存储当前选中人物 ID 的 key（与 Layout.tsx 保持一致） */
const CURRENT_PERSON_STORAGE_KEY = "zwds-current-person-id";

/**
 * 获取当前选中的人物 ID（从 localStorage 读取）。
 * 如果未找到或解析失败，回退到默认人物 ID。
 *
 * @returns 当前选中的人物 ID
 */
async function getCurrentPersonId(): Promise<number> {
  try {
    const savedId = localStorage.getItem(CURRENT_PERSON_STORAGE_KEY);
    if (savedId) {
      const id = Number(savedId);
      if (Number.isFinite(id) && id > 0) {
        return id;
      }
    }
  } catch (err) {
    console.warn("[resolvePersonId] 读取 localStorage 失败", err);
  }
  // 回退到默认人物
  const defaultPerson = await getDefaultPerson();
  return defaultPerson.id!;
}

/**
 * 解析人物 ID：未传或无效时返回当前选中的人物 ID（从 localStorage 读取）。
 * 所有接受 personId 的调试接口共用此逻辑——AI 不传 ID 时自动使用 Header 中选中的那个人物。
 *
 * @param personId 人物 ID（可选，正整数）
 * @returns 解析后的人物 ID
 *
 * @example
 * ```typescript
 * const id = await resolvePersonId(1);        // 返回 1
 * const id = await resolvePersonId(undefined); // 返回当前选中的人物 ID
 * ```
 */
export async function resolvePersonId(personId?: number): Promise<number> {
  // 使用统一的参数验证
  validatePersonId(personId, "resolvePersonId");
  if (personId != null && Number.isFinite(personId) && personId > 0) {
    return personId;
  }
  return getCurrentPersonId();
}

/**
 * 人物列表：返回所有人物（按保存时间倒序）。
 * 纯 DB 操作，无 UI 交互。
 *
 * @returns 人物数组，每人包含 id、name、date、timeIndex、gender 等完整出生信息
 *
 * @example
 * ```typescript
 * const persons = await window.peep.PersonList();
 * persons.forEach(p => console.log(`${p.id}: ${p.name} (${p.date})`));
 * ```
 */
export async function PersonList(): Promise<Person[]> {
  const stop = timer("PersonList");
  try {
    log("info", "PersonList", "查询人物列表");
    const persons = await listPersons();
    log("info", "PersonList", "查询成功", { count: persons.length });
    stop();
    return persons;
  } catch (err) {
    log("error", "PersonList", "查询失败", err);
    throw wrapError("PersonList", err, ZiWeiError);
  }
}

/**
 * 获取人物详情：按 ID 查询，不传则返回默认人物。
 * 纯 DB 操作，无 UI 交互。
 *
 * @param personId 人物 ID（可选，不传则返回默认人物）
 * @returns 人物详情，包含完整出生信息和设置
 * @throws ZiWeiError 人物不存在时（errorCode: NOT_FOUND）
 *
 * @example
 * ```typescript
 * // 获取默认人物
 * const person = await window.peep.PersonGet();
 * console.log("姓名:", person.name);
 * console.log("出生日期:", person.date);
 *
 * // 获取指定人物
 * const person = await window.peep.PersonGet(1);
 * console.log("性别:", person.gender);
 * console.log("历法:", person.calendar);
 * ```
 */
export async function PersonGet(personId?: number): Promise<Person> {
  const stop = timer("PersonGet");
  try {
    const id = await resolvePersonId(personId);
    log("info", "PersonGet", "查询人物", { id });
    const person = await getPerson(id);
    if (!person) {
      throw new ZiWeiError(`人物 ${id} 不存在`, "PersonGet", {
        context: { personId: id },
        suggestion: "请检查人物 ID 是否正确。可调用 PersonList() 查看可用的人物列表",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }
    log("info", "PersonGet", "查询成功", { id, name: person.name });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonGet", "查询失败", err);
    throw wrapError("PersonGet", err, ZiWeiError);
  }
}

/**
 * 创建人物：写入 DB 并触发 UI 同步（切换为新人物）。
 *
 * UI 同步流程：
 * 1. savePerson() 写入 IndexedDB
 * 2. globalEvents.emit("person.changed") 通知所有页面
 * 3. ZiweiPage 收到事件后重新计算盘面
 *
 * @param input 出生信息
 * @param isDefault 是否设为默认人物（可选，默认 false）
 */
export async function PersonCreate(input: BirthInput, isDefault?: boolean): Promise<Person> {
  const stop = timer("PersonCreate");
  try {
    log("info", "PersonCreate", "创建人物", { name: input.name, isDefault });
    const person = await savePerson(undefined, input, isDefault ?? false);
    // UI 同步：通知所有页面切换到新人物
    globalEvents.emit("person.changed", person);
    log("info", "PersonCreate", "创建成功", { id: person.id });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonCreate", "创建失败", err);
    throw wrapError("PersonCreate", err, ZiWeiError);
  }
}

/**
 * 更新人物：按 ID 更新并触发 UI 同步。
 * 如果更新的是当前选中人物，页面会自动重新计算盘面。
 *
 * @param personId 人物 ID（正整数）
 * @param input 出生信息
 * @param isDefault 是否设为默认人物（可选，不传则保持原值）
 * @throws ZiWeiError personId 无效时（errorCode: INVALID_INPUT）
 *
 * @example
 * ```typescript
 * await window.peep.PersonUpdate(1, { ...personData, name: "新名字" });
 * ```
 */
export async function PersonUpdate(
  personId: number,
  input: BirthInput,
  isDefault?: boolean,
): Promise<Person> {
  const stop = timer("PersonUpdate");
  try {
    // 使用统一的参数验证
    validatePersonId(personId, "PersonUpdate");
    log("info", "PersonUpdate", "更新人物", { id: personId, name: input.name, isDefault });
    // 如果未指定 isDefault，保持原值
    const defaultFlag = isDefault ?? (await getPerson(personId))?.isDefault ?? false;
    const person = await savePerson(personId, input, defaultFlag);
    // UI 同步：通知所有页面人物数据已变化
    globalEvents.emit("person.changed", person);
    log("info", "PersonUpdate", "更新成功", { id: person.id });
    stop();
    return person;
  } catch (err) {
    log("error", "PersonUpdate", "更新失败", err);
    throw wrapError("PersonUpdate", err, ZiWeiError);
  }
}

/**
 * 删除人物：从 DB 删除并触发 UI 同步（切换到默认人物）。
 * 默认人物不可删除（personDb.ts 会抛错）。
 *
 * @param personId 人物 ID（正整数）
 * @throws ZiWeiError personId 无效时（errorCode: INVALID_INPUT）
 * @throws ZiWeiError 删除默认人物时（errorCode: PERMISSION_DENIED）
 *
 * @example
 * ```typescript
 * await window.peep.PersonDelete(2); // 删除 ID 为 2 的人物
 * ```
 */
export async function PersonDelete(personId: number): Promise<void> {
  const stop = timer("PersonDelete");
  try {
    // 使用统一的参数验证
    validatePersonId(personId, "PersonDelete");
    log("info", "PersonDelete", "删除人物", { id: personId });
    await deletePerson(personId);
    // UI 同步：删除后切换到默认人物
    const defaultPerson = await getDefaultPerson();
    globalEvents.emit("person.changed", defaultPerson);
    log("info", "PersonDelete", "删除成功", { id: personId });
    stop();
  } catch (err) {
    log("error", "PersonDelete", "删除失败", err);
    throw wrapError("PersonDelete", err, ZiWeiError);
  }
}

// 重新导出 wrapError 供其他模块使用
export { wrapError } from "./errors";
