/**
 * 运限 API 共享工具函数
 *
 * 供 peep-api-bazi.ts 与 peep-api-ziwei.ts 共用，
 * 避免日期解析、人物转换、大运匹配等逻辑重复维护。
 */

import { Lunar } from "lunar-typescript";
import { db, type Person } from "@/lib/db";
import type { BaziInput } from "@/modules/bazi/types";
import type { DaYun } from "@/modules/shared/horoscope";
import {
  calculateBazi,
  calculateDaYun,
  calculateLiuNian,
  calculateLiuYue,
  calculateLiuRi,
  calculateLiuShi,
} from "@/modules/bazi/core";
import { getBaziYear } from "@/modules/shared/horoscope";
import { useHoroscopeStore, type HoroscopeLevel } from "@/stores/horoscopeStore";
import type { HoroscopeScope } from "@/lib/peep-api";

/**
 * 读取人物并校验（存在且未删除），排盘 API 共用入口
 *
 * @throws 人物不存在或已删除时抛出错误
 */
export async function getActivePerson(personId: number): Promise<Person> {
  const person = await db.persons.get(personId);
  if (!person) throw new Error(`Person ${personId} not found`);
  if (person.deletedAt) throw new Error(`Person ${personId} has been deleted`);
  return person;
}

/**
 * 解析 Agent 传入的 datetime 字符串
 *
 * 格式: "2026-09-11H12" -> { year: 2026, month: 9, day: 11, hour: 12 }
 *
 * @throws 格式不合法或日期范围越界时抛出错误
 */
export function parseDatetime(datetime: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})H(\d{1,2})$/);
  if (!match) {
    throw new Error(
      `Invalid datetime format: ${datetime}. Expected: YYYY-MM-DDHhh (e.g., 2026-09-11H12)`,
    );
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in datetime: ${datetime}. Month must be 1-12, got ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day in datetime: ${datetime}. Day must be 1-31, got ${day}`);
  }
  if (hour > 23) {
    throw new Error(`Invalid hour in datetime: ${datetime}. Hour must be 0-23, got ${hour}`);
  }

  // 校验日期实际有效性（如拒绝 2026-02-31）
  const dateCheck = new Date(year, month - 1, day);
  if (
    dateCheck.getFullYear() !== year ||
    dateCheck.getMonth() !== month - 1 ||
    dateCheck.getDate() !== day
  ) {
    throw new Error(`Invalid date in datetime: ${datetime}. The date does not exist in the calendar.`);
  }

  return { year, month, day, hour };
}

/**
 * 将 Person 记录转为八字排盘输入
 *
 * - 农历日期自动转换为公历
 * - 缺失时辰默认取午时（12:00）
 */
export function personToBaziInput(person: Person): BaziInput {
  let [year, month, day] = person.birthDate.split("-").map(Number);
  if (person.isLunar) {
    const lunar = Lunar.fromYmd(year, month, day);
    const solar = lunar.getSolar();
    year = solar.getYear();
    month = solar.getMonth();
    day = solar.getDay();
  }
  let hour = 12;
  let minute = 0;
  if (person.birthTime) {
    const parts = person.birthTime.split(":");
    hour = parseInt(parts[0], 10) || 12;
    minute = parseInt(parts[1], 10) || 0;
  }
  return { year, month, day, hour, minute, gender: person.gender, yearDivide: "lichun" };
}

/**
 * 根据 datetime 在 dayunList 中查找匹配的大运
 */
export function findDayunByDatetime(
  dayunList: DaYun[],
  datetime: { year: number; month: number; day: number },
): DaYun | null {
  const baziYear = getBaziYear(datetime.year, datetime.month, datetime.day);

  for (const dy of dayunList) {
    if (baziYear >= dy.startYear && baziYear <= dy.endYear) {
      return dy;
    }
  }
  return null;
}

/**
 * 将 scope 同步到时间维度选择器 UI（horoscopeStore）
 *
 * 按层级依次写入大运、流年、流月、流日、流时，
 * 并激活对应的 activeLevel。
 */
export function applyScopeToHoroscopeStore(
  input: BaziInput,
  scope: HoroscopeScope,
): void {
  const result = calculateBazi(input);
  const dayunList = calculateDaYun(input, result);
  const dayMaster = result.dayMaster;

  const store = useHoroscopeStore.getState();

  // 解析 datetime
  const dt = parseDatetime(scope.datetime);

  // 找到对应的大运
  const matchedDayun = findDayunByDatetime(dayunList, dt);
  if (matchedDayun) store.setDayun(matchedDayun);

  // 根据 level 逐级计算流年、流月、流日、流时
  if (["liunian", "liuyue", "liuri", "liushi"].includes(scope.level)) {
    // 使用实际出生月日计算八字年份（以立春为界）
    const baziYear = getBaziYear(input.year, input.month, input.day);
    const liuNianList = calculateLiuNian(dayMaster, baziYear);

    // 找到对应年份的流年
    const matchedLiuNian = liuNianList.find((ln) => ln.year === dt.year);
    if (matchedLiuNian) store.setLiunian(matchedLiuNian);

    if (["liuyue", "liuri", "liushi"].includes(scope.level) && matchedLiuNian) {
      const liuYueList = calculateLiuYue(matchedLiuNian.tianGan);
      // 找到对应月份的流月
      const matchedLiuYue = liuYueList.find((ly) => ly.month === dt.month);
      if (matchedLiuYue) store.setLiuyue(matchedLiuYue);

      if (["liuri", "liushi"].includes(scope.level) && matchedLiuYue) {
        const liuRiList = calculateLiuRi(dt.year, dt.month);
        // 找到对应日期的流日
        const matchedLiuRi = liuRiList.find((lr) => lr.day === dt.day);
        if (matchedLiuRi) store.setLiuri(matchedLiuRi);

        if (scope.level === "liushi" && matchedLiuRi) {
          const liuShiList = calculateLiuShi(matchedLiuRi.tianGan);
          // 将小时转换为时辰索引 (0-11)：子时(23-1)→0，丑时(1-3)→1，...
          const shichenIndex = Math.floor((dt.hour + 1) / 2) % 12;
          const matchedLiuShi = liuShiList.find((ls) => ls.hour === shichenIndex);
          if (matchedLiuShi) store.setLiushi(matchedLiuShi);
        }
      }
    }
  }

  store.setActiveLevel(scope.level as HoroscopeLevel);
}
