import React from 'react';
import { getCourtName } from '../logic/court';
import { Match, Standing, Team } from '../types';

interface MyTeamScheduleProps {
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
  onOpenScoreModal?: (match: Match) => void;
}

export const MyTeamSchedule: React.FC<MyTeamScheduleProps> = ({
  teams,
  matches,
  standings,
  selectedTeamId,
  onSelectTeam,
  onOpenScoreModal,
}) => {
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const teamMap = React.useMemo(() => new Map<string, Team>(teams.map((t) => [t.id, t])), [teams]);

  // コートごとの全試合を進行順にマッピング（コート内の第何試合目かを正確に算出）
  const courtMatchesMap = React.useMemo(() => {
    const map = new Map<number, Match[]>();
    matches.forEach((m) => {
      const court = m.court || 1;
      if (!map.has(court)) map.set(court, []);
      map.get(court)!.push(m);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        const slotA = a.slot || 999;
        const slotB = b.slot || 999;
        if (slotA !== slotB) return slotA - slotB;
        return a.matchNumber - b.matchNumber;
      });
    });
    return map;
  }, [matches]);

  // 各試合が「そのコートで第何試合目なのか」を取得
  const getCourtOrderInfo = React.useCallback((match: Match) => {
    const court = match.court || 1;
    const list = courtMatchesMap.get(court) || [];
    const index = list.findIndex((m) => m.id === match.id);
    const order = index !== -1 ? index + 1 : (match.slot || 1);
    
    // そのコートで現在進行中または直近の試合インデックス
    const currentIdx = list.findIndex((m) => m.status === 'in_progress');
    const firstPendingIdx = list.findIndex((m) => m.status === 'pending');
    const activeCourtIdx = currentIdx !== -1 ? currentIdx : (firstPendingIdx !== -1 ? firstPendingIdx : list.length);
    const matchesUntilThis = index !== -1 ? index - activeCourtIdx : 0;

    return {
      courtOrder: order,
      totalInCourt: list.length,
      isCurrentlyPlayingOnCourt: currentIdx === index && currentIdx !== -1,
      isNextOnCourt: activeCourtIdx === index,
      matchesUntilThis: Math.max(0, matchesUntilThis),
    };
  }, [courtMatchesMap]);

  // 自チームが審判・得点板を担当しているか判定（「チーム名 (A5敗者)」などのサフィックス表記も包含）
  const isTeamRef = React.useCallback((m: Match | null | undefined, team: Team | null): boolean => {
    if (!m || !m.referee || !team) return false;
    return m.referee === team.name || m.referee.startsWith(team.name);
  }, []);

  // 自チームに関連する試合（対戦チーム、または審判担当）
  const relevantMatches = React.useMemo(() => {
    if (!selectedTeam) return [];
    return matches.filter((m) => {
      const isPlayer = m.team1Id === selectedTeam.id || m.team2Id === selectedTeam.id;
      const isRef = isTeamRef(m, selectedTeam);
      return isPlayer || isRef;
    }).sort((a, b) => {
      const slotA = a.slot || 999;
      const slotB = b.slot || 999;
      if (slotA !== slotB) return slotA - slotB;
      if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
      return a.matchNumber - b.matchNumber;
    });
  }, [selectedTeam, matches, isTeamRef]);

  // 自チームの「試合のみ」のカウント用インデックス
  const teamMatchIndexMap = React.useMemo(() => {
    if (!selectedTeam) return new Map<string, number>();
    const map = new Map<string, number>();
    let matchCount = 0;
    relevantMatches.forEach((m) => {
      const isPlayer = m.team1Id === selectedTeam.id || m.team2Id === selectedTeam.id;
      if (isPlayer) {
        matchCount++;
        map.set(m.id, matchCount);
      }
    });
    return map;
  }, [selectedTeam, relevantMatches]);

  // 自チームの「審判のみ」のカウント用インデックス
  const teamRefIndexMap = React.useMemo(() => {
    if (!selectedTeam) return new Map<string, number>();
    const map = new Map<string, number>();
    let refCount = 0;
    relevantMatches.forEach((m) => {
      const isRef = isTeamRef(m, selectedTeam) && m.team1Id !== selectedTeam.id && m.team2Id !== selectedTeam.id;
      if (isRef) {
        refCount++;
        map.set(m.id, refCount);
      }
    });
    return map;
  }, [selectedTeam, relevantMatches, isTeamRef]);

  // 次の予定（未完了の中で最も早い予定）
  const nextUp = React.useMemo(() => {
    return relevantMatches.find((m) => m.status !== 'completed');
  }, [relevantMatches]);

  const nextUpCourtInfo = React.useMemo(() => {
    if (!nextUp) return null;
    return getCourtOrderInfo(nextUp);
  }, [nextUp, getCourtOrderInfo]);

  // 自チームの順位情報
  const teamStanding = React.useMemo(() => {
    if (!selectedTeam) return null;
    return standings.find((s) => s.teamId === selectedTeam.id);
  }, [selectedTeam, standings]);

  return (
    <div className="rounded-3xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-white dark:from-indigo-950/40 dark:via-zinc-900 dark:to-zinc-900 p-4 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100">
              マイチーム検索・試合進行スケジュール
            </h3>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
              参加者・応援用
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            ご自身のチームを選ぶと、<strong>「何コートの第何試合目か」</strong>や<strong>「次の対戦・審判の順番」</strong>が一目で分かります。
          </p>
        </div>

        {/* チーム選択セレクト */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTeamId || ''}
            onChange={(e) => onSelectTeam(e.target.value || null)}
            className="w-full sm:w-60 px-3.5 py-2.5 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-800 text-xs font-black text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
          >
            <option value="">▼ ご自身のチームを選択...</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (グループ {t.pool || '未定'})
              </option>
            ))}
          </select>
          {selectedTeamId && (
            <button
              type="button"
              onClick={() => onSelectTeam(null)}
              className="px-3 py-2.5 text-xs font-bold rounded-2xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap cursor-pointer"
              title="選択解除"
            >
              解除
            </button>
          )}
        </div>
      </div>

      {/* チーム未選択時のクイック選択チップ */}
      {!selectedTeam && (
        <div className="pt-3 border-t border-indigo-100/80 dark:border-indigo-950/60">
          <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">
            チームをタップしてスケジュールを表示:
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTeam(t.id)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all shadow-2xs cursor-pointer"
              >
                <span>🏐 {t.name}</span>
                <span className="ml-1 text-[10px] opacity-70">({t.pool || '-'}組)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* チーム選択時のステータス＆スケジュール表示 */}
      {selectedTeam && (
        <div className="space-y-5 pt-2 border-t border-indigo-100/80 dark:border-indigo-950/60">
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. チーム基本情報 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 shadow-xs">
              <div className="text-[11px] font-bold text-zinc-500">選択中のマイチーム</div>
              <div className="font-black text-base text-zinc-950 dark:text-zinc-50 break-words leading-tight mt-1" title={selectedTeam.name}>
                {selectedTeam.name}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                  グループ {selectedTeam.pool || '-'}
                </span>
                <span className="text-[11px] text-zinc-500 font-medium">
                  全 {relevantMatches.length} スケジュール
                </span>
              </div>
            </div>

            {/* 2. 予選戦績 */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 shadow-xs">
              <div className="text-[11px] font-bold text-zinc-500">予選リーグ戦績</div>
              {teamStanding ? (
                <div className="mt-1">
                  <div className="text-base font-black text-zinc-900 dark:text-zinc-100">
                    {teamStanding.win}勝 {teamStanding.loss}敗{' '}
                    <span className="text-xs font-semibold text-zinc-500">
                      (得失点差 {teamStanding.pointDiff > 0 ? `+${teamStanding.pointDiff}` : teamStanding.pointDiff})
                    </span>
                  </div>
                  <div className="text-xs mt-1.5 flex items-center gap-2">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      グループ内 {teamStanding.rank}位
                    </span>
                    {teamStanding.rank <= 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        決勝T進出圏内
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 mt-2 font-medium">試合データなし</div>
              )}
            </div>

            {/* 3. 次の予定（何コートの第何試合かが一目でわかる特別表示） */}
            <div
              className={`p-4 rounded-2xl border-2 shadow-xs transition-all ${
                nextUp
                  ? isTeamRef(nextUp, selectedTeam) && nextUp.team1Id !== selectedTeam.id && nextUp.team2Id !== selectedTeam.id
                    ? 'bg-amber-500/10 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100'
                    : 'bg-indigo-500/10 border-indigo-500 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100'
                  : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-500'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  {nextUp ? (
                    isTeamRef(nextUp, selectedTeam) && nextUp.team1Id !== selectedTeam.id && nextUp.team2Id !== selectedTeam.id ? (
                      <>
                        <span className="text-amber-600 dark:text-amber-400 text-sm">📋</span>
                        <span className="text-amber-800 dark:text-amber-300">次は自チームの得点板担当</span>
                      </>
                    ) : (
                      <>
                        <span className="text-indigo-600 dark:text-indigo-400 text-sm">⚡</span>
                        <span className="text-indigo-800 dark:text-indigo-300">次の試合予定</span>
                      </>
                    )
                  ) : (
                    '🎉 全試合終了'
                  )}
                </span>
                {nextUpCourtInfo && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-white dark:bg-zinc-800 border border-current">
                    {nextUp.status === 'in_progress' ? '進行中！' : '次戦'}
                  </span>
                )}
              </div>

              {nextUp && nextUpCourtInfo ? (
                <div className="mt-2">
                  <div className="text-sm sm:text-base font-black flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-black">
                      {getCourtName(nextUp.court)} 第{nextUpCourtInfo.courtOrder}試合
                    </span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      {isTeamRef(nextUp, selectedTeam) && nextUp.team1Id !== selectedTeam.id && nextUp.team2Id !== selectedTeam.id
                        ? '（得点板対応）'
                        : `（自チーム 第${teamMatchIndexMap.get(nextUp.id) || 1}戦）`}
                    </span>
                  </div>
                  <div className="text-xs font-bold mt-1.5 break-words leading-tight">
                    {isTeamRef(nextUp, selectedTeam) && nextUp.team1Id !== selectedTeam.id && nextUp.team2Id !== selectedTeam.id
                      ? `担当試合: ${teamMap.get(nextUp.team1Id || '')?.name || 'TBD'} vs ${teamMap.get(nextUp.team2Id || '')?.name || 'TBD'}`
                      : `対戦相手: vs ${
                          nextUp.team1Id === selectedTeam.id
                            ? teamMap.get(nextUp.team2Id || '')?.name || '未定'
                            : teamMap.get(nextUp.team1Id || '')?.name || '未定'
                        }`}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-400 mt-2 font-medium">予定されている全試合が完了しました</div>
              )}
            </div>
          </div>

          {/* スケジュールタイムライン（何試合目かが一目でわかるカード一覧） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📅</span>
                <span>{selectedTeam.name} の進行タイムライン（全{relevantMatches.length}件）</span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                上から順に時系列で進行します
              </span>
            </div>

            <div className="space-y-3">
              {relevantMatches.map((m, idx) => {
                const isPlaying = m.team1Id === selectedTeam.id || m.team2Id === selectedTeam.id;
                const isRefereeOnly = isTeamRef(m, selectedTeam) && !isPlaying;
                const opponentId = m.team1Id === selectedTeam.id ? m.team2Id : m.team1Id;
                const opponent = opponentId ? teamMap.get(opponentId) : null;
                const isDone = m.status === 'completed';
                const isWinner = isDone && m.winnerId === selectedTeam.id;
                const isLoser = isDone && isPlaying && m.winnerId && m.winnerId !== selectedTeam.id;
                const isInProgress = m.status === 'in_progress';
                const isNext = nextUp?.id === m.id;

                const courtInfo = getCourtOrderInfo(m);
                const teamMatchNum = teamMatchIndexMap.get(m.id);
                const teamRefNum = teamRefIndexMap.get(m.id);

                return (
                  <div
                    key={m.id}
                    onClick={() => onOpenScoreModal && onOpenScoreModal(m)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      onOpenScoreModal ? 'cursor-pointer hover:shadow-md' : ''
                    } ${
                      isInProgress
                        ? 'bg-red-500/10 border-red-500 shadow-md ring-2 ring-red-400/50'
                        : isNext
                        ? 'bg-indigo-500/10 border-indigo-500 shadow-md ring-2 ring-indigo-400/40'
                        : isRefereeOnly
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                        : isWinner
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : isLoser
                        ? 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 opacity-80'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {/* カード最上部：試合順の特大ハイライト */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 自チームにとってのステップ番号 */}
                        <span className="w-6 h-6 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </span>

                        {/* コート名 ＆ そのコートでの第何試合目か（超明瞭表示） */}
                        <span className="font-black px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm shadow-2xs">
                          {getCourtName(m.court)} 【第{courtInfo.courtOrder}試合目】
                        </span>

                        {/* 自チームにとって何試合目か */}
                        <span className={`font-bold px-2.5 py-1 rounded-xl text-xs ${
                          isRefereeOnly
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                            : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                        }`}>
                          {isRefereeOnly ? `📋 得点板担当 (${teamRefNum}回目)` : `🏐 自チーム第${teamMatchNum}戦`}
                        </span>

                        {m.slot && (
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
                            (全体 第{m.slot}枠)
                          </span>
                        )}
                      </div>

                      {/* 進行状況ステータスバッジ */}
                      <div className="flex items-center gap-2">
                        {isInProgress ? (
                          <span className="px-3 py-1 rounded-full font-black bg-red-600 text-white text-xs animate-pulse flex items-center gap-1.5 shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span>🔴 現在進行中！</span>
                          </span>
                        ) : isNext ? (
                          <span className="px-3 py-1 rounded-full font-black bg-indigo-600 text-white text-xs shadow-xs flex items-center gap-1">
                            <span>⚡ NEXT！次です</span>
                          </span>
                        ) : isDone ? (
                          isRefereeOnly ? (
                            <span className="px-2.5 py-0.5 rounded-full font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">
                              ✅ 完了
                            </span>
                          ) : isWinner ? (
                            <span className="px-2.5 py-0.5 rounded-full font-black bg-emerald-600 text-white text-xs shadow-2xs">
                              🏆 勝利
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs">
                              終了
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs border border-zinc-200 dark:border-zinc-700">
                            {courtInfo.matchesUntilThis > 0 ? `⏳ あと${courtInfo.matchesUntilThis}試合後` : '⏳ 準備中'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* カード本文 */}
                    <div className="pt-2.5">
                      <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                        <span>{m.roundName}</span>
                        {m.pool && <span>グループ {m.pool}</span>}
                      </div>

                      {isRefereeOnly ? (
                        <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                              得点板担当
                            </div>
                            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 mt-0.5 break-words leading-tight">
                              {teamMap.get(m.team1Id || '')?.name || 'TBD'} vs {teamMap.get(m.team2Id || '')?.name || 'TBD'}
                            </div>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 shrink-0">
                            得点板
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-2xl shrink-0">🏐</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-zinc-500">対戦チーム</div>
                              <div className="text-base font-black text-zinc-950 dark:text-zinc-50 break-words leading-tight">
                                vs {opponent?.name || '未定'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            {isDone ? (
                              <div className="text-right">
                                <div className="text-[11px] font-bold text-zinc-500">試合結果</div>
                                <div className="text-base font-mono font-black text-zinc-900 dark:text-zinc-100">
                                  {m.team1Sets} - {m.team2Sets}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-zinc-500">
                                得点板: {m.referee ? m.referee : '本部'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

