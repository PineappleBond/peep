/**
 * 多设备数据同步模块（方案 C：导出/导入 + 端到端加密）。
 *
 * 设计思路：
 * - 将 IndexedDB 全部数据（人物、六壬、Wiki）打包为 JSON 快照
 * - 可选用密码派生 AES-GCM 密钥加密（PBKDF2-SHA256）
 * - 生成可分享的同步链接（URL 哈希携带密文，纯客户端，不上传服务器）
 * - 在另一设备打开链接即可还原数据（覆盖或合并）
 *
 * 安全约定：
 * - 密码不传输、不存储；仅作为密钥派生材料
 * - 每次加密使用随机 salt + iv，相同密码不同密文
 * - 无密码模式下为明文 Base64（便于调试，不推荐用于敏感数据）
 *
 * 限制：
 * - URL 长度受浏览器限制（通常 ~2MB），超大备份请改用文件导入
 */
import { db } from "./personDb";
import type { Person, LiurenRecord, WikiDocument, WikiLink } from "./personDb";
import type { BackupData } from "./importData";

/* ─────────────── 同步配置（持久化在 localStorage） ─────────────── */

export interface SyncConfig {
  /** 默认密码（留空=不加密） */
  defaultPassword: string;
  /** 自动同步间隔（分钟），0 表示不自动；TODO: 自动同步定时器尚未实现 */
  autoSyncInterval: number;
  /** 自动上传开关；TODO: 自动上传逻辑尚未实现 */
  autoUpload: boolean;
}

const CONFIG_KEY = "peep-sync-config";

const DEFAULT_CONFIG: SyncConfig = {
  defaultPassword: "",
  autoSyncInterval: 0,
  autoUpload: false,
};

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSyncConfig(cfg: SyncConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.error("[sync] 保存配置失败", err);
  }
}

/* ─────────────── 同步历史（展示最近操作） ─────────────── */

export type SyncEvent = "upload" | "download";

export interface SyncRecord {
  /** 事件类型 */
  event: SyncEvent;
  /** 时间戳 */
  at: number;
  /** 数据大小（字节） */
  size: number;
  /** 是否加密 */
  encrypted: boolean;
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  error?: string;
}

const HISTORY_KEY = "peep-sync-history";
const MAX_HISTORY = 20;

export function loadSyncHistory(): SyncRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: SyncRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
  } catch {
    /* 忽略 */
  }
}

export function appendSyncHistory(rec: SyncRecord): void {
  const all = loadSyncHistory();
  all.unshift(rec);
  saveHistory(all);
}

export function clearSyncHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* 忽略 */
  }
}

/* ─────────────── 数据快照 ─────────────── */

/**
 * 收集所有本地数据，打包为可导出的备份结构。
 */
export async function collectSnapshot(): Promise<BackupData> {
  const [persons, liuren, wikiDocs, wikiLinks] = await Promise.all([
    db.persons.toArray(),
    db.liurenRecords.toArray(),
    db.wikiDocs.toArray(),
    db.wikiLinks.toArray(),
  ]);
  return {
    meta: {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      scope: "all",
    },
    // 通过 unknown 中转：保留运行时 id 字段，但绕开 BackupData 的窄类型约束
    persons: persons as unknown as BackupData["persons"],
    liuren: liuren as unknown as BackupData["liuren"],
    wiki: wikiDocs as unknown as BackupData["wiki"],
    wikiLinks: wikiLinks as unknown as BackupData["wikiLinks"],
  };
}

/* ─────────────── 数据恢复 ─────────────── */

export type RestoreMode = "overwrite" | "merge";

/**
 * 还原备份数据到本地数据库。
 * - overwrite：清空所有表后写入（保留原始 ID）
 * - merge：逐条合并，同 ID 跳过，保留本地原有
 *
 * 注意：本函数通过 unknown 中转类型，以保留快照中的 id 字段
 */
