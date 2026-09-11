import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { lsGet, lsSet, STORAGE_KEYS } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = STORAGE_KEYS.THEME;

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): Theme {
  const stored = lsGet<Theme | null>(THEME_KEY, null);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light";
        setResolvedTheme(newTheme);
        root.classList.toggle("dark", e.matches);
      };

      setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      root.classList.toggle("dark", mediaQuery.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      setResolvedTheme(theme);
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    lsSet(THEME_KEY, newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
