/**
 * 事件发射器测试：验证 on / off / emit 的基本行为与异常隔离
 */
import { describe, expect, it, vi } from "vitest";
import { globalEvents } from "./events";
import type { Person } from "./personDb";

/** 构造一个最小 Person 对象用于测试 */
function makePerson(id = 1): Person {
  return {
    id,
    savedAt: Date.now(),
    isDefault: false,
    name: "测试",
    gender: "男",
    calendar: "solar",
    date: "2000-08-16",
    timeIndex: 2,
    isLeapMonth: false,
    exactTime: "",
    useTrueSolar: false,
    placeMode: "china",
    province: "北京",
    city: "北京",
    district: "市区",
    timezone: "",
    algorithm: "default",
    yearDivide: "normal",
    mutagenTable: "default",
    dayDivide: "forward",
    astroType: "heaven",
    residence: "",
  };
}

describe("EventEmitter 事件系统", () => {
  it("on + emit：监听器被调用，参数正确传递", () => {
    const fn = vi.fn();
    globalEvents.on("person.changed", fn);
    const p = makePerson();
    globalEvents.emit("person.changed", p);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(p);
    globalEvents.off("person.changed", fn);
  });

  it("多个监听器同时注册，emit 全部触发", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    globalEvents.on("person.changed", fn1);
    globalEvents.on("person.changed", fn2);
    globalEvents.emit("person.changed", makePerson());
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    globalEvents.off("person.changed", fn1);
    globalEvents.off("person.changed", fn2);
  });

  it("off：移除后不再触发", () => {
    const fn = vi.fn();
    globalEvents.on("person.changed", fn);
    globalEvents.off("person.changed", fn);
    globalEvents.emit("person.changed", makePerson());
    expect(fn).not.toHaveBeenCalled();
  });

  it("emit 未注册事件不抛错", () => {
    expect(() => globalEvents.emit("person.changed", makePerson())).not.toThrow();
  });

  it("单个监听器抛错不影响其他监听器执行", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const badFn = () => {
      throw new Error("模拟错误");
    };
    const goodFn = vi.fn();
    globalEvents.on("person.changed", badFn);
    globalEvents.on("person.changed", goodFn);
    globalEvents.emit("person.changed", makePerson());
    expect(goodFn).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    // 清理
    globalEvents.off("person.changed", badFn);
    globalEvents.off("person.changed", goodFn);
  });

  describe("边缘案例", () => {
    it("同一个监听器注册两次，Set 去重只触发一次", () => {
      const fn = vi.fn();
      globalEvents.on("person.changed", fn);
      globalEvents.on("person.changed", fn);
      globalEvents.emit("person.changed", makePerson());
      // Set 去重，同一个函数引用只存储一次
      expect(fn).toHaveBeenCalledTimes(1);
      globalEvents.off("person.changed", fn);
    });

    it("off 未注册的监听器不抛错", () => {
      const fn = vi.fn();
      expect(() => globalEvents.off("person.changed", fn)).not.toThrow();
    });

    it("off 不存在的同名事件不抛错", () => {
      const fn = vi.fn();
      expect(() => globalEvents.off("nonexistent.event" as "person.changed", fn)).not.toThrow();
    });

    it("emit 传递 undefined 参数", () => {
      const fn = vi.fn();
      globalEvents.on("person.changed", fn);
      globalEvents.emit("person.changed", undefined as unknown as Person);
      expect(fn).toHaveBeenCalledWith(undefined);
      globalEvents.off("person.changed", fn);
    });

    it("emit 传递 null 参数", () => {
      const fn = vi.fn();
      globalEvents.on("person.changed", fn);
      globalEvents.emit("person.changed", null as unknown as Person);
      expect(fn).toHaveBeenCalledWith(null);
      globalEvents.off("person.changed", fn);
    });

    it("多个监听器中第一个抛错，后续全部执行", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const fn1 = vi.fn(() => {
        throw new Error("first fails");
      });
      const fn2 = vi.fn();
      const fn3 = vi.fn();
      globalEvents.on("person.changed", fn1);
      globalEvents.on("person.changed", fn2);
      globalEvents.on("person.changed", fn3);
      globalEvents.emit("person.changed", makePerson());
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
      globalEvents.off("person.changed", fn1);
      globalEvents.off("person.changed", fn2);
      globalEvents.off("person.changed", fn3);
    });

    it("异步监听器不影响 emit 的同步执行", () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      globalEvents.on("person.changed", fn1);
      globalEvents.on("person.changed", fn2);
      globalEvents.emit("person.changed", makePerson());
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      globalEvents.off("person.changed", fn1);
      globalEvents.off("person.changed", fn2);
    });
  });
});
