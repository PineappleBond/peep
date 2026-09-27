import type { Element } from "./types";
import { ELEM_GEN, ELEM_OVERCOME } from "./constants";

/** 五行对应的"旺相休囚死"状态 */
export type VigorState = "旺" | "相" | "休" | "囚" | "死";

/**
 * 根据时间五行与爻五行，计算旺相休囚死：
 *   旺：时间五行与爻五行相同（同我者）
 *   相：时间生爻（生我者）
 *   休：爻生时间（我生者）
 *   囚：爻克时间（我克者）
 *   死：时间克爻（克我者）
 */
export function vigorOf(timeElem: Element, lineElem: Element): VigorState {
  if (timeElem === lineElem) return "旺";
  if (ELEM_GEN[timeElem] === lineElem) return "相"; // 时间生爻
  if (ELEM_GEN[lineElem] === timeElem) return "休"; // 爻生时间
  if (ELEM_OVERCOME[lineElem] === timeElem) return "囚"; // 爻克时间
  return "死"; // 时间克爻
}
