import { useSearchParams } from "react-router-dom";
import { usePersons, usePerson } from "./usePersons";
import { STORAGE_KEYS } from "@/lib/utils";

/** localStorage key for persisting the selected person ID */
export const SELECTED_PERSON_KEY = STORAGE_KEYS.SELECTED_PERSON;

/**
 * 读取 URL 中 ?personId=X，返回当前选中人物及其加载状态
 */
export function useSelectedPerson() {
  const { persons } = usePersons();
  const [searchParams] = useSearchParams();
  const personIdStr = searchParams.get("personId");
  const personId = personIdStr ? Number(personIdStr) : null;
  // Guard against NaN from non-numeric personId strings (e.g., ?personId=abc)
  const safeId = Number.isNaN(personId) ? null : personId;
  const { person, loading } = usePerson(safeId);

  return {
    selectedPerson: person,
    selectedPersonId: safeId,
    persons,
    loading,
  };
}
