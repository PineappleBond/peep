/** 导出层：下载工具与文件名生成 */
import type { Zwds } from "../useZwds";
import { type ExportOptions } from "./serialize";

// Magic numbers
const OBJECT_URL_REVOKE_DELAY = 800; // 下载后撤销 object URL 的延时（毫秒）

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY);
}

/** 日期补零便于文件名排序：2000-8-16 → 2000-08-16 */
function padSolarDate(s: string): string {
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : s;
}

/**
 * 导出文件名：`紫微斗数_姓名_YYYY-MM-DD_HH-mm`（参照 react-8char 带出生时刻，
 * 便于区分同日不同时辰的盘）。时刻取**实际排盘所用**时刻——真太阳时校正后的
 * 时刻优先；未启用真太阳时（无精确时刻）则用时辰名（如 `寅时`），不编造分钟数。
 * 勾选附加流日时追加观测点（`_流日2026-06-29`）：同一张盘的多份导出（择日各一份）
 * 不致重名互相覆盖，也能一眼看出择的是哪天。
 */
export function baseFilename(z: Zwds, opts: ExportOptions = {}): string {
  const name = (z.input.name || "无名").replace(/[\\/:*?"<>|\s]/g, "");
  const a = z.astrolabe;
  const date = padSolarDate(a?.solarDate ?? "");
  const clock = z.trueSolar?.trueTime;
  const time = clock ? clock.replace(":", "-") : ((a?.time as string) ?? "");
  let s = `紫微斗数_${name}_${date}${time ? `_${time}` : ""}`;
  if (opts.withDaily) s += `_流日${padSolarDate(z.targetSolar ?? "")}`;
  return s;
}
