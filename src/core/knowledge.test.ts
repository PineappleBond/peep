/**
 * 知识库模块测试：常量完整性与 topicGuidesMd 拼接
 */
import { describe, expect, it } from "vitest";
import { RULEBOOK_MD, STAR_MUTAGEN_MD, TOPIC_GUIDES, topicGuidesMd } from "./knowledge";

describe("knowledge 知识库", () => {
  describe("RULEBOOK_MD 推理规则速查", () => {
    it("非空字符串，含附录A标题", () => {
      expect(RULEBOOK_MD.length).toBeGreaterThan(100);
      expect(RULEBOOK_MD).toContain("附录A");
    });

    it("含推理次序与四化推理章节", () => {
      expect(RULEBOOK_MD).toContain("推理次序");
      expect(RULEBOOK_MD).toContain("四化推理");
    });
  });

  describe("STAR_MUTAGEN_MD 十四主星四化要诀", () => {
    it("非空字符串，含附录C标题", () => {
      expect(STAR_MUTAGEN_MD.length).toBeGreaterThan(100);
      expect(STAR_MUTAGEN_MD).toContain("附录C");
    });

    it("覆盖十四主星", () => {
      const stars = ["紫微", "天机", "太阳", "武曲", "天同", "廉贞", "天府",
        "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军"];
      for (const star of stars) {
        expect(STAR_MUTAGEN_MD).toContain(star);
      }
    });
  });

  describe("TOPIC_GUIDES 分主题推理指引", () => {
    it("含事业/财运/婚姻/健康/子女/应期六大主题", () => {
      const keys = TOPIC_GUIDES.map((t) => t.key);
      expect(keys).toContain("career");
      expect(keys).toContain("wealth");
      expect(keys).toContain("love");
      expect(keys).toContain("health");
      expect(keys).toContain("family");
      expect(keys).toContain("timing");
      expect(TOPIC_GUIDES).toHaveLength(6);
    });

    it("每条含 key/label/md 三字段", () => {
      for (const t of TOPIC_GUIDES) {
        expect(t.key).toBeTruthy();
        expect(t.label).toBeTruthy();
        expect(t.md.length).toBeGreaterThan(50);
      }
    });
  });

  describe("topicGuidesMd 全文拼接", () => {
    it("输出含附录D标题与每个主题的关键词", () => {
      const md = topicGuidesMd();
      expect(md).toContain("附录D");
      // md 中包含每个主题的 md 内容（取各自 md 中前 20 字符作为关键字检测）
      for (const t of TOPIC_GUIDES) {
        expect(md).toContain(t.md.slice(0, 20).trim());
      }
    });

    it("确定性：两次调用结果一致", () => {
      expect(topicGuidesMd()).toBe(topicGuidesMd());
    });
  });
});
