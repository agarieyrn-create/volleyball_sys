import React, { useState } from 'react';
import { Settings, Team, Match } from '../types';

interface CourtLeagueConfigPanelProps {
  settings: Settings;
  teams: Team[];
  matches: Match[];
  onAutoAssign: (leagueCount: number, courtCount: number) => void;
  compact?: boolean;
}

export const CourtLeagueConfigPanel: React.FC<CourtLeagueConfigPanelProps> = ({
  settings,
  teams,
  matches,
  onAutoAssign,
  compact = false,
}) => {
  const [selectedLeagueCount, setSelectedLeagueCount] = useState<number>(settings.leagueCount || 4);
  const [selectedCourtCount, setSelectedCourtCount] = useState<number>(settings.courtCount || 4);

  const teamCount = teams.length;
  const isChanged =
    selectedLeagueCount !== (settings.leagueCount || 4) ||
    selectedCourtCount !== (settings.courtCount || 4);

  // 1リーグあたりのチーム数計算
  const minTeamsPerLeague = Math.floor(teamCount / selectedLeagueCount);
  const maxTeamsPerLeague = Math.ceil(teamCount / selectedLeagueCount);
  const teamsPerLeagueText =
    minTeamsPerLeague === maxTeamsPerLeague
      ? `各${minTeamsPerLeague}チーム`
      : `${minTeamsPerLeague}〜${maxTeamsPerLeague}チーム`;

  // 概算総試合数 (各チーム2試合想定)
  const estimatedMatches = Math.round((teamCount * (settings.matchesPerTeam || 2)) / 2);
  const estimatedSlots = Math.ceil(estimatedMatches / selectedCourtCount);

  const poolLetters = Array.from({ length: selectedLeagueCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  return (
    <div
      id="court-league-config-panel"
      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-indigo-300 dark:border-indigo-700 shadow-md space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl shrink-0">🏟️</span>
          <div>
            <h3 className="font-black text-sm sm:text-base text-zinc-950 dark:text-zinc-50 flex items-center gap-2 flex-wrap">
              <span>コート数・リーグ数の任意設定 & 自動割り振り</span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs">
                ワンクリック編成
              </span>
            </h3>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
              会場のコート数や参加チーム数に合わせて自由に設定し、ボタン1つでチーム分け・試合順・コート枠・審判を自動編成します。
            </p>
          </div>
        </div>

        {/* 現在適用中のバッジ */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs shrink-0 font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100">
            現在: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{settings.leagueCount || 4}リーグ</strong> / <strong className="text-teal-600 dark:text-teal-400 font-black">{settings.courtCount || 4}面コート</strong>
          </span>
        </div>
      </div>

      {/* 16〜20チーム向けクイックプリセット */}
      <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
          <span>⚡</span>
          <span>推奨プリセット:</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectedLeagueCount(5);
            setSelectedCourtCount(5);
          }}
          className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
            selectedLeagueCount === 5 && selectedCourtCount === 5
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600 hover:border-indigo-400'
          }`}
        >
          社内バレー公式 (17チーム・5面・A〜E組)
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedLeagueCount(4);
            setSelectedCourtCount(4);
          }}
          className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
            selectedLeagueCount === 4 && selectedCourtCount === 4
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600 hover:border-indigo-400'
          }`}
        >
          16〜20チーム (4リーグ × 4面コート)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* 1. リーグ数（グループ数）設定 */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              <span>🏐</span>
              <span>予選リーグ数（グループ数）</span>
            </label>
            <span className="text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700">
              {selectedLeagueCount} リーグ ({poolLetters.join(', ')})
            </span>
          </div>

          {/* クイック選択ピルボタン (1〜8) */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => {
              const isSelected = selectedLeagueCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSelectedLeagueCount(count)}
                  className={`py-2 px-2 rounded-lg text-xs font-black text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500 scale-102'
                      : 'bg-white dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {count}
                </button>
              );
            })}
          </div>

          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between pt-0.5">
            <span>
              全{teamCount}チーム ÷ {selectedLeagueCount}リーグ ＝ {teamsPerLeagueText}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">推奨: 2〜4リーグ</span>
          </div>
        </div>

        {/* 2. コート面数（同時進行面数）設定 */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              <span>🏟️</span>
              <span>使用コート数（体育館面数）</span>
            </label>
            <span className="text-xs font-mono font-black text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950 px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-700">
              {selectedCourtCount} 面 (A〜{String.fromCharCode(64 + selectedCourtCount)}コート)
            </span>
          </div>

          {/* クイック選択ピルボタン (1〜8) */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => {
              const isSelected = selectedCourtCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSelectedCourtCount(count)}
                  className={`py-2 px-2 rounded-lg text-xs font-black text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-500 scale-102'
                      : 'bg-white dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {count}面
                </button>
              );
            })}
          </div>

          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between pt-0.5">
            <span>
              1枠あたり最大{selectedCourtCount}試合を同時進行 (約{estimatedSlots}枠進行)
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">標準: 2〜4面</span>
          </div>
        </div>
      </div>

      {/* 実行プランプレビュー & 割り振り実行ボタン */}
      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs space-y-1">
          <div className="font-black text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5 flex-wrap">
            <span>📋 編成プレビュー:</span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 font-black border border-indigo-300 dark:border-indigo-800">
              {selectedLeagueCount}グループ配分
            </span>
            <span>×</span>
            <span className="px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200 font-black border border-teal-300 dark:border-teal-800">
              {selectedCourtCount}面同時進行
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
            ボタンをクリックすると、全{teamCount}チームが{selectedLeagueCount}リーグへ自動均等配分され、{selectedCourtCount}面コートの進行順（第1試合、第2試合…）と審判が即座に最適自動配置されます。
          </p>
        </div>

        <button
          type="button"
          id="btn-auto-assign-courts-leagues"
          onClick={() => onAutoAssign(selectedLeagueCount, selectedCourtCount)}
          className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 whitespace-nowrap ${
            isChanged
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-400 animate-pulse'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <span className="text-base">⚡</span>
          <span>この構成で自動割り振りを実行</span>
        </button>
      </div>
    </div>
  );
};
