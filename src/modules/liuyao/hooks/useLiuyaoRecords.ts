import { useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LiuyaoRecord } from "@/lib/db";
import { useHoroscopeStore } from "@/stores/horoscopeStore";

export type { LiuyaoRecord };

/**
 * 六爻起卦记录 hook
 * 支持按时间选择器（大运/流年/流月/流日）过滤
 * 支持按人物过滤
 * 支持软删除（垃圾篓）
 */
export function useLiuyaoRecords(personId?: number | null, showDeleted: boolean = false) {
  const horoscope = useHoroscopeStore();

  const records = useLiveQuery(
    async () => {
      // 利用 timestamp 索引按时间倒序获取记录，避免 toArray() 后排序
      let allRecords = await db.liuyaoRecords.orderBy("timestamp").reverse().toArray();

      // 过滤删除状态
      allRecords = allRecords.filter((r) =>
        showDeleted ? r.deletedAt != null : !r.deletedAt
      );

      // 按人物过滤（利用 personId 索引预筛选）
      if (personId !== undefined && personId !== null) {
        allRecords = allRecords.filter((r) => r.personId === personId);
      }

      // 按时间选择器过滤
      if (horoscope.dayun) {
        allRecords = allRecords.filter((r) => {
          const year = new Date(r.date).getFullYear();
          return year >= horoscope.dayun!.startYear && year <= horoscope.dayun!.endYear;
        });
      }

      if (horoscope.liunian) {
        allRecords = allRecords.filter((r) => {
          const year = new Date(r.date).getFullYear();
          return year === horoscope.liunian!.year;
        });
      }

      // 流月过滤需要流年作为上下文（年+月）
      if (horoscope.liuyue && horoscope.liunian) {
        allRecords = allRecords.filter((r) => {
          const date = new Date(r.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          return year === horoscope.liunian!.year && month === horoscope.liuyue!.month;
        });
      }

      // 流日过滤需要流年+流月作为上下文（年+月+日）
      if (horoscope.liuri && horoscope.liunian && horoscope.liuyue) {
        allRecords = allRecords.filter((r) => {
          const date = new Date(r.date);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const day = date.getDate();
          return (
            year === horoscope.liunian!.year &&
            month === horoscope.liuyue!.month &&
            day === horoscope.liuri!.day
          );
        });
      }

      return allRecords;
    },
    [personId, showDeleted, horoscope.dayun, horoscope.liunian, horoscope.liuyue, horoscope.liuri],
    []
  );

  const addRecord = useCallback(async (record: Omit<LiuyaoRecord, "createdAt">) => {
    const newRecord: LiuyaoRecord = {
      ...record,
      createdAt: Date.now(),
    };
    await db.liuyaoRecords.add(newRecord);
    return newRecord.id;
  }, []);

  const deleteRecord = useCallback(async (id: number) => {
    await db.liuyaoRecords.update(id, { deletedAt: Date.now() });
  }, []);

  const restoreRecord = useCallback(async (id: number) => {
    await db.liuyaoRecords.update(id, { deletedAt: null });
  }, []);

  const permanentlyDeleteRecord = useCallback(async (id: number) => {
    await db.liuyaoRecords.delete(id);
  }, []);

  const getRecord = useCallback(async (id: number) => {
    return db.liuyaoRecords.get(id);
  }, []);

  return {
    records,
    addRecord,
    deleteRecord,
    restoreRecord,
    permanentlyDeleteRecord,
    getRecord,
  };
}
