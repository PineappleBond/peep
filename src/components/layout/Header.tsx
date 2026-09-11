import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Users, Plus, X } from "lucide-react";
import { usePersons } from "@/hooks/usePersons";
import { SELECTED_PERSON_KEY } from "@/hooks/useSelectedPerson";
import type { Person } from "@/lib/db";
import { lsGet, lsSet, lsRemove } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function personLabel(p: Person): string {
  const parts = [p.name, p.gender === "male" ? "男" : "女", p.birthDate];
  if (p.birthTime) parts.push(p.birthTime);
  return parts.join(" · ");
}

export default function Header() {
  const { persons } = usePersons();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedId = searchParams.get("personId");
  const selectedPerson = selectedId ? persons.find(p => String(p.id) === selectedId) : null;

  // 当 persons 加载完成后，若 URL 没有 personId 但 localStorage 有记录，自动恢复
  useEffect(() => {
    if (selectedId != null) return; // URL 已有值，跳过
    if (persons.length === 0) return; // persons 还未加载完成
    const saved = lsGet<string | null>(SELECTED_PERSON_KEY, null);
    if (saved && persons.some(p => String(p.id) === saved)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("personId", saved);
        return next;
      }, { replace: true });
    }
  }, [persons, selectedId, setSearchParams]);

  const handleSelect = (personId: string) => {
    // 持久化到 localStorage
    lsSet(SELECTED_PERSON_KEY, personId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (personId) {
        next.set("personId", personId);
      } else {
        next.delete("personId");
      }
      return next;
    }, { replace: true });
  };

  const handleClear = () => {
    lsRemove(SELECTED_PERSON_KEY);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("personId");
      return next;
    }, { replace: true });
  };

  return (
    <header className="flex h-10 items-center px-4 gap-3 border-b">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">当前研究：</span>
      </div>
      {persons.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <Select
            value={selectedId ?? ""}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="w-[220px] h-7 text-xs">
              <SelectValue placeholder="选择人物..." />
            </SelectTrigger>
            <SelectContent>
              {persons.map((person) => (
                <SelectItem key={person.id} value={String(person.id)}>
                  {personLabel(person)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPerson && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleClear}
              title="清除选择"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">暂无人物档案</span>
      )}
      <div className="flex-1" />
      <Button variant="ghost" size="xs" onClick={() => navigate("/persons")}>
        <Plus className="h-3 w-3 mr-1" />
        人物库
      </Button>
    </header>
  );
}
