/**
 * AI 导出 · Markdown 格式：把整张命盘 + 当前运限序列化为 Markdown 文本，
 * 供用户下载后上传给 AI 推理。
 */
import { util } from "iztro";
import type { Astrolabe, Horoscope, Zwds } from "../useZwds";
import {
  MUTAGEN_CHARS,
  MUTAGEN_TABLE_LABEL,
  SCOPE_META,
  STEMS,
  bodyPalaceBranchOf,
  fixIndex,
  type Scope,
} from "../utils";
import {
  analyzeChart,
  type ChartAnalysis,
  type HoroPattern,
} from "../analysis";
import { RULEBOOK_MD, STAR_MUTAGEN_MD, topicGuidesMd } from "../knowledge";
import { ADJ_MID_WEIGHT, STAR_WEIGHT_NOTE, type AnyStar } from "./starWeights";
import {
  type ExportOptions,
  getSelfMutagens,
  schoolLabel,
  currentMonthCell,
  getMonthlyOfYear,
  horoscopePatternsOf,
  AGE_NOTE,
} from "./serialize";

/* ─────────────── Markdown ─────────────── */

const starTxt = (s: AnyStar) =>
  `${s.name}${s.brightness ? `(${s.brightness})` : ""}${s.mutagen ? `【生年${s.mutagen}】` : ""}`;

const starList = (list: AnyStar[]) => (list.length ? list.map(starTxt).join("、") : "无");

function mutagenLine(mutagen: string[]): string {
  if (!mutagen?.length) return "无";
  return mutagen.map((m, i) => `化${MUTAGEN_CHARS[i]}=${m}`).join("，");
}

function scopeSection(
  a: Astrolabe,
  scope: Scope,
  item: Horoscope[Scope],
  extraTitle: string
): string {
  const meta = SCOPE_META[scope];
  const seat = a.palaces[item.index];
  const lines: string[] = [];
  lines.push(`### ${meta.rowLabel}${extraTitle}`);
  lines.push("");
  lines.push(`- ${meta.rowLabel}干支：${item.heavenlyStem}${item.earthlyBranch}`);
  lines.push(
    `- ${meta.rowLabel}命宫落于本命【${seat?.name ?? "?"}】宫（地支${seat?.earthlyBranch ?? "?"}）`
  );
  lines.push(`- ${meta.rowLabel}四化：${mutagenLine(item.mutagen as string[])}`);
  lines.push("");
  lines.push(`| 本命宫位（地支） | ${meta.rowLabel}十二宫 |`);
  lines.push("|---|---|");
  a.palaces.forEach((p, i) => {
    lines.push(`| ${p.name}（${p.earthlyBranch}） | ${meta.prefix}${item.palaceNames[i]} |`);
  });
  if (item.stars?.some((g) => g.length)) {
    lines.push("");
    lines.push(`- ${meta.rowLabel}流耀分布：`);
    item.stars.forEach((g, i) => {
      if (g.length)
        lines.push(
          `  - ${a.palaces[i].earthlyBranch}宫（本命${a.palaces[i].name}）：${g
            .map((s) => s.name)
            .join("、")}`
        );
    });
  }
  lines.push("");
  return lines.join("\n");
}

/** 二、格局与关键结构 */
function analysisPatternsMd(an: ChartAnalysis): string[] {
  const L: string[] = [];
  L.push(`## 二、格局与关键结构（程序确定性检测）`);
  L.push("");
  L.push(`> 以下按本盘星位逐一判定（含成格瑕疵与古籍出处），推理请直接引用本节结论，不要自行重推格局。`);
  L.push("");
  if (an.patterns.length) {
    L.push(`### 格局（共 ${an.patterns.length} 个）`);
    L.push("");
    an.patterns.forEach((p, i) => {
      L.push(`${i + 1}. **${p.name}**〔${p.kind}〕· ${p.where}`);
      L.push(`   - 构成：${p.basis}`);
      L.push(`   - 释义：${p.meaning}`);
      if (p.classic) L.push(`   - 古籍：${p.classic}`);
      if (p.flaw) L.push(`   - ⚠ 瑕疵：${p.flaw}`);
    });
  } else {
    L.push(`### 格局：未检出经典格局（以星情与四化论）`);
  }
  L.push("");
  L.push(`### 夹宫关系`);
  L.push("");
  if (an.jiaGong.length) {
    for (const j of an.jiaGong) {
      L.push(`- ${j.palaceName}(${j.branch}) 被**${j.kind}**〔${j.good ? "吉" : "凶"}〕——${j.detail}`);
    }
  } else {
    L.push(`- 未检出显著夹宫组合`);
  }
  L.push("");
  if (an.borrowed.length) {
    L.push(`### 空宫借星（借对宫主星论）`);
    L.push("");
    for (const b of an.borrowed) {
      L.push(`- ${b.palaceName}(${b.branch}) 无主星，借对宫【${b.oppositeName}】：${b.borrowed.join("、") || "对宫亦无主星（再借其三方论）"}`);
    }
    L.push("");
  }
  return L;
}

