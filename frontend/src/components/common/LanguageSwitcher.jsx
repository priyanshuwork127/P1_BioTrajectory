import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSwitcher({ className = '', showLabel = true, compact = false }) {
  const { language, setLanguage, toggleLanguage, isHindi } = useLanguage();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label="Switch between English and Hindi"
        title={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border btn-3d-secondary transition-all cursor-pointer ${
          isHindi
            ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
            : 'text-slate-700 dark:text-slate-300'
        } ${className}`}
      >
        <Languages className="w-3.5 h-3.5" />
        <span className="font-mono uppercase">{isHindi ? 'HI' : 'EN'}</span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language selection"
      className={`inline-flex items-center p-1 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 shadow-xs transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          language === 'en'
            ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Languages className="w-3.5 h-3.5" />
        <span>English</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('hi')}
        aria-pressed={language === 'hi'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          language === 'hi'
            ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <span>हिंदी</span>
      </button>
    </div>
  );
}
