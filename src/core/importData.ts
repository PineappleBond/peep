/**
 * 数据导入模块：支持从 JSON 备份恢复、CSV 导入。
 *
 * 功能：
 * - JSON 完整备份导入（人物、大六壬记录、Wiki 文档）
 * - CSV 数据导入（大六壬记录、Wiki 文档列表）
 * - ID 冲突处理（自动生成新 ID）
 * - 数据验证与错误处理
 * - 导入统计返回
 */
import { db, getDefaultPerson } from "./personDb";
import type { Person, LiurenRecord, WikiDocument } from "./personDb";
import type { BirthInput } from "./useZwds";
import type { DaLiuRenResult } from "./daliuren/types";

/* ─────────────── 类型定义 ─────────────── */

/** 导入统计结果 */
export interface ImportResult {
  persons: number;
  liuren: number;
  wiki: number;
  errors: string[];
}

/** 冲突处理策略 */
export type ConflictStrategy = "skip" | "overwrite" | "merge";

/** JSON 备份数据结构 */
export interface BackupData {
  meta?: {
    version: string;
    exportedAt: string;
    scope: string;
  };
  /** 人物列表（同步快照使用，可能包含多条） */
  persons?: Array<{
    id?: number;
    name: string;
    gender: string;
    date: string;
    timeIndex: number;
    calendar?: string;
    residence?: string;
    [k: string]: unknown;
  }>;
  /** 单条人物（老版导出兼容） */
  person?: {
    id?: number;
    name: string;
    gender: string;
    date: string;
    timeIndex: number;
    calendar?: string;
    residence?: string;
  };
  ziwei?: Record<string, unknown>;
  liuren?: Array<{
    id?: number;
    calculationTime: string;
    question: string;
    note: string;
    background: string;
    tags: string[];
    result: Record<string, unknown>;
  }>;
  wiki?: Array<{
    id?: number;
    title: string;
    content: string;
    tags: string[];
    savedAt: number;
    updatedAt: number;
  }>;
  /** Wiki 文档间链接（同步快照使用） */
  wikiLinks?: Array<{
    id?: number;
    sourceDocId: number;
    targetDocId: number;
  }>;
}

/* ─────────────── JSON 导入 ─────────────── */

/**
 * 从 JSON 文件导入完整备份
 */
export async function importFromJson(
  file: File,
  onProgress?: (percent: number, text: string) => void,
): Promise<ImportResult> {
  const result: ImportResult = { persons: 0, liuren: 0, wiki: 0, errors: [] };

  try {
    onProgress?.(10, "读取文件...");
    const text = await file.text();
    const data: BackupData = JSON.parse(text);

    onProgress?.(20, "验证数据...");
    await validateBackupData(data);

    // 获取默认人物 ID（用于关联导入的记录）
    const defaultPerson = await getDefaultPerson();
    const defaultPersonId = defaultPerson.id ?? 1;

    onProgress?.(30, "导入人物...");
    // 导入人物数据
    if (data.person) {
      try {
        const personData: Omit<Person, "id"> = {
          name: data.person.name,
          gender: data.person.gender as BirthInput["gender"],
          date: data.person.date,
          timeIndex: data.person.timeIndex,
          calendar: (data.person.calendar as BirthInput["calendar"]) || "solar",
          residence: data.person.residence || "",
          // 默认值
          isLeapMonth: false,
          exactTime: "",
          useTrueSolar: false,
          placeMode: "china",
          province: "",
          city: "",
          district: "",
          timezone: "",
          algorithm: "default",
          yearDivide: "normal",
          mutagenTable: "default",
          dayDivide: "forward",
          astroType: "heaven",
          savedAt: Date.now(),
          isDefault: false,
        };
        await db.persons.add(personData);
        result.persons = 1;
      } catch (err) {
        result.errors.push(`导入人物失败: ${err}`);
      }
    }

    onProgress?.(50, "导入大六壬记录...");
    // 导入大六壬记录
    if (data.liuren && data.liuren.length > 0) {
      for (const record of data.liuren) {
        try {
          const liurenData: Omit<LiurenRecord, "id"> = {
            personId: defaultPersonId,
            calculationTime: record.calculationTime,
            question: record.question,
            note: record.note,
            background: record.background,
            tags: record.tags,
            result: record.result as unknown as DaLiuRenResult,
            savedAt: Date.now(),
          };
          await db.liurenRecords.add(liurenData);
          result.liuren++;
        } catch (err) {
          result.errors.push(`导入大六壬记录失败: ${err}`);
        }
      }
    }

    onProgress?.(70, "导入Wiki文档...");
    // 导入 Wiki 文档
    if (data.wiki && data.wiki.length > 0) {
      for (const doc of data.wiki) {
        try {
          const wikiData: Omit<WikiDocument, "id"> = {
            personId: defaultPersonId,
            title: doc.title,
            content: doc.content,
            tags: doc.tags,
            savedAt: doc.savedAt || Date.now(),
            updatedAt: doc.updatedAt || Date.now(),
          };
          await db.wikiDocs.add(wikiData);
          result.wiki++;
        } catch (err) {
          result.errors.push(`导入Wiki文档失败: ${err}`);
        }
      }
    }

    onProgress?.(100, "导入完成");
  } catch (err) {
    result.errors.push(`导入失败: ${err}`);
  }

  return result;
}

