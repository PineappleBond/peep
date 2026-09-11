import type { ChartJSON, Element, RuleContext, SkeEdge } from '../types';
import { ELEM_GEN, ELEM_OVERCOME } from '../constants';

/** 官鬼五行 → 病位（R-BS-04） */
const ILLNESS_LOCATION: Record<Element, string> = {
  金: '肺／呼吸系統',
  木: '肝膽',
  水: '腎／泌尿系統',
  火: '心／炎症',
  土: '脾胃',
};

function gen(a: Element, b: Element): boolean {
  return ELEM_GEN[a] === b;
}
function overcome(a: Element, b: Element): boolean {
  return ELEM_OVERCOME[a] === b;
}
function prosperous(elem: Element, monthElem: Element): boolean {
  return elem === monthElem || gen(monthElem, elem);
}

export interface HitDraft {
  id: string;
  delta: number;
  detail: string;
  edges?: SkeEdge[];
}

export interface ScenarioRuleArgs {
  chart: ChartJSON;
  ctx: RuleContext;
  drafts: HitDraft[];
  yLabel: string;
  yl: ChartJSON['lines'][number];
  mE: Element;
}

export function applyIllnessKong(ctx: RuleContext, drafts: HitDraft[], yLabel: string) {
  const duration = ctx.extras.illnessDuration ?? '近病';
  if (duration === '近病') {
    drafts.push({ id: 'R-BS-01', delta: 2.5, detail: `近病${yLabel}旬空，即癒之兆` });
  } else {
    drafts.push({ id: 'R-BS-02', delta: -3.0, detail: `久病${yLabel}旬空，凶兆` });
  }
}

export function applyIllnessHarmony(
  ctx: RuleContext,
  drafts: HitDraft[],
  harmony: '六合' | '六沖',
) {
  if (harmony !== '六沖') return;
  const near = (ctx.extras.illnessDuration ?? '近病') === '近病';
  drafts.push({
    id: 'R-BS-03',
    delta: near ? 2.0 : -2.0,
    detail: `六沖卦：${near ? '近病即癒' : '久病不吉'}`,
  });
}

export function applyIllnessRules({ chart, drafts, mE }: ScenarioRuleArgs) {
  const guiLines = chart.lines.filter((l) => l.rel === '官鬼');
  for (const g of guiLines) {
    drafts.push({
      id: 'R-BS-04', delta: 0,
      detail: `官鬼${g.branch}${g.elem}（第${g.pos}爻）→ 病位：${ILLNESS_LOCATION[g.elem]}`,
    });
  }
  if (guiLines.some((g) => g.pos === chart.shi)) {
    drafts.push({ id: 'R-BS-06', delta: -1.0, detail: '官鬼持世，病體纏身' });
  }
  for (const s of chart.lines.filter((l) => l.rel === '子孫')) {
    if (s.moving && prosperous(s.elem, mE)) {
      drafts.push({
        id: 'R-BS-05', delta: 1.5,
        detail: `子孫${s.branch}${s.elem}（第${s.pos}爻）旺動，醫治得力`,
      });
    } else if (s.kong) {
      drafts.push({
        id: 'R-BS-05', delta: -1.0,
        detail: `子孫${s.branch}${s.elem}（第${s.pos}爻）旬空，醫藥乏力`,
      });
    }
  }
}

export function applyWealthRules({ chart, drafts, yLabel, yl, mE }: ScenarioRuleArgs) {
  for (const line of chart.lines) {
    if (line.rel !== '兄弟') continue;
    if (line.moving && prosperous(line.elem, mE) && overcome(line.elem, yl.elem)) {
      drafts.push({
        id: 'R-WC-02', delta: -2.0,
        detail: `第${line.pos}爻兄弟${line.branch}${line.elem}旺動剋${yLabel}，破財之兆`,
        edges: [{ from: line.pos, to: yl.pos, kind: '剋' }],
      });
    }
  }
  for (const line of chart.lines) {
    if (line.rel !== '子孫') continue;
    if (line.moving && prosperous(line.elem, mE) && gen(line.elem, yl.elem)) {
      drafts.push({
        id: 'R-WC-03', delta: 1.5,
        detail: `第${line.pos}爻子孫${line.branch}${line.elem}旺動生${yLabel}，生財有道`,
        edges: [{ from: line.pos, to: yl.pos, kind: '生' }],
      });
    }
  }
}
