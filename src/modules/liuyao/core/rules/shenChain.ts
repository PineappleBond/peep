import type { ChartJSON, Element, Relative, ShenChain, ShenSlot, YongShen } from '../types';
import { ELEM_GEN, ELEM_OVERCOME, relativeOf } from '../constants';

export type { ShenChain, ShenSlot };

/** 五行「生我」者 */
export function elemThatGenerates(target: Element): Element {
  for (const e of Object.keys(ELEM_GEN) as Element[]) {
    if (ELEM_GEN[e] === target) return e;
  }
  throw new Error(`no generator for ${target}`);
}

/** 五行「剋我」者 */
export function elemThatOvercomes(target: Element): Element {
  for (const e of Object.keys(ELEM_OVERCOME) as Element[]) {
    if (ELEM_OVERCOME[e] === target) return e;
  }
  throw new Error(`no overcomer for ${target}`);
}

/** 依用神五行定位元神／忌神／仇神（增刪卜易用神章） */
export function locateShenChain(chart: ChartJSON, yong: YongShen): ShenChain | null {
  if (yong.pos === null) return null;
  const yongElem = chart.lines[yong.pos - 1].elem;
  const palaceElem = chart.palaceElem;

  const yuanElem = elemThatGenerates(yongElem);
  const jiElem = elemThatOvercomes(yongElem);
  const chouElem = ELEM_GEN[yongElem];

  const build = (rel: Relative, elem: Element): ShenSlot => ({
    rel,
    elem,
    positions: chart.lines.filter((l) => l.rel === rel).map((l) => l.pos),
  });

  return {
    yuan: build(relativeOf(palaceElem, yuanElem), yuanElem),
    ji: build(relativeOf(palaceElem, jiElem), jiElem),
    chou: build(relativeOf(palaceElem, chouElem), chouElem),
  };
}

export function formatShenChainDetail(chart: ChartJSON, chain: ShenChain): string {
  const fmt = (slot: ShenSlot, label: string) => {
    if (slot.positions.length === 0) {
      return `${label}：${slot.rel}（${slot.elem}）不上卦`;
    }
    const ps = slot.positions.map((p) => {
      const l = chart.lines[p - 1];
      return `第${p}爻${l.branch}${l.elem}`;
    }).join('、');
    return `${label}：${slot.rel}（${slot.elem}）→ ${ps}`;
  };
  return [fmt(chain.yuan, '元神'), fmt(chain.ji, '忌神'), fmt(chain.chou, '仇神')].join('；');
}
