'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      className="p-2 md:p-3 rounded-xl border border-neutral-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#222] transition-all flex-shrink-0">
      {theme === 'dark' ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
    </button>
  );
}
