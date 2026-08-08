import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

export const ThemeChanger = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-30 rounded-full bg-secondary/20 animate-pulse" />;
  }

  const options = [
    { value: "light", icon: Sun, label: "Light Mode" },
    { value: "dark", icon: Moon, label: "Dark Mode" },
    { value: "system", icon: Monitor, label: "System Preference" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/40 border border-border/40 rounded-full w-fit backdrop-blur-md shadow-sm">
      {options.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value;
        return (
          <Button
            key={value}
            variant="ghost"
            size="icon"
            onClick={() => setTheme(value)}
            className={`h-6 w-6 rounded-full p-0 transition-all duration-200 ${
              isActive
                ? "bg-background text-foreground shadow-xs scale-100"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            }`}
            title={label}
          >
            <Icon className="h-3.75 w-3.75" />
            <span className="sr-only">{label}</span>
          </Button>
        );
      })}
    </div>
  );
};

