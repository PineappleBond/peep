/**
 * 数据库通用工具：分页过滤查询、错误处理封装。
 * 用于 daliurenDb / wikiDb / personDb 的列表查询与 CRUD，消除重复的分页/搜索/标签过滤/错误处理逻辑。
 */

/* ─────────────── 分页过滤 ─────────────── */

/** 分页 + 过滤选项 */
export interface FilterPaginateOptions<T> {
  /** 原始记录数组（已按 personId 过滤） */
  records: T[];
  /** 排序字段名（倒序，最新在前）；字段值必须为数字（时间戳等） */
  sortField: { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
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

  // 1. 按指定字段倒序排序（字段值保证为数字）
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

/* ─────────────── DB 操作安全封装 ─────────────── */

/**
 * 创建数据库操作包装器：统一处理错误日志与错误包装。
 * 消除 DB 层重复的 try/catch + console.error + throw 模式。
 *
 * 用法：
 *   const dbOp = createDbOperation("daliurenDb");
 *   return dbOp("查询记录列表失败", () => db.liurenRecords.where(...).toArray());
 *
 * 指标记录（metricName）保留在调用方自行处理（因为上下文数据各异），
 * 此工具只解决最普遍的错误处理重复。
 */
export function createDbOperation(domain: string) {
  /**
   * 安全执行一次数据库操作；出错时记录日志并抛出包装后的错误。
   * @param errorMessage 翻译后的错误消息（抛出时使用）
   * @param operation 实际数据库操作
   * @param preserveBusinessErrors 需原样抛出的业务错误消息列表（不被包装）
   */
  return async function run<T>(
    errorMessage: string,
    operation: () => Promise<T>,
    preserveBusinessErrors?: string[],
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      // 保留业务错误（如"默认人物不可删除"、"标题必填"）
      if (
        preserveBusinessErrors &&
        err instanceof Error &&
        preserveBusinessErrors.some(msg => err.message === msg)
      ) {
        throw err;
      }
      console.error(`[${domain}] ${errorMessage}`, err);
      throw new Error(errorMessage);
    }
  };
}
