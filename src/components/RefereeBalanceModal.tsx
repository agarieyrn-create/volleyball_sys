import React, { useMemo, useState } from 'react';
import { getCourtName } from '../logic/court';
import { Match, Team } from '../types';

interface RefereeBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  matches: Match[];
}

export const RefereeBalanceModal: React.FC<RefereeBalanceModalProps> = ({
  isOpen,
  onClose,
  teams,
  matches,
}) => {
  const [selectedPool, setSelectedPool] = useState<string>('ALL');

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // 各チームごとの審判・得点板担当データを集計
  const teamDutyList = useMemo(() => {
    return teams.map((team) => {
      const leagueMatches = matches.filter(
        (m) =>
          m.round === 'league' &&
          m.referee &&
          (m.referee === team.name || m.referee.startsWith(team.name))
      );

      const tournamentMatches = matches.filter(
        (m) =>
          m.round !== 'league' &&
          m.referee &&
          (m.referee === team.name || m.referee.startsWith(team.name))
      );

      return {
        team,
        leagueMatches,
        tournamentMatches,
        leagueCount: leagueMatches.length,
        totalCount: leagueMatches.length + tournamentMatches.length,
      };
    });
  }, [teams, matches]);

  // 均等チェック（予選リーグで全チームが1回ずつ担当しているか）
  const balanceStats = useMemo(() => {
    const counts = teamDutyList.map((d) => d.leagueCount);
    const min = counts.length > 0 ? Math.min(...counts) : 0;
    const max = counts.length > 0 ? Math.max(...counts) : 0;
    const isPerfect = min === 1 && max === 1;
    return { min, max, isPerfect };
  }, [teamDutyList]);

  const filteredList = useMemo(() => {
    if (selectedPool === 'ALL') return teamDutyList;
    return teamDutyList.filter((d) => (d.team.pool || '') === selectedPool);
  }, [teamDutyList, selectedPool]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold border border-amber-500/20">
              ⚖️
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>得点板・審判 割当バランス確認</span>
                {balanceStats.isPerfect && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    完全均等 (偏りゼロ)
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                各チームの得点板担当回数・割り当て試合の偏りを検証
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* サマリーカード */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <span>✓</span> 予選リーグ得点板担当
              </div>
              <div className="text-lg font-black text-emerald-900 dark:text-emerald-100 mt-1">
                全17チーム 各1回
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                最大 {balanceStats.max}回 / 最小 {balanceStats.min}回（偏りなし）
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <span>📍</span> 自コート完結の原則
              </div>
              <div className="text-lg font-black text-indigo-900 dark:text-indigo-100 mt-1">
                移動負担 0％
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                自チームの試合コートで待機中に担当
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span>⚡</span> 決勝トーナメント
              </div>
              <div className="text-lg font-black text-amber-900 dark:text-amber-100 mt-1">
                負け審＆本部対応
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                敗退チームの負け審リレー＋決勝は本部
              </div>
            </div>
          </div>

          {/* プール切り替えタブ */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setSelectedPool('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedPool === 'ALL'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
              }`}
            >
              全チーム (全{teams.length}組)
            </button>
            {['A', 'B', 'C', 'D', 'E'].map((pool) => {
              const count = teams.filter((t) => t.pool === pool).length;
              return (
                <button
                  key={pool}
                  type="button"
                  onClick={() => setSelectedPool(pool)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedPool === pool
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  {pool}組 ({count}チーム)
                </button>
              );
            })}
          </div>
        </div>

        {/* チーム別担当一覧テーブル */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="p-3 font-bold w-14 text-center">組</th>
                  <th className="p-3 font-bold">チーム名</th>
                  <th className="p-3 font-bold text-center w-24">予選担当回数</th>
                  <th className="p-3 font-bold">担当試合 (コート・巡目・対戦カード)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                {filteredList.map(({ team, leagueMatches, leagueCount }) => {
                  return (
                    <tr
                      key={team.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {team.pool || '-'}組
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 break-words leading-tight">
                          {team.name}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                            leagueCount === 1
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                          }`}
                        >
                          {leagueCount}回 {leagueCount === 1 ? '✓' : '⚠️'}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-600 dark:text-zinc-300">
                        {leagueMatches.length > 0 ? (
                          <div className="space-y-1">
                            {leagueMatches.map((m) => {
                              const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name || '未定' : '未定';
                              const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name || '未定' : '未定';
                              return (
                                <div
                                  key={m.id}
                                  className="flex flex-wrap items-center gap-1.5 text-[11px]"
                                >
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                                    {m.matchCode || `#${m.matchNumber}`}
                                  </span>
                                  <span className="font-semibold text-zinc-500">
                                    {getCourtName(m.court)} 第{m.slot || 1}試合枠:
                                  </span>
                                  <span className="font-medium break-words leading-tight">
                                    {t1} vs {t2}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-zinc-400">担当なし</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          <span>※全チームが公平に得点板（スコアめくり）を担当できるように調整されています。</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
