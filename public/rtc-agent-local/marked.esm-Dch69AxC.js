var $e = Object.defineProperty;
var Se = (r, e, t) => e in r ? $e(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var f = (r, e, t) => Se(r, typeof e != "symbol" ? e + "" : e, t);
function U() {
  return { async: !1, breaks: !1, extensions: null, gfm: !0, hooks: null, pedantic: !1, renderer: null, silent: !1, tokenizer: null, walkTokens: null };
}
var A = U();
function ce(r) {
  A = r;
}
var _ = { exec: () => null };
function P(r) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = r(n), e[n] = s), s;
  };
}
function k(r, e = "") {
  let t = typeof r == "string" ? r : r.source, n = { replace: (s, i) => {
    let a = typeof i == "string" ? i : i.source;
    return a = a.replace(w.caret, "$1"), t = t.replace(s, a), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var ye = ((r = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + r);
  } catch {
    return !1;
  }
})(), w = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (r) => new RegExp(`^( {0,3}${r})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: P((r) => new RegExp(`^ {0,${r}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: P((r) => new RegExp(`^ {0,${r}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: P((r) => new RegExp(`^ {0,${r}}(?:\`\`\`|~~~)`)), headingBeginRegex: P((r) => new RegExp(`^ {0,${r}}#`)), htmlBeginRegex: P((r) => new RegExp(`^ {0,${r}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: P((r) => new RegExp(`^ {0,${r}}>`)) }, Re = /^(?:[ \t]*(?:\n|$))+/, Te = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/, _e = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/, C = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/, ze = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/, W = / {0,3}(?:[*+-]|\d{1,9}[.)])/, he = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/, pe = k(he).replace(/bull/g, W).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex(), Ae = k(he).replace(/bull/g, W).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(), F = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/, Pe = /^[^\n]+/, J = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/, Le = k(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", J).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(), Ee = k(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, W).getRegex(), j = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul", K = /<!--(?:-?>|[\s\S]*?(?:-->|$))/, Ie = k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", K).replace("tag", j).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(), ue = (r) => k(F).replace("hr", C).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", r).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", j).getRegex(), Be = ue(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/), Ce = ue(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/), qe = k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ce).getRegex(), V = { blockquote: qe, code: Te, def: Le, fences: _e, heading: ze, hr: C, html: Ie, lheading: pe, list: Ee, newline: Re, paragraph: Be, table: _, text: Pe }, re = k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", C).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", j).getRegex(), ve = { ...V, lheading: Ae, table: re, paragraph: k(F).replace("hr", C).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", re).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", j).getRegex() }, De = { ...V, html: k(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", K).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: k(F).replace("hr", C).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", pe).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() }, Ze = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/, Oe = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/, ge = /^( {2,}|\\)\n(?!\s*$)/, Qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/, R = /[\p{P}\p{S}]/u, L = /[\s\p{P}\p{S}]/u, q = /[^\s\p{P}\p{S}]/u, Me = k(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, L).getRegex(), je = /[\p{Pi}\p{Ps}"']/u, ke = /(?!~)[\p{P}\p{S}]/u, He = /(?!~)[\s\p{P}\p{S}]/u, Ne = /(?:[^\s\p{P}\p{S}]|~)/u, Ge = k(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", ye ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex(), fe = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/, Xe = k(fe, "u").replace(/punct/g, R).getRegex(), Ue = k(fe, "u").replace(/punct/g, ke).getRegex(), We = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/, Fe = k(We, "u").replace(/openQuote/g, je).replace(/punct/g, R).getRegex(), de = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)", Je = k(de, "gu").replace(/notPunctSpace/g, q).replace(/punctSpace/g, L).replace(/punct/g, R).getRegex(), Ke = k(de, "gu").replace(/notPunctSpace/g, Ne).replace(/punctSpace/g, He).replace(/punct/g, ke).getRegex(), Ve = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)", Ye = k(Ve, "gu").replace(/notPunctSpace/g, q).replace(/punctSpace/g, L).replace(/punct/g, R).getRegex(), et = k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, q).replace(/punctSpace/g, L).replace(/punct/g, R).getRegex(), tt = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)", rt = k(tt, "gu").replace(/notPunctSpace/g, q).replace(/punctSpace/g, L).replace(/punct/g, R).getRegex(), nt = k(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, R).getRegex(), st = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", lt = k(st, "gu").replace(/notPunctSpace/g, q).replace(/punctSpace/g, L).replace(/punct/g, R).getRegex(), it = k(/\\(punct)/, "gu").replace(/punct/g, R).getRegex(), at = k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(), ot = k(K).replace("(?:-->|$)", "-->").getRegex(), ct = k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ot).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(), O = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/, ht = k(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", O).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(), xe = k(/^!?\[(label)\]\[(ref)\]/).replace("label", O).replace("ref", J).getRegex(), be = k(/^!?\[(ref)\](?:\[\])?/).replace("ref", J).getRegex(), pt = k("reflink|nolink(?!\\()", "g").replace("reflink", xe).replace("nolink", be).getRegex(), ne = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/, Y = { _backpedal: _, anyPunctuation: it, autolink: at, blockSkip: Ge, br: ge, code: Oe, del: _, delLDelim: _, delRDelim: _, emStrongLDelim: Xe, emStrongRDelimAst: Je, emStrongRDelimUnd: et, escape: Ze, link: ht, nolink: be, punctuation: Me, reflink: xe, reflinkSearch: pt, tag: ct, text: Qe, url: _ }, ut = { ...Y, emStrongLDelim: Fe, emStrongRDelimAst: Ye, emStrongRDelimUnd: rt, link: k(/^!?\[(label)\]\((.*?)\)/).replace("label", O).getRegex(), reflink: k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", O).getRegex() }, N = { ...Y, emStrongRDelimAst: Ke, emStrongLDelim: Ue, delLDelim: nt, delRDelim: lt, url: k(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ne).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: k(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ne).getRegex() }, gt = { ...N, br: k(ge).replace("{2,}", "*").getRegex(), text: k(N.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() }, D = { normal: V, gfm: ve, pedantic: De }, I = { normal: Y, gfm: N, breaks: gt, pedantic: ut }, kt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }, se = (r) => kt[r];
function y(r, e) {
  if (e) {
    if (w.escapeTest.test(r)) return r.replace(w.escapeReplace, se);
  } else if (w.escapeTestNoEncode.test(r)) return r.replace(w.escapeReplaceNoEncode, se);
  return r;
}
function le(r) {
  try {
    r = encodeURI(r).replace(w.percentDecode, "%");
  } catch {
    return null;
  }
  return r;
}
function ie(r, e) {
  var i;
  let t = r.replace(w.findPipe, (a, o, l) => {
    let p = !1, c = o;
    for (; --c >= 0 && l[c] === "\\"; ) p = !p;
    return p ? "|" : " |";
  }), n = t.split(w.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !((i = n.at(-1)) != null && i.trim()) && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(w.slashPipe, "|");
  return n;
}
function T(r, e, t) {
  let n = r.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n && r.charAt(n - s - 1) === e; )
    s++;
  return r.slice(0, n - s);
}
function ae(r) {
  let e = r.split(`
`), t = e.length - 1;
  for (; t >= 0 && w.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? r : e.slice(0, t + 1).join(`
`);
}
function ft(r, e) {
  if (r.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < r.length; n++) if (r[n] === "\\") n++;
  else if (r[n] === e[0]) t++;
  else if (r[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function dt(r, e = 0) {
  let t = e, n = "";
  for (let s of r) if (s === "	") {
    let i = 4 - t % 4;
    n += " ".repeat(i), t += i;
  } else n += s, t++;
  return n;
}
function oe(r, e, t, n, s) {
  let i = e.href, a = e.title || null, o = r[1].replace(s.other.outputLinkReplace, "$1"), l = r[0].charAt(0) === "!";
  n.state.inLink = !0;
  let p = n.state.linkEmitted, c = n.state.inRawBlock;
  n.state.linkEmitted = !1;
  let g = n.inlineTokens(o), h = n.state.linkEmitted;
  if (n.state.linkEmitted = p, n.state.inLink = !1, !l) {
    if (h) {
      n.state.inRawBlock = c;
      return;
    }
    n.state.linkEmitted = !0;
  }
  return { type: l ? "image" : "link", raw: t, href: i, title: a, text: o, tokens: g };
}
function xt(r, e, t) {
  let n = r.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((i) => {
    let a = i.match(t.other.beginningSpace);
    if (a === null) return i;
    let [o] = a;
    return o.length >= s.length ? i.slice(s.length) : i;
  }).join(`
`);
}
var Q = class {
  constructor(r) {
    f(this, "options");
    f(this, "rules");
    f(this, "lexer");
    this.options = r || A;
  }
  space(r) {
    let e = this.rules.block.newline.exec(r);
    if (e && e[0].length > 0) return { type: "space", raw: e[0] };
  }
  code(r) {
    let e = this.rules.block.code.exec(r);
    if (e) {
      let t = this.options.pedantic ? e[0] : ae(e[0]), n = t.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: t, codeBlockStyle: "indented", text: n };
    }
  }
  fences(r) {
    let e = this.rules.block.fences.exec(r);
    if (e) {
      let t = e[0], n = xt(t, e[3] || "", this.rules);
      return { type: "code", raw: t, lang: e[2] ? e[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : e[2], text: n };
    }
  }
  heading(r) {
    let e = this.rules.block.heading.exec(r);
    if (e) {
      let t = e[2].trim();
      if (this.rules.other.endingHash.test(t)) {
        let n = T(t, "#");
        (this.options.pedantic || !n || this.rules.other.endingSpaceChar.test(n)) && (t = n.trim());
      }
      return { type: "heading", raw: T(e[0], `
`), depth: e[1].length, text: t, tokens: this.lexer.inline(t) };
    }
  }
  hr(r) {
    let e = this.rules.block.hr.exec(r);
    if (e) return { type: "hr", raw: T(e[0], `
`) };
  }
  blockquote(r) {
    let e = this.rules.block.blockquote.exec(r);
    if (e) {
      let t = T(e[0], `
`).split(`
`), n = "", s = "", i = [];
      for (; t.length > 0; ) {
        let a = !1, o = [], l;
        for (l = 0; l < t.length; l++) if (this.rules.other.blockquoteStart.test(t[l])) o.push(t[l]), a = !0;
        else if (!a) o.push(t[l]);
        else break;
        t = t.slice(l);
        let p = o.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        n = n ? `${n}
${p}` : p, s = s ? `${s}
${c}` : c;
        let g = this.lexer.state.top;
        if (this.lexer.state.top = !0, this.lexer.blockTokens(c, i, !0), this.lexer.state.top = g, t.length === 0) break;
        let h = i.at(-1);
        if ((h == null ? void 0 : h.type) === "code") break;
        if ((h == null ? void 0 : h.type) === "blockquote") {
          let x = h, u = t.join(`
`), b = x.raw + `
` + u.replace(this.rules.other.blockquoteSetextReplace2, ""), m = this.blockquote(b);
          i[i.length - 1] = m, n = `${n}
${u}`, s = s.substring(0, s.length - x.text.length) + m.text;
          break;
        } else if ((h == null ? void 0 : h.type) === "list") {
          let x = h, u = x.raw + `
` + t.join(`
`), b = this.list(u);
          i[i.length - 1] = b, n = n.substring(0, n.length - h.raw.length) + b.raw, s = s.substring(0, s.length - x.raw.length) + b.raw, t = u.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: n, tokens: i, text: s };
    }
  }
  list(r) {
    let e = this.rules.block.list.exec(r);
    if (e) {
      let t = e[1].trim(), n = t.length > 1, s = { type: "list", raw: "", ordered: n, start: n ? +t.slice(0, -1) : "", loose: !1, items: [] };
      t = n ? `\\d{1,9}\\${t.slice(-1)}` : `\\${t}`, this.options.pedantic && (t = n ? t : "[*+-]");
      let i = this.rules.other.listItemRegex(t), a = !1;
      for (; r; ) {
        let l = !1, p = "", c = "";
        if (!(e = i.exec(r)) || this.rules.block.hr.test(r)) break;
        p = e[0], r = r.substring(p.length);
        let g = dt(e[2].split(`
`, 1)[0], e[1].length), h = r.split(`
`, 1)[0], x = !g.trim(), u = 0;
        if (this.options.pedantic ? (u = 2, c = g.trimStart()) : x ? u = e[1].length + 1 : (u = g.search(this.rules.other.nonSpaceChar), u = u > 4 ? 1 : u, c = g.slice(u), u += e[1].length), x && this.rules.other.blankLine.test(h) && (p += h + `
`, r = r.substring(h.length + 1), l = !0), !l) {
          let b = this.rules.other.nextBulletRegex(u), m = this.rules.other.hrRegex(u), v = this.rules.other.fencesBeginRegex(u), te = this.rules.other.headingBeginRegex(u), we = this.rules.other.htmlBeginRegex(u), me = this.rules.other.blockquoteBeginRegex(u);
          for (; r; ) {
            let H = r.split(`
`, 1)[0], E;
            if (h = H, this.options.pedantic ? (h = h.replace(this.rules.other.listReplaceNesting, "  "), E = h) : E = h.replace(this.rules.other.tabCharGlobal, "    "), v.test(h) || te.test(h) || we.test(h) || me.test(h) || b.test(h) || m.test(h)) break;
            if (E.search(this.rules.other.nonSpaceChar) >= u || !h.trim()) c += `
` + E.slice(u);
            else {
              if (x || g.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || v.test(g) || te.test(g) || m.test(g)) break;
              c += `
` + h;
            }
            x = !h.trim(), p += H + `
`, r = r.substring(H.length + 1), g = E.slice(u);
          }
        }
        s.loose || (a ? s.loose = !0 : this.rules.other.doubleBlankLine.test(p) && (a = !0)), s.items.push({ type: "list_item", raw: p, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: !1, text: c, tokens: [] }), s.raw += p;
      }
      let o = s.items.at(-1);
      if (o) o.raw = o.raw.trimEnd(), o.text = o.text.trimEnd();
      else return;
      s.raw = s.raw.trimEnd();
      for (let l of s.items) if (this.lexer.state.top = !1, l.tokens = this.lexer.blockTokens(l.text, []), !s.loose) {
        let p = l.tokens.filter((g) => g.type === "space"), c = p.length > 0 && p.some((g) => this.rules.other.anyLine.test(g.raw));
        s.loose = c;
      }
      for (let l of s.items) {
        let p = l.tokens[0];
        if (l.task && ((p == null ? void 0 : p.type) === "text" || (p == null ? void 0 : p.type) === "paragraph")) {
          l.text = l.text.replace(this.rules.other.listReplaceTask, ""), p.raw = p.raw.replace(this.rules.other.listReplaceTask, ""), p.text = p.text.replace(this.rules.other.listReplaceTask, "");
          for (let g = this.lexer.inlineQueue.length - 1; g >= 0; g--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[g].src)) {
            this.lexer.inlineQueue[g].src = this.lexer.inlineQueue[g].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let c = this.rules.other.listTaskCheckbox.exec(l.raw);
          if (c) {
            let g = { type: "checkbox", raw: c[0] + " ", checked: c[0] !== "[ ]" };
            l.checked = g.checked, s.loose ? l.tokens[0] && ["paragraph", "text"].includes(l.tokens[0].type) && "tokens" in l.tokens[0] && l.tokens[0].tokens ? (l.tokens[0].raw = g.raw + l.tokens[0].raw, l.tokens[0].text = g.raw + l.tokens[0].text, l.tokens[0].tokens.unshift(g)) : l.tokens.unshift({ type: "paragraph", raw: g.raw, text: g.raw, tokens: [g] }) : l.tokens.unshift(g);
          }
        } else l.task && (l.task = !1);
      }
      if (s.loose) for (let l of s.items) {
        l.loose = !0;
        for (let p of l.tokens) p.type === "text" && (p.type = "paragraph");
      }
      return s;
    }
  }
  html(r) {
    let e = this.rules.block.html.exec(r);
    if (e) {
      let t = ae(e[0]);
      return { type: "html", block: !0, raw: t, pre: e[1] === "pre" || e[1] === "script" || e[1] === "style", text: t };
    }
  }
  def(r) {
    let e = this.rules.block.def.exec(r);
    if (e) {
      let t = e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), n = e[2] ? e[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", s = e[3] ? e[3].substring(1, e[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : e[3];
      return { type: "def", tag: t, raw: T(e[0], `
`), href: n, title: s };
    }
  }
  table(r) {
    var a;
    let e = this.rules.block.table.exec(r);
    if (!e || !this.rules.other.tableDelimiter.test(e[2])) return;
    let t = ie(e[1]), n = e[2].replace(this.rules.other.tableAlignChars, "").split("|"), s = (a = e[3]) != null && a.trim() ? e[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: T(e[0], `
`), header: [], align: [], rows: [] };
    if (t.length === n.length) {
      for (let o of n) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < t.length; o++) i.header.push({ text: t[o], tokens: this.lexer.inline(t[o]), header: !0, align: i.align[o] });
      for (let o of s) i.rows.push(ie(o, i.header.length).map((l, p) => ({ text: l, tokens: this.lexer.inline(l), header: !1, align: i.align[p] })));
      return i;
    }
  }
  lheading(r) {
    let e = this.rules.block.lheading.exec(r);
    if (e) {
      let t = e[1].trim();
      return { type: "heading", raw: T(e[0], `
`), depth: e[2].charAt(0) === "=" ? 1 : 2, text: t, tokens: this.lexer.inline(t) };
    }
  }
  paragraph(r) {
    let e = this.rules.block.paragraph.exec(r);
    if (e) {
      let t = e[1].charAt(e[1].length - 1) === `
` ? e[1].slice(0, -1) : e[1];
      return { type: "paragraph", raw: e[0], text: t, tokens: this.lexer.inline(t) };
    }
  }
  text(r) {
    let e = this.rules.block.text.exec(r);
    if (e) return { type: "text", raw: e[0], text: e[0], tokens: this.lexer.inline(e[0]) };
  }
  escape(r) {
    let e = this.rules.inline.escape.exec(r);
    if (e) return { type: "escape", raw: e[0], text: e[1] };
  }
  tag(r) {
    let e = this.rules.inline.tag.exec(r);
    if (e) return !this.lexer.state.inLink && this.rules.other.startATag.test(e[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && this.rules.other.endATag.test(e[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(e[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(e[0]) && (this.lexer.state.inRawBlock = !1), { type: "html", raw: e[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: !1, text: e[0] };
  }
  link(r) {
    let e = this.rules.inline.link.exec(r);
    if (e) {
      let t = e[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(t)) {
        if (!this.rules.other.endAngleBracket.test(t)) return;
        let i = T(t.slice(0, -1), "\\");
        if ((t.length - i.length) % 2 === 0) return;
      } else {
        let i = ft(e[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let a = (e[0].indexOf("!") === 0 ? 5 : 4) + e[1].length + i;
          e[2] = e[2].substring(0, i), e[0] = e[0].substring(0, a).trim(), e[3] = "";
        }
      }
      let n = e[2], s = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(n);
        i && (n = i[1], s = i[3]);
      } else s = e[3] ? e[3].slice(1, -1) : "";
      return n = n.trim(), this.rules.other.startAngleBracket.test(n) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(t) ? n = n.slice(1) : n = n.slice(1, -1)), oe(e, { href: n && n.replace(this.rules.inline.anyPunctuation, "$1"), title: s && s.replace(this.rules.inline.anyPunctuation, "$1") }, e[0], this.lexer, this.rules);
    }
  }
  reflink(r, e) {
    let t;
    if ((t = this.rules.inline.reflink.exec(r)) || (t = this.rules.inline.nolink.exec(r))) {
      let n = (t[2] || t[1]).replace(this.rules.other.multipleSpaceGlobal, " "), s = e[n.toLowerCase()];
      if (!s) {
        let i = t[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return oe(t, s, t[0], this.lexer, this.rules);
    }
  }
  emStrong(r, e, t = "") {
    let n = this.rules.inline.emStrongLDelim.exec(r);
    if (!(!n || !n[1] && !n[2] && !n[3] && !n[4] || n[4] && t.match(this.rules.other.unicodeAlphaNumeric)) && (!(n[1] || n[3]) || !t || this.rules.inline.punctuation.exec(t))) {
      let s = [...n[0]].length - 1, i, a, o = s, l = 0, p = n[0][0], c = t === p, g = p === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (g.lastIndex = 0, e = e.slice(-1 * r.length + s); (n = g.exec(e)) !== null; ) {
        if (i = n[1] || n[2] || n[3] || n[4] || n[5] || n[6], !i) continue;
        if (a = [...i].length, n[3] || n[4]) {
          o += a;
          continue;
        } else if (n[5] || n[6]) {
          if (s % 3 && !((s + a) % 3)) {
            l += a;
            continue;
          }
          if (c) break;
        }
        if (o -= a, o > 0) continue;
        a = Math.min(a, a + o + l);
        let h = [...n[0]][0].length, x = r.slice(0, s + n.index + h + a);
        if (Math.min(s, a) % 2) {
          let b = x.slice(1, -1);
          return { type: "em", raw: x, text: b, tokens: this.lexer.inlineTokens(b) };
        }
        let u = x.slice(2, -2);
        return { type: "strong", raw: x, text: u, tokens: this.lexer.inlineTokens(u) };
      }
    }
  }
  codespan(r) {
    let e = this.rules.inline.code.exec(r);
    if (e) {
      let t = e[2].replace(this.rules.other.newLineCharGlobal, " "), n = this.rules.other.nonSpaceChar.test(t), s = this.rules.other.startingSpaceChar.test(t) && this.rules.other.endingSpaceChar.test(t);
      return n && s && (t = t.substring(1, t.length - 1)), { type: "codespan", raw: e[0], text: t };
    }
  }
  br(r) {
    let e = this.rules.inline.br.exec(r);
    if (e) return { type: "br", raw: e[0] };
  }
  del(r, e, t = "") {
    let n = this.rules.inline.delLDelim.exec(r);
    if (n && (!n[1] || !t || this.rules.inline.punctuation.exec(t))) {
      let s = [...n[0]].length - 1, i, a, o = s, l = this.rules.inline.delRDelim;
      for (l.lastIndex = 0, e = e.slice(-1 * r.length + s); (n = l.exec(e)) !== null; ) {
        if (i = n[1] || n[2] || n[3] || n[4] || n[5] || n[6], !i || (a = [...i].length, a !== s)) continue;
        if (n[3] || n[4]) {
          o += a;
          continue;
        }
        if (o -= a, o > 0) continue;
        a = Math.min(a, a + o);
        let p = [...n[0]][0].length, c = r.slice(0, s + n.index + p + a), g = c.slice(s, -s);
        return { type: "del", raw: c, text: g, tokens: this.lexer.inlineTokens(g) };
      }
    }
  }
  autolink(r) {
    let e = this.rules.inline.autolink.exec(r);
    if (e) {
      let t, n;
      return e[2] === "@" ? (t = e[1], n = "mailto:" + t) : (t = e[1], n = t), { type: "link", raw: e[0], text: t, href: n, tokens: [{ type: "text", raw: t, text: t }] };
    }
  }
  url(r) {
    var t;
    let e;
    if (e = this.rules.inline.url.exec(r)) {
      let n, s;
      if (e[2] === "@") n = e[0], s = "mailto:" + n;
      else {
        let i;
        do
          i = e[0], e[0] = ((t = this.rules.inline._backpedal.exec(e[0])) == null ? void 0 : t[0]) ?? "";
        while (i !== e[0]);
        n = e[0], e[1] === "www." ? s = "http://" + e[0] : s = e[0];
      }
      return { type: "link", raw: e[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(r) {
    let e = this.rules.inline.text.exec(r);
    if (e) {
      let t = this.lexer.state.inRawBlock;
      return { type: "text", raw: e[0], text: e[0], escaped: t };
    }
  }
}, $ = class G {
  constructor(e) {
    f(this, "tokens");
    f(this, "options");
    f(this, "state");
    f(this, "inlineQueue");
    f(this, "tokenizer");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || A, this.options.tokenizer = this.options.tokenizer || new Q(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: !1, inRawBlock: !1, linkEmitted: !1, top: !0 };
    let t = { other: w, block: D.normal, inline: I.normal };
    this.options.pedantic ? (t.block = D.pedantic, t.inline = I.pedantic) : this.options.gfm && (t.block = D.gfm, this.options.breaks ? t.inline = I.breaks : t.inline = I.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: D, inline: I };
  }
  static lex(e, t) {
    return new G(t).lex(e);
  }
  static lexInline(e, t) {
    return new G(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(w.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = !1) {
    var i, a, o;
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(w.tabCharGlobal, "    ").replace(w.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let l;
      if ((a = (i = this.options.extensions) == null ? void 0 : i.block) != null && a.some((c) => (l = c.call({ lexer: this }, e, t)) ? (e = e.substring(l.raw.length), t.push(l), !0) : !1)) continue;
      if (l = this.tokenizer.space(e)) {
        e = e.substring(l.raw.length);
        let c = t.at(-1);
        l.raw.length === 1 && c !== void 0 ? c.raw += `
` : t.push(l);
        continue;
      }
      if (l = this.tokenizer.code(e)) {
        e = e.substring(l.raw.length);
        let c = t.at(-1);
        (c == null ? void 0 : c.type) === "paragraph" || (c == null ? void 0 : c.type) === "text" ? (c.raw += (c.raw.endsWith(`
`) ? "" : `
`) + l.raw, c.text += `
` + l.text, this.inlineQueue.at(-1).src = c.text) : t.push(l);
        continue;
      }
      if (l = this.tokenizer.fences(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.heading(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.hr(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.blockquote(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.list(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.html(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.def(e)) {
        e = e.substring(l.raw.length);
        let c = t.at(-1);
        (c == null ? void 0 : c.type) === "paragraph" || (c == null ? void 0 : c.type) === "text" ? (c.raw += (c.raw.endsWith(`
`) ? "" : `
`) + l.raw, c.text += `
` + l.raw, this.inlineQueue.at(-1).src = c.text) : this.tokens.links[l.tag] || (this.tokens.links[l.tag] = { href: l.href, title: l.title }, t.push(l));
        continue;
      }
      if (l = this.tokenizer.table(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      if (l = this.tokenizer.lheading(e)) {
        e = e.substring(l.raw.length), t.push(l);
        continue;
      }
      let p = e;
      if ((o = this.options.extensions) != null && o.startBlock) {
        let c = 1 / 0, g = e.slice(1), h;
        this.options.extensions.startBlock.forEach((x) => {
          h = x.call({ lexer: this }, g), typeof h == "number" && h >= 0 && (c = Math.min(c, h));
        }), c < 1 / 0 && c >= 0 && (p = e.substring(0, c + 1));
      }
      if (this.state.top && (l = this.tokenizer.paragraph(p))) {
        let c = t.at(-1);
        n && (c == null ? void 0 : c.type) === "paragraph" ? (c.raw += (c.raw.endsWith(`
`) ? "" : `
`) + l.raw, c.text += `
` + l.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = c.text) : t.push(l), n = p.length !== e.length, e = e.substring(l.raw.length);
        continue;
      }
      if (l = this.tokenizer.text(e)) {
        e = e.substring(l.raw.length);
        let c = t.at(-1);
        (c == null ? void 0 : c.type) === "text" ? (c.raw += (c.raw.endsWith(`
`) ? "" : `
`) + l.raw, c.text += `
` + l.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = c.text) : t.push(l);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = !0, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  linkInText(e) {
    if (!e.includes("[")) return !1;
    let t = this.tokenizer.rules.inline.link;
    for (let n of e.matchAll(this.tokenizer.rules.inline.blockSkip)) if (t.test(n[0]) && e.charAt(n.index - 1) !== "!") return !0;
    for (let n of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      let s = n[0], i = s.lastIndexOf("[");
      if (!(s.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, s.slice(i + 1, -1))) && !(i > 1 && this.linkInText(s.slice(1, i - 1)))) return !0;
    }
    return !1;
  }
  inlineTokens(e, t = []) {
    var o, l, p, c, g;
    this.tokenizer.lexer = this;
    let n = e;
    if (this.tokens.links && e.includes("[")) {
      let h = this.tokenizer.rules.inline.reflinkSearch, x = (u) => {
        let b = u.lastIndexOf("[");
        if (!Object.hasOwn(this.tokens.links, u.slice(b + 1, -1))) return u;
        if (b > 1 && u.charAt(0) !== "!") {
          let m = u.slice(1, b - 1);
          if (this.linkInText(m)) return "[" + m.replace(h, x) + "][" + "a".repeat(u.length - b - 2) + "]";
        }
        return "[" + "a".repeat(u.length - 2) + "]";
      };
      n = n.replace(h, x);
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuation, (h) => "+".repeat(h.length)), n = n.replace(this.tokenizer.rules.inline.blockSkip, (h, x, u) => {
      let b = u ? u.length : 0;
      return h.slice(0, b) + "[" + "a".repeat(h.length - b - 2) + "]";
    }), n = ((l = (o = this.options.hooks) == null ? void 0 : o.emStrongMask) == null ? void 0 : l.call({ lexer: this }, n)) ?? n;
    let s = !1, i = "", a = 1 / 0;
    for (; e; ) {
      if (e.length < a) a = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      s || (i = ""), s = !1;
      let h;
      if ((c = (p = this.options.extensions) == null ? void 0 : p.inline) != null && c.some((u) => (h = u.call({ lexer: this }, e, t)) ? (e = e.substring(h.raw.length), t.push(h), !0) : !1)) continue;
      if (h = this.tokenizer.escape(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.tag(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.link(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(h.raw.length);
        let u = t.at(-1);
        h.type === "text" && (u == null ? void 0 : u.type) === "text" ? (u.raw += h.raw, u.text += h.text) : t.push(h);
        continue;
      }
      if (h = this.tokenizer.emStrong(e, n, i)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.codespan(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.br(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.del(e, n, i)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (h = this.tokenizer.autolink(e)) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      if (!this.state.inLink && (h = this.tokenizer.url(e))) {
        e = e.substring(h.raw.length), t.push(h);
        continue;
      }
      let x = e;
      if ((g = this.options.extensions) != null && g.startInline) {
        let u = 1 / 0, b = e.slice(1), m;
        this.options.extensions.startInline.forEach((v) => {
          m = v.call({ lexer: this }, b), typeof m == "number" && m >= 0 && (u = Math.min(u, m));
        }), u < 1 / 0 && u >= 0 && (x = e.substring(0, u + 1));
      }
      if (h = this.tokenizer.inlineText(x)) {
        e = e.substring(h.raw.length), h.raw.slice(-1) !== "_" && (i = h.raw.slice(-1)), s = !0;
        let u = t.at(-1);
        (u == null ? void 0 : u.type) === "text" ? (u.raw += h.raw, u.text += h.text) : t.push(h);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
}, M = class {
  constructor(r) {
    f(this, "options");
    f(this, "parser");
    this.options = r || A;
  }
  space(r) {
    return "";
  }
  code({ text: r, lang: e, escaped: t }) {
    var i;
    let n = (i = (e || "").match(w.notSpaceStart)) == null ? void 0 : i[0], s = r.replace(w.endingNewline, "") + `
`;
    return n ? '<pre><code class="language-' + y(n) + '">' + (t ? s : y(s, !0)) + `</code></pre>
` : "<pre><code>" + (t ? s : y(s, !0)) + `</code></pre>
`;
  }
  blockquote({ tokens: r }) {
    return `<blockquote>
${this.parser.parse(r)}</blockquote>
`;
  }
  html({ text: r }) {
    return r;
  }
  def(r) {
    return "";
  }
  heading({ tokens: r, depth: e }) {
    return `<h${e}>${this.parser.parseInline(r)}</h${e}>
`;
  }
  hr(r) {
    return `<hr>
`;
  }
  list(r) {
    let e = r.ordered, t = r.start, n = "";
    for (let a = 0; a < r.items.length; a++) {
      let o = r.items[a];
      n += this.listitem(o);
    }
    let s = e ? "ol" : "ul", i = e && t !== 1 ? ' start="' + t + '"' : "";
    return "<" + s + i + `>
` + n + "</" + s + `>
`;
  }
  listitem(r) {
    return `<li>${this.parser.parse(r.tokens)}</li>
`;
  }
  checkbox({ checked: r }) {
    return "<input " + (r ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: r }) {
    return `<p>${this.parser.parseInline(r)}</p>
`;
  }
  table(r) {
    let e = "", t = "";
    for (let s = 0; s < r.header.length; s++) t += this.tablecell(r.header[s]);
    e += this.tablerow({ text: t });
    let n = "";
    for (let s = 0; s < r.rows.length; s++) {
      let i = r.rows[s];
      t = "";
      for (let a = 0; a < i.length; a++) t += this.tablecell(i[a]);
      n += this.tablerow({ text: t });
    }
    return n && (n = `<tbody>${n}</tbody>`), `<table>
<thead>
` + e + `</thead>
` + n + `</table>
`;
  }
  tablerow({ text: r }) {
    return `<tr>
${r}</tr>
`;
  }
  tablecell(r) {
    let e = this.parser.parseInline(r.tokens), t = r.header ? "th" : "td";
    return (r.align ? `<${t} align="${r.align}">` : `<${t}>`) + e + `</${t}>
`;
  }
  strong({ tokens: r }) {
    return `<strong>${this.parser.parseInline(r)}</strong>`;
  }
  em({ tokens: r }) {
    return `<em>${this.parser.parseInline(r)}</em>`;
  }
  codespan({ text: r }) {
    return `<code>${y(r, !0)}</code>`;
  }
  br(r) {
    return "<br>";
  }
  del({ tokens: r }) {
    return `<del>${this.parser.parseInline(r)}</del>`;
  }
  link({ href: r, title: e, tokens: t }) {
    let n = this.parser.parseInline(t), s = le(r);
    if (s === null) return n;
    r = s;
    let i = '<a href="' + r + '"';
    return e && (i += ' title="' + y(e) + '"'), i += ">" + n + "</a>", i;
  }
  image({ href: r, title: e, text: t, tokens: n }) {
    n && (t = this.parser.parseInline(n, this.parser.textRenderer));
    let s = le(r);
    if (s === null) return y(t);
    r = s;
    let i = `<img src="${r}" alt="${y(t)}"`;
    return e && (i += ` title="${y(e)}"`), i += ">", i;
  }
  text(r) {
    return "tokens" in r && r.tokens ? this.parser.parseInline(r.tokens) : "escaped" in r && r.escaped ? r.text : y(r.text);
  }
}, ee = class {
  strong({ text: r }) {
    return r;
  }
  em({ text: r }) {
    return r;
  }
  codespan({ text: r }) {
    return r;
  }
  del({ text: r }) {
    return r;
  }
  html({ text: r }) {
    return r;
  }
  text({ text: r }) {
    return r;
  }
  link({ text: r }) {
    return "" + r;
  }
  image({ text: r }) {
    return "" + r;
  }
  br() {
    return "";
  }
  checkbox({ raw: r }) {
    return r;
  }
}, S = class X {
  constructor(e) {
    f(this, "options");
    f(this, "renderer");
    f(this, "textRenderer");
    this.options = e || A, this.options.renderer = this.options.renderer || new M(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new ee();
  }
  static parse(e, t) {
    return new X(t).parse(e);
  }
  static parseInline(e, t) {
    return new X(t).parseInline(e);
  }
  parse(e) {
    var n, s;
    this.renderer.parser = this;
    let t = "";
    for (let i = 0; i < e.length; i++) {
      let a = e[i];
      if ((s = (n = this.options.extensions) == null ? void 0 : n.renderers) != null && s[a.type]) {
        let l = a, p = this.options.extensions.renderers[l.type].call({ parser: this }, l);
        if (p !== !1 || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(l.type)) {
          t += p || "";
          continue;
        }
      }
      let o = a;
      switch (o.type) {
        case "space": {
          t += this.renderer.space(o);
          break;
        }
        case "hr": {
          t += this.renderer.hr(o);
          break;
        }
        case "heading": {
          t += this.renderer.heading(o);
          break;
        }
        case "code": {
          t += this.renderer.code(o);
          break;
        }
        case "table": {
          t += this.renderer.table(o);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(o);
          break;
        }
        case "list": {
          t += this.renderer.list(o);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(o);
          break;
        }
        case "html": {
          t += this.renderer.html(o);
          break;
        }
        case "def": {
          t += this.renderer.def(o);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(o);
          break;
        }
        case "text": {
          t += this.renderer.text(o);
          break;
        }
        default: {
          let l = 'Token with "' + o.type + '" type was not found.';
          if (this.options.silent) return console.error(l), "";
          throw new Error(l);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    var s, i;
    this.renderer.parser = this;
    let n = "";
    for (let a = 0; a < e.length; a++) {
      let o = e[a];
      if ((i = (s = this.options.extensions) == null ? void 0 : s.renderers) != null && i[o.type]) {
        let p = this.options.extensions.renderers[o.type].call({ parser: this }, o);
        if (p !== !1 || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(o.type)) {
          n += p || "";
          continue;
        }
      }
      let l = o;
      switch (l.type) {
        case "escape": {
          n += t.text(l);
          break;
        }
        case "html": {
          n += t.html(l);
          break;
        }
        case "link": {
          n += t.link(l);
          break;
        }
        case "image": {
          n += t.image(l);
          break;
        }
        case "checkbox": {
          n += t.checkbox(l);
          break;
        }
        case "strong": {
          n += t.strong(l);
          break;
        }
        case "em": {
          n += t.em(l);
          break;
        }
        case "codespan": {
          n += t.codespan(l);
          break;
        }
        case "br": {
          n += t.br(l);
          break;
        }
        case "del": {
          n += t.del(l);
          break;
        }
        case "text": {
          n += t.text(l);
          break;
        }
        default: {
          let p = 'Token with "' + l.type + '" type was not found.';
          if (this.options.silent) return console.error(p), "";
          throw new Error(p);
        }
      }
    }
    return n;
  }
}, Z, B = (Z = class {
  constructor(r) {
    f(this, "options");
    f(this, "block");
    this.options = r || A;
  }
  preprocess(r) {
    return r;
  }
  postprocess(r) {
    return r;
  }
  processAllTokens(r) {
    return r;
  }
  emStrongMask(r) {
    return r;
  }
  provideLexer(r = this.block) {
    return r ? $.lex : $.lexInline;
  }
  provideParser(r = this.block) {
    return r ? S.parse : S.parseInline;
  }
}, f(Z, "passThroughHooks", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"])), f(Z, "passThroughHooksRespectAsync", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"])), Z), bt = class {
  constructor(...r) {
    f(this, "defaults", U());
    f(this, "options", this.setOptions);
    f(this, "parse", this.parseMarkdown(!0));
    f(this, "parseInline", this.parseMarkdown(!1));
    f(this, "Parser", S);
    f(this, "Renderer", M);
    f(this, "TextRenderer", ee);
    f(this, "Lexer", $);
    f(this, "Tokenizer", Q);
    f(this, "Hooks", B);
    this.use(...r);
  }
  walkTokens(r, e) {
    var n, s;
    let t = [];
    for (let i of r) switch (t = t.concat(e.call(this, i)), i.type) {
      case "table": {
        let a = i;
        for (let o of a.header) t = t.concat(this.walkTokens(o.tokens, e));
        for (let o of a.rows) for (let l of o) t = t.concat(this.walkTokens(l.tokens, e));
        break;
      }
      case "list": {
        let a = i;
        t = t.concat(this.walkTokens(a.items, e));
        break;
      }
      default: {
        let a = i;
        (s = (n = this.defaults.extensions) == null ? void 0 : n.childTokens) != null && s[a.type] ? this.defaults.extensions.childTokens[a.type].forEach((o) => {
          let l = a[o].flat(1 / 0);
          t = t.concat(this.walkTokens(l, e));
        }) : a.tokens && (t = t.concat(this.walkTokens(a.tokens, e)));
      }
    }
    return t;
  }
  use(...r) {
    let e = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return r.forEach((t) => {
      let n = { ...t };
      if (n.async = this.defaults.async || n.async || !1, t.extensions && (t.extensions.forEach((s) => {
        if (!s.name) throw new Error("extension name required");
        if ("renderer" in s) {
          let i = e.renderers[s.name];
          i ? e.renderers[s.name] = function(...a) {
            let o = s.renderer.apply(this, a);
            return o === !1 && (o = i.apply(this, a)), o;
          } : e.renderers[s.name] = s.renderer;
        }
        if ("tokenizer" in s) {
          if (!s.level || s.level !== "block" && s.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = e[s.level];
          i ? i.unshift(s.tokenizer) : e[s.level] = [s.tokenizer], s.start && (s.level === "block" ? e.startBlock ? e.startBlock.push(s.start) : e.startBlock = [s.start] : s.level === "inline" && (e.startInline ? e.startInline.push(s.start) : e.startInline = [s.start]));
        }
        "childTokens" in s && s.childTokens && (e.childTokens[s.name] = s.childTokens);
      }), n.extensions = e), t.renderer) {
        let s = this.defaults.renderer || new M(this.defaults);
        for (let i in t.renderer) {
          if (!(i in s)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let a = i, o = t.renderer[a], l = s[a];
          s[a] = (...p) => {
            let c = o.apply(s, p);
            return c === !1 && (c = l.apply(s, p)), c || "";
          };
        }
        n.renderer = s;
      }
      if (t.tokenizer) {
        let s = this.defaults.tokenizer || new Q(this.defaults);
        for (let i in t.tokenizer) {
          if (!(i in s)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let a = i, o = t.tokenizer[a], l = s[a];
          s[a] = (...p) => {
            let c = o.apply(s, p);
            return c === !1 && (c = l.apply(s, p)), c;
          };
        }
        n.tokenizer = s;
      }
      if (t.hooks) {
        let s = this.defaults.hooks || new B();
        for (let i in t.hooks) {
          if (!(i in s)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let a = i, o = t.hooks[a], l = s[a];
          B.passThroughHooks.has(i) ? s[a] = (p) => {
            if (this.defaults.async && B.passThroughHooksRespectAsync.has(i)) return (async () => {
              let g = await o.call(s, p);
              return l.call(s, g);
            })();
            let c = o.call(s, p);
            return l.call(s, c);
          } : s[a] = (...p) => {
            if (this.defaults.async) return (async () => {
              let g = await o.apply(s, p);
              return g === !1 && (g = await l.apply(s, p)), g;
            })();
            let c = o.apply(s, p);
            return c === !1 && (c = l.apply(s, p)), c;
          };
        }
        n.hooks = s;
      }
      if (t.walkTokens) {
        let s = this.defaults.walkTokens, i = t.walkTokens;
        n.walkTokens = function(a) {
          let o = [];
          return o.push(i.call(this, a)), s && (o = o.concat(s.call(this, a))), o;
        };
      }
      this.defaults = { ...this.defaults, ...n };
    }), this;
  }
  setOptions(r) {
    return this.defaults = { ...this.defaults, ...r }, this;
  }
  lexer(r, e) {
    return $.lex(r, e ?? this.defaults);
  }
  parser(r, e) {
    return S.parse(r, e ?? this.defaults);
  }
  parseMarkdown(r) {
    return (e, t) => {
      let n = { ...t }, s = { ...this.defaults, ...n }, i = this.onError(!!s.silent, !!s.async);
      if (this.defaults.async === !0 && n.async === !1) return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof e > "u" || e === null) return i(new Error("marked(): input parameter is undefined or null"));
      if (typeof e != "string") return i(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(e) + ", string expected"));
      if (s.hooks && (s.hooks.options = s, s.hooks.block = r), s.async) return (async () => {
        let a = s.hooks ? await s.hooks.preprocess(e) : e, o = await (s.hooks ? await s.hooks.provideLexer(r) : r ? $.lex : $.lexInline)(a, s), l = s.hooks ? await s.hooks.processAllTokens(o) : o;
        s.walkTokens && await Promise.all(this.walkTokens(l, s.walkTokens));
        let p = await (s.hooks ? await s.hooks.provideParser(r) : r ? S.parse : S.parseInline)(l, s);
        return s.hooks ? await s.hooks.postprocess(p) : p;
      })().catch(i);
      try {
        s.hooks && (e = s.hooks.preprocess(e));
        let a = (s.hooks ? s.hooks.provideLexer(r) : r ? $.lex : $.lexInline)(e, s);
        s.hooks && (a = s.hooks.processAllTokens(a)), s.walkTokens && this.walkTokens(a, s.walkTokens);
        let o = (s.hooks ? s.hooks.provideParser(r) : r ? S.parse : S.parseInline)(a, s);
        return s.hooks && (o = s.hooks.postprocess(o)), o;
      } catch (a) {
        return i(a);
      }
    };
  }
  onError(r, e) {
    return (t) => {
      if (t.message += `
Please report this to https://github.com/markedjs/marked.`, r) {
        let n = "<p>An error occurred:</p><pre>" + y(t.message + "", !0) + "</pre>";
        return e ? Promise.resolve(n) : n;
      }
      if (e) return Promise.reject(t);
      throw t;
    };
  }
}, z = new bt();
function d(r, e) {
  return z.parse(r, e);
}
d.options = d.setOptions = function(r) {
  return z.setOptions(r), d.defaults = z.defaults, ce(d.defaults), d;
};
d.getDefaults = U;
d.defaults = A;
function wt(...r) {
  return z.use(...r), d.defaults = z.defaults, ce(d.defaults), d;
}
d.use = wt;
d.walkTokens = function(r, e) {
  return z.walkTokens(r, e);
};
d.parseInline = z.parseInline;
d.Parser = S;
d.parser = S.parse;
d.Renderer = M;
d.TextRenderer = ee;
d.Lexer = $;
d.lexer = $.lex;
d.Tokenizer = Q;
d.Hooks = B;
d.parse = d;
var $t = d.options, St = d.setOptions, yt = d.walkTokens, Rt = d.parseInline, Tt = d, _t = S.parse, zt = $.lex;
export {
  B as Hooks,
  $ as Lexer,
  bt as Marked,
  S as Parser,
  M as Renderer,
  ee as TextRenderer,
  Q as Tokenizer,
  A as defaults,
  U as getDefaults,
  zt as lexer,
  d as marked,
  $t as options,
  Tt as parse,
  Rt as parseInline,
  _t as parser,
  St as setOptions,
  wt as use,
  yt as walkTokens
};
