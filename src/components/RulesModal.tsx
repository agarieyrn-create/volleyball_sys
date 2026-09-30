import React from 'react';
import { TOURNAMENT_RULES } from '../data/rules';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50">
                {TOURNAMENT_RULES.title}
              </h2>
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{TOURNAMENT_RULES.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-base font-bold cursor-pointer"
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* モーダルコンテンツ */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-900 dark:text-zinc-100">
          {/* スケジュール */}
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <h3 className="font-extrabold text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-2 mb-2.5">
              <span>🕒</span>
              <span>{TOURNAMENT_RULES.schedule.title}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {TOURNAMENT_RULES.schedule.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-900 font-semibold text-zinc-900 dark:text-zinc-100 shadow-2xs"
                >
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 基本ルール 3箇条 */}
          <div>
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2 mb-3 pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-amber-600">🏐</span>
              <span>基本試合ルール</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TOURNAMENT_RULES.mainRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 space-y-1.5 shadow-2xs"
                >
                  <div className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
                    RULE #{rule.id}
                  </div>
                  <div className="font-black text-xs sm:text-sm text-zinc-900 dark:text-zinc-50">
                    {rule.title}
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                    {rule.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 今大会の特別ルール */}
          <div>
            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2 mb-3 pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
              <span className="text-rose-600">⭐</span>
              <span>今大会の特別ルール（エンジョイ＆安全重視）</span>
            </h3>
            <div className="space-y-2.5">
              {TOURNAMENT_RULES.specialRules.map((sRule, idx) => {
                const isHighlight =
                  sRule.includes('2点') || sRule.includes('ブロックを禁止') || sRule.includes('バックアタック');
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                      isHighlight
                        ? 'bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100 font-bold'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-zinc-100 font-medium'
                    }`}
                  >
                    <span
                      className={`shrink-0 mt-0.5 font-black font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        isHighlight
                          ? 'bg-rose-200/80 text-rose-900 dark:bg-rose-900 dark:text-rose-100'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <div className="pt-0.5">{sRule}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 会場利用の注意事項 */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
            <h3 className="font-extrabold text-amber-950 dark:text-amber-200 text-sm flex items-center gap-2 mb-2.5">
              <span>⚠️</span>
              <span>会場利用の注意事項・マナー</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-100 font-semibold">
              {TOURNAMENT_RULES.notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-black text-amber-600 dark:text-amber-400">・</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold hidden sm:inline">
            みんなでルールを守って楽しい大会にしましょう！
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors ml-auto shadow-sm cursor-pointer"
          >
            確認して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
