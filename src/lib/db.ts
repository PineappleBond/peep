import Dexie, { type EntityTable } from "dexie";
import type { ChartJSON } from "@/modules/liuyao/core/types";

/* ── 文档记录 ─────────────────────────────────── */
export interface DocumentRecord {
  id?: number;
  type: "recall" | "diary" | "notes";
  title: string;
  content: string;
  tags: string[];
  /** 关联人物 ID（可选），用于按人物组织文档 */
  personId?: number | null;
  /** 关联文件夹 ID（可选），用于文件夹树组织 */
  folderId?: number | null;
  /** 关联时间范围（可选），用于按运势时间组织文档 */
  horoscopeScope?: {
    startLevel: "dayun" | "liunian" | "liuyue" | "liuri" | "liushi";
    endLevel: "dayun" | "liunian" | "liuyue" | "liuri" | "liushi";
    startValue: string;
    endValue: string;
    ganzhi?: string;
  } | null;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

/* ── 文件夹记录 ────────────────────────────────── */
export interface Folder {
  id?: number;
  title: string;
  /** 父文件夹 ID，null 表示根级 */
  parentId: number | null;
  createdAt: number;
  updatedAt: number;
}

/* ── 用户（人物）记录 ──────────────────────────── */
export interface Person {
  id?: number;
  /** 姓名 */
  name: string;
  /** 性别 */
  gender: "male" | "female";
  /** 出生日期 ISO 格式 */
  birthDate: string;
  /** 出生时辰或 HH:mm */
  birthTime?: string;
  /** 是否为农历日期（默认 false = 公历） */
  isLunar?: boolean;
  /** 备注（支持 Markdown） */
  note?: string;
  deletedAt?: number | null; // 软删除标记（时间戳）
  createdAt: number;
  updatedAt: number;
}

/* ── 六爻起卦记录 ─────────────────────────────── */
export interface LiuyaoRecord {
  id?: number;
  timestamp: number;
  /** 起卦日期 ISO 格式 (sv-SE) */
  date: string;
  lines: [number, number, number, number, number, number];
  scenarioId: string;
  yongTarget: string;
  extras: Record<string, string>;
  question: string;
  background?: string;
  chart: ChartJSON;
  personId?: number | null;
  personName?: string;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt?: number;
}

class PeepDatabase extends Dexie {
  documents!: EntityTable<DocumentRecord, "id">;
  persons!: EntityTable<Person, "id">;
  folders!: EntityTable<Folder, "id">;
  liuyaoRecords!: EntityTable<LiuyaoRecord, "id">;

  constructor() {
    super("peep-db");

    // v8: 统一所有 ID 为自增整数，时间戳统一为 number
    // 注意：此版本不兼容旧数据，需要清除 IndexedDB
    this.version(8).stores({
      persons: "++id, name, gender, birthDate, deletedAt, createdAt, updatedAt",
      documents:
        "++id, type, title, *tags, personId, folderId, horoscopeScope, deletedAt, createdAt, updatedAt, [type+updatedAt], [type+createdAt]",
      folders: "++id, parentId, title, createdAt, updatedAt",
      liuyaoRecords: "++id, timestamp, date, scenarioId, personId, deletedAt",
    });
  }
}

export const db = new PeepDatabase();
