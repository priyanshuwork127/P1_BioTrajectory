import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '', showLabel = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border btn-3d-secondary transition-all duration-300 select-none cursor-pointer ${
        isDark
          ? 'text-[#A9D6F5]'
          : 'text-[#553C2A]'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#A9D6F5] transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110" />
        ) : (
          <Moon className="w-4 h-4 text-[#6B4F3A] transition-transform duration-500 group-hover:-rotate-45 group-hover:scale-110" />
        )}
      </div>

      <span className="text-[12px] font-bold tracking-wide hidden sm:inline-block">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
