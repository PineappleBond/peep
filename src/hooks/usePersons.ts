import { useLiveQuery } from "dexie-react-hooks";
import { db, type Person } from "@/lib/db";

/**
 * 响应式人员列表 hook
 * 基于 dexie-react-hooks 的 useLiveQuery，数据变化时自动重新渲染
 *
 * @param includeDeleted - 是否包含已软删除的人物（默认 false）
 */
export function usePersons(includeDeleted: boolean = false): { persons: Person[]; loading: boolean } {
  const persons = useLiveQuery<Person[]>(
    async () => {
      const all = await db.persons.orderBy("createdAt").reverse().toArray();
      return includeDeleted ? all : all.filter((p) => !p.deletedAt);
    },
    [includeDeleted],
  );

  return {
    persons: persons ?? [],
    loading: persons === undefined,
  };
}

/**
 * 获取单个人员的响应式 hook
 *
 * 通过包装查询结果区分"正在加载"和"记录不存在"两种 undefined 状态：
 * - useLiveQuery 返回 undefined => 查询尚未完成 => loading: true
 * - 查询完成后若记录不存在 => { found: false, person: undefined } => loading: false
 */
export function usePerson(id: number | null | undefined): { person: Person | undefined; loading: boolean } {
  const result = useLiveQuery<{ found: boolean; person: Person | undefined }>(
    async () => {
      if (id == null) return { found: false, person: undefined };
      const p = await db.persons.get(id);
      return { found: true, person: p };
    },
    [id],
  );

  return {
    person: result?.person,
    loading: result === undefined,
  };
}