export async function restoreBackup(data: BackupData, mode: RestoreMode): Promise<void> {
  // 通过 unknown 中转以获得含 id 的完整类型（保留跨表引用）
  const persons = (data.persons ?? []) as unknown as Person[];
  const liuren = (data.liuren ?? []) as unknown as LiurenRecord[];
  const wiki = (data.wiki ?? []) as unknown as WikiDocument[];
  const links = (data.wikiLinks ?? []) as unknown as WikiLink[];

  await db.transaction("rw", db.persons, db.liurenRecords, db.wikiDocs, db.wikiLinks, async () => {
    if (mode === "overwrite") {
      await db.persons.clear();
      await db.liurenRecords.clear();
      await db.wikiDocs.clear();
      await db.wikiLinks.clear();

      if (persons.length) await db.persons.bulkAdd(persons);
      if (liuren.length) await db.liurenRecords.bulkAdd(liuren);
      if (wiki.length) await db.wikiDocs.bulkAdd(wiki);
      if (links.length) await db.wikiLinks.bulkAdd(links);
    } else {
      // merge：按 ID 去重，同 id 已存在则跳过
      for (const p of persons) {
        if (p.id == null || !(await db.persons.get(p.id))) {
          await db.persons.add(p);
        }
      }
      for (const l of liuren) {
        if (l.id == null || !(await db.liurenRecords.get(l.id))) {
          await db.liurenRecords.add(l);
        }
      }
      for (const w of wiki) {
        if (w.id == null || !(await db.wikiDocs.get(w.id))) {
          await db.wikiDocs.add(w);
        }
      }
      for (const link of links) {
        if (link.id == null || !(await db.wikiLinks.get(link.id))) {
          await db.wikiLinks.add(link);
        }
      }
    }
  });
}

/**
 * 冲突预检：统计本地与备份中同 ID 的记录数
 */
export async function detectConflicts(data: BackupData): Promise<{
  persons: number;
  liuren: number;
  wiki: number;
}> {
  const [localPersons, localLiuren, localWiki] = await Promise.all([
    db.persons.toArray(),
    db.liurenRecords.toArray(),
    db.wikiDocs.toArray(),
  ]);
  const localPersonIds = new Set(localPersons.map(p => p.id));
  const localLiurenIds = new Set(localLiuren.map(l => l.id));
  const localWikiIds = new Set(localWiki.map(w => w.id));

  const backupPersons = (data.persons ?? []) as unknown as Array<{ id?: number }>;
  const backupLiuren = (data.liuren ?? []) as unknown as Array<{ id?: number }>;
  const backupWiki = (data.wiki ?? []) as unknown as Array<{ id?: number }>;

  return {
    persons: backupPersons.filter(p => p.id != null && localPersonIds.has(p.id)).length,
    liuren: backupLiuren.filter(l => l.id != null && localLiurenIds.has(l.id)).length,
    wiki: backupWiki.filter(w => w.id != null && localWikiIds.has(w.id)).length,
  };
}

/* ─────────────── 加密 / 解密 ─────────────── */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * 用密码派生 AES-GCM 密钥
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** URL 安全的 Base64（+ → -，/ → _，去除 =） */
function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return fromBase64(b64);
}

/**
 * 加密 JSON 字符串为 URL 安全载荷（salt + iv + ciphertext 拼接）
 */
async function encryptPayload(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  // 拼接：salt(16) + iv(12) + ciphertext
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
  return toBase64Url(combined);
}

/**
 * 解密 URL 安全载荷为 JSON 字符串
 */
