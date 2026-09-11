import type { HexType, Palace } from './types';
import { HEX_NAMES, TRIGRAMS } from './constants';

export type Bits = [number, number, number, number, number, number];

export interface PalaceInfo {
  palace: Palace;
  type: HexType;
  shi: number;
  ying: number;
  name: string;
}

export function bitsKey(bits: Bits): string {
  return bits.join('');
}

export function trigramOf(bits: number[]): (typeof TRIGRAMS)[number] {
  const found = TRIGRAMS.find(
    (t) => t.bits[0] === bits[0] && t.bits[1] === bits[1] && t.bits[2] === bits[2],
  );
  if (!found) throw new Error(`invalid trigram bits: ${bits.join('')}`);
  return found;
}

export function hexName(bits: Bits): string {
  const lower = trigramOf(bits.slice(0, 3)).name;
  const upper = trigramOf(bits.slice(3, 6)).name;
  return HEX_NAMES[`${lower}${upper}`];
}

/**
 * 八宮卦序生成（汰換點：可換成 64 卦硬表，契約不變）：
 * 本宮 → 一世~五世（依次翻初~五爻）→ 遊魂（翻五世卦第四爻）→ 歸魂（翻遊魂卦內三爻）。
 * 世爻位：6,1,2,3,4,5,4,3；應爻 = 世 ±3。
 */
const SHI_BY_ORDER = [6, 1, 2, 3, 4, 5, 4, 3];
const TYPE_BY_ORDER: HexType[] = ['本宮', '一世', '二世', '三世', '四世', '五世', '遊魂', '歸魂'];

function buildPalaceTable(): Map<string, PalaceInfo> {
  const table = new Map<string, PalaceInfo>();
  for (const tri of TRIGRAMS) {
    const pure: Bits = [...tri.bits, ...tri.bits] as Bits;
    let current: Bits = [...pure];
    for (let order = 0; order < 8; order++) {
      if (order >= 1 && order <= 5) {
        current = [...current];
        current[order - 1] = current[order - 1] ? 0 : 1;
      } else if (order === 6) {
        current = [...current];
        current[3] = current[3] ? 0 : 1;
      } else if (order === 7) {
        current = [...current];
        for (let i = 0; i < 3; i++) current[i] = current[i] ? 0 : 1;
      }
      const shi = SHI_BY_ORDER[order];
      table.set(bitsKey(current), {
        palace: tri.name,
        type: TYPE_BY_ORDER[order],
        shi,
        ying: shi > 3 ? shi - 3 : shi + 3,
        name: hexName(current),
      });
    }
  }
  return table;
}

const PALACE_TABLE = buildPalaceTable();

export function palaceInfo(bits: Bits): PalaceInfo {
  const info = PALACE_TABLE.get(bitsKey(bits));
  if (!info) throw new Error(`hexagram not found in palace table: ${bitsKey(bits)}`);
  return info;
}

/** 由卦名反查爻象（REQ-13 卦名起卦） */
export function bitsOfName(name: string): Bits | null {
  for (const [key, info] of PALACE_TABLE) {
    if (info.name === name) return key.split('').map(Number) as Bits;
  }
  return null;
}

export const ALL_HEX_NAMES: string[] = [...PALACE_TABLE.values()].map((i) => i.name);
