import React, { useState } from 'react';
import { getCourtLetter, getCourtName } from '../logic/court';
import { Match, Settings, Team } from '../types';

interface CourtScheduleViewProps {
  matches: Match[];
  teams: Team[];
  settings: Settings;
  adminMode?: boolean;
  onOpenScoreModal?: (match: Match) => void;
  onOpenManualEditModal?: (match: Match) => void;
}

export const CourtScheduleView: React.FC<CourtScheduleViewProps> = ({
  matches,
  teams,
  settings,
  adminMode = false,
  onOpenScoreModal,
  onOpenManualEditModal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'league' | 'tournament'>('all');
  const [viewMode, setViewMode] = useState<'slots' | 'courts'>('slots');

  const courtCount = settings.courtCount || 4;
  const activeCourtNumbers = Array.from({ length: Math.min(8, Math.max(1, courtCount)) }, (_, i) => i + 1);

  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

  // フィルタ
  const filteredMatches = matches.filter((m) => {
    if (filterType === 'league') return m.round === 'league';
    if (filterType === 'tournament') return m.round !== 'league';
    return true;
  });

  // スロットごとにグループ化（未設定や重複を安全に補正）
  const slotsMap = new Map<number, Match[]>();
  // まずスロットが既に指定されている試合
  filteredMatches.forEach((m) => {
    const slotNum = typeof m.slot === 'number' && m.slot >= 1 ? m.slot : 1;
    if (!slotsMap.has(slotNum)) {
      slotsMap.set(slotNum, []);
    }
    slotsMap.get(slotNum)!.push(m);
  });

  const sortedSlots = Array.from(slotsMap.keys()).sort((a, b) => a - b);

  // コートごとにグループ化
  const courtsMap = new Map<number, Match[]>();
  for (const c of activeCourtNumbers) {
    courtsMap.set(c, []);
  }
  for (const m of filteredMatches) {
    const c = m.court || 1;
    if (courtsMap.has(c)) {
      courtsMap.get(c)!.push(m);
    }
  }

  // スロットごとの進行状況
  const getSlotStatus = (slotMatches: Match[]) => {
    const completedCount = slotMatches.filter((m) => m.status === 'completed').length;
    if (completedCount === slotMatches.length && slotMatches.length > 0) {
      return { text: '全コート終了', color: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700' };
    }
    if (completedCount > 0) {
      return { text: '一部進行中', color: 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800' };
    }
    return { text: '待機中', color: 'bg-blue-100 dark:bg-blue-950/80 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800' };
  };

  return (
    <div className="space-y-6">
      {/* 進行コントロール＆サマリーバー */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-black text-base text-zinc-950 dark:text-white">
                コート別 同時進行スケジュール
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                {courtCount}面同時稼働
              </span>
              {settings.avoidConsecutiveMatches !== false && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <span>🛡️</span>
                  <span>連戦回避（連続試合なし）</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-650 dark:text-zinc-300 mt-1 font-medium">
              各進行枠（第1試合、第2試合…）ごとに、A〜{String.fromCharCode(64 + courtCount)}コートで同時に試合を実施します。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 表示モード切替 */}
            <div className="inline-flex rounded-xl bg-zinc-200 dark:bg-zinc-800 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('slots')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'slots'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                }`}
              >
                進行枠別（第1試合・第2試合…）
              </button>
              <button
                type="button"
                onClick={() => setViewMode('courts')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'courts'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                }`}
              >
                コート別一覧
              </button>
            </div>

            {/* ラウンドフィルタ */}
            <div className="inline-flex rounded-xl bg-zinc-200 dark:bg-zinc-800 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setFilterType('league')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'league'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                }`}
              >
                予選リーグ
              </button>
              <button
                type="button"
                onClick={() => setFilterType('tournament')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  filterType === 'tournament'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950'
                }`}
              >
                決勝トーナメント
              </button>
            </div>
          </div>
        </div>

        {/* 稼働コートバッジ */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex-wrap">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">稼働コート:</span>
          {activeCourtNumbers.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-black text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              {getCourtName(c)}
            </span>
          ))}
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-bold ml-auto">
            全{filteredMatches.length}試合 / 全{sortedSlots.length}枠進行
          </span>
        </div>
      </div>

      {/* スロット別（同時進行）表示 */}
      {viewMode === 'slots' && (
        <div className="space-y-5">
          {sortedSlots.map((slotNum) => {
            const slotMatches = slotsMap.get(slotNum) || [];
            const slotStatus = getSlotStatus(slotMatches);

            return (
              <div
                key={slotNum}
                className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-xs space-y-4"
              >
                {/* スロットヘッダー */}
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                      {slotNum}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-zinc-950 dark:text-white">
                          第{slotNum}試合（各コート同時進行）
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${slotStatus.color}`}>
                          {slotStatus.text}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-650 dark:text-zinc-350 mt-0.5 font-medium">
                        {slotMatches.length}コートで並行して試合を実施
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                    Match #{slotNum}
                  </span>
                </div>

                {/* 各コートでの試合カード（グリッド） */}
                <div className={`grid grid-cols-1 ${
                  courtCount === 1 ? 'sm:grid-cols-1' :
                  courtCount === 2 ? 'sm:grid-cols-2' :
                  courtCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
                } gap-3`}>
                  {activeCourtNumbers.map((c) => {
                    const match = slotMatches.find((m) => (m.court || 1) === c);

                    if (!match) {
                      return (
                        <div
                          key={c}
                          className="p-3.5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center text-center min-h-[140px] text-zinc-600 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-850/50"
                        >
                          <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                            {getCourtName(c)}
                          </span>
                          <span className="text-[11px] font-medium">この時間帯は試合なし（空きコート）</span>
                        </div>
                      );
                    }

                    const t1 = match.team1Id ? teamMap.get(match.team1Id) : null;
                    const t2 = match.team2Id ? teamMap.get(match.team2Id) : null;
                    const isCompleted = match.status === 'completed';

                    return (
                      <div
                        key={match.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCompleted
                            ? 'bg-zinc-50 dark:bg-zinc-850/60 border-zinc-300 dark:border-zinc-700'
                            : 'bg-white dark:bg-zinc-900 border-indigo-300 dark:border-indigo-700 shadow-xs'
                        } flex flex-col justify-between space-y-3`}
                      >
                        {/* コートラベル & 試合番号 */}
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-750 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            {getCourtName(match.court)}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                            <span>#{match.matchNumber}</span>
                            <span>{match.roundName}</span>
                          </div>
                        </div>

                        {/* チーム対戦 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              title={t1 ? t1.name : '未定'}
                              className={`text-xs font-bold break-words leading-tight flex-1 ${
                                match.winnerId === match.team1Id && isCompleted
                                  ? 'text-indigo-700 dark:text-indigo-300 font-black'
                                  : 'text-zinc-950 dark:text-white'
                              }`}
                            >
                              {t1 ? t1.name : '未定'}
                            </span>
                            <span className="font-mono font-black text-sm text-zinc-950 dark:text-white shrink-0 pl-1">
                              {isCompleted ? match.team1Sets : '-'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              title={t2 ? t2.name : '未定'}
                              className={`text-xs font-bold break-words leading-tight flex-1 ${
                                match.winnerId === match.team2Id && isCompleted
                                  ? 'text-amber-700 dark:text-amber-300 font-black'
                                  : 'text-zinc-950 dark:text-white'
                              }`}
                            >
                              {t2 ? t2.name : '未定'}
                            </span>
                            <span className="font-mono font-black text-sm text-zinc-950 dark:text-white shrink-0 pl-1">
                              {isCompleted ? match.team2Sets : '-'}
                            </span>
                          </div>
                        </div>

                        {/* 各セットスコア（完了時） */}
                        {isCompleted && match.sets && match.sets.some((s) => s.team1 !== null) && (
                          <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-800 dark:text-zinc-200 flex-wrap">
                            {match.sets
                              .filter((s) => s.team1 !== null && s.team2 !== null)
                              .map((s, idx) => (
                                <span key={idx} className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-sm border border-zinc-300 dark:border-zinc-700">
                                  {s.team1}-{s.team2}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* 得点板情報 */}
                        {match.referee && (
                          <div className="text-[11px] text-zinc-700 dark:text-zinc-300 flex items-start justify-between gap-1 border-t border-zinc-200 dark:border-zinc-800 pt-1.5 font-medium">
                            <div className="flex items-start gap-1 flex-1">
                              <span className="font-bold shrink-0">得点板:</span>
                              <span className="font-black text-zinc-950 dark:text-white break-words leading-tight" title={match.referee}>
                                {match.referee}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 管理者用操作ボタン */}
                        {adminMode && (
                          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5">
                            {onOpenScoreModal && (
                              <button
                                type="button"
                                onClick={() => onOpenScoreModal(match)}
                                className="flex-1 py-1 px-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 text-[11px] font-black text-center transition-colors cursor-pointer"
                              >
                                {isCompleted ? 'スコア修正' : 'スコア入力'}
                              </button>
                            )}
                            {onOpenManualEditModal && (
                              <button
                                type="button"
                                onClick={() => onOpenManualEditModal(match)}
                                title="緊急手動修正"
                                className="py-1 px-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                🛠️
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* コート別一覧表示 */}
      {viewMode === 'courts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeCourtNumbers.map((courtNum) => {
            const courtMatches = courtsMap.get(courtNum) || [];
            return (
              <div
                key={courtNum}
                className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-indigo-600" />
                    <h4 className="font-black text-base text-zinc-950 dark:text-white">
                      {getCourtName(courtNum)}
                    </h4>
                  </div>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                    計{courtMatches.length}試合
                  </span>
                </div>

                <div className="space-y-2.5">
                  {courtMatches.map((m) => {
                    const t1 = m.team1Id ? teamMap.get(m.team1Id) : null;
                    const t2 = m.team2Id ? teamMap.get(m.team2Id) : null;
                    const isCompleted = m.status === 'completed';

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-300 dark:border-zinc-700 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center justify-center shrink-0">
                            {m.slot || '-'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-zinc-950 dark:text-white break-words leading-tight" title={`${t1 ? t1.name : '未定'} vs ${t2 ? t2.name : '未定'}`}>
                              <span>{t1 ? t1.name : '未定'}</span>
                              <span className="text-zinc-400 font-normal mx-1">vs</span>
                              <span>{t2 ? t2.name : '未定'}</span>
                            </div>
                            <div className="text-[10px] text-zinc-700 dark:text-zinc-300 font-medium break-words mt-0.5">
                              第{m.slot || 1}試合 · {m.roundName} {m.referee ? `· 得点板: ${m.referee}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-mono font-black text-xs">
                              {m.team1Sets} - {m.team2Sets}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                              待機中
                            </span>
                          )}

                          {adminMode && onOpenScoreModal && (
                            <button
                              type="button"
                              onClick={() => onOpenScoreModal(m)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors cursor-pointer"
                            >
                              入力
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