async function decryptPayload(
  payload: string,
  password: string,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<string> {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  const combined = fromBase64Url(payload);
  if (combined.byteLength < SALT_BYTES + IV_BYTES + 1) {
    throw new Error(tr("sync.payloadBad", "载荷格式错误"));
  }
  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = combined.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/* ─────────────── 链接生成与解析 ─────────────── */

/** 加密载荷在 URL 中的键 */
export const LINK_KEY = "restore";

/**
 * 生成本地数据的加密同步链接
 * @returns 包含完整 URL 的字符串
 */
export async function generateSyncLink(
  password: string,
  onProgress?: (percent: number, text: string) => void,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<string> {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  onProgress?.(10, tr("sync.collecting", "收集数据..."));
  const snapshot = await collectSnapshot();
  const json = JSON.stringify(snapshot);

  onProgress?.(40, tr("sync.encrypting", "加密中..."));
  const payload = password
    ? await encryptPayload(json, password)
    : toBase64Url(new TextEncoder().encode(json));

  onProgress?.(80, tr("sync.generatingLink", "生成链接..."));

  // 将载荷放入 URL 哈希，避免发送到服务器
  const base = globalThis.location?.href?.split("#")[0] ?? "";
  const link = `${base}#${LINK_KEY}=${payload}`;

  onProgress?.(100, tr("sync.done", "完成"));

  // 记录同步历史
  appendSyncHistory({
    event: "upload",
    at: Date.now(),
    size: json.length,
    encrypted: !!password,
    success: true,
  });

  // 超大载荷提示（浏览器 URL 长度通常 ~2MB）
  if (link.length > 1_500_000) {
    console.warn("[sync] 链接体积较大，部分浏览器可能无法打开");
  }

  return link;
}

/**
 * 检测当前 URL 是否包含同步链接数据
 *
 * 注意：无法仅从载荷外观可靠区分加密与明文（两者均为 base64url），
 * 因此 `encrypted` 字段始终返回 true，由调用方根据用户是否输入密码判断。
 */
export function parseSyncLink(url?: string): { payload: string; encrypted: boolean } | null {
  const href = url ?? globalThis.location?.href ?? "";
  const hashIdx = href.indexOf("#");
  if (hashIdx < 0) return null;
  const hash = href.slice(hashIdx + 1);
  // 支持 ?restore= 或 restore=
  const patterns = [`${LINK_KEY}=`, `?${LINK_KEY}=`, `&${LINK_KEY}=`];
  for (const pat of patterns) {
    if (hash.startsWith(pat)) {
      return { payload: hash.slice(pat.length), encrypted: true };
    }
  }
  return null;
}

/**
 * 解析同步链接并还原数据
 */
export async function restoreFromLink(
  url: string,
  password: string,
  mode: RestoreMode,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<BackupData> {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  const parsed = parseSyncLink(url);
  if (!parsed) throw new Error(tr("sync.linkBad", "无效同步链接"));

  let json: string;
  if (password) {
    try {
      json = await decryptPayload(parsed.payload, password, t);
    } catch {
      throw new Error(tr("sync.wrongPassword", "密码错误"));
    }
  } else {
    json = new TextDecoder().decode(fromBase64Url(parsed.payload));
  }

  const data: BackupData = JSON.parse(json);
  await restoreBackup(data, mode);

  appendSyncHistory({
    event: "download",
    at: Date.now(),
    size: json.length,
    encrypted: !!password,
    success: true,
  });

  return data;
}

/**
 * 直接解析链接为 BackupData（不写入数据库，用于预览）
 */
export async function previewFromLink(
  url: string,
  password: string,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<BackupData> {
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  const parsed = parseSyncLink(url);
  if (!parsed) throw new Error(tr("sync.linkBad", "无效同步链接"));

  let json: string;
  if (password) {
    try {
      json = await decryptPayload(parsed.payload, password, t);
    } catch {
      throw new Error(tr("sync.wrongPassword", "密码错误"));
    }
  } else {
    json = new TextDecoder().decode(fromBase64Url(parsed.payload));
  }

  return JSON.parse(json);
}

/**
 * 清除当前 URL 中的同步载荷（避免刷新时重复触发）
 */
export function clearSyncLinkFromUrl(): void {
  if (typeof globalThis.history?.replaceState !== "function") return;
  const href = globalThis.location.href;
  const hashIdx = href.indexOf("#");
  if (hashIdx < 0) return;
  const base = href.slice(0, hashIdx);
  globalThis.history.replaceState(null, "", base);
}

/* ─────────────── 大小估算 ─────────────── */

/**
 * 估算当前数据体积（字节），用于 UI 提示
 */
export async function estimateSnapshotSize(): Promise<number> {
  const snapshot = await collectSnapshot();
  return JSON.stringify(snapshot).length;
}
