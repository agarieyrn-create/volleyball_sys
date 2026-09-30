import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefereeBalanceModal } from '../components/RefereeBalanceModal';
import { RulesModal } from '../components/RulesModal';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { getActiveCourts, getCourtName } from '../logic/court';
import { useTheme } from '../state/ThemeContext';
import { useTournament } from '../state/TournamentContext';
import { Match, SetScore } from '../types';

export const RefereeScoreboardPage: React.FC = () => {
  const { state, dispatch } = useTournament();
  const { matches, teams, settings } = state;
  const { theme } = useTheme();

  const [selectedCourt, setSelectedCourt] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0); // 0 = set1, 1 = set2, 2 = set3
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const activeCourts = useMemo(() => {
    return getActiveCourts(settings.courtCount || 4);
  }, [settings.courtCount]);

  const effectiveCourt = activeCourts.includes(selectedCourt) ? selectedCourt : activeCourts[0] || 1;

  // 現在のコートの試合一覧
  const courtMatches = useMemo(() => {
    return matches.filter((m) => (m.court || 1) === effectiveCourt).sort((a, b) => {
      if (a.slot && b.slot && a.slot !== b.slot) return a.slot - b.slot;
      if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
      return a.matchNumber - b.matchNumber;
    });
  }, [matches, effectiveCourt]);

  // 現在選択中の試合（未選択ならコート内の最初の未完了試合、または最初の試合）
  const activeMatch = useMemo(() => {
    if (selectedMatchId) {
      const found = matches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    const ongoing = courtMatches.find((m) => m.status === 'in_progress');
    if (ongoing) return ongoing;
    const nextUnplayed = courtMatches.find((m) => m.status === 'scheduled');
    if (nextUnplayed) return nextUnplayed;
    return courtMatches[0] || null;
  }, [matches, selectedMatchId, courtMatches]);

  const t1Name = activeMatch?.team1Id ? teamMap.get(activeMatch.team1Id)?.name || 'チーム1' : '未定';
  const t2Name = activeMatch?.team2Id ? teamMap.get(activeMatch.team2Id)?.name || 'チーム2' : '未定';

  // 現在のセットスコア取得または初期化
  const currentSets: SetScore[] = useMemo(() => {
    if (!activeMatch) return [];
    if (activeMatch.sets && activeMatch.sets.length > 0) {
      return activeMatch.sets;
    }
    return [
      { team1: 0, team2: 0 },
      { team1: 0, team2: 0 },
      { team1: 0, team2: 0 },
    ];
  }, [activeMatch]);

  const [history, setHistory] = useState<
    Array<{ sets: SetScore[]; setIdx: number; desc: string }>
  >([]);
  const [isCourtSwapped, setIsCourtSwapped] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  const targetSet: SetScore = currentSets[activeSetIndex] || {
    team1: 0,
    team2: 0,
  };

  const setLimit = activeSetIndex === 2 ? settings.set3Points || 10 : settings.set12Points || 15;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // 得点変更処理（Undo履歴を保持）
  const updateScore = (team: 'team1' | 'team2', delta: number) => {
    if (!activeMatch) return;

    const updatedSets: SetScore[] = [...currentSets];
    while (updatedSets.length <= activeSetIndex) {
      updatedSets.push({
        team1: 0,
        team2: 0,
      });
    }

    // 履歴に現在の状態をプッシュ（最大15件）
    setHistory((prev) => [
      ...prev.slice(-15),
      {
        sets: JSON.parse(JSON.stringify(currentSets)),
        setIdx: activeSetIndex,
        desc: `${team === 'team1' ? t1Name : t2Name} ${delta > 0 ? '+' : ''}${delta}点`,
      },
    ]);

    const currentScore = updatedSets[activeSetIndex][team] || 0;
    const newScore = Math.max(0, currentScore + delta);

    updatedSets[activeSetIndex] = {
      ...updatedSets[activeSetIndex],
      [team]: newScore,
    };

    dispatch({
      type: 'SAVE_SCORE',
      payload: {
        matchId: activeMatch.id,
        sets: updatedSets,
      },
    });

    if (delta > 0) {
      // 触覚フィードバック（スマホバイブレーション）
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }
  };

  // 直前の操作を取り消す (Undo)
  const undoLastAction = () => {
    if (history.length === 0 || !activeMatch) return;
    const last = history[history.length - 1];
    dispatch({
      type: 'SAVE_SCORE',
      payload: {
        matchId: activeMatch.id,
        sets: last.sets,
      },
    });
    setActiveSetIndex(last.setIdx);
    setHistory((prev) => prev.slice(0, -1));
    showToast(`↩ 操作を取り消しました (${last.desc})`);
  };

  // セットリセット（確認ダイアログを開く）
  const resetCurrentSet = () => {
    if (!activeMatch) return;
    setIsResetConfirmOpen(true);
  };

  // セットリセットの確定実行
  const executeResetSet = () => {
    if (!activeMatch) return;
    const updatedSets: SetScore[] = [...currentSets];
    if (updatedSets[activeSetIndex]) {
      setHistory((prev) => [
        ...prev.slice(-15),
        {
          sets: JSON.parse(JSON.stringify(currentSets)),
          setIdx: activeSetIndex,
          desc: `第${activeSetIndex + 1}セットリセット`,
        },
      ]);
      updatedSets[activeSetIndex] = {
        team1: 0,
        team2: 0,
      };
      dispatch({
        type: 'SAVE_SCORE',
        payload: {
          matchId: activeMatch.id,
          sets: updatedSets,
        },
      });
      showToast(`第${activeSetIndex + 1}セットのスコアを0-0にリセットしました`);
    }
  };

  return (
    <div
      className={`min-h-screen ${theme.classes.pageBg} flex flex-col select-none font-sans transition-colors duration-200`}
    >
      {/* 画面トップ ナビゲーションバー */}
      <header
        className={`px-3 sm:px-6 py-2.5 ${theme.classes.headerBg} border-b ${theme.classes.headerBorder} flex items-center justify-between gap-2 shrink-0`}
      >
        <div className="flex items-center gap-2">
          <Link
            to="/admin"
            className="p-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs whitespace-nowrap"
            title="運営管理画面に戻る"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">管理画面</span>
          </Link>
          <Link
            to="/"
            className="p-1.5 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 text-xs font-bold"
            title="ホームに戻る"
          >
            ← ホーム
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-xl">📱</span>
            <div>
              <h1 className="text-xs sm:text-sm font-bold flex items-center gap-1">
                <span>審判・得点板モード</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-mono font-normal">
                  LIVE SCORER
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* クラウド同期ステータス */}
          <SyncStatusBadge />

          {/* テーマ切り替え */}
          {/* 1手戻す (Undo) ボタン */}
          <button
            type="button"
            onClick={undoLastAction}
            disabled={history.length === 0}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-1 border border-amber-500/30 active:scale-95 transition-all cursor-pointer min-h-[38px]"
            title="直前の得点操作を取り消す"
          >
            <span>↩</span>
            <span className="font-bold">取消</span>
            {history.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center ml-0.5">
                {history.length}
              </span>
            )}
          </button>

          {/* テーマセレクター */}
          <ThemeSelector variant="compact" />

          <button
            type="button"
            onClick={() => setIsBalanceModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer min-h-[38px] hover:bg-amber-500/30 transition-colors"
            title="各チームの得点板担当回数・割当バランス確認"
          >
            <span>⚖️</span>
            <span className="hidden sm:inline">担当一覧</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-400 text-xs font-bold flex items-center gap-1 cursor-pointer min-h-[38px]"
          >
            <span>📋</span>
            <span className="hidden sm:inline">特別ルール</span>
          </button>
          <Link
            to="/monitor"
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 text-xs font-bold flex items-center gap-1 min-h-[38px]"
          >
            <span>📺</span>
            <span className="hidden sm:inline">大画面</span>
          </Link>
        </div>
      </header>

      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xl animate-fade-in pointer-events-none">
          ✓ {toastMsg}
        </div>
      )}

      {/* コート切り替えタブ（スマホ横スクロール最適化） */}
      <div
        className={`border-b ${theme.classes.cardBorder} px-2 sm:px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0 bg-black/5 dark:bg-black/20 no-scrollbar`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs opacity-75 font-bold mr-0.5 shrink-0">コート:</span>
          {activeCourts.map((courtNum) => (
            <button
              key={courtNum}
              type="button"
              onClick={() => {
                setSelectedCourt(courtNum);
                setSelectedMatchId('');
              }}
              className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[42px] cursor-pointer active:scale-95 ${
                effectiveCourt === courtNum
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold ring-2 ring-amber-400/50'
                  : 'bg-black/10 dark:bg-white/10 opacity-75 hover:opacity-100'
              }`}
            >
              {getCourtName(courtNum)}
            </button>
          ))}
        </div>

        {/* 対象試合セレクター */}
        {courtMatches.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-zinc-400 hidden sm:inline">試合:</span>
            <select
              value={activeMatch?.id || ''}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 text-xs sm:text-sm font-bold max-w-[240px] truncate min-h-[42px]"
            >
              {courtMatches.map((m) => {
                const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name || '未定' : '未定';
                const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name || '未定' : '未定';
                const slotPrefix = m.slot ? `[第${m.slot}試合] ` : '';
                return (
                  <option key={m.id} value={m.id}>
                    {slotPrefix}#{m.matchNumber} ({m.roundName}): {t1} vs {t2}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* メイン得点板エリア */}
      {activeMatch ? (
        <div className="flex-1 flex flex-col p-2 sm:p-4 max-w-5xl mx-auto w-full justify-between gap-3">
          {/* 試合ヘッダー情報 */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/80 rounded-xl px-3 sm:px-4 py-2 border border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <div>
                <span className="text-xs font-bold text-amber-400 font-mono mr-2">
                  第{activeMatch.matchNumber}試合
                </span>
                <span className="text-xs text-zinc-400">{activeMatch.roundName}</span>
                {activeMatch.referee && (
                  <span className="ml-2 text-xs text-indigo-400">
                    (主審: {activeMatch.referee})
                  </span>
                )}
              </div>
              {/* コートチェンジ（左右反転）トグルボタン */}
              <button
                type="button"
                onClick={() => {
                  setIsCourtSwapped((prev) => !prev);
                  showToast(!isCourtSwapped ? '🔄 コートチェンジ（左右反転）しました' : 'コート表示を通常に戻しました');
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                  isCourtSwapped
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-zinc-200 border-white/10'
                }`}
                title="コートチェンジ時に得点板の左右表示を反転させます"
              >
                <span>🔄</span>
                <span>{isCourtSwapped ? '左右反転中' : 'コート交代'}</span>
              </button>
            </div>

            {/* セット切り替えボタン（スマホタップ対応） */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[0, 1, 2].map((idx) => {
                const s = currentSets[idx];
                const hasScore = s && ((s.team1 ?? 0) > 0 || (s.team2 ?? 0) > 0);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSetIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all min-h-[38px] cursor-pointer whitespace-nowrap active:scale-95 ${
                      activeSetIndex === idx
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                        : hasScore
                        ? 'bg-black/15 dark:bg-white/15 text-inherit opacity-90'
                        : 'bg-black/5 dark:bg-white/5 opacity-50 hover:opacity-80'
                    }`}
                  >
                    第{idx + 1}セット
                    {s && (
                      <span className="ml-1 font-mono text-[11px] font-bold">
                        ({s.team1 ?? 0}-{s.team2 ?? 0})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ルール告知バナー */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-center text-xs text-amber-500 dark:text-amber-300 flex items-center justify-center gap-2 font-medium">
            <span className="font-bold">⚡ 第{activeSetIndex + 1}セット:</span>
            <span className="font-extrabold">
              {setLimit}点先取（デュース無し）
            </span>
            <span className="opacity-60 hidden sm:inline">|</span>
            <span className="hidden sm:inline font-bold">🌸 女子ダイレクト返球得点は【＋2点】！</span>
            {isCourtSwapped && (
              <span className="ml-2 font-bold px-2 py-0.5 rounded bg-amber-500 text-zinc-950 text-[10px]">
                左右反転表示中
              </span>
            )}
          </div>

          {/* 超巨大スコア表示カード（スマホ最適化・左右分割・コートチェンジ対応） */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 flex-1 items-stretch min-h-[320px]">
            {isCourtSwapped ? (
              <>
                {/* 反転時：左がチーム2 */}
                <div className="bg-white/90 dark:bg-zinc-900/90 border-2 border-amber-500/50 rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden">
                  <div className="w-full">
                    <div className="text-[10px] sm:text-[11px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-0.5 flex items-center justify-center gap-1">
                      <span>TEAM 2</span>
                      <span className="text-[9px] px-1 rounded bg-amber-500/20">反転表示</span>
                    </div>
                    <div className="text-xs sm:text-base md:text-lg font-black break-words leading-tight px-1" title={t2Name}>
                      {t2Name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateScore('team2', 1)}
                    className="my-auto group flex flex-col items-center justify-center w-full py-3 sm:py-6 rounded-2xl hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                    title="タップで＋1点"
                  >
                    <span className="font-mono text-6xl sm:text-8xl md:text-9xl font-black text-amber-500 dark:text-amber-400 tracking-tighter group-hover:scale-105 transition-transform drop-shadow-xs">
                      {targetSet.team2 ?? 0}
                    </span>
                    <span className="text-[11px] sm:text-xs opacity-75 mt-1 flex items-center gap-1 font-bold">
                      <span>👆</span>
                      <span>タップで＋1点</span>
                    </span>
                  </button>

                  <div className="w-full grid grid-cols-3 gap-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => updateScore('team2', -1)}
                      disabled={(targetSet.team2 ?? 0) <= 0}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-black/10 dark:bg-white/10 hover:opacity-80 disabled:opacity-20 text-inherit font-black text-sm sm:text-base flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
                      title="1点マイナス"
                    >
                      <span className="text-base">−</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateScore('team2', 1)}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-0.5 active:scale-95 shadow-md shadow-amber-950/30 cursor-pointer"
                      title="1点プラス"
                    >
                      <span className="text-base">＋</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateScore('team2', 2);
                        showToast(`【特別ルール】${t2Name} に女子得点＋2点！`);
                      }}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-rose-950/30 cursor-pointer"
                      title="女子ダイレクト得点（＋2点）"
                    >
                      <span>🌸</span>
                      <span className="font-extrabold">＋2</span>
                    </button>
                  </div>
                </div>

                {/* 反転時：右がチーム1 */}
                <div className="bg-white/90 dark:bg-zinc-900/90 border-2 border-indigo-500/50 rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden">
                  <div className="w-full">
                    <div className="text-[10px] sm:text-[11px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-0.5 flex items-center justify-center gap-1">
                      <span>TEAM 1</span>
                      <span className="text-[9px] px-1 rounded bg-indigo-500/20">反転表示</span>
                    </div>
                    <div className="text-xs sm:text-base md:text-lg font-black break-words leading-tight px-1" title={t1Name}>
                      {t1Name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateScore('team1', 1)}
                    className="my-auto group flex flex-col items-center justify-center w-full py-3 sm:py-6 rounded-2xl hover:bg-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                    title="タップで＋1点"
                  >
                    <span className="font-mono text-6xl sm:text-8xl md:text-9xl font-black text-indigo-500 dark:text-indigo-400 tracking-tighter group-hover:scale-105 transition-transform drop-shadow-xs">
                      {targetSet.team1 ?? 0}
                    </span>
                    <span className="text-[11px] sm:text-xs opacity-75 mt-1 flex items-center gap-1 font-bold">
                      <span>👆</span>
                      <span>タップで＋1点</span>
                    </span>
                  </button>

                  <div className="w-full grid grid-cols-3 gap-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => updateScore('team1', -1)}
                      disabled={(targetSet.team1 ?? 0) <= 0}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-black/10 dark:bg-white/10 hover:opacity-80 disabled:opacity-20 text-inherit font-black text-sm sm:text-base flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
                      title="1点マイナス"
                    >
                      <span className="text-base">−</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateScore('team1', 1)}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-0.5 active:scale-95 shadow-md shadow-indigo-950/30 cursor-pointer"
                      title="1点プラス"
                    >
                      <span className="text-base">＋</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateScore('team1', 2);
                        showToast(`【特別ルール】${t1Name} に女子得点＋2点！`);
                      }}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-rose-950/30 cursor-pointer"
                      title="女子ダイレクト得点（＋2点）"
                    >
                      <span>🌸</span>
                      <span className="font-extrabold">＋2</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* 通常時：左がチーム1 */}
                <div className="bg-white/90 dark:bg-zinc-900/90 border-2 border-indigo-500/50 rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden">
                  <div className="w-full">
                    <div className="text-[10px] sm:text-[11px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-0.5">
                      TEAM 1
                    </div>
                    <div className="text-xs sm:text-base md:text-lg font-black break-words leading-tight px-1" title={t1Name}>
                      {t1Name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateScore('team1', 1)}
                    className="my-auto group flex flex-col items-center justify-center w-full py-3 sm:py-6 rounded-2xl hover:bg-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                    title="タップで＋1点"
                  >
                    <span className="font-mono text-6xl sm:text-8xl md:text-9xl font-black text-indigo-500 dark:text-indigo-400 tracking-tighter group-hover:scale-105 transition-transform drop-shadow-xs">
                      {targetSet.team1 ?? 0}
                    </span>
                    <span className="text-[11px] sm:text-xs opacity-75 mt-1 flex items-center gap-1 font-bold">
                      <span>👆</span>
                      <span>タップで＋1点</span>
                    </span>
                  </button>

                  <div className="w-full grid grid-cols-3 gap-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => updateScore('team1', -1)}
                      disabled={(targetSet.team1 ?? 0) <= 0}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-black/10 dark:bg-white/10 hover:opacity-80 disabled:opacity-20 text-inherit font-black text-sm sm:text-base flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
                      title="1点マイナス"
                    >
                      <span className="text-base">−</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateScore('team1', 1)}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-0.5 active:scale-95 shadow-md shadow-indigo-950/30 cursor-pointer"
                      title="1点プラス"
                    >
                      <span className="text-base">＋</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateScore('team1', 2);
                        showToast(`【特別ルール】${t1Name} に女子得点＋2点！`);
                      }}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-rose-950/30 cursor-pointer"
                      title="女子ダイレクト得点（＋2点）"
                    >
                      <span>🌸</span>
                      <span className="font-extrabold">＋2</span>
                    </button>
                  </div>
                </div>

                {/* 通常時：右がチーム2 */}
                <div className="bg-white/90 dark:bg-zinc-900/90 border-2 border-amber-500/50 rounded-2xl p-2.5 sm:p-5 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden">
                  <div className="w-full">
                    <div className="text-[10px] sm:text-[11px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-0.5">
                      TEAM 2
                    </div>
                    <div className="text-xs sm:text-base md:text-lg font-black break-words leading-tight px-1" title={t2Name}>
                      {t2Name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateScore('team2', 1)}
                    className="my-auto group flex flex-col items-center justify-center w-full py-3 sm:py-6 rounded-2xl hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                    title="タップで＋1点"
                  >
                    <span className="font-mono text-6xl sm:text-8xl md:text-9xl font-black text-amber-500 dark:text-amber-400 tracking-tighter group-hover:scale-105 transition-transform drop-shadow-xs">
                      {targetSet.team2 ?? 0}
                    </span>
                    <span className="text-[11px] sm:text-xs opacity-75 mt-1 flex items-center gap-1 font-bold">
                      <span>👆</span>
                      <span>タップで＋1点</span>
                    </span>
                  </button>

                  <div className="w-full grid grid-cols-3 gap-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => updateScore('team2', -1)}
                      disabled={(targetSet.team2 ?? 0) <= 0}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-black/10 dark:bg-white/10 hover:opacity-80 disabled:opacity-20 text-inherit font-black text-sm sm:text-base flex items-center justify-center gap-0.5 active:scale-95 cursor-pointer"
                      title="1点マイナス"
                    >
                      <span className="text-base">−</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateScore('team2', 1)}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-base sm:text-lg flex items-center justify-center gap-0.5 active:scale-95 shadow-md shadow-amber-950/30 cursor-pointer"
                      title="1点プラス"
                    >
                      <span className="text-base">＋</span>
                      <span>1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateScore('team2', 2);
                        showToast(`【特別ルール】${t2Name} に女子得点＋2点！`);
                      }}
                      className="min-h-[48px] sm:min-h-[54px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 active:scale-95 shadow-md shadow-rose-950/30 cursor-pointer"
                      title="女子ダイレクト得点（＋2点）"
                    >
                      <span>🌸</span>
                      <span className="font-extrabold">＋2</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 下部コントローラー: Undo / 次セットへ進む / セットリセット */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/80 dark:bg-zinc-900/90 rounded-2xl border border-black/10 dark:border-white/10 shrink-0 safe-area-bottom">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undoLastAction}
                disabled={history.length === 0}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400 disabled:opacity-25 font-bold text-xs flex items-center gap-1 min-h-[42px] cursor-pointer active:scale-95"
                title="直前の得点操作を取り消す"
              >
                <span>↩ 1手戻す</span>
                {history.length > 0 && <span>({history.length})</span>}
              </button>

              <button
                type="button"
                onClick={resetCurrentSet}
                className="px-3 py-2.5 rounded-xl bg-black/10 dark:bg-white/10 hover:opacity-80 text-inherit text-xs font-semibold min-h-[42px] cursor-pointer"
              >
                ↺ リセット
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeSetIndex < 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSetIndex((prev) => Math.min(2, prev + 1));
                    showToast(`第${activeSetIndex + 2}セットに切り替えました`);
                  }}
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-1.5 min-h-[42px] cursor-pointer active:scale-95"
                >
                  <span>次のセットへ進む</span>
                  <span>→</span>
                </button>
              )}
              {activeSetIndex === 2 && (
                <span className="text-xs text-emerald-500 dark:text-emerald-400 font-extrabold px-3 py-2 bg-emerald-500/15 rounded-xl border border-emerald-500/30">
                  ★第3セット (ファイナル)
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
          <span className="text-4xl mb-2">🏐</span>
          <p className="text-sm font-bold text-zinc-300">
            {getCourtName(selectedCourt)}の試合が登録されていません
          </p>
          <p className="text-xs mt-1">管理画面から試合を生成してください。</p>
        </div>
      )}

      {/* 特別ルール確認モーダル */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* セットスコアリセット確認モーダル */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-zinc-900 dark:text-zinc-100">
            <h4 className="font-bold text-base flex items-center gap-2 text-red-600 dark:text-red-400">
              <span>⚠️</span>
              <span>セットスコアのリセット</span>
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              第{activeSetIndex + 1}セットのスコアを <strong className="text-zinc-900 dark:text-zinc-100">0 - 0</strong> にリセットしますか？
              <br />
              （誤ってリセットした場合も「1手戻す」で復元できます）
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  executeResetSet();
                  setIsResetConfirmOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-xs cursor-pointer"
              >
                リセット実行
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 得点板・審判 担当バランスモーダル */}
      <RefereeBalanceModal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        teams={teams}
        matches={matches}
      />
    </div>
  );
};
