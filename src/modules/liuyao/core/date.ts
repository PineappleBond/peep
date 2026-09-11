/** 使用者本地日期 yyyy-mm-dd */
export function localDateISO(d = new Date()): string {
  return d.toLocaleDateString('sv-SE');
}
