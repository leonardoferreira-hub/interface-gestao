import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const effectiveTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(effectiveTheme === "light" ? "dark" : "light")}
      className="relative"
      aria-label="Alternar tema"
    >
      <motion.div
        initial={false}
        animate={{
          scale: effectiveTheme === "light" ? 1 : 0,
          opacity: effectiveTheme === "light" ? 1 : 0,
          rotate: effectiveTheme === "light" ? 0 : 180,
        }}
        transition={{ duration: 0.2 }}
        className="absolute"
      >
        <Sun className="h-5 w-5" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          scale: effectiveTheme === "dark" ? 1 : 0,
          opacity: effectiveTheme === "dark" ? 1 : 0,
          rotate: effectiveTheme === "dark" ? 0 : -180,
        }}
        transition={{ duration: 0.2 }}
        className="absolute"
      >
        <Moon className="h-5 w-5" />
      </motion.div>
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
