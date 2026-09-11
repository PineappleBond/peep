import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  Layout,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { path: "/", label: "工作台", icon: Layout },
  { path: "/persons", label: "人物库", icon: Users },
  { path: "/documents", label: "笔记", icon: BookOpen },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex flex-col border-r bg-background w-12 shrink-0">
      {/* Spacer - matches header height */}
      <div className="h-10" />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-1 pt-2">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="icon-sm"
                className="w-full"
                title={item.label}
              >
                <item.icon className="h-4 w-4" />
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Theme toggle */}
      <div className="p-1.5 pb-4">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-full"
      onClick={toggleTheme}
      title={theme === "light" ? "亮色" : theme === "dark" ? "暗色" : "跟随系统"}
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}
