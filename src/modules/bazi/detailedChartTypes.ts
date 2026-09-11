/** 详细命盘类型定义 */

/** 藏干条目（结构化，渲染时可直接取五行着色） */
export interface CangGanItem {
  stem: string;
  element: string; // "wood" | "fire" | "earth" | "metal" | "water"
}

/** 单柱详细信息（大运 / 流年 / 年柱 / 月柱 / 日柱 / 时柱通用） */
export interface PillarDetail {
  /** 列标题，如 "大运"、"流年"、"年柱"、"月柱"、"日柱"、"时柱" */
  label: string;
  /** 天干五行元素 class，用于着色 */
  element: string;
  /** 地支五行元素 class，用于着色 */
  branchElement: string;
  /** 主星，如 "正印"、"偏印"、"食神"、"比肩"、"元男" */
  zhuXing: string;
  /** 天干，如 "甲"、"乙"、"己"、"丁" */
  tianGan: string;
  /** 地支，如 "子"、"巳"、"卯"、"酉" */
  diZhi: string;
  /** 藏干（结构化数组） */
  cangGan: CangGanItem[];
  /** 五行，如 "木"、"火"、"土"、"金"、"水" */
  wuXing: string;
  /** 十神，如 "正印"、"偏印"、"食神"、"比肩"、"日元" */
  shiShen: string;
  /** 时间，如 "21-30岁"、"2025年 27岁"、"1999年" */
  shiJian: string;
  /** 副星（数组） */
  fuXing: string[];
  /** 星运，如 "沐浴"、"病"、"帝旺"、"长生" */
  xingYun: string;
  /** 自坐 */
  ziZuo: string;
  /** 空亡，如 "戌亥"、"寅卯"、"申酉"、"子丑" */
  kongWang: string;
  /** 纳音，如 "海中金"、"覆灯火"、"城头土" */
  naYin: string;
  /** 神煞标签列表 */
  shenSha: string[];
}

/** 详细命盘 */
export interface DetailedChart {
  /** 日主，如 "丁火" */
  dayMaster: string;
  /** 五行缺失，如 "缺水" */
  wuXingLack: string;
  /** 当前运势描述，如 "21-30岁 甲子 › 2025年 乙巳" */
  currentFortune: string;
  /** 列数据：[大运, 流年, 年柱, 月柱, 日柱, 时柱]（顺序即渲染顺序） */
  columns: PillarDetail[];
}
