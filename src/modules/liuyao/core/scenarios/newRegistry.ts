import type { ScenarioDef, ScenarioId } from '../types';

/** 所有占卜场景定义 */
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  marriage_female: {
    scenarioId: 'marriage_female',
    title: '感情/婚姻(女)',
    scoreLabel: '感情倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '感情占卜仅供参考，不构成人生决策建议。',
  },
  marriage_male: {
    scenarioId: 'marriage_male',
    title: '感情/婚姻(男)',
    scoreLabel: '感情倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '感情占卜仅供参考，不构成人生决策建议。',
  },
  wealth_business: {
    scenarioId: 'wealth_business',
    title: '财运/生意',
    scoreLabel: '财运倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '财运占卜仅供参考，不构成投资建议。',
  },
  number_prediction: {
    scenarioId: 'number_prediction',
    title: '号码预测',
    scoreLabel: '号码倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '号码预测仅供娱乐参考。',
  },
  career_official: {
    scenarioId: 'career_official',
    title: '事业官运',
    scoreLabel: '事业倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '事业占卜仅供参考，不构成职业决策建议。',
  },
  weekly_fortune: {
    scenarioId: 'weekly_fortune',
    title: '周运势',
    scoreLabel: '周运势',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '运势占卜仅供参考。',
  },
  lifetime_yearly: {
    scenarioId: 'lifetime_yearly',
    title: '终身运/年运',
    scoreLabel: '运势倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '终身运/年运占卜仅供参考。',
  },
  education_exam: {
    scenarioId: 'education_exam',
    title: '学业/考试',
    scoreLabel: '学业倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '学业占卜仅供参考，不构成学习决策建议。',
  },
  pregnancy_children: {
    scenarioId: 'pregnancy_children',
    title: '怀孕/子女缘',
    scoreLabel: '子女缘倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '子女缘占卜仅供参考。',
  },
  job_hunting: {
    scenarioId: 'job_hunting',
    title: '求职应聘',
    scoreLabel: '求职倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '求职占卜仅供参考，不构成职业决策建议。',
  },
  illness_medicine: {
    scenarioId: 'illness_medicine',
    title: '疾病/医药',
    scoreLabel: '康复倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '疾病占卜仅供参考，不构成医疗建议。如有不适，请及时就医。',
  },
  traveler_return: {
    scenarioId: 'traveler_return',
    title: '行人归来',
    scoreLabel: '行人归期',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '行人占卜仅供参考。',
  },
  stock_futures: {
    scenarioId: 'stock_futures',
    title: '股票期货',
    scoreLabel: '投资倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '投资占卜仅供参考，不构成投资建议。投资有风险，入市需谨慎。',
  },
  travel_safety: {
    scenarioId: 'travel_safety',
    title: '出行平安',
    scoreLabel: '出行平安',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '出行占卜仅供参考，请注意安全。',
  },
  lawsuit: {
    scenarioId: 'lawsuit',
    title: '官司诉讼',
    scoreLabel: '诉讼倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '诉讼占卜仅供参考，不构成法律建议。',
  },
  message_contact: {
    scenarioId: 'message_contact',
    title: '消息联络',
    scoreLabel: '消息倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '消息占卜仅供参考。',
  },
  home_fengshui: {
    scenarioId: 'home_fengshui',
    title: '家宅风水',
    scoreLabel: '家宅倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '风水占卜仅供参考。',
  },
  lost_item: {
    scenarioId: 'lost_item',
    title: '找寻失物',
    scoreLabel: '失物找回',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '失物占卜仅供参考。',
  },
  misc_other: {
    scenarioId: 'misc_other',
    title: '杂占/其它',
    scoreLabel: '占卜倾向',
    extraRules: [],
    contextFields: [],
    flowMapRulePrefixes: [],
    disclaimer: '占卜仅供参考。',
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];

export function scenarioOf(id: ScenarioId): ScenarioDef {
  const def = SCENARIOS[id];
  if (!def) throw new Error(`unknown scenario: ${id}`);
  return def;
}

export function defaultExtrasFor(def: ScenarioDef): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const f of def.contextFields) extras[f.key] = f.default;
  return extras;
}
