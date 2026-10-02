import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BracketView } from '../components/BracketView';
import { MyTeamSchedule } from '../components/MyTeamSchedule';
import { RulesModal } from '../components/RulesModal';
import { StandingsTable } from '../components/StandingsTable';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { getActiveCourts, getCourtName } from '../logic/court';
import { computeLeagueStandings } from '../logic/standings';
import { useTheme } from '../state/ThemeContext';
import { useTournament } from '../state/TournamentContext';

type ViewerTab = 'monitor' | 'myteam' | 'standings';

export const ViewerPage: React.FC = () => {
  const { state } = useTournament();
  const { matches, teams, settings } = state;
  const { theme } = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();

  // URLパラメータからの初期タブ・チーム取得
  const initialTab = (searchParams.get('tab') as ViewerTab) || 'monitor';
  const initialTeamId = searchParams.get('team') || (teams.length > 0 ? teams[0].id : null);

  const [activeTab, setActiveTab] = useState<ViewerTab>(
    ['monitor', 'myteam', 'standings'].includes(initialTab) ? initialTab : 'monitor'
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(initialTeamId);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  // 自動切替モード（1分毎に進行モニターと全体の状況を自動ローテーション）
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(() => {
    return searchParams.get('rotate') === '1' || searchParams.get('auto') === 'true';
  });
  const [rotateIntervalSec, setRotateIntervalSec] = useState<number>(60); // 既定60秒 (1分)
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [toastMsg, setToastMsg] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const switchNextTab = (manual: boolean = false) => {
    setActiveTab((curr) => {
      const next: ViewerTab = curr === 'monitor' ? 'standings' : 'monitor';
      showToast(
        next === 'monitor'
          ? '📺 コート進行モニターに切り替えました'
          : '📊 全体の状況（星取表・トーナメント）に切り替えました'
      );
      return next;
    });
    setSecondsLeft(rotateIntervalSec);
  };

  const toggleAutoRotate = () => {
    setIsAutoRotate((prev) => {
      const next = !prev;
      setSecondsLeft(rotateIntervalSec);
      showToast(
        next
          ? `🔄 自動切替をONにしました（${rotateIntervalSec === 60 ? '1分' : `${rotateIntervalSec}秒`}毎に交互切替）`
          : '⏸️ 自動切替をOFFにしました'
      );
      return next;
    });
  };

  // 1秒ごとのカウントダウンタイマー
  useEffect(() => {
    if (!isAutoRotate || activeTab === 'myteam') return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRotate, activeTab]);

  // 秒数が0になったタイミングで確実にタブを自動ローテーション
  useEffect(() => {
    if (!isAutoRotate || activeTab === 'myteam') return;

    if (secondsLeft === 0) {
      setActiveTab((currTab) => {
        const nextTab: ViewerTab = currTab === 'monitor' ? 'standings' : 'monitor';
        showToast(
          nextTab === 'monitor'
            ? '📺 コート進行モニターに切り替えました（次は自動で全体の状況へ）'
            : '📊 全体の状況（星取表・トーナメント）に切り替えました（次は自動で進行モニターへ）'
        );
        return nextTab;
      });
      setSecondsLeft(rotateIntervalSec);
    }
  }, [secondsLeft, isAutoRotate, activeTab, rotateIntervalSec]);

  // URLパラメータで team が指定されている場合は自動でマイチームタブまたはチーム選択を同期
  useEffect(() => {
    const teamParam = searchParams.get('team');
    if (teamParam) {
      setSelectedTeamId(teamParam);
    }
  }, [searchParams]);

  // 時計更新
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // 順位表計算
  const standings = useMemo(() => {
    return computeLeagueStandings(teams, matches, settings);
  }, [teams, matches, settings]);

  // 全体進捗
  const completedMatches = matches.filter((m) => m.status === 'completed').length;
  const totalMatches = matches.length;
  const progressPercent = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  // 設定された有効コート数
  const activeCourts = useMemo(() => {
    return getActiveCourts(settings.courtCount || 4);
  }, [settings.courtCount]);

  // コート別の試合グルーピング
  const courtData = useMemo(() => {
    return activeCourts.map((courtNum) => {
      const courtMatches = matches
        .filter((m) => {
          if (m.court) return m.court === courtNum;
          const poolMap: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8 };
          return m.pool && poolMap[m.pool] === courtNum;
        })
        .sort((a, b) => {
          if (a.slot && b.slot && a.slot !== b.slot) return a.slot - b.slot;
          if (a.roundOrder !== b.roundOrder) return a.roundOrder - b.roundOrder;
          return a.matchNumber - b.matchNumber;
        });

      const currentMatch = courtMatches.find(
        (m) => m.status === 'pending' && (m.team1Id || m.team2Id)
      );
      const remaining = courtMatches.filter((m) => m.status === 'pending');
      const nextMatch = remaining.length > 1 ? remaining[1] : null;
      const finished = courtMatches.filter((m) => m.status === 'completed');
      const lastFinished = finished.length > 0 ? finished[finished.length - 1] : null;

      return {
        courtNum,
        matches: courtMatches,
        currentMatch,
        nextMatch,
        lastFinished,
      };
    });
  }, [activeCourts, matches]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const handleTabChange = (tab: ViewerTab) => {
    setActiveTab(tab);
    setSecondsLeft(rotateIntervalSec); // 手動切り替え時に次の切替までのタイマーを満タンにリセット
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set('tab', tab);
      return updated;
    });
  };

  const handleSelectTeam = (teamId: string | null) => {
    setSelectedTeamId(teamId);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (teamId) {
        updated.set('team', teamId);
      } else {
        updated.delete('team');
      }
      return updated;
    });
  };

  return (
    <div className={`min-h-screen ${theme.classes.pageBg} ${theme.classes.pageText} flex flex-col select-none transition-colors duration-200`}>
      {/* トップ閲覧専用ヘッダー（管理画面へのリンクは完全非表示・外部共有ガード） */}
      <header className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${theme.classes.headerBorder} ${theme.classes.headerBg} flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shrink-0 shadow-md`}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
            🏐
          </span>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-[11px] animate-pulse flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                <span>LIVE VIEW</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                閲覧専用モード
              </span>
              <h1 className="text-lg sm:text-xl font-black tracking-tight">
                {settings.name || '社内バレーボール大会'}
              </h1>
            </div>
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mt-0.5 flex items-center gap-2.5 flex-wrap">
              <span>📍 {settings.venue || '体育館'}</span>
              <span>•</span>
              <span>進行状況: {completedMatches} / {totalMatches} 試合完了 ({progressPercent}%)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* プログレスバー */}
          <div className="hidden xl:block w-36">
            <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-700">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* デジタル時計 */}
          <div className="font-mono text-xl sm:text-2xl font-black text-amber-500 dark:text-amber-400 tracking-wider bg-zinc-100 dark:bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-inner">
            {currentTime || '--:--:--'}
          </div>

          {/* クラウド同期ステータス */}
          <SyncStatusBadge />

          {/* 4色のテーマ切り替え丸ボタン */}
          <ThemeSelector variant="compact" />

          {/* 自動切替ボタン (ヘッダークイックトグル) */}
          <button
            type="button"
            onClick={toggleAutoRotate}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isAutoRotate
                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black ring-2 ring-amber-400/40'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
            }`}
            title="1分毎に進行モニターと全体の状況を自動で交互に切り替えます"
          >
            <span className={isAutoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }}>
              🔄
            </span>
            <span className="hidden sm:inline">自動切替:</span>
            <span>{isAutoRotate ? `ON (${secondsLeft}s)` : 'OFF'}</span>
          </button>

          {/* 大会ルール確認 */}
          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-300 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
            title="大会公式ルール・特別ルールを確認"
          >
            <span>📋</span>
            <span className="hidden sm:inline">ルール</span>
          </button>

          {/* フルスクリーン切り替え */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-300 dark:border-zinc-700 transition-colors flex items-center gap-1 cursor-pointer"
            title="プロジェクター・大画面全画面表示"
          >
            <span>⛶</span>
            <span className="hidden sm:inline">{isFullscreen ? '縮小' : '全画面'}</span>
          </button>
        </div>
      </header>

      {/* サブナビゲーション・タブバー */}
      <div className={`px-4 sm:px-6 py-2.5 border-b ${theme.classes.headerBorder} bg-zinc-100/70 dark:bg-zinc-900/70 backdrop-blur-xs flex flex-wrap items-center justify-between gap-2 shrink-0`}>
        <div className="inline-flex rounded-2xl bg-zinc-200/80 dark:bg-zinc-800 p-1 text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => handleTabChange('monitor')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'monitor'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>📺</span>
            <span>コート進行モニター</span>
            {isAutoRotate && activeTab === 'monitor' && (
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono animate-pulse">
                {secondsLeft}s
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('standings')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'standings'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>📊</span>
            <span>全体の状況（順位・トーナメント）</span>
            {isAutoRotate && activeTab === 'standings' && (
              <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono animate-pulse">
                {secondsLeft}s
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('myteam')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'myteam'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-black'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>🏐</span>
            <span>自分たちの試合（マイチーム）</span>
          </button>
        </div>

        {/* 自動切替の詳細コントロールエリア */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAutoRotate}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                isAutoRotate
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400/40'
                  : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
              }`}
              title="1分毎に進行モニターと全体の状況を自動交互切替"
            >
              <span className={isAutoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }}>
                🔄
              </span>
              <span>自動切替: {isAutoRotate ? 'ON' : 'OFF'}</span>
              {isAutoRotate && (
                <span className="px-1.5 py-0.2 rounded-md bg-black/20 font-mono text-[11px] font-bold">
                  {secondsLeft}秒
                </span>
              )}
            </button>

            {/* 切替間隔切り替えボタン */}
            {isAutoRotate && (
              <div className="flex items-center gap-0.5 bg-zinc-200/80 dark:bg-zinc-800 p-0.5 rounded-xl text-[10px] font-bold">
                {[
                  { sec: 15, label: '15秒 (確認用)' },
                  { sec: 30, label: '30秒' },
                  { sec: 60, label: '1分' },
                  { sec: 120, label: '2分' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => {
                      setRotateIntervalSec(item.sec);
                      setSecondsLeft(item.sec);
                      showToast(`切替間隔を「${item.label}」に設定しました`);
                    }}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      rotateIntervalSec === item.sec
                        ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-100 shadow-2xs font-black'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] font-bold text-zinc-500 hidden xl:flex items-center gap-1.5">
            <span>• リアルタイム自動更新中</span>
          </div>
        </div>
      </div>

      {/* 自動切替カウントダウン プログレスバー */}
      {isAutoRotate && activeTab !== 'myteam' && (
        <div className="w-full h-1 bg-zinc-200/50 dark:bg-zinc-800/50 overflow-hidden shrink-0">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500 transition-all duration-1000 ease-linear shadow-xs"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, ((rotateIntervalSec - secondsLeft) / rotateIntervalSec) * 100)
              )}%`,
            }}
          />
        </div>
      )}

      {/* メインビュー */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {/* 1. コート進行モニター画面 */}
        {activeTab === 'monitor' && (
          <div className="space-y-4">
            {isAutoRotate ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 text-xs font-semibold shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="animate-spin text-sm" style={{ animationDuration: '3s' }}>
                    🔄
                  </span>
                  <span>自動切替中：各コートの進行モニターを表示中</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                    あと {secondsLeft} 秒で「全体の状況」へ自動切替
                  </span>
                  <button
                    type="button"
                    onClick={() => switchNextTab(true)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <span>今すぐ切替</span>
                    <span>⚡</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">
                <div className="flex items-center gap-2">
                  <span>📺</span>
                  <span>各コートの対戦・得点状況を表示中（全体の状況と自動交互切替が可能です）</span>
                </div>
                <button
                  type="button"
                  onClick={toggleAutoRotate}
                  className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 self-start sm:self-auto shrink-0"
                >
                  <span>🔄 自動切替をONにする</span>
                  <span className="font-normal text-[10px] opacity-80">(1分毎)</span>
                </button>
              </div>
            )}

            <div
              className={`grid gap-4 sm:gap-6 ${
              activeCourts.length === 1
                ? 'grid-cols-1 max-w-2xl mx-auto w-full'
                : activeCourts.length === 2
                ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto w-full'
                : activeCourts.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : activeCourts.length === 4
                ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
            }`}
          >
            {courtData.map(({ courtNum, currentMatch, nextMatch, lastFinished }) => {
              const courtColors: Record<number, { border: string; bg: string; badge: string }> = {
                1: { border: 'border-blue-400 dark:border-blue-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-blue-600 text-white' },
                2: { border: 'border-indigo-400 dark:border-indigo-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-indigo-600 text-white' },
                3: { border: 'border-emerald-400 dark:border-emerald-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-emerald-600 text-white' },
                4: { border: 'border-amber-400 dark:border-amber-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-amber-600 text-white' },
                5: { border: 'border-purple-400 dark:border-purple-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-purple-600 text-white' },
                6: { border: 'border-rose-400 dark:border-rose-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-rose-600 text-white' },
                7: { border: 'border-cyan-400 dark:border-cyan-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-cyan-600 text-white' },
                8: { border: 'border-teal-400 dark:border-teal-600', bg: 'bg-white dark:bg-zinc-900', badge: 'bg-teal-600 text-white' },
              };
              const courtStyle = courtColors[courtNum] || courtColors[1];

              return (
                <div
                  key={courtNum}
                  className={`rounded-3xl border-2 ${courtStyle.border} ${courtStyle.bg} p-4 sm:p-5 flex flex-col justify-between shadow-lg`}
                >
                  {/* コートヘッダー */}
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider ${courtStyle.badge}`}>
                          {getCourtName(courtNum)}
                        </span>
                        {currentMatch?.slot && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono">
                            第{currentMatch.slot}試合 同時進行
                          </span>
                        )}
                      </div>
                      {currentMatch ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>進行中</span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">待機中</span>
                      )}
                    </div>

                    {/* 現在進行中のスコアカード */}
                    {currentMatch ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                            {currentMatch.roundName} #{currentMatch.matchNumber}
                          </div>

                          {/* 対戦カード */}
                          <div className="mt-3 space-y-3">
                            {/* チーム1 */}
                            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between shadow-xs gap-2">
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="text-base sm:text-lg font-black text-zinc-950 dark:text-zinc-50 break-words leading-tight" title={teamMap.get(currentMatch.team1Id || '')?.name}>
                                  {teamMap.get(currentMatch.team1Id || '')?.name || '未定'}
                                </div>
                                {currentMatch.pool && (
                                  <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    グループ {currentMatch.pool}
                                  </div>
                                )}
                              </div>
                              <div className="text-3xl sm:text-4xl font-mono font-black text-indigo-600 dark:text-indigo-400 pl-2 shrink-0">
                                {currentMatch.team1Sets}
                              </div>
                            </div>

                            <div className="text-center text-xs font-black text-zinc-400 tracking-widest">
                              VS
                            </div>

                            {/* チーム2 */}
                            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between shadow-xs gap-2">
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="text-base sm:text-lg font-black text-zinc-950 dark:text-zinc-50 break-words leading-tight" title={teamMap.get(currentMatch.team2Id || '')?.name}>
                                  {teamMap.get(currentMatch.team2Id || '')?.name || '未定'}
                                </div>
                                {currentMatch.pool && (
                                  <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    グループ {currentMatch.pool}
                                  </div>
                                )}
                              </div>
                              <div className="text-3xl sm:text-4xl font-mono font-black text-amber-600 dark:text-amber-400 pl-2 shrink-0">
                                {currentMatch.team2Sets}
                              </div>
                            </div>
                          </div>

                          {/* 各セットスコア詳細 */}
                          <div className="mt-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center justify-around text-center">
                            {currentMatch.sets.slice(0, settings.bestOf).map((set, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <div className="text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase">
                                  Set {idx + 1}
                                </div>
                                <div className="font-mono text-sm sm:text-base font-black text-zinc-950 dark:text-zinc-50">
                                  {set.team1 ?? '-'}:{set.team2 ?? '-'}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* 得点板担当表示 */}
                          {currentMatch.referee && (
                            <div className="mt-3 px-3.5 py-2 rounded-xl bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs flex items-start justify-between gap-1.5">
                              <span className="font-black flex items-center gap-1.5 shrink-0">
                                <span>📋</span>
                                <span>得点板:</span>
                              </span>
                              <span className="font-black break-words leading-tight text-right flex-1" title={currentMatch.referee}>
                                {currentMatch.referee}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-zinc-500 space-y-1">
                        <div className="text-3xl">🏐</div>
                        <div className="text-sm font-semibold">このコートの全試合が終了しました</div>
                      </div>
                    )}
                  </div>

                  {/* コート下部: 次の試合 / 直近完了試合 */}
                  <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                    {nextMatch && (
                      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="font-black text-indigo-600 dark:text-indigo-400">⚡ NEXT MATCH</span>
                          <span className="text-zinc-500">#{nextMatch.matchNumber}</span>
                        </div>
                        <div className="font-black text-zinc-950 dark:text-zinc-50 break-words leading-tight">
                          {teamMap.get(nextMatch.team1Id || '')?.name || 'TBD'} vs{' '}
                          {teamMap.get(nextMatch.team2Id || '')?.name || 'TBD'}
                        </div>
                        {nextMatch.referee && (
                          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1 break-words leading-tight">
                            得点板: {nextMatch.referee}
                          </div>
                        )}
                      </div>
                    )}

                    {lastFinished && !nextMatch && (
                      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-zinc-500 shrink-0">直前結果:</span>
                        <span className="font-black text-zinc-950 dark:text-zinc-50 break-words leading-tight flex-1 text-center">
                          {teamMap.get(lastFinished.winnerId || '')?.name || '勝者'} 勝利
                        </span>
                        <span className="font-mono font-black text-zinc-900 dark:text-zinc-100 shrink-0">
                          {lastFinished.team1Sets}-{lastFinished.team2Sets}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* 2. 自分たちの試合（マイチーム検索・スケジュール） */}
        {activeTab === 'myteam' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {isAutoRotate && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">⏸️</span>
                  <span>
                    自チームの試合を閲覧中のため、自動切替は一時停止しています。
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('monitor')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer shrink-0 transition-colors self-start sm:self-auto"
                >
                  進行モニターに戻って再開 →
                </button>
              </div>
            )}
            <MyTeamSchedule
              teams={teams}
              matches={matches}
              standings={standings}
              selectedTeamId={selectedTeamId}
              onSelectTeam={handleSelectTeam}
            />
          </div>
        )}

        {/* 3. 全体の試合状況（順位表 & 決勝トーナメント樹形図） */}
        {activeTab === 'standings' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {isAutoRotate ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs font-semibold shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="animate-spin text-sm" style={{ animationDuration: '3s' }}>
                    🔄
                  </span>
                  <span>自動切替中：全体の状況（予選順位・トーナメント）を表示中</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                    あと {secondsLeft} 秒で「コート進行モニター」へ自動切替
                  </span>
                  <button
                    type="button"
                    onClick={() => switchNextTab(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <span>今すぐ切替</span>
                    <span>⚡</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">
                <div className="flex items-center gap-2">
                  <span>📊</span>
                  <span>全体の順位表・トーナメント表を表示中（進行モニターと自動交互切替が可能です）</span>
                </div>
                <button
                  type="button"
                  onClick={toggleAutoRotate}
                  className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1 self-start sm:self-auto shrink-0"
                >
                  <span>🔄 自動切替をONにする</span>
                  <span className="font-normal text-[10px] opacity-80">(1分毎)</span>
                </button>
              </div>
            )}

            {/* 予選リーグ順位表・星取表 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                  予選リーグ星取表 & 順位表
                </h2>
              </div>
              <StandingsTable standings={standings} isDark={theme.isDark} />
            </section>

            {/* 決勝トーナメント表 */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌲</span>
                <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                  決勝トーナメント表（樹形図）
                </h2>
              </div>
              <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
                <BracketView
                  matches={matches}
                  teams={teams}
                  settings={settings}
                  isDark={theme.isDark}
                  defaultView="tree"
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 閲覧専用フッター（管理画面へのリンクは完全非表示・外部共有安全ガード） */}
      <footer className={`px-4 sm:px-6 py-3.5 ${theme.classes.headerBg} border-t ${theme.classes.headerBorder} text-xs opacity-90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span>🏐 {settings.name || '社内バレーボール大会'} リアルタイム閲覧専用ポータル</span>
          <span>•</span>
          <span className="text-zinc-500 dark:text-zinc-400">自動更新中</span>
        </div>
        <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
          ※ 観客・選手用画面（管理権限のないセキュアな閲覧専用画面です）
        </div>
      </footer>

      {/* 大会ルール＆注意事項モーダル */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* 自動切替トースト通知 */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-950/95 dark:bg-white/95 text-white dark:text-zinc-950 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md border border-white/20 dark:border-zinc-300 animate-fade-in flex items-center gap-2 pointer-events-none">
          <span className="text-amber-400 dark:text-amber-600">🔄</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
