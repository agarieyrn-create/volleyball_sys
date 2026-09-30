import React from 'react';

export type PublicNavTab = 'summary' | 'myteam' | 'bracket' | 'standings' | 'results';

interface MobileNavBarProps {
  activeTab: PublicNavTab;
  onSelectTab: (tab: PublicNavTab) => void;
  onOpenRules: () => void;
  onOpenMvp: () => void;
  onOpenAwards: () => void;
  onOpenMenu: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenMenu,
}) => {
  return (
    <nav
      aria-label="モバイル下部ナビゲーション"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-300 dark:border-zinc-800 px-2 py-1 shadow-2xl safe-area-bottom text-zinc-750 dark:text-zinc-250"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. ⚡ 速報 */}
        <button
          type="button"
          onClick={() => onSelectTab('summary')}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'summary'
              ? 'text-indigo-700 dark:text-indigo-400 font-black scale-105'
              : 'text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          <span className="text-lg">⚡</span>
          <span className="text-[10px] tracking-tight">速報・注目</span>
          {activeTab === 'summary' && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
          )}
        </button>

        {/* 2. 🏐 マイチーム */}
        <button
          type="button"
          onClick={() => onSelectTab('myteam')}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'myteam'
              ? 'text-indigo-700 dark:text-indigo-400 font-black scale-105'
              : 'text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          <span className="text-lg">🏐</span>
          <span className="text-[10px] tracking-tight">マイチーム</span>
          {activeTab === 'myteam' && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
          )}
        </button>

        {/* 3. 🏆 トーナメント */}
        <button
          type="button"
          onClick={() => onSelectTab('bracket')}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'bracket'
              ? 'text-indigo-700 dark:text-indigo-400 font-black scale-105'
              : 'text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          <span className="text-lg">🏆</span>
          <span className="text-[10px] tracking-tight">決勝T</span>
          {activeTab === 'bracket' && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
          )}
        </button>

        {/* 4. 📊 順位表 */}
        <button
          type="button"
          onClick={() => onSelectTab('standings')}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'standings'
              ? 'text-indigo-700 dark:text-indigo-400 font-black scale-105'
              : 'text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          <span className="text-lg">📊</span>
          <span className="text-[10px] tracking-tight">予選順位</span>
          {activeTab === 'standings' && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5" />
          )}
        </button>

        {/* 5. ☰ その他メニュー */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 rounded-xl text-zinc-700 dark:text-zinc-300 font-bold hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer"
        >
          <span className="text-lg">☰</span>
          <span className="text-[10px] tracking-tight">メニュー</span>
        </button>
      </div>
    </nav>
  );
};
