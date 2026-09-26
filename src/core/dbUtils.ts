/**
 * 数据库通用工具：分页过滤查询。
 * 用于 daliurenDb / wikiDb 的列表查询，消除重复的分页/搜索/标签过滤逻辑。
 */

/** 分页 + 过滤选项 */
export interface FilterPaginateOptions<T> {
  /** 原始记录数组（已按 personId 过滤） */
  records: T[];
  /** 排序字段名（倒序，最新在前） */
  sortField: keyof T;
  /** 文本搜索匹配的字段名列表 */
  searchFields: (keyof T)[];
  /** 过滤条件 */
  filters: {
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  };
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  /** 当前页记录 */
  items: T[];
  /** 总条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/**
 * 通用分页过滤查询：
 * 1. 按 sortField 倒序排序
 * 2. 按 searchText 在 searchFields 中模糊匹配
 * 3. 按 tags 过滤（记录包含任一选中标签即可）
 * 4. 分页切片
 */
export function filterAndPaginate<T>(opts: FilterPaginateOptions<T>): PaginatedResult<T> {
  const { records, sortField, searchFields, filters } = opts;
  const { searchText = "", tags = [], page = 1, pageSize = 20 } = filters;

  // 1. 按指定字段倒序排序
  const sorted = [...records].sort((a, b) => {
    const va = a[sortField] as number;
    const vb = b[sortField] as number;
    return vb - va;
  });

  // 2. 文本搜索
  let filtered = sorted;
  if (searchText.trim()) {
    const keyword = searchText.trim().toLowerCase();
    filtered = filtered.filter(r =>
      searchFields.some(f => String(r[f]).toLowerCase().includes(keyword)),
    );
  }

  // 3. 标签过滤（多值匹配：记录包含任一选中的标签）
  if (tags.length > 0) {
    filtered = filtered.filter(r => {
      const rTags = (r as unknown as { tags?: string[] }).tags;
      return Array.isArray(rTags) && rTags.some(t => tags.includes(t));
    });
  }

  // 4. 分页
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}
