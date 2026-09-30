import React from 'react';
import { THEMES, ThemeId } from '../logic/theme';
import { useTheme } from '../state/ThemeContext';

interface ThemeSelectorProps {
  variant?: 'button' | 'compact' | 'inline';
}

interface ThemeButtonItem {
  id: ThemeId;
  name: string;
  bg: string;
  accent: string;
  ring: string;
}

const THEME_BUTTONS: ThemeButtonItem[] = [
  {
    id: 'ocean',
    name: 'オーシャンブルー',
    bg: '#0284c7',
    accent: '#38bdf8',
    ring: 'ring-sky-500',
  },
  {
    id: 'court',
    name: '体育館クラシック',
    bg: '#ea580c',
    accent: '#fdba74',
    ring: 'ring-orange-500',
  },
  {
    id: 'emerald',
    name: 'ミントグリーン',
    bg: '#059669',
    accent: '#6ee7b7',
    ring: 'ring-emerald-500',
  },
  {
    id: 'midnight',
    name: 'ミッドナイト',
    bg: '#18181b',
    accent: '#6366f1',
    ring: 'ring-indigo-500',
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = () => {
  const { themeId, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center gap-1.5 p-1 rounded-full bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-300/80 dark:border-zinc-700/80 shadow-xs shrink-0"
      role="group"
      aria-label="テーマカラー切替"
    >
      {THEME_BUTTONS.map((item) => {
        const isSelected = themeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTheme(item.id)}
            aria-label={item.name}
            title={item.name}
            className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
              item.id === 'midnight'
                ? 'border-indigo-400/80'
                : 'border-white/80 dark:border-zinc-700'
            } ${
              isSelected
                ? `ring-2 ring-offset-2 ${item.ring} scale-110 shadow-sm z-10`
                : 'opacity-80 hover:opacity-100 hover:scale-105'
            }`}
            style={{
              background:
                item.id === 'midnight'
                  ? 'radial-gradient(circle, #6366f1 35%, #09090b 90%)'
                  : item.id === 'court'
                  ? 'linear-gradient(135deg, #ea580c 45%, #c2410c 100%)'
                  : item.id === 'emerald'
                  ? 'linear-gradient(135deg, #10b981 45%, #059669 100%)'
                  : 'linear-gradient(135deg, #38bdf8 45%, #0284c7 100%)',
            }}
          >
            {isSelected && (
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white shadow-xs" />
            )}
          </button>
        );
      })}
    </div>
  );
};
