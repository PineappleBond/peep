/**
 * 带缓存的标签提取工具。
 * 用于 daliurenDb / wikiDb 等模块的"获取全部已用标签"查询，
 * 避免每次全表扫描；写入/删除后调用 invalidate() 即可失效。
 */

/**
 * 创建一个标签缓存实例。
 * @param getRecords 按 personId 查询全部记录的异步函数
 * @param extractTags 从单条记录中提取标签的函数
 */
export function createTagCache<T>(
  getRecords: (personId: number) => Promise<T[]>,
  extractTags: (record: T) => string[],
) {
  let cache: { personId: number; tags: string[] } | null = null;

  return {
    /** 使缓存失效（写入/删除后调用） */
    invalidate() {
      cache = null;
    },
    /** 获取指定 personId 下的所有标签（去重、排序），命中缓存直接返回 */
    async get(personId: number): Promise<string[]> {
      if (cache && cache.personId === personId) {
        return cache.tags;
      }
      const records = await getRecords(personId);
      const tagSet = new Set<string>();
      for (const r of records) {
        for (const t of extractTags(r)) {
          tagSet.add(t);
        }
      }
      const tags = Array.from(tagSet).sort();
      cache = { personId, tags };
      return tags;
    },
  };
}