/**
 * 验证备份数据结构
 */
async function validateBackupData(data: BackupData): Promise<void> {
  if (!data.person && !data.liuren && !data.wiki) {
    throw new Error("备份文件中没有可导入的数据");
  }

  // 验证人物数据
  if (data.person) {
    if (!data.person.name || !data.person.date || data.person.timeIndex === undefined) {
      throw new Error("人物数据不完整：缺少必要字段");
    }
  }

  // 验证大六壬记录
  if (data.liuren) {
    for (const record of data.liuren) {
      if (!record.calculationTime || !record.question || !record.result) {
        throw new Error("大六壬记录数据不完整");
      }
    }
  }

  // 验证 Wiki 文档
  if (data.wiki) {
    for (const doc of data.wiki) {
      if (!doc.title || !doc.content) {
        throw new Error("Wiki文档数据不完整");
      }
    }
  }
}

/* ─────────────── CSV 导入 ─────────────── */

/**
 * 从 CSV 文件导入数据
 */
export async function importFromCsv(
  file: File,
  type: "liuren" | "wiki",
  onProgress?: (percent: number, text: string) => void,
): Promise<number> {
  const text = await file.text();
  const lines = text.split("\n").filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV 文件为空或格式不正确");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1);

  // 获取默认人物 ID（用于关联导入的记录）
  const defaultPerson = await getDefaultPerson();
  const defaultPersonId = defaultPerson.id ?? 1;

  onProgress?.(10, `解析 CSV（${rows.length} 行）...`);

  let importedCount = 0;

  if (type === "liuren") {
    // 大六壬记录 CSV 导入
    for (let i = 0; i < rows.length; i++) {
      try {
        const values = parseCsvLine(rows[i]);
        const record = mapCsvToLiuren(headers, values, defaultPersonId);
        await db.liurenRecords.add(record);
        importedCount++;
        onProgress?.(10 + (i / rows.length) * 80, `导入第 ${i + 1}/${rows.length} 条...`);
      } catch (err) {
        console.error(`[importData] 导入第 ${i + 1} 行失败`, err);
      }
    }
  } else if (type === "wiki") {
    // Wiki 文档 CSV 导入
    for (let i = 0; i < rows.length; i++) {
      try {
        const values = parseCsvLine(rows[i]);
        const doc = mapCsvToWiki(headers, values, defaultPersonId);
        await db.wikiDocs.add(doc);
        importedCount++;
        onProgress?.(10 + (i / rows.length) * 80, `导入第 ${i + 1}/${rows.length} 篇...`);
      } catch (err) {
        console.error(`[importData] 导入第 ${i + 1} 行失败`, err);
      }
    }
  }

  onProgress?.(100, "导入完成");
  return importedCount;
}

/**
 * 解析 CSV 行（支持引号包裹的字段）
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * CSV 行映射为大六壬记录
 */
function mapCsvToLiuren(
  headers: string[],
  values: string[],
  personId: number,
): Omit<LiurenRecord, "id"> {
  const map: Record<string, string> = {};
  headers.forEach((h, i) => {
    map[h] = values[i] || "";
  });

  return {
    personId,
    calculationTime: map["起课时间"] || "",
    question: map["占事"] || "",
    note: map["备注"] || "",
    tags: (map["标签"] || "").split(";").filter(Boolean),
    background: "",
    result: {} as LiurenRecord["result"], // CSV 导入不包含完整卦象数据
    savedAt: Date.now(),
  };
}

/**
 * CSV 行映射为 Wiki 文档
 */
function mapCsvToWiki(
  headers: string[],
  values: string[],
  personId: number,
): Omit<WikiDocument, "id"> {
  const map: Record<string, string> = {};
  headers.forEach((h, i) => {
    map[h] = values[i] || "";
  });

  return {
    personId,
    title: map["标题"] || "",
    content: map["内容预览"] || "",
    tags: (map["标签"] || "").split(";").filter(Boolean),
    savedAt: new Date(map["创建时间"] || Date.now()).getTime(),
    updatedAt: new Date(map["更新时间"] || Date.now()).getTime(),
  };
}

/* ─────────────── 数据预览 ─────────────── */

/**
 * 预览 JSON 备份内容
 */
export async function previewJsonBackup(file: File): Promise<{
  hasPerson: boolean;
  liurenCount: number;
  wikiCount: number;
  exportedAt?: string;
}> {
  const text = await file.text();
  const data: BackupData = JSON.parse(text);

  return {
    hasPerson: !!data.person || (Array.isArray(data.persons) && data.persons.length > 0),
    liurenCount: data.liuren?.length || 0,
    wikiCount: data.wiki?.length || 0,
    exportedAt: data.meta?.exportedAt,
  };
}

/**
 * 预览 CSV 数据
 */
export async function previewCsvData(file: File): Promise<{
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
}> {
  const text = await file.text();
  const lines = text.split("\n").filter(line => line.trim());

  if (lines.length < 1) {
    throw new Error("CSV 文件为空");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1, 6); // 只预览前 5 行
  const sampleRows = rows.map(parseCsvLine);

  return {
    headers,
    rowCount: lines.length - 1,
    sampleRows,
  };
}
