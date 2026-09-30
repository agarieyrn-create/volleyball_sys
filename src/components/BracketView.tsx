import React, { useState } from 'react';
import { getCourtName } from '../logic/court';
import {
  computeAllTeamsMatchProgress,
  computeExchangeLeagueStandings,
} from '../logic/standings';
import { Match, Team } from '../types';

interface BracketViewProps {
  matches: Match[];
  teams: Team[];
  onMatchClick?: (match: Match) => void;
  onManualEditClick?: (match: Match) => void;
  isDark?: boolean;
  defaultView?: 'tree' | 'cards';
  hideControls?: boolean;
}

export const BracketView: React.FC<BracketViewProps> = ({
  matches,
  teams,
  onMatchClick,
  onManualEditClick,
  isDark = false,
  defaultView = 'tree',
  hideControls = false,
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>(defaultView);
  const [blockFilter, setBlockFilter] = useState<'all' | 'upper' | 'exchange' | 'progress'>('all');

  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

  // 公式マッチの抽出 (Plan A)
  const matchA5 = matches.find((m) => m.matchCode === 'A5' || m.id === 'match_A5');
  const matchA6 = matches.find((m) => m.matchCode === 'A6' || m.id === 'match_A6');
  const matchA7 = matches.find((m) => m.matchCode === 'A7' || m.id === 'match_A7');
  const matchB5 = matches.find((m) => m.matchCode === 'B5' || m.id === 'match_B5');
  const matchB6 = matches.find((m) => m.matchCode === 'B6' || m.id === 'match_B6');
  const matchB7 = matches.find((m) => m.matchCode === 'B7' || m.id === 'match_B7');
  const matchA8 = matches.find((m) => m.matchCode === 'A8' || m.id === 'match_A8');
  const matchB8 = matches.find((m) => m.matchCode === 'B8' || m.id === 'match_B8');
  const matchC8 = matches.find((m) => m.matchCode === 'C8' || m.id === 'match_C8');
  const matchD8 = matches.find((m) => m.matchCode === 'D8' || m.id === 'match_D8');

  // 下位交流リーグマッチ (X, Y, Z組)
  const matchC5 = matches.find((m) => m.matchCode === 'C5' || m.id === 'match_C5');
  const matchC6 = matches.find((m) => m.matchCode === 'C6' || m.id === 'match_C6');
  const matchC7 = matches.find((m) => m.matchCode === 'C7' || m.id === 'match_C7');

  const matchD5 = matches.find((m) => m.matchCode === 'D5' || m.id === 'match_D5');
  const matchD6 = matches.find((m) => m.matchCode === 'D6' || m.id === 'match_D6');
  const matchD7 = matches.find((m) => m.matchCode === 'D7' || m.id === 'match_D7');

  const matchE5 = matches.find((m) => m.matchCode === 'E5' || m.id === 'match_E5');
  const matchE6 = matches.find((m) => m.matchCode === 'E6' || m.id === 'match_E6');
  const matchE7 = matches.find((m) => m.matchCode === 'E7' || m.id === 'match_E7');

  // 汎用トーナメントマッチフォールバック
  const finalMatch = matchA8 || matches.find((m) => m.round === 'final');
  const thirdPlaceMatch = matchB8 || matches.find((m) => m.round === 'third_place');

  // 優勝・3位チーム
  const championTeam =
    finalMatch?.status === 'completed' && finalMatch.winnerId
      ? teamMap.get(finalMatch.winnerId)
      : null;
  const thirdPlaceTeam =
    thirdPlaceMatch?.status === 'completed' && thirdPlaceMatch.winnerId
      ? teamMap.get(thirdPlaceMatch.winnerId)
      : null;

  // 交流リーグ順位表＆全チーム試合数進捗
  const exchangeStandings = computeExchangeLeagueStandings(teams, matches);
  const allTeamsProgress = computeAllTeamsMatchProgress(teams, matches);

  const getTeamDisplay = (
    teamId: string | null,
    fallbackPlaceholder: string = '未定'
  ) => {
    if (!teamId) return { name: fallbackPlaceholder, pool: '', seed: undefined, isTBD: true };
    const team = teamMap.get(teamId);
    if (!team) return { name: fallbackPlaceholder, pool: '', seed: undefined, isTBD: true };
    return {
      name: team.name,
      pool: team.pool || '',
      seed: team.seed,
      isTBD: false,
    };
  };

  if (matches.filter((m) => m.round !== 'league').length === 0) {
    return (
      <div
        className={`p-8 text-center rounded-2xl border ${
          isDark
            ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
            : 'bg-white border-zinc-200 text-zinc-500'
        }`}
      >
        <div className="text-3xl mb-2">🌴</div>
        <p className="font-bold text-base">決勝・交流戦はまだ生成されていません。</p>
        <p className="text-xs text-zinc-400 mt-1">
          予選リーグ全試合終了後、運営管理コンソールより自動シード生成できます。
        </p>
      </div>
    );
  }

  // 樹形図用カード
  const renderTreeMatchCard = (
    match?: Match,
    roundLabel?: string,
    placeholderTeam1: string = '未定',
    placeholderTeam2: string = '未定',
    badgeVariant: 'primary' | 'gold' | 'silver' | 'teal' | 'bronze' = 'primary'
  ) => {
    const isCardMode = viewMode === 'cards';
    const cardWidthClass = isCardMode ? 'w-full' : 'w-[235px] sm:w-[255px]';

    if (!match) {
      return (
        <div
          className={`${cardWidthClass} h-[108px] p-2.5 rounded-2xl border border-dashed flex flex-col justify-center items-center text-center text-xs shrink-0 select-none ${
            isDark
              ? 'border-zinc-800 text-zinc-600 bg-zinc-900/30'
              : 'border-zinc-300 text-zinc-400 bg-zinc-50'
          }`}
        >
          <span className="font-bold text-xs">{roundLabel || '対戦枠'}</span>
          <span className="text-[10px] mt-0.5 opacity-60">未定</span>
        </div>
      );
    }

    const t1Placeholder = match.bracketSlotLabel1 || placeholderTeam1;
    const t2Placeholder = match.bracketSlotLabel2 || placeholderTeam2;

    const t1 = getTeamDisplay(match.team1Id, t1Placeholder);
    const t2 = getTeamDisplay(match.team2Id, t2Placeholder);

    const isCompleted = match.status === 'completed';
    const isT1Winner = isCompleted && match.winnerId === match.team1Id;
    const isT2Winner = isCompleted && match.winnerId === match.team2Id;

    const cardBorderColor = isDark
      ? badgeVariant === 'gold'
        ? 'border-amber-700/80 hover:border-amber-500'
        : badgeVariant === 'bronze'
        ? 'border-amber-600/80 hover:border-amber-400'
        : badgeVariant === 'teal'
        ? 'border-teal-700/80 hover:border-teal-500'
        : 'border-zinc-700/80 hover:border-indigo-500/80'
      : badgeVariant === 'gold'
      ? 'border-amber-300 hover:border-amber-500'
      : badgeVariant === 'bronze'
      ? 'border-amber-400 hover:border-amber-600'
      : badgeVariant === 'teal'
      ? 'border-teal-300 hover:border-teal-500'
      : 'border-zinc-300 hover:border-indigo-400';

    return (
      <div
        id={`tree-match-${match.id}`}
        onClick={() => onMatchClick && onMatchClick(match)}
        className={`${cardWidthClass} h-[108px] rounded-2xl border p-2 shadow-xs transition-all relative select-none flex flex-col justify-between shrink-0 ${
          isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900'
        } ${cardBorderColor} ${
          onMatchClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''
        }`}
        title={onMatchClick ? 'クリックしてスコアを入力・変更' : undefined}
      >
        {/* ヘッダー情報（試合番号・コート・ステータス） */}
        <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800 text-[10px] leading-none shrink-0">
          <div className="flex items-center gap-1 font-bold text-zinc-500 dark:text-zinc-400">
            {badgeVariant === 'gold' && <span>🏆</span>}
            {badgeVariant === 'bronze' && <span>🥉</span>}
            {badgeVariant === 'teal' && <span>🎖️</span>}
            <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {match.matchCode || match.id.replace('match_', '')}
            </span>
            <span className="truncate max-w-[80px]">{roundLabel || match.roundName}</span>
            {match.court && (
              <span className="px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono font-bold text-[9px] shrink-0">
                {getCourtName(match.court)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onManualEditClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManualEditClick(match);
                }}
                title="緊急手動修正"
                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors"
              >
                🛠️
              </button>
            )}
            <span
              className={`px-1.5 py-0.2 rounded-full font-bold text-[9px] ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : match.team1Id && match.team2Id
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {isCompleted ? '終了' : match.team1Id && match.team2Id ? '予定' : '待機'}
            </span>
          </div>
        </div>

        {/* チーム1 */}
        <div
          className={`flex items-center justify-between px-2 py-1 rounded-xl text-xs transition-colors ${
            isT1Winner
              ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300'
              : isCompleted
              ? 'opacity-60 font-medium'
              : 'font-semibold'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            {isT1Winner && <span className="text-[10px]">👑</span>}
            <span className="truncate max-w-[150px]" title={t1.name}>
              {t1.name}
            </span>
          </div>
          <span className="font-mono font-black text-xs shrink-0 pl-1">{match.team1Sets}</span>
        </div>

        {/* チーム2 */}
        <div
          className={`flex items-center justify-between px-2 py-1 rounded-xl text-xs transition-colors ${
            isT2Winner
              ? 'bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300'
              : isCompleted
              ? 'opacity-60 font-medium'
              : 'font-semibold'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            {isT2Winner && <span className="text-[10px]">👑</span>}
            <span className="truncate max-w-[150px]" title={t2.name}>
              {t2.name}
            </span>
          </div>
          <span className="font-mono font-black text-xs shrink-0 pl-1">{match.team2Sets}</span>
        </div>

        {/* 審判割当 */}
        <div className="pt-0.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[9px] text-zinc-500 dark:text-zinc-400">
          <span className="truncate max-w-[160px]" title={match.referee || '審判'}>
            👨‍⚖️ {match.referee || '審判割当あり'}
          </span>
          {match.slot && (
            <span className="font-mono text-[9px] text-zinc-400">枠{match.slot}</span>
          )}
        </div>
      </div>
    );
  };

  // 樹形図コネクタ
  const PairBranchConnector: React.FC<{
    topWon: boolean;
    bottomWon: boolean;
    isFinished: boolean;
  }> = ({ topWon, bottomWon, isFinished }) => (
    <div className="w-10 sm:w-12 h-[232px] relative flex items-center shrink-0">
      <div
        className={`absolute left-0 top-[54px] w-5 sm:w-6 h-[1px] ${
          topWon ? 'bg-emerald-500 h-[2px]' : isFinished ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      />
      <div
        className={`absolute left-0 bottom-[54px] w-5 sm:w-6 h-[1px] ${
          bottomWon ? 'bg-emerald-500 h-[2px]' : isFinished ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      />
      <div
        className={`absolute left-5 sm:left-6 top-[54px] bottom-[54px] w-[1px] ${
          topWon || bottomWon ? 'bg-emerald-500 w-[2px]' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      />
      <div
        className={`absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-5 sm:w-6 h-[1px] ${
          topWon || bottomWon ? 'bg-emerald-500 h-[2px]' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      />
    </div>
  );

  const HorizontalLineConnector: React.FC<{
    hasWinner: boolean;
    height: number;
    y: number;
  }> = ({ hasWinner, height, y }) => (
    <div className="w-8 sm:w-10 relative shrink-0" style={{ height: `${height}px` }}>
      <div
        className={`absolute left-0 w-full ${
          hasWinner ? 'bg-emerald-500 h-[2px]' : 'bg-zinc-300 dark:bg-zinc-700 h-[1px]'
        }`}
        style={{ top: `${y}px` }}
      />
    </div>
  );

  // 交流リーグミニ順位表
  const renderPoolTable = (poolName: 'X' | 'Y' | 'Z', title: string, courtName: string) => {
    const poolStandings = exchangeStandings.filter((s) => s.pool === poolName);
    return (
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="font-black text-xs text-zinc-950 dark:text-white">{title}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
            {courtName}
          </span>
        </div>
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-100/70 dark:bg-zinc-800 text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="py-1.5 px-2 text-center w-8">順位</th>
              <th className="py-1.5 px-2">チーム名</th>
              <th className="py-1.5 px-2 text-center w-14">勝 - 敗</th>
              <th className="py-1.5 px-2 text-center w-14">得失差</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
            {poolStandings.map((s, idx) => (
              <tr key={s.teamId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="py-2 px-2 text-center font-black">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </td>
                <td className="py-2 px-2 font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[130px]" title={s.teamName}>
                  {s.teamName}
                </td>
                <td className="py-2 px-2 text-center font-mono font-bold">
                  {s.win} - {s.loss}
                </td>
                <td className="py-2 px-2 text-center font-mono text-[11px]">
                  {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                </td>
              </tr>
            ))}
            {poolStandings.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-zinc-400 text-[11px]">
                  予選終了後にチーム自動配分
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // 全17チーム試合数消化進捗モニター
  const renderMatchProgressMonitor = () => {
    return (
      <div className="space-y-4 p-4 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="font-black text-base text-zinc-950 dark:text-white flex items-center gap-2">
              <span>📊</span>
              <span>全17チーム 試合数・消化進捗モニター（4〜5試合保証）</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              午前予選（2試合）＋午後決勝Tまたは交流L（2〜3試合）の予定・消化状況をチーム毎に完全可視化しています。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              全チーム 4〜5試合 達成設計
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800 text-[11px] uppercase font-bold text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="py-2.5 px-3">チーム名</th>
                <th className="py-2.5 px-3 text-center">予選組</th>
                <th className="py-2.5 px-3 text-center">午後ステージ</th>
                <th className="py-2.5 px-3 text-center">予定試合数</th>
                <th className="py-2.5 px-3 text-center">消化状況</th>
                <th className="py-2.5 px-3">本日の対戦カード</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {allTeamsProgress.map((info) => {
                const isFinishedAll = info.playedCount >= info.scheduledCount && info.playedCount > 0;
                const progressPct = Math.min(100, Math.round((info.playedCount / info.scheduledCount) * 100));

                return (
                  <tr key={info.teamId} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {info.teamName}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 font-mono">
                        {info.pool ? `予選${info.pool}組` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          info.isUpper
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                        }`}
                      >
                        {info.isUpper ? '🏆 上位決勝トーナメント' : '🤝 下位交流リーグ'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-black">
                      <span className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-mono text-sm">
                        {info.scheduledCount}試合
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isFinishedAll ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500">
                          {info.playedCount} / {info.scheduledCount} 試合 ({progressPct}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {info.allMatches.map((m) => {
                          const code = m.matchCode || m.id.replace('match_', '');
                          const isDone = m.status === 'completed';
                          return (
                            <span
                              key={m.id}
                              title={`${m.roundName} (${isDone ? '完了' : '待機中'})`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                isDone
                                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                              }`}
                            >
                              {code} {isDone ? '✓' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 4〜5試合保証の視覚的ハイライトバナー（ユーザーの見た目でわかる要求を完全満たす） */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-200 dark:border-indigo-800/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-xs shrink-0">
              🏐
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base text-zinc-950 dark:text-white">
                  全17チーム 4〜5試合 保証フォーマット（案A採用）
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  全員 最低4試合プレー保証
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 font-medium">
                予選リーグ（全員2試合） ＋ 午後（上位トーナメント または 交流リーグ 各2〜3試合） ＝ 全チーム合計4〜5試合
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-left md:text-right">
              <div className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                全36試合（予選17＋決勝T10＋交流L9）
              </div>
              <div className="text-[11px] text-zinc-500">
                5面コート同時進行・スムーズ消化
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs pt-1">
          <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-indigo-100 dark:border-zinc-800 space-y-1">
            <div className="font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <span>🏆</span>
              <span>上位トーナメント（8チーム / 10試合）</span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              ・ベスト4進出：<strong>5試合</strong>（準決勝＋決勝または3位決定戦）<br />
              ・QF敗退4チーム：<strong>4試合</strong>（QF敗者順位交流戦 C8/D8）
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-indigo-100 dark:border-zinc-800 space-y-1">
            <div className="font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <span>🤝</span>
              <span>下位交流リーグ（9チーム / 9試合）</span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              ・3チーム×3グループ（X・Y・Z組）総当たり<br />
              ・9チーム全員が午後2試合 ＝ <strong>計4試合</strong>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-indigo-100 dark:border-zinc-800 space-y-1 sm:col-span-2 lg:col-span-1">
            <div className="font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span>✅</span>
              <span>1チームあたりの全試合数 内訳</span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
              ・4試合プレー：<strong>13チーム</strong><br />
              ・5試合プレー：<strong>4チーム</strong>（決勝進出・3位決定戦）
            </div>
          </div>
        </div>
      </div>

      {/* 表示形式（ツリー vs カード）＆ブロックフィルタ切り替え */}
      {!hideControls && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl p-1 bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <span>🌲</span>
                <span>トーナメント樹形図</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <span>🃏</span>
                <span>カード一覧</span>
              </button>
            </div>
          </div>

          {/* ブロックフィルタ */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setBlockFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                blockFilter === 'all'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
              }`}
            >
              全ブロック表示 (36試合)
            </button>
            <button
              type="button"
              onClick={() => setBlockFilter('upper')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                blockFilter === 'upper'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
              }`}
            >
              🏆 上ブロック (決勝・順位戦 10試合)
            </button>
            <button
              type="button"
              onClick={() => setBlockFilter('exchange')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                blockFilter === 'exchange'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100'
              }`}
            >
              🤝 下ブロック (交流リーグ 9試合)
            </button>
            <button
              type="button"
              onClick={() => setBlockFilter('progress')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                blockFilter === 'progress'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              📊 全チーム試合数モニター (4〜5試合)
            </button>
          </div>
        </div>
      )}

      {/* 4〜5試合消化モニタータブ */}
      {blockFilter === 'progress' && renderMatchProgressMonitor()}

      {/* 1. ツリー型表示 (樹形図) */}
      {viewMode === 'tree' && blockFilter !== 'progress' && (
        <div className="space-y-8">
          {/* モバイル横スクロール案内 */}
          <div className="md:hidden flex items-center justify-between px-3.5 py-2 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/40 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <span>👈</span>
              <span>左右にスワイプして決勝・勝ち上がりを確認</span>
            </span>
            <span>👉</span>
          </div>

          {/* A. 🏆 上ブロック（決勝トーナメント＋3位決定戦＋QF敗者順位交流戦） */}
          {(blockFilter === 'all' || blockFilter === 'upper') && (
            <div className="p-4 sm:p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">🏆</span>
                  <h3 className="font-black text-base text-zinc-950 dark:text-white">
                    上ブロック（決勝トーナメント・3位決定戦・順位交流戦）
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    A8 決勝戦 ＆ B8 3位決定戦
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                    計10試合（全チーム4〜5試合達成）
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  上位8チーム進出
                </span>
              </div>

              {/* トーナメントツリー */}
              <div className="overflow-x-auto pb-4 pt-1">
                <div className="inline-flex items-start min-w-[860px] justify-start py-2">
                  {/* 列 1: 準々決勝 (A5, B5, A6, B6) */}
                  <div className="flex flex-col shrink-0">
                    <div className="text-center font-bold text-xs uppercase tracking-wider text-zinc-500 pb-2">
                      準々決勝 (1回戦)
                    </div>
                    <div className="space-y-4">
                      {/* 上ペア: A5 vs A6 */}
                      <div className="h-[232px] flex flex-col justify-between">
                        {renderTreeMatchCard(matchA5, 'A5 (1回戦)', 'A組2位', 'D組1位')}
                        {renderTreeMatchCard(matchA6, 'A6 (1回戦)', 'B組1位', 'E組1位')}
                      </div>
                      {/* 下ペア: B5 vs B6 */}
                      <div className="h-[232px] flex flex-col justify-between">
                        {renderTreeMatchCard(matchB5, 'B5 (1回戦)', 'C組1位', 'B組2位')}
                        {renderTreeMatchCard(matchB6, 'B6 (1回戦)', 'A組1位', 'C/D/E組 2位最上位')}
                      </div>
                    </div>
                  </div>

                  {/* コネクタ 1 */}
                  <div className="flex flex-col shrink-0 pt-6 space-y-4">
                    <PairBranchConnector
                      topWon={matchA5?.status === 'completed' && !!matchA5.winnerId}
                      bottomWon={matchA6?.status === 'completed' && !!matchA6.winnerId}
                      isFinished={matchA5?.status === 'completed' && matchA6?.status === 'completed'}
                    />
                    <PairBranchConnector
                      topWon={matchB5?.status === 'completed' && !!matchB5.winnerId}
                      bottomWon={matchB6?.status === 'completed' && !!matchB6.winnerId}
                      isFinished={matchB5?.status === 'completed' && matchB6?.status === 'completed'}
                    />
                  </div>

                  {/* 列 2: 準決勝 (A7, B7) */}
                  <div className="flex flex-col shrink-0">
                    <div className="text-center font-bold text-xs uppercase tracking-wider text-zinc-500 pb-2">
                      準決勝
                    </div>
                    <div className="h-[480px] flex flex-col justify-around py-4">
                      {renderTreeMatchCard(matchA7, 'A7 (準決勝)', 'A5の勝者', 'A6の勝者')}
                      {renderTreeMatchCard(matchB7, 'B7 (準決勝)', 'B5の勝者', 'B6の勝者')}
                    </div>
                  </div>

                  {/* コネクタ 2 */}
                  <div className="flex flex-col shrink-0 pt-6">
                    <div className="w-10 sm:w-12 h-[480px] relative flex items-center shrink-0">
                      <div
                        className={`absolute left-0 top-[116px] w-5 sm:w-6 h-[1px] ${
                          matchA7?.status === 'completed' && matchA7.winnerId ? 'bg-emerald-500 h-[2px]' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      />
                      <div
                        className={`absolute left-0 bottom-[116px] w-5 sm:w-6 h-[1px] ${
                          matchB7?.status === 'completed' && matchB7.winnerId ? 'bg-emerald-500 h-[2px]' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      />
                      <div
                        className={`absolute left-5 sm:left-6 top-[116px] bottom-[116px] w-[1px] ${
                          (matchA7?.status === 'completed' && matchA7.winnerId) ||
                          (matchB7?.status === 'completed' && matchB7.winnerId)
                            ? 'bg-emerald-500 w-[2px]'
                            : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      />
                      <div
                        className={`absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 w-5 sm:w-6 h-[1px] ${
                          matchA7?.status === 'completed' || matchB7?.status === 'completed'
                            ? 'bg-emerald-500 h-[2px]'
                            : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 列 3: 決勝戦 (A8) 🏆 */}
                  <div className="flex flex-col shrink-0">
                    <div className="text-center font-black text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 pb-2 flex items-center justify-center gap-1">
                      <span>🏆</span>
                      <span>決勝戦 (A8)</span>
                    </div>
                    <div className="h-[480px] flex items-center justify-center">
                      {renderTreeMatchCard(matchA8, 'A8 (決勝)', 'A7の勝者', 'B7の勝者', 'gold')}
                    </div>
                  </div>

                  {/* コネクタ 3 */}
                  <div className="flex flex-col shrink-0 pt-6">
                    <HorizontalLineConnector hasWinner={!!championTeam} height={480} y={240} />
                  </div>

                  {/* 列 4: 優勝チームバナー */}
                  <div className="flex flex-col shrink-0 pt-6 pl-1">
                    <div className="h-[480px] flex items-center justify-center">
                      <div
                        className={`w-[180px] p-4 rounded-3xl border text-center transition-all ${
                          championTeam
                            ? 'bg-gradient-to-b from-amber-500/20 via-amber-500/10 to-transparent border-amber-500 shadow-lg'
                            : isDark
                            ? 'bg-zinc-850 border-zinc-700 text-zinc-500'
                            : 'bg-zinc-100 border-zinc-300 text-zinc-400'
                        }`}
                      >
                        <div className="text-3xl mb-1">👑</div>
                        <div className="text-[10px] uppercase tracking-widest font-black text-amber-600 dark:text-amber-400 mb-0.5">
                          CHAMPION
                        </div>
                        <div
                          className="text-sm font-black break-words leading-tight text-zinc-950 dark:text-zinc-50"
                          title={championTeam ? championTeam.name : ''}
                        >
                          {championTeam ? championTeam.name : '優勝チーム待機'}
                        </div>
                        {championTeam && (
                          <div className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            🎉 全5試合 走破優勝！
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🥉 3位決定戦 (B8) セクション */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-amber-500/20 text-amber-600 shrink-0">
                      🥉
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100">
                          3位決定戦（B8・コート2 / スロット8）
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          第3位・敢闘賞決定
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        準決勝（A7・B7）で惜しくも敗れた2チームが激突！両チームとも本日通算5試合をプレーします。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-center md:self-auto shrink-0 flex-wrap justify-center">
                    {renderTreeMatchCard(matchB8, 'B8 (3位決定戦)', 'A7の敗者', 'B7の敗者', 'bronze')}
                    {thirdPlaceTeam && (
                      <div className="w-[140px] p-2.5 rounded-2xl bg-amber-500/10 border border-amber-400 text-center shadow-xs">
                        <div className="text-xl mb-0.5">🥉</div>
                        <div className="text-[9px] uppercase tracking-wider font-black text-amber-600 dark:text-amber-400">
                          3RD PLACE
                        </div>
                        <div className="text-xs font-black text-zinc-950 dark:text-zinc-50 truncate" title={thirdPlaceTeam.name}>
                          {thirdPlaceTeam.name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 🎖️ QF敗者順位交流戦（C8・D8）セクション */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-indigo-500/20 text-indigo-600 shrink-0">
                      🎖️
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100">
                          上ブロック QF敗者 順位交流戦（C8・D8 / スロット8）
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                          4試合保証マッチ
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                        準々決勝（A5〜B6）で惜敗した4チームもここで交流戦を実施！午前2試合＋午後2試合＝全チーム4試合達成！
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <span>🎖️</span>
                        <span>C8 (コート3): A5敗者 vs A6敗者</span>
                      </span>
                      {renderTreeMatchCard(matchC8, 'C8 (順位交流戦)', 'A5の敗者', 'A6の敗者', 'teal')}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <span>🎖️</span>
                        <span>D8 (コート4): B5敗者 vs B6敗者</span>
                      </span>
                      {renderTreeMatchCard(matchD8, 'D8 (順位交流戦)', 'B5の敗者', 'B6の敗者', 'teal')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. 🤝 下ブロック（下位交流リーグ：X組・Y組・Z組 各3チーム総当たり） */}
          {(blockFilter === 'all' || blockFilter === 'exchange') && (
            <div className="p-4 sm:p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">🤝</span>
                  <h3 className="font-black text-base text-zinc-950 dark:text-white">
                    下ブロック（下位交流リーグ：X組・Y組・Z組）
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                    3チーム×3グループ 総当たり（計9試合）
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    全9チーム 午後2試合保証 ＝ 合計4試合達成！
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  下位9チーム進出
                </span>
              </div>

              {/* 3グループ横並びグリッド */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* 交流X組 */}
                <div className="space-y-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                  {renderPoolTable('X', '交流X組（Cコート・Court 3）', 'Cコート')}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider block">
                      対戦カード（総当たり3試合）
                    </span>
                    {renderTreeMatchCard(matchC5, 'C5 (第1戦)', 'A組3位', 'C/D/E組 2位(次点1)')}
                    {renderTreeMatchCard(matchC6, 'C6 (第2戦)', 'C/D/E組 2位(次点1)', 'B組4位')}
                    {renderTreeMatchCard(matchC7, 'C7 (第3戦)', 'A組3位', 'B組4位')}
                  </div>
                </div>

                {/* 交流Y組 */}
                <div className="space-y-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                  {renderPoolTable('Y', '交流Y組（Dコート・Court 4）', 'Dコート')}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider block">
                      対戦カード（総当たり3試合）
                    </span>
                    {renderTreeMatchCard(matchD5, 'D5 (第1戦)', 'B組3位', 'C/D/E組 2位(次点2)')}
                    {renderTreeMatchCard(matchD6, 'D6 (第2戦)', 'C/D/E組 2位(次点2)', 'A組4位')}
                    {renderTreeMatchCard(matchD7, 'D7 (第3戦)', 'B組3位', 'A組4位')}
                  </div>
                </div>

                {/* 交流Z組 */}
                <div className="space-y-4 p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                  {renderPoolTable('Z', '交流Z組（Eコート・Court 5）', 'Eコート')}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider block">
                      対戦カード（総当たり3試合）
                    </span>
                    {renderTreeMatchCard(matchE5, 'E5 (第1戦)', 'C組3位', 'D組3位')}
                    {renderTreeMatchCard(matchE6, 'E6 (第2戦)', 'D組3位', 'E組3位')}
                    {renderTreeMatchCard(matchE7, 'E7 (第3戦)', 'C組3位', 'E組3位')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. カード一覧形式表示 */}
      {viewMode === 'cards' && blockFilter !== 'progress' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {/* 上位トーナメント */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="font-black text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>🏆</span>
                  <span>上位トーナメント＆順位戦</span>
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">10試合</span>
              </div>
              <div className="space-y-3">
                {renderTreeMatchCard(matchA5, 'A5 (1回戦)', 'A組2位', 'D組1位')}
                {renderTreeMatchCard(matchB5, 'B5 (1回戦)', 'C組1位', 'B組2位')}
                {renderTreeMatchCard(matchA6, 'A6 (1回戦)', 'B組1位', 'E組1位')}
                {renderTreeMatchCard(matchB6, 'B6 (1回戦)', 'A組1位', 'C/D/E組 2位最上位')}
                {renderTreeMatchCard(matchA7, 'A7 (準決勝)', 'A5勝者', 'A6勝者')}
                {renderTreeMatchCard(matchB7, 'B7 (準決勝)', 'B5勝者', 'B6勝者')}
                {renderTreeMatchCard(matchA8, 'A8 (決勝)', 'A7勝者', 'B7勝者', 'gold')}
                {renderTreeMatchCard(matchB8, 'B8 (3位決定戦)', 'A7敗者', 'B7敗者', 'bronze')}
                {renderTreeMatchCard(matchC8, 'C8 (順位交流戦①)', 'A5敗者', 'A6敗者', 'teal')}
                {renderTreeMatchCard(matchD8, 'D8 (順位交流戦②)', 'B5敗者', 'B6敗者', 'teal')}
              </div>
            </div>

            {/* 交流X組 */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="font-black text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>🤝</span>
                  <span>交流X組（Cコート）</span>
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">3試合</span>
              </div>
              {renderPoolTable('X', '交流X組', 'Cコート')}
              <div className="space-y-3 pt-2">
                {renderTreeMatchCard(matchC5, 'C5 (第1戦)', 'A組3位', '次点1')}
                {renderTreeMatchCard(matchC6, 'C6 (第2戦)', '次点1', 'B組4位')}
                {renderTreeMatchCard(matchC7, 'C7 (第3戦)', 'A組3位', 'B組4位')}
              </div>
            </div>

            {/* 交流Y組 */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="font-black text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>🤝</span>
                  <span>交流Y組（Dコート）</span>
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">3試合</span>
              </div>
              {renderPoolTable('Y', '交流Y組', 'Dコート')}
              <div className="space-y-3 pt-2">
                {renderTreeMatchCard(matchD5, 'D5 (第1戦)', 'B組3位', '次点2')}
                {renderTreeMatchCard(matchD6, 'D6 (第2戦)', '次点2', 'A組4位')}
                {renderTreeMatchCard(matchD7, 'D7 (第3戦)', 'B組3位', 'A組4位')}
              </div>
            </div>

            {/* 交流Z組 */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h4 className="font-black text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>🤝</span>
                  <span>交流Z組（Eコート）</span>
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">3試合</span>
              </div>
              {renderPoolTable('Z', '交流Z組', 'Eコート')}
              <div className="space-y-3 pt-2">
                {renderTreeMatchCard(matchE5, 'E5 (第1戦)', 'C組3位', 'D組3位')}
                {renderTreeMatchCard(matchE6, 'E6 (第2戦)', 'D組3位', 'E組3位')}
                {renderTreeMatchCard(matchE7, 'E7 (第3戦)', 'C組3位', 'E組3位')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
