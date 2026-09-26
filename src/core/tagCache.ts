/**
 * 带缓存的标签提取工具。
 * 用于 daliurenDb / wikiDb 等模块的"获取全部已用标签"查询，
 * 避免每次全表扫描；写入/删除后调用 invalidate() 即可失效。
 *
 * 采用 Map 缓存多个 personId 的标签，切换人物时不必重新扫描。
 */

/**
 * 创建一个标签缓存实例。
 * @param getRecords 按 personId 查询全部记录的异步函数
 * @param extractTags 从单条记录中提取标签的函数
 * @param maxEntries 缓存条目上限（默认 8，防止无限增长）
 */
export function createTagCache<T>(
  getRecords: (personId: number) => Promise<T[]>,
  extractTags: (record: T) => string[],
  maxEntries = 8,
) {
  /** personId → 标签列表，使用 Map 保持插入顺序 */
  const cache = new Map<number, string[]>();

  return {
    /** 使指定 personId 的缓存失效（不传参则清空全部） */
    invalidate(personId?: number) {
      if (personId !== undefined) {
        cache.delete(personId);
      } else {
        cache.clear();
      }
    },
    /** 获取指定 personId 下的所有标签（去重、排序），命中缓存直接返回 */
    async get(personId: number): Promise<string[]> {
      const cached = cache.get(personId);
      if (cached) return cached;

      const records = await getRecords(personId);
      const tagSet = new Set<string>();
      for (const r of records) {
        for (const t of extractTags(r)) {
          tagSet.add(t);
        }
      }
      const tags = Array.from(tagSet).sort();

      // 缓存满时淘汰最早插入的条目
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(personId, tags);
      return tags;
    },
  };
}
