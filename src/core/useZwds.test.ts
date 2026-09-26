/**
 * useZwds 有效出生时间计算测试
 */
import { describe, expect, it } from "vitest";
import { effectiveBirth, DEFAULT_BIRTH_INPUT } from "./useZwds";
import type { BirthInput } from "./useZwds";

describe("useZwds 辅助函数", () => {
  describe("DEFAULT_BIRTH_INPUT 默认输入", () => {
    it("含完整 BirthInput 字段", () => {
      expect(typeof DEFAULT_BIRTH_INPUT.name).toBe("string");
      expect(DEFAULT_BIRTH_INPUT.gender).toBe("男");
      expect(DEFAULT_BIRTH_INPUT.calendar).toBeTruthy();
      expect(DEFAULT_BIRTH_INPUT.date).toBeTruthy();
      expect(typeof DEFAULT_BIRTH_INPUT.timeIndex).toBe("number");
    });
  });

  describe("effectiveBirth 有效出生时间", () => {
    it("不使用真太阳时时直接返回原始数据", () => {
      const input: BirthInput = {
        ...DEFAULT_BIRTH_INPUT,
        useTrueSolar: false,
        exactTime: "",
      };
      const result = effectiveBirth(input);
      expect(result.dateStr).toBe(input.date);
      expect(result.timeIndex).toBe(input.timeIndex);
      expect(result.trueSolar).toBeNull();
    });

    it("使用真太阳时但无精确时间时返回原始数据", () => {
      const input: BirthInput = {
        ...DEFAULT_BIRTH_INPUT,
        useTrueSolar: true,
        exactTime: "",
        placeMode: "china",
        province: "北京",
        city: "北京",
        district: "市区",
      };
      const result = effectiveBirth(input);
      expect(result.trueSolar).toBeNull();
    });

    it("使用真太阳时且有精确时间时返回校正结果", () => {
      const input: BirthInput = {
        ...DEFAULT_BIRTH_INPUT,
        useTrueSolar: true,
        exactTime: "12:00",
        placeMode: "china",
        province: "北京",
        city: "北京",
        district: "市区",
        calendar: "solar",
        date: "2000-06-15",
        timeIndex: 6,
      };
      const result = effectiveBirth(input);
      expect(result.trueSolar).not.toBeNull();
      if (result.trueSolar) {
        expect(result.trueSolar.longitude).toBeGreaterThan(0);
        expect(typeof result.trueSolar.offsetMinutes).toBe("number");
      }
    });
  });
});
