/**
 * 用户引导系统
 *
 * 设计：
 * - 定义多个引导流程（welcome、ziwei、daliuren、wiki）
 * - 每个流程由若干步骤组成，每步高亮一个目标元素并显示说明
 * - 进度保存在 localStorage，首次访问自动启动 welcome 引导
 * - 引导可跳过、可重新播放
 */

/** 引导步骤定义 */
export interface GuideStep {
  /** 步骤唯一标识 */
  id: string;
  /** 目标元素 CSS 选择器（为空时表示居中说明卡，无高亮） */
  target?: string;
  /** 步骤标题 */
  title: string;
  /** 步骤说明内容 */
  content: string;
  /** 气泡相对于目标元素的位置，默认 bottom */
  position?: "top" | "bottom" | "left" | "right";
}

/** 引导流程定义 */
const guides: Record<string, GuideStep[]> = {
  /** 欢迎引导（首次访问） */
  welcome: [
    {
      id: "welcome-1",
      title: "欢迎使用紫微斗数",
      content: "这是一个融合传统命理与现代可视化的排盘工具。接下来用 1 分钟带你了解核心功能。",
    },
    {
      id: "welcome-2",
      target: "[data-guide='person-selector']",
      title: "人物管理",
      content: "在这里添加、切换你要分析的命盘人物。支持多套命盘独立管理。",
      position: "bottom",
    },
    {
      id: "welcome-3",
      target: "[data-guide='nav']",
      title: "导航菜单",
      content: "在紫微排盘、大六壬占课、命理 Wiki 之间切换。也可用快捷键 1/2/3。",
      position: "bottom",
    },
    {
      id: "welcome-4",
      target: "[data-guide='theme']",
      title: "主题与语言",
      content: "点击可切换亮色 / 暗色主题，以及中 / 英文界面。",
      position: "bottom",
    },
    {
      id: "welcome-5",
      title: "准备就绪",
      content: "你可以随时在页面右上角的「?」按钮重新播放引导。现在就开始探索吧！",
    },
  ],

  /** 紫微页面引导 */
  ziwei: [
    {
      id: "ziwei-1",
      target: "[data-guide='ziwei-input']",
      title: "输入面板",
      content: "在这里选择日期、时辰、性别，生成命盘。也可切换农历 / 公历。",
      position: "bottom",
    },
    {
      id: "ziwei-2",
      target: "[data-guide='ziwei-chart']",
      title: "星盘",
      content: "十二宫位呈现完整命盘。点击任一宫位查看详情，滚轮缩放查看重点。",
      position: "top",
    },
    {
      id: "ziwei-3",
      target: "[data-guide='ziwei-dial']",
      title: "运限拨盘",
      content: "拖动拨盘切换大限、流年、流月、流日、流时，观察运势变化。",
      position: "top",
    },
    {
      id: "ziwei-4",
      target: "[data-guide='ziwei-palace']",
      title: "宫位详情",
      content: "点击宫位后，这里显示本宫主星、辅星、四化、杂曜及详细解读。",
      position: "left",
    },
    {
      id: "ziwei-5",
      target: "[data-guide='ziwei-export']",
      title: "导出",
      content: "把盘面导出为 TOON / Markdown / JSON 格式，方便发给 AI 或存档。",
      position: "top",
    },
  ],

  /** 大六壬页面引导 */
  daliuren: [
    {
      id: "daliuren-1",
      target: "[data-guide='liuren-list']",
      title: "占课列表",
      content: "你创建的所有占课记录都在这里，支持搜索、按标签过滤、分页浏览。",
      position: "bottom",
    },
    {
      id: "daliuren-2",
      target: "[data-guide='liuren-create']",
      title: "新建占课",
      content: "点击新建，填写问题、选择起课方式（时间 / 手工），即可开始占课。",
      position: "bottom",
    },
    {
      id: "daliuren-3",
      target: "[data-guide='liuren-chart']",
      title: "课盘",
      content: "四课三传、天地盘、神将一一呈现。点击单元格查看单条信息的含义。",
      position: "top",
    },
    {
      id: "daliuren-4",
      target: "[data-guide='liuren-export']",
      title: "导出占课",
      content: "把一课导出为 Markdown 或 JSON，便于回顾或与 AI 讨论。",
      position: "top",
    },
  ],

  /** Wiki 页面引导 */
  wiki: [
    {
      id: "wiki-1",
      target: "[data-guide='wiki-list']",
      title: "文档列表",
      content: "你的命理笔记、古籍摘录、案例心得都集中在此，支持搜索和筛选。",
      position: "bottom",
    },
    {
      id: "wiki-2",
      target: "[data-guide='wiki-create']",
      title: "新建文档",
      content: "点击新建按钮，开始写你的第一篇命理笔记。",
      position: "bottom",
    },
    {
      id: "wiki-3",
      target: "[data-guide='wiki-editor']",
      title: "编辑器",
      content: "支持 Markdown 语法，实时预览。你可以为文档添加标签便于分类。",
      position: "left",
    },
    {
      id: "wiki-4",
      target: "[data-guide='wiki-related']",
      title: "关联文档",
      content: "把相关笔记互相链接，构建你自己的命理知识网络。",
      position: "left",
    },
  ],
};

/** localStorage 键名前缀 */
const STORAGE_PREFIX = "guide_";

/** 启动指定引导流程 */
export function getGuideSteps(guideId: string): GuideStep[] | null {
  return guides[guideId] ?? null;
}

/** 检查是否已完成指定引导 */
export function isGuideCompleted(guideId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${guideId}`) === "completed";
  } catch {
    return false;
  }
}

/** 标记指定引导为已完成 */
export function markGuideCompleted(guideId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${guideId}`, "completed");
  } catch (err) {
    console.warn("[guide] 写入 localStorage 失败", err);
  }
}

/** 清除指定引导的完成状态（用于重新播放） */
export function resetGuide(guideId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${guideId}`);
  } catch (err) {
    console.warn("[guide] 清除 localStorage 失败", err);
  }
}

/** 是否应该自动启动欢迎引导（首次访问） */
export function shouldAutoStartWelcome(): boolean {
  return !isGuideCompleted("welcome");
}

/** 标记欢迎引导已完成 */
export function markWelcomeCompleted(): void {
  markGuideCompleted("welcome");
}

/** 当前是否有任何引导在运行（供外部查询） */
let activeGuideId: string | null = null;
export function setActiveGuide(id: string | null): void {
  activeGuideId = id;
}
export function getActiveGuide(): string | null {
  return activeGuideId;
}

/** 所有可重播的引导 id 列表（用于设置页或菜单） */
export function listGuideIds(): string[] {
  return Object.keys(guides);
}

/** 导出供测试 */
export const __internal__ = { guides };
