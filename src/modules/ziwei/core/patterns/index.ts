/** 格局检测：统一入口。本命格局见 ./detect.ts，运限格局见 ./horoscope.ts */
export { detectPatterns, type Pattern } from "./detect";
export { detectHoroscopePatterns, scanHoroscopePatterns, type HoroPattern } from "./horoscope";
