/** 真太阳时校正：将 BirthInput 转换为实际排盘参数（纯函数，无副作用） */
import { applyTrueSolar } from "./utils";
import { lunarStrToSolarStr } from "./lunar";
import { resolveBirthPlace } from "./place";
import type { BirthInput, EffectiveBirth } from "./types";

/**
 * 真太阳时校正后的实际排盘参数（纯函数）。
 * 排盘 Hook、合盘从档案取盘、生时校正等场景共用，保证同一口径。
 */
export function effectiveBirth(input: BirthInput): EffectiveBirth {
  const base: EffectiveBirth = {
    calendar: input.calendar,
    dateStr: input.date,
    timeIndex: input.timeIndex,
    trueSolar: null,
  };
  if (!input.useTrueSolar || !input.exactTime) return base;
  const solarStr =
    input.calendar === "lunar" ? lunarStrToSolarStr(input.date, input.isLeapMonth) : input.date;
  if (!solarStr) return base;
  const resolved = resolveBirthPlace(input, solarStr, input.exactTime);
  const adj = applyTrueSolar(
    solarStr,
    input.exactTime,
    resolved.longitude,
    resolved.clockOffsetMinutes
  );
  if (!adj) return base;
  return {
    calendar: "solar",
    dateStr: adj.dateStr,
    timeIndex: adj.timeIndex,
    trueSolar: {
      clockDate: solarStr,
      clockTime: input.exactTime,
      trueDate: adj.dateStr,
      trueTime: adj.timeStr,
      timeIndex: adj.timeIndex,
      offsetMinutes: adj.offsetMinutes,
      eotMinutes: adj.eotMinutes,
      longitude: resolved.longitude,
      clockOffsetMinutes: resolved.clockOffsetMinutes,
      place: resolved.place,
    },
  };
}