/** 四、三方四正快照 */
function sanfangMd(an: ChartAnalysis): string[] {
  const L: string[] = [];
  L.push(`## 四、三方四正快照（每宫会照总览）`);
  L.push("");
  L.push(`> 每宫的对宫/三合已算好并汇总会吉、会煞、生年四化会入——判断任一宫强弱直接读本表，无需再数宫位。`);
  L.push("");
  L.push(`| 宫位 | 本宫主星 | 对宫 | 三合 | 三合 | 会吉（六吉禄马） | 会煞 | 生年四化会入 |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for (const s of an.sanfang) {
    const [self, opp, t1, t2] = s.seats;
    const cell = (x: (typeof s.seats)[number]) => `${x.palaceName}(${x.branch})：${x.majors}`;
    L.push(
      `| **${s.palaceName}(${s.branch})** | ${self.majors} | ${cell(opp)} | ${cell(t1)} | ${cell(t2)} | ${
        s.auspicious.join("、") || "无"
      } | ${s.inauspicious.join("、") || "无"} | ${s.natalMutagens.join("、") || "无"} |`
    );
  }
  L.push("");
  const borrowedNotes = an.sanfang.filter((s) => s.borrowed);
  for (const s of borrowedNotes) L.push(`> ${s.palaceName}(${s.branch})：${s.borrowed}`);
  if (borrowedNotes.length) L.push("");
  return L;
}

/** 五、飞宫四化全矩阵 */
function flyMatrixMd(an: ChartAnalysis): string[] {
  const L: string[] = [];
  const fm = an.flyMatrix;
  L.push(`## 五、飞宫四化全矩阵（十二宫互飞）`);
  L.push("");
  L.push(`> ${fm.note}`);
  L.push("");
  L.push(`| 宫（干支） | 化禄 | 化权 | 化科 | 化忌 |`);
  L.push(`|---|---|---|---|---|`);
  for (const pf of fm.palaces) {
    const cell = (k: number) => {
      const f = pf.flies[k];
      if (!f) return "-";
      if (f.isSelf) return `${f.star}→**本宫**（自化${f.mutagen}·离心）`;
      return `${f.star}→${f.toName}${f.isOpposite ? "（冲本宫方向）" : ""}`;
    };
    L.push(`| **${pf.palaceName}**（${pf.stem}${pf.branch}） | ${cell(0)} | ${cell(1)} | ${cell(2)} | ${cell(3)} |`);
  }
  L.push("");
  const outward = fm.palaces.filter((p) => p.selfOutward.length);
  const inward = fm.palaces.filter((p) => p.selfInward.length);
  if (outward.length) {
    L.push(`- **离心自化汇总**：${outward.map((p) => `${p.palaceName}(${p.selfOutward.join("、")})`).join("；")}`);
  }
  if (inward.length) {
    L.push(`- **向心自化汇总**：${inward.map((p) => `${p.palaceName}(${p.selfInward.join("、")})`).join("；")}`);
  }
  L.push("");
  const mc = an.mutagenChains;
  L.push(`### 四化传导链（两转三转）`);
  L.push("");
  L.push(`> ${mc.note}`);
  L.push("");
  L.push(`- **忌链**（十二宫为链首）：`);
  for (const c of mc.ji) L.push(`  - ${c.text}`);
  L.push(`- **禄链**（十二宫为链首）：`);
  for (const c of mc.lu) L.push(`  - ${c.text}`);
  L.push("");
  return L;
}

export function buildExportMd(z: Zwds, opts: ExportOptions = {}): string | null {
  const a = z.astrolabe;
  if (!a) return null;
  const h = z.horoscope;
  const an = z.analysis ?? analyzeChart(a);
  const L: string[] = [];

  L.push(`# 紫微斗数命盘（AI 分析用）`);
  L.push("");
  const astroTypeLabel =
    z.input.algorithm === "zhongzhou" && z.input.astroType !== "heaven"
      ? ` · 盘型：${z.input.astroType === "earth" ? "地盘（身宫起局重排）" : "人盘（福德宫起局重排）"}`
      : "";
  L.push(`> 排盘引擎：iztro · 安星流派：**${schoolLabel(z.input.algorithm)}** · 年/运限分界：${
    z.input.yearDivide === "exact" ? "立春" : "正月初一"
  }${astroTypeLabel} · 四化表：**${MUTAGEN_TABLE_LABEL[z.input.mutagenTable]}**（全表见附录B） · ${
    z.input.dayDivide === "current" ? "晚子时归当日" : "晚子时归次日"
  } · 导出时间：${new Date().toLocaleString("zh-CN")}`);
  L.push(`> 星名后括号为亮度（庙旺得利平不陷），【生年X】为生年四化；各运限四化在对应章节单列。`);
  L.push(`> ${STAR_WEIGHT_NOTE}`);
  L.push(`> 本文件不含任何量化评分数据（如人生K线），吉凶请依星耀、四化、格局本身推断。`);
  L.push("");

  /* 一、命主信息 */
  L.push(`## 一、命主信息`);
  L.push("");
  L.push(`| 项目 | 内容 |`);
  L.push(`|---|---|`);
  L.push(`| 姓名 | ${z.input.name || "无名"} |`);
  L.push(`| 性别 | ${a.gender === "女" ? "坤造" : "乾造"} ${a.gender} |`);
  L.push(`| 阳历生日 | ${a.solarDate} |`);
  L.push(`| 农历生日 | ${a.lunarDate}${z.input.isLeapMonth ? "（闰月）" : ""} |`);
  L.push(`| 出生时辰 | ${a.time}（${a.timeRange}） |`);
  if (z.trueSolar) {
    L.push(
      `| 真太阳时 | ${z.trueSolar.trueDate} ${z.trueSolar.trueTime}（出生地 ${z.trueSolar.place}，经度 ${z.trueSolar.longitude}°；钟表 ${z.trueSolar.clockDate} ${z.trueSolar.clockTime}，偏移 ${z.trueSolar.offsetMinutes.toFixed(1)} 分，其中均时差 ${z.trueSolar.eotMinutes.toFixed(1)} 分）→ 已按真太阳时排盘 |`
    );
  }
  L.push(`| 四柱干支 | ${a.chineseDate} |`);
  L.push(`| 五行局 | ${a.fiveElementsClass}（${z.decades[0]?.range[0] ?? "?"} 岁上运，虚岁） |`);
  L.push(`| 命主 / 身主 | ${a.soul} / ${a.body} |`);
  L.push(`| 命宫 / 身宫 | ${a.earthlyBranchOfSoulPalace} / ${bodyPalaceBranchOf(a.palaces, a.earthlyBranchOfBodyPalace)} |`);
  const origin = a.palaces.find((p) => p.isOriginalPalace);
  if (origin) L.push(`| 来因宫 | ${origin.name}（${origin.earthlyBranch}） |`);
  L.push(`| 生肖 / 星座 | ${a.zodiac} / ${a.sign} |`);
  if (z.input.residence)
    L.push(`| 常居住地 | ${z.input.residence}（不参与排盘，供地域/方位/迁移背景参考） |`);
  L.push("");

  /* 二、格局与关键结构 */
  L.push(...analysisPatternsMd(an));

  /* 三、十二宫详情（命宫起，逆布） */
  L.push(`## 三、十二宫详情`);
  L.push("");
  const soul = z.soulPalaceIndex >= 0 ? z.soulPalaceIndex : 0;
  for (let k = 0; k < 12; k++) {
    const p = a.palaces[fixIndex(soul - k)];
    if (!p) continue;
    const marks = [p.isBodyPalace ? "【身宫】" : "", p.isOriginalPalace ? "【来因宫】" : ""].join("");
    L.push(`### ${k + 1}. ${p.name}${marks}（${p.heavenlyStem}${p.earthlyBranch}）`);
    L.push("");
    L.push(`- 主星：${starList(p.majorStars)}`);
    if (!p.majorStars.length) {
      const opp = a.palaces[fixIndex(p.index + 6)];
      L.push(
        `- 借星：无主星，借对宫【${opp.name}】${starList(opp.majorStars)}（借星力量略减，兼看其四化）`
      );
    }
    L.push(`- 辅星：${starList(p.minorStars)}`);
    const adjMid = p.adjectiveStars.filter((s) => ADJ_MID_WEIGHT.has(s.name));
    const adjLow = p.adjectiveStars.filter((s) => !ADJ_MID_WEIGHT.has(s.name));
    L.push(`- 杂耀·中权重：${starList(adjMid)}；低权重（仅叠加参考）：${starList(adjLow)}`);
    const selfMuts = getSelfMutagens(p);
    if (selfMuts.length) {
      L.push(
        `- 自化（宫干${p.heavenlyStem}四化入本宫·离心）：${selfMuts
          .map((x) => `${x.star}化${x.mutagen}`)
          .join("、")}`
      );
    }
    L.push(`- 长生十二神：${p.changsheng12}；博士十二神：${p.boshi12}`);
    L.push(`- 岁前十二神：${p.suiqian12}；将前十二神：${p.jiangqian12}`);
    L.push(`- 大限：${p.decadal.range.join("~")} 岁（${p.decadal.heavenlyStem}${p.decadal.earthlyBranch}）；小限岁数：${p.ages.join("、")}`);
    L.push("");
  }

  /* 四、三方四正快照 + 五、飞宫四化 */
  L.push(...sanfangMd(an));
  L.push(...flyMatrixMd(an));

  /* 六、当前观测运限 */
  if (h) {
    L.push(`## 六、当前观测运限`);
    L.push("");
    L.push(
      `- 观测点：公历 ${h.solarDate}（农历 ${h.lunarDate}），虚岁 ${h.age.nominalAge}`
    );
    const dec = z.activeDecadeIdx >= 0 ? z.decades[z.activeDecadeIdx] : null;
    let seq = `- 当前序列：${
      dec ? `大限 ${dec.range[0]}~${dec.range[1]}（${dec.heavenlyStem}${dec.earthlyBranch}）` : "童限"
    } → 流年 ${z.pick.year} → 流月 ${currentMonthCell(z)?.label ?? z.pick.month}（${
      currentMonthCell(z)?.gz ?? ""
    }）`;
    if (opts.withDaily)
      seq += ` → 流日 ${z.days[z.clampedDay - 1]?.label ?? z.clampedDay}（${z.days[z.clampedDay - 1]?.gz ?? ""}）`;
    L.push(seq);
    L.push("");

    /* 运限格局提示（程序确定性扫描） */
    const hp = horoscopePatternsOf(z);
    if (hp && (hp.decadal.length || hp.yearly.length)) {
      L.push(`### 运限格局提示（以运限命宫三方扫描，直接引用勿重推）`);
      L.push("");
      const dump = (label: string, list: HoroPattern[]) => {
        if (!list.length) {
          L.push(`- ${label}：未检出显著运限格局`);
          return;
        }
        for (const p of list) {
          L.push(`- ${label}【${p.name}】〔${p.kind}〕${p.basis}——${p.meaning}`);
        }
      };
      dump(
        `大限（${dec ? `${dec.heavenlyStem}${dec.earthlyBranch} ${dec.range[0]}~${dec.range[1]}岁` : "童限"}）`,
        hp.decadal
      );
      dump(`流年（${z.pick.year} ${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}）`, hp.yearly);
      L.push("");
    }

    L.push(scopeSection(a, "decadal", h.decadal, `（${dec ? `${dec.range[0]}~${dec.range[1]}岁` : "童限"}）`));
    const ageSeat = a.palaces[h.age.index];
    L.push(`### 小限（虚岁 ${h.age.nominalAge}）`);
    L.push("");
    L.push(`> ${AGE_NOTE}`);
    L.push("");
    L.push(`- 小限落于本命【${ageSeat?.name ?? "?"}】宫（地支${ageSeat?.earthlyBranch ?? "?"}）`);
    if (h.age.palaceNames?.length) {
      L.push("");
      L.push(`| 本命宫位（地支） | 小限十二宫 |`);
      L.push(`|---|---|`);
      a.palaces.forEach((p, i) => {
        L.push(`| ${p.name}（${p.earthlyBranch}） | 小${h.age.palaceNames[i]} |`);
      });
    }
    L.push("");
    L.push(scopeSection(a, "yearly", h.yearly, `（${z.pick.year} 年）`));
    L.push(`- 流年岁前十二神：${h.yearly.yearlyDecStar.suiqian12.join("、")}（按宫位索引 0~11 排列，0=寅宫）`);
    L.push(`- 流年将前十二神：${h.yearly.yearlyDecStar.jiangqian12.join("、")}（同上）`);
    L.push("");
    L.push(scopeSection(a, "monthly", h.monthly, `（${currentMonthCell(z)?.label ?? ""}）`));
    /* 流日默认不导出（择日勾选附加），防无关层级稀释 AI 注意力 */
    if (opts.withDaily) L.push(scopeSection(a, "daily", h.daily, `（${z.days[z.clampedDay - 1]?.label ?? ""}）`));
  }

  /* 七、当年十二流月总览 */
  const my = getMonthlyOfYear(z);
  if (my.length) {
    L.push(`## 七、${z.pick.year} 年十二流月总览`);
    L.push("");
    L.push(`| 流月 | 干支 | 流月命宫落宫 | 四化（禄/权/科/忌） | 格局提示 |`);
    L.push(`|---|---|---|---|---|`);
    for (const m of my) {
      const idx = m.index as number;
      const seat = a.palaces[idx];
      const pats = (m.patterns as string[]) ?? [];
      L.push(
        `| ${m.label} | ${m.ganZhi} | ${seat?.name}（${seat?.earthlyBranch}） | ${(m.mutagen as string[]).join(" / ")} | ${pats.join("、") || "—"} |`
      );
    }
    L.push("");
  }

  L.push(`## 八、AI 推理指引`);
  L.push("");
  L.push(`将本文件整体提供给 AI 并附上您的问题。建议同时粘贴以下指令（可直接复制）：`);
  L.push("");
  L.push(`> 请以严谨的紫微斗数分析师身份，严格依据本文件数据推理：`);
  L.push(
    `> 1. 先复述盘面骨架——命宫主星与亮度、第二节已检出的格局、生年四化落宫——确认无误后再展开分析；`
  );
  L.push(
    `> 2. 三方四正、格局、飞宫四化、夹宫、借星均已在第二/四/五节确定性算好，请直接引用，不要自行重算宫位关系；若需推衍文中未列的关系，按宫位环形计算（对宫=隔六位，三合=前后各隔四位）；`
  );
  L.push(`> 3. 推理次序：本命（性格/禀赋/格局）→ 大限定十年基调 → 流年四化引动断当年吉凶 → 流月定应期；`);
  L.push(
    `> 4. 每个论断须注明依据（引用具体宫位/星耀/四化/格局），并区分「结构必然 / 大概率 / 倾向参考」三档确定度；`
  );
  L.push(`> 5. 推理框架遵循附录A《规则速查》；星情与四化事象反应遵循附录C；按提问主题取用附录D对应小节的宫位组合与检查清单；流派口径以本文件 meta 与附录B为准，不得改星、改宫、改四化。`);
  L.push(
    `> 6. 如需切换为**飞宫四化视角**（以四化流向为主轴论盘），直接引用第五节全矩阵与传导链：忌链看压力/亏欠流向，禄链看资源/情义流向，配合离心/向心自化论收放——仍以本文件已算好的矩阵为准，勿自行重飞。`
  );
  if (z.input.residence) {
    L.push(
      `> 7. 命主常居住地为「${z.input.residence}」（不参与排盘），涉及迁移宫、方位喜忌、异地发展等议题时结合参考。`
    );
  }
  L.push("");
  L.push(`常见问题示例（附建议取用素材）：`);
  L.push("");
  L.push(`- 我的性格优劣势与适合的行业方向？——命宫/官禄/福德三方四正快照 + 第二节格局`);
  L.push(`- 某年运势如何，宜进取还是防守？——该年流年四化与运限格局（第六/八节）+ 流年命宫三方会照`);
  L.push(`- 感情婚姻的走势与要点？——夫妻宫三方四正快照 + 夫妻宫飞宫四化 + 大限夫妻宫叠宫`);
  L.push(`- 近十年何时适合创业/置业/转型？——十二大限总览（第七节）+ 各限四化与运限格局 + 官禄/田宅宫引动`);
  L.push("");

  /* 附录A：推理规则速查（L1 知识层） */
  L.push(RULEBOOK_MD);

  /* 附录B：本盘实际生效的十干四化表 */
  L.push(`## 附录B：本盘所用十干四化表（${MUTAGEN_TABLE_LABEL[z.input.mutagenTable]}）`);
  L.push("");
  L.push(`| 天干 | 化禄 | 化权 | 化科 | 化忌 |`);
  L.push(`|---|---|---|---|---|`);
  for (const s of STEMS) {
    const t = util.getMutagensByHeavenlyStem(s as never) as string[];
    L.push(`| ${s} | ${t[0]} | ${t[1]} | ${t[2]} | ${t[3]} |`);
  }
  L.push("");
  L.push(`> 本文件所有生年四化、运限四化、飞宫四化、自化均依上表推算，AI 分析时请以此表为准。`);
  L.push("");

  /* 附录C：十四主星四化要诀 + 附录D：分主题推理指引（L3 知识层） */
  L.push(STAR_MUTAGEN_MD);
  L.push(topicGuidesMd());

  return L.join("\n");
}
