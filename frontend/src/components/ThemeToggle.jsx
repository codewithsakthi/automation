import React from 'react';
import { Moon, SunMedium } from 'lucide-react';

const ThemeToggle = ({ theme, onToggle, className = '' }) => {
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border hover:bg-muted font-bold text-xs transition-all active:scale-95 ${className}`.trim()}
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      <div className="relative w-4 h-4 text-primary">
         <SunMedium size={16} className={`absolute inset-0 transition-all duration-300 ${isLight ? 'opacity-0 -rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} />
         <Moon size={16} className={`absolute inset-0 transition-all duration-300 ${!isLight ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}`} />
      </div>
      <span className="text-foreground tracking-tight">{isLight ? 'Dark Focus' : 'Light Mode'}</span>
    </button>
  );
};

export default ThemeToggle;
