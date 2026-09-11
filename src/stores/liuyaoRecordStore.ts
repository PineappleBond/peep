import { create } from "zustand";

interface LiuyaoRecordState {
  selectedRecordId: number | null;
  setSelectedRecord: (id: number | null) => void;
}

export const useLiuyaoRecordStore = create<LiuyaoRecordState>((set) => ({
  selectedRecordId: null,

  setSelectedRecord: (id) => {
    set({ selectedRecordId: id });
  },
}));
