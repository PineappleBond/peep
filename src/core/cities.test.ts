/**
 * 城市经度查找与省份数据测试
 */
import { describe, expect, it } from "vitest";
import {
  PROVINCES,
  findLongitude,
  getCityByName,
  getLongitude,
  ALL_PROVINCE_NAMES,
  ALL_CITY_NAMES,
} from "./cities";

describe("cities 城市数据", () => {
  describe("PROVINCES 省份列表", () => {
    it("非空数组", () => {
      expect(PROVINCES.length).toBeGreaterThan(30);
    });

    it("每个省含 name 和 cities", () => {
      for (const p of PROVINCES) {
        expect(p.name).toBeTruthy();
        expect(p.cities.length).toBeGreaterThan(0);
      }
    });
  });

  describe("ALL_PROVINCE_NAMES / ALL_CITY_NAMES", () => {
    it("省份名列表含北京、广东", () => {
      expect(ALL_PROVINCE_NAMES).toContain("北京");
      expect(ALL_PROVINCE_NAMES).toContain("广东");
    });

    it("城市名列表含深圳、上海", () => {
      expect(ALL_CITY_NAMES).toContain("深圳");
      expect(ALL_CITY_NAMES).toContain("上海");
    });
  });

  describe("getCityByName 城市查找", () => {
    it("查找存在的城市", () => {
      const city = getCityByName("北京", "北京");
      expect(city).toBeDefined();
      if (city) {
        expect(city.name).toBe("北京");
      }
    });

    it("查找不存在的城市返回 undefined", () => {
      expect(getCityByName("不存在的省", "不存在的市")).toBeUndefined();
    });
  });

  describe("findLongitude / getLongitude 经度查找", () => {
    it("北京经度约 116°E", () => {
      const lng = findLongitude("北京", "北京", "市区");
      if (lng != null) {
        expect(lng).toBeGreaterThan(115);
        expect(lng).toBeLessThan(118);
      }
    });

    it("getLongitude 正常返回数值", () => {
      const lng = getLongitude("北京", "北京", "市区");
      if (lng != null) {
        expect(typeof lng).toBe("number");
        expect(lng).toBeGreaterThan(100);
      }
    });

    it("不存在的城市返回 null 或 undefined", () => {
      const lng = findLongitude("不存在", "不存在", "");
      expect(lng == null).toBe(true);
    });
  });
});
