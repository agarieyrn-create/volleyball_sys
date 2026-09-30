export type ThemeId = 'midnight' | 'court' | 'ocean' | 'emerald';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  shortName: string;
  englishName: string;
  description: string;
  emoji: string;
  isDark: boolean;
  swatches: [string, string, string]; // [Background, Card, Accent]
  classes: {
    // Page background
    pageBg: string;
    pageText: string;
    
    // Header
    headerBg: string;
    headerBorder: string;
    
    // Card containers
    cardBg: string;
    cardBorder: string;
    cardHover: string;
    cardHeaderBg: string;
    
    // Primary accents
    accentColor: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
    accentButton: string;
    accentButtonHover: string;
    
    // Secondary accents / badges
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    
    // Tables
    tableHeader: string;
    tableRowHover: string;
    tableBorder: string;
    
    // Highlight / Winner
    winnerBg: string;
    winnerBorder: string;
    winnerText: string;
  };
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  midnight: {
    id: 'midnight',
    name: 'ミッドナイト・サイバー',
    shortName: 'ミッドナイト',
    englishName: 'Midnight Cyber',
    description: '深みのある漆黒キャンバスに鮮烈なエレクトリックブルー。競技の緊張感を引き締める高コントラストダーク。',
    emoji: '🌌',
    isDark: true,
    swatches: ['#09090b', '#18181b', '#6366f1'],
    classes: {
      pageBg: 'bg-zinc-950 text-zinc-100',
      pageText: 'text-zinc-100',
      headerBg: 'bg-zinc-900/90 backdrop-blur-md',
      headerBorder: 'border-zinc-800',
      cardBg: 'bg-zinc-900/90',
      cardBorder: 'border-zinc-800',
      cardHover: 'hover:border-zinc-700',
      cardHeaderBg: 'bg-zinc-950/60',
      accentColor: '#6366f1',
      accentBg: 'bg-indigo-600',
      accentBorder: 'border-indigo-500/40',
      accentText: 'text-indigo-400',
      accentButton: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      accentButtonHover: 'hover:bg-indigo-500',
      badgeBg: 'bg-indigo-950/80',
      badgeText: 'text-indigo-300',
      badgeBorder: 'border-indigo-800',
      tableHeader: 'bg-zinc-950/70 text-zinc-400',
      tableRowHover: 'hover:bg-zinc-800/40',
      tableBorder: 'border-zinc-800',
      winnerBg: 'bg-gradient-to-br from-amber-950/50 to-zinc-900',
      winnerBorder: 'border-amber-500/50',
      winnerText: 'text-amber-300',
    },
  },
  court: {
    id: 'court',
    name: '体育館クラシック',
    shortName: '体育館',
    englishName: 'Gym Court Wood',
    description: '天然木の体育館フロアを彷彿とさせる温もりと、コートオレンジ＆ロイヤルネイビーの王道バレーボールデザイン。',
    emoji: '🪵',
    isDark: false,
    swatches: ['#fbf8f3', '#ffffff', '#ea580c'],
    classes: {
      pageBg: 'bg-[#faf6ed] text-stone-900',
      pageText: 'text-stone-900',
      headerBg: 'bg-[#fffdf9]/95 backdrop-blur-md shadow-xs',
      headerBorder: 'border-stone-300',
      cardBg: 'bg-white shadow-xs',
      cardBorder: 'border-stone-200',
      cardHover: 'hover:border-orange-300',
      cardHeaderBg: 'bg-stone-50',
      accentColor: '#ea580c',
      accentBg: 'bg-orange-600',
      accentBorder: 'border-orange-400/50',
      accentText: 'text-orange-600',
      accentButton: 'bg-orange-600 hover:bg-orange-500 text-white shadow-xs',
      accentButtonHover: 'hover:bg-orange-500',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-800',
      badgeBorder: 'border-orange-200',
      tableHeader: 'bg-stone-100 text-stone-700',
      tableRowHover: 'hover:bg-amber-50/50',
      tableBorder: 'border-stone-200',
      winnerBg: 'bg-gradient-to-br from-amber-100 to-orange-50',
      winnerBorder: 'border-amber-400',
      winnerText: 'text-amber-900',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'オーシャンブルー',
    shortName: 'オーシャン',
    englishName: 'Ocean Blue',
    description: '抜けるような青空と爽快な海風をイメージしたスカイブルー。クリーンなホワイトカードに鮮明なロイヤルブルー。',
    emoji: '🌊',
    isDark: false,
    swatches: ['#f0f7ff', '#ffffff', '#0284c7'],
    classes: {
      pageBg: 'bg-[#f0f7ff] text-[#0c2b4e]',
      pageText: 'text-[#0c2b4e]',
      headerBg: 'bg-white/95 backdrop-blur-md shadow-xs',
      headerBorder: 'border-sky-200',
      cardBg: 'bg-white shadow-xs',
      cardBorder: 'border-sky-100',
      cardHover: 'hover:border-sky-300',
      cardHeaderBg: 'bg-sky-50/70',
      accentColor: '#0284c7',
      accentBg: 'bg-sky-600',
      accentBorder: 'border-sky-400/50',
      accentText: 'text-sky-600',
      accentButton: 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs',
      accentButtonHover: 'hover:bg-sky-500',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-800',
      badgeBorder: 'border-sky-200',
      tableHeader: 'bg-sky-100/70 text-sky-900',
      tableRowHover: 'hover:bg-sky-50/70',
      tableBorder: 'border-sky-100',
      winnerBg: 'bg-gradient-to-br from-amber-100 via-sky-50 to-white',
      winnerBorder: 'border-amber-400',
      winnerText: 'text-amber-900',
    },
  },
  emerald: {
    id: 'emerald',
    name: 'ミントアリーナ',
    shortName: 'ミント',
    englishName: 'Mint Arena',
    description: '清涼感溢れるミントグリーン＆ディープエメラルド。高輝度な屋外・明るい体育館でも視認性抜群の爽快スポーティ。',
    emoji: '🌿',
    isDark: false,
    swatches: ['#f0fdf4', '#ffffff', '#059669'],
    classes: {
      pageBg: 'bg-[#edf9f1] text-emerald-950',
      pageText: 'text-emerald-950',
      headerBg: 'bg-white/95 backdrop-blur-md shadow-xs',
      headerBorder: 'border-emerald-200',
      cardBg: 'bg-white shadow-xs',
      cardBorder: 'border-emerald-100',
      cardHover: 'hover:border-emerald-400',
      cardHeaderBg: 'bg-emerald-50/70',
      accentColor: '#059669',
      accentBg: 'bg-emerald-600',
      accentBorder: 'border-emerald-400/50',
      accentText: 'text-emerald-600',
      accentButton: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs',
      accentButtonHover: 'hover:bg-emerald-500',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-200',
      tableHeader: 'bg-emerald-100/60 text-emerald-900',
      tableRowHover: 'hover:bg-emerald-50/70',
      tableBorder: 'border-emerald-100',
      winnerBg: 'bg-gradient-to-br from-amber-100 via-emerald-50 to-white',
      winnerBorder: 'border-amber-400',
      winnerText: 'text-amber-900',
    },
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'ocean';

export function getTheme(id?: string | null): ThemeConfig {
  if (id === 'sunset') return THEMES.ocean;
  if (id && id in THEMES) {
    return THEMES[id as ThemeId];
  }
  return THEMES[DEFAULT_THEME_ID];
}
