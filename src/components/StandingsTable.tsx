import React, { useState } from 'react';
import { findBestCDE2ndPlace } from '../logic/officialTournament';
import { Standing } from '../types';

interface StandingsTableProps {
  standings: Standing[];
  isDark?: boolean;
  showFinalOnly?: boolean;
}

export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  isDark = false,
  showFinalOnly = false,
}) => {
  const [selectedPoolFilter, setSelectedPoolFilter] = useState<'all' | string>('all');

  // 実際にデータに存在するプール一覧を抽出（未登録時はフォールバック）
  const pools = new Map<string, Standing[]>();
  const detectedPools: string[] = Array.from(
    new Set(standings.map((s) => s.pool || 'A'))
  ).sort() as string[];
  const activePoolList: string[] = detectedPools.length > 0 ? detectedPools : ['A', 'B'];

  for (const p of activePoolList) {
    pools.set(p, []);
  }

  for (const s of standings) {
    const pool = s.pool || 'A';
    if (!pools.has(pool)) {
      pools.set(pool, []);
    }
    pools.get(pool)!.push(s);
  }

  const sortedPools = Array.from(pools.keys()).sort();
  const visiblePools =
    selectedPoolFilter === 'all'
      ? sortedPools
      : sortedPools.filter((p) => p === selectedPoolFilter);

  const containerBg = isDark
    ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
    : 'bg-white border-zinc-300 text-zinc-950';

  const tableHeaderBg = isDark
    ? 'bg-zinc-950 text-zinc-200 border-zinc-700 font-bold'
    : 'bg-zinc-100 text-zinc-850 border-zinc-300 font-bold';

  const rowHover = isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50';

  // 決勝確定後の最終順位表
  if (showFinalOnly) {
    return (
      <div className={`rounded-2xl border shadow-xs overflow-hidden ${containerBg}`}>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-750 flex items-center justify-between bg-zinc-50 dark:bg-zinc-850">
          <h3 className="font-black text-base flex items-center gap-2 text-zinc-950 dark:text-white">
            🏆 大会最終結果
          </h3>
          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">確定順位</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase border-b ${tableHeaderBg}`}>
              <tr>
                <th className="py-3 px-4 w-16 text-center">順位</th>
                <th className="py-3 px-4">チーム名</th>
                <th className="py-3 px-4 text-center">リーグ</th>
                <th className="py-3 px-4 text-center">勝 - 敗</th>
                <th className="py-3 px-4 text-center">セット率</th>
                <th className="py-3 px-4 text-center">得失差</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {standings.map((s) => {
                let badge = '';
                if (s.rank === 1) badge = '🥇 優勝';
                else if (s.rank === 2) badge = '🥈 準優勝';
                else if (s.rank === 3) badge = '🥉 3位';
                else if (s.rank === 4) badge = '4位';

                return (
                  <tr key={s.teamId} className={`${rowHover} ${s.rank <= 3 ? 'font-bold' : ''}`}>
                    <td className="py-3 px-4 text-center font-black">
                      {badge || `${s.rank}位`}
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-700 dark:text-indigo-400">
                      {s.teamName}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                      {s.pool ? `グループ${s.pool}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {s.win} - {s.loss}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {s.setRatio.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // C/D/E組の2位得失点最上位チームを算出
  const { best: bestCDE2nd } = findBestCDE2ndPlace(standings);

  // 予選リーグ別テーブル
  return (
    <div className="space-y-3">
      {/* 8チーム決勝トーナメント進出条件案内バナー */}
      <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2">
        <span className="text-base shrink-0">🏆</span>
        <div className="leading-relaxed">
          <strong className="font-bold text-amber-950 dark:text-amber-100">決勝トーナメント進出（計8チーム）: </strong>
          A組1・2位、B組1・2位、C・D・E組1位、および
          <strong className="text-amber-700 dark:text-amber-300 font-black">【C/D/E組2位で得失点差が一番良い最上位チーム】</strong>
          が進出（A組1位と1回戦で対戦）。
        </div>
      </div>

      {/* グループ切り替えタブ (スマホで特に便利) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedPoolFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-all cursor-pointer ${
            selectedPoolFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          全グループ (A〜E)
        </button>
        {sortedPools.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSelectedPoolFilter(p)}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-all cursor-pointer ${
              selectedPoolFilter === p
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            グループ {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visiblePools.map((pool) => {
          const poolStandings = pools.get(pool)!;
          return (
            <div
              key={pool}
              className={`rounded-2xl border shadow-xs overflow-hidden ${containerBg}`}
            >
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-750 flex items-center justify-between bg-zinc-50 dark:bg-zinc-850">
                <h4 className="font-black text-sm flex items-center gap-1.5 text-zinc-950 dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  {['X', 'Y', 'Z'].includes(pool) ? `下位交流 ${pool}組 順位` : `グループ ${pool} 予選順位`}
                </h4>
                <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-bold">
                  {['X', 'Y', 'Z'].includes(pool) ? '午後 交流リーグ' : '全チーム決勝・交流へ進出'}
                </span>
              </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`uppercase border-b ${tableHeaderBg}`}>
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">順位</th>
                    <th className="py-2.5 px-3 min-w-[150px]">チーム</th>
                    <th className="py-2.5 px-2 text-center">勝-敗</th>
                    <th className="py-2.5 px-2 text-center">セット率</th>
                    <th className="py-2.5 px-2 text-center">得失点</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {poolStandings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        チーム未所属
                      </td>
                    </tr>
                  ) : (
                    poolStandings.map((s) => {
                    const isUpperQualified =
                      (['A', 'B'].includes(pool) && s.rank <= 2) ||
                      (['C', 'D', 'E'].includes(pool) && s.rank === 1) ||
                      (['C', 'D', 'E'].includes(pool) && s.rank === 2 && s.teamId === bestCDE2nd?.teamId);

                    const isBestCDE2nd =
                      ['C', 'D', 'E'].includes(pool) && s.rank === 2 && s.teamId === bestCDE2nd?.teamId;

                    return (
                      <tr
                        key={s.teamId}
                        className={`${rowHover} ${
                          isUpperQualified
                            ? isDark
                              ? 'bg-amber-950/30'
                              : 'bg-amber-50/70 font-semibold'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-black">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                              isUpperQualified
                                ? isDark
                                  ? 'bg-amber-900 text-amber-200'
                                  : 'bg-amber-100 text-amber-900'
                                : 'text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {s.rank}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 min-w-[150px] text-zinc-950 dark:text-zinc-50 font-bold break-words leading-snug" title={s.teamName}>
                          {s.teamName}
                          {isBestCDE2nd ? (
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-900/60 text-[10px] text-amber-800 dark:text-amber-200 font-black border border-amber-300 dark:border-amber-700">
                              🏆 決勝T進出 (得失点1位)
                            </span>
                          ) : isUpperQualified ? (
                            <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400 font-black">
                              🏆 決勝T進出
                            </span>
                          ) : (
                            <span className="ml-1 text-[10px] text-zinc-500 font-medium">
                              🎖️ 交流T進出
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {s.win}-{s.loss}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {s.setRatio.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
