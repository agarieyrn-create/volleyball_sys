import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AwardsModal } from '../components/AwardsModal';
import { BracketView } from '../components/BracketView';
import { MobileNavBar, PublicNavTab } from '../components/MobileNavBar';
import { MvpVotingModal } from '../components/MvpVotingModal';
import { MyTeamSchedule } from '../components/MyTeamSchedule';
import { PrintSheetsModal } from '../components/PrintSheetsModal';
import { RulesModal } from '../components/RulesModal';
import { ShareUrlModal } from '../components/ShareUrlModal';
import { StandingsTable } from '../components/StandingsTable';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { getCourtName } from '../logic/court';
import { useTheme } from '../state/ThemeContext';
import { useTournament } from '../state/TournamentContext';

export const PublicPage: React.FC = () => {
  const { state, standings } = useTournament();
  const { settings, teams, matches, updatedAt, updatedBy } = state;
  const { theme, themeId } = useTheme();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isAwardsOpen, setIsAwardsOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isMvpOpen, setIsMvpOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeNavTab, setActiveNavTab] = useState<PublicNavTab>('summary');

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // サマリー情報の計算
  const totalMatches = matches.length;
  const completedMatches = matches.filter((m) => m.status === 'completed').length;

  // コート面数と各コートの進行状況
  const courtCount = settings.courtCount || 4;
  const activeCourts = useMemo(
    () => Array.from({ length: courtCount }, (_, i) => i + 1),
    [courtCount]
  );

  const courtData = useMemo(() => {
    return activeCourts.map((courtNum) => {
      const courtMatches = matches.filter((m) => (m.court || 1) === courtNum);
      // 進行中またはチーム確定している未完了試合
      const currentMatch = courtMatches.find(
        (m) => m.status === 'pending' && (m.team1Id || m.team2Id)
      );
      // スコア入力中（LIVE）かどうか
      const isLive = Boolean(
        currentMatch &&
          currentMatch.sets.some((s) => (s.team1 ?? 0) > 0 || (s.team2 ?? 0) > 0)
      );
      // 次の試合
      const remaining = courtMatches.filter((m) => m.status === 'pending');
      const nextMatch = remaining.length > 1 ? remaining[1] : null;
      // 直近完了試合
      const finished = courtMatches.filter((m) => m.status === 'completed');
      const lastFinished = finished.length > 0 ? finished[finished.length - 1] : null;

      return {
        courtNum,
        courtName: getCourtName(courtNum),
        courtMatches,
        currentMatch,
        isLive,
        nextMatch,
        lastFinished,
      };
    });
  }, [activeCourts, matches]);

  // 決勝戦と優勝チーム
  const finalMatch = matches.find((m) => m.round === 'final' || m.matchCode === 'A8' || m.id === 'match_A8');
  const championTeam =
    finalMatch && finalMatch.status === 'completed' && finalMatch.winnerId
      ? teamMap.get(finalMatch.winnerId)
      : null;

  // 3位決定戦と第3位チーム（3位決定戦がある場合、または準決勝敗退チーム）
  const thirdPlaceMatch = matches.find(
    (m) => m.round === 'third_place' || m.matchCode === 'B8' || m.id === 'match_B8' || m.id === 'final_3rd'
  );
  const semiA7 = matches.find((m) => m.matchCode === 'A7' || m.id === 'match_A7');
  const semiB7 = matches.find((m) => m.matchCode === 'B7' || m.id === 'match_B7');

  let thirdPlaceTeam =
    thirdPlaceMatch && thirdPlaceMatch.status === 'completed' && thirdPlaceMatch.winnerId
      ? teamMap.get(thirdPlaceMatch.winnerId)
      : null;

  if (!thirdPlaceTeam && semiA7?.winnerId && semiB7?.winnerId) {
    const loserA7Id = semiA7.winnerId === semiA7.team1Id ? semiA7.team2Id : semiA7.team1Id;
    const loserB7Id = semiB7.winnerId === semiB7.team1Id ? semiB7.team2Id : semiB7.team1Id;
    const rankA = standings.findIndex((s) => s.teamId === loserA7Id);
    const rankB = standings.findIndex((s) => s.teamId === loserB7Id);
    const best3rdId = rankA !== -1 && rankB !== -1 && rankA <= rankB ? loserA7Id : (loserB7Id || loserA7Id);
    if (best3rdId) {
      thirdPlaceTeam = teamMap.get(best3rdId) || null;
    }
  }

  // 完了した試合の一覧（最新順）
  const finishedMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === 'completed')
      .slice(-8)
      .reverse();
  }, [matches]);

  // タブ選択時のスクロールハンドラー
  const handleSelectNavTab = (tab: PublicNavTab) => {
    setActiveNavTab(tab);
    const elementId =
      tab === 'summary'
        ? 'section-summary'
        : tab === 'myteam'
        ? 'section-myteam'
        : tab === 'bracket'
        ? 'section-bracket'
        : tab === 'standings'
        ? 'section-standings'
        : 'section-results';

    const el = document.getElementById(elementId);
    if (el) {
      const yOffset = -70;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`min-h-screen ${theme.classes.pageBg} font-sans antialiased selection:bg-indigo-500 selection:text-white pb-24 md:pb-16 transition-colors duration-200`}
    >
      {/* 観客用レスポンシブヘッダー */}
      <header
        className={`border-b ${theme.classes.headerBorder} ${theme.classes.headerBg} sticky top-0 z-30 transition-colors`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base md:text-lg truncate leading-tight">
                {settings.name || '社内バレーボール大会'}
              </h1>
              <p className="text-[10px] sm:text-xs opacity-75 truncate">
                リアルタイム観客速報 • {settings.venue || '社内体育館'}
              </p>
            </div>
          </div>

          {/* デスクトップ用ナビゲーション (md以上) */}
          <div className="hidden md:flex items-center gap-1.5 flex-wrap justify-end">
            {/* クラウド同期ステータス */}
            <div className="shrink-0">
              <SyncStatusBadge />
            </div>

            {/* テーマ切替セレクター */}
            <div className="shrink-0">
              <ThemeSelector variant="button" />
            </div>

            {/* 閲覧専用URL発行 */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 transition-colors font-bold shadow-xs cursor-pointer whitespace-nowrap shrink-0"
              title="観客・選手用閲覧専用URL（QRコード）を発行・共有"
            >
              <span>🔗</span>
              <span>共有URL発行</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 flex items-center gap-1 transition-colors font-bold shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="大会公式ルール・特別ルールを確認"
            >
              <span>📋</span>
              <span>ルール</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMvpOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 flex items-center gap-1 transition-colors font-bold shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="本日一番輝いた選手に投票"
            >
              <span>⭐</span>
              <span>MVP投票</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAwardsOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 flex items-center gap-1 transition-colors font-bold shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="表彰状・大会結果サマリーを開く"
            >
              <span>🏆</span>
              <span>表彰</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 flex items-center gap-1 transition-colors font-bold shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
              title="対戦表・星取表・トーナメント表をA4画像保存または印刷"
            >
              <span>📸</span>
              <span className="whitespace-nowrap">A4画像保存</span>
            </button>

            <Link
              to="/referee"
              className="text-xs px-2.5 py-1.5 rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-950 dark:text-amber-200 flex items-center gap-1 transition-colors font-bold shadow-2xs whitespace-nowrap shrink-0"
              title="審判・得点板モード"
            >
              <span>🏐</span>
              <span>得点板</span>
            </Link>

            <Link
              to="/monitor"
              className="text-xs px-2.5 py-1.5 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-950 dark:text-emerald-200 flex items-center gap-1 transition-colors font-bold shadow-2xs whitespace-nowrap shrink-0"
              title="体育館プロジェクター・大型モニターモード"
            >
              <span>📺</span>
              <span>モニター</span>
            </Link>

            <Link
              to="/"
              className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 transition-colors font-bold shadow-2xs whitespace-nowrap shrink-0"
            >
              ホーム
            </Link>

            <Link
              to="/admin"
              className="text-xs px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-black shadow-xs whitespace-nowrap shrink-0"
            >
              運営管理
            </Link>
          </div>

          {/* モバイル用ヘッダー操作ボタン (md未満) */}
          <div className="flex md:hidden items-center gap-1 sm:gap-1.5 shrink-0">
            {/* クラウド同期ステータス */}
            <SyncStatusBadge />

            {/* テーマピッカー (コンパクト版) */}
            <ThemeSelector variant="compact" />

            {/* モバイルメニューボタン */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center text-sm font-bold shadow-xs cursor-pointer min-w-[36px] min-h-[36px] shrink-0"
              aria-label="メニューを開く"
            >
              ☰
            </button>
          </div>
        </div>

        {/* モバイル向け sticky セクション切り替えピルバー */}
        <div className="md:hidden border-t border-zinc-200/60 dark:border-zinc-800/80 px-2 py-1.5 bg-black/5 dark:bg-black/20 overflow-x-auto flex items-center gap-1.5 text-xs whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => handleSelectNavTab('summary')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all cursor-pointer ${
              activeNavTab === 'summary'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-zinc-800/80 opacity-80'
            }`}
          >
            ⚡ 速報・注目
          </button>
          <button
            type="button"
            onClick={() => handleSelectNavTab('myteam')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all cursor-pointer ${
              activeNavTab === 'myteam'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-zinc-800/80 opacity-80'
            }`}
          >
            🏐 マイチーム
          </button>
          <button
            type="button"
            onClick={() => handleSelectNavTab('bracket')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all cursor-pointer ${
              activeNavTab === 'bracket'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-zinc-800/80 opacity-80'
            }`}
          >
            🏆 決勝T
          </button>
          <button
            type="button"
            onClick={() => handleSelectNavTab('standings')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all cursor-pointer ${
              activeNavTab === 'standings'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-zinc-800/80 opacity-80'
            }`}
          >
            📊 予選順位
          </button>
          <button
            type="button"
            onClick={() => handleSelectNavTab('results')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-bold transition-all cursor-pointer ${
              activeNavTab === 'results'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white/80 dark:bg-zinc-800/80 opacity-80'
            }`}
          >
            📝 試合結果
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* セクション1: マイチーム検索・スケジュール抽出 */}
        <section id="section-myteam">
          <MyTeamSchedule
            teams={teams}
            matches={matches}
            standings={standings}
            selectedTeamId={selectedTeamId}
            onSelectTeam={setSelectedTeamId}
          />
        </section>

        {/* セクション2: 全コート同時進行・試合速報 (全{courtCount}コート) */}
        <section id="section-summary" className="space-y-4">
          {/* 大会進行プログレス & 優勝バナー */}
          {championTeam ? (
            <div
              className={`p-4 sm:p-5 rounded-2xl ${theme.classes.winnerBg} border ${theme.classes.winnerBorder} ${theme.classes.winnerText} flex items-center justify-between gap-4 shadow-md`}
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="text-3xl sm:text-4xl shrink-0">🏆</div>
                <div className="min-w-0">
                  <div className="text-xs uppercase font-bold tracking-wider opacity-90">
                    大会優勝 (Champion)
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold truncate mt-0.5">
                    {championTeam.name}
                  </div>
                  {thirdPlaceTeam ? (
                    <div className="text-[11px] opacity-90 mt-1 flex items-center gap-1 font-semibold truncate">
                      <span>🥉 第3位:</span>
                      <span className="font-bold">{thirdPlaceTeam.name}</span>
                    </div>
                  ) : (
                    <div className="text-xs opacity-90 mt-0.5">
                      全試合終了 おめでとうございます！
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAwardsOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs shrink-0 cursor-pointer"
              >
                表彰状を見る
              </button>
            </div>
          ) : (
            <div
              className={`p-3.5 sm:p-4 rounded-2xl ${theme.classes.cardBg} border ${theme.classes.cardBorder} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0 text-sm">
                  {totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0}%
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">大会進行状況</div>
                  <div className="text-sm sm:text-base font-extrabold font-mono text-zinc-900 dark:text-zinc-100">
                    {completedMatches}{' '}
                    <span className="text-xs font-normal text-zinc-500">/ {totalMatches} 試合完了</span>
                    <span className="ml-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      (残り {totalMatches - completedMatches} 試合)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 font-semibold cursor-pointer"
                >
                  ルール
                </button>
                <button
                  type="button"
                  onClick={() => setIsMvpOpen(true)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 font-semibold cursor-pointer"
                >
                  MVP投票
                </button>
                <Link
                  to="/monitor"
                  className="text-xs px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold"
                >
                  大画面モニター →
                </Link>
              </div>
            </div>
          )}

          {/* 全コート同時進行ライブ速報カード一覧 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                  全コート同時進行 リアルタイム速報
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  全{courtCount}コート
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:inline font-medium">
                各コートで現在進行中または次の試合
              </span>
            </div>

            <div
              className={`grid gap-3.5 ${
                courtCount === 1
                  ? 'grid-cols-1'
                  : courtCount === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : courtCount === 3
                  ? 'grid-cols-1 md:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {courtData.map(
                ({ courtNum, courtName, currentMatch, isLive, nextMatch, lastFinished }) => {
                  const courtColors: Record<
                    number,
                    { border: string; badge: string; text: string; lightBg: string }
                  > = {
                    1: {
                      border: 'border-blue-200 dark:border-blue-800/60',
                      badge: 'bg-blue-600 text-white',
                      text: 'text-blue-700 dark:text-blue-300',
                      lightBg: 'bg-blue-50/40 dark:bg-blue-950/20',
                    },
                    2: {
                      border: 'border-indigo-200 dark:border-indigo-800/60',
                      badge: 'bg-indigo-600 text-white',
                      text: 'text-indigo-700 dark:text-indigo-300',
                      lightBg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
                    },
                    3: {
                      border: 'border-emerald-200 dark:border-emerald-800/60',
                      badge: 'bg-emerald-600 text-white',
                      text: 'text-emerald-700 dark:text-emerald-300',
                      lightBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
                    },
                    4: {
                      border: 'border-amber-200 dark:border-amber-800/60',
                      badge: 'bg-amber-600 text-white',
                      text: 'text-amber-700 dark:text-amber-300',
                      lightBg: 'bg-amber-50/40 dark:bg-amber-950/20',
                    },
                    5: {
                      border: 'border-purple-200 dark:border-purple-800/60',
                      badge: 'bg-purple-600 text-white',
                      text: 'text-purple-700 dark:text-purple-300',
                      lightBg: 'bg-purple-50/40 dark:bg-purple-950/20',
                    },
                    6: {
                      border: 'border-teal-200 dark:border-teal-800/60',
                      badge: 'bg-teal-600 text-white',
                      text: 'text-teal-700 dark:text-teal-300',
                      lightBg: 'bg-teal-50/40 dark:bg-teal-950/20',
                    },
                    7: {
                      border: 'border-rose-200 dark:border-rose-800/60',
                      badge: 'bg-rose-600 text-white',
                      text: 'text-rose-700 dark:text-rose-300',
                      lightBg: 'bg-rose-50/40 dark:bg-rose-950/20',
                    },
                    8: {
                      border: 'border-cyan-200 dark:border-cyan-800/60',
                      badge: 'bg-cyan-600 text-white',
                      text: 'text-cyan-700 dark:text-cyan-300',
                      lightBg: 'bg-cyan-50/40 dark:bg-cyan-950/20',
                    },
                  };
                  const cStyle = courtColors[courtNum] || courtColors[1];

                  const matchToShow = currentMatch || lastFinished;
                  const isCompleted = !currentMatch && Boolean(lastFinished);

                  return (
                    <div
                      key={courtNum}
                      className={`rounded-2xl border ${cStyle.border} ${cStyle.lightBg} bg-white dark:bg-zinc-900 p-3.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all`}
                    >
                      {/* コート上部情報 */}
                      <div>
                        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide ${cStyle.badge}`}
                            >
                              {courtName}
                            </span>
                            {matchToShow?.slot && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                第{matchToShow.slot}試合
                              </span>
                            )}
                          </div>
                          {isLive ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span>LIVE 進行中</span>
                            </span>
                          ) : currentMatch ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              待機・次戦
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              全試合終了
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">割当なし</span>
                          )}
                        </div>

                        {/* 対戦カード & スコア */}
                        {matchToShow ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-black text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                              <span>
                                {matchToShow.roundName} #{matchToShow.matchNumber}
                              </span>
                              {isCompleted && <span className="text-zinc-500 font-bold">最終結果</span>}
                            </div>

                            {/* チーム1 */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
                                matchToShow.winnerId === matchToShow.team1Id
                                  ? 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 font-bold'
                                  : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                              }`}
                            >
                              <div className="truncate pr-2 text-xs sm:text-sm text-zinc-950 dark:text-zinc-50 font-bold">
                                {matchToShow.team1Id
                                  ? teamMap.get(matchToShow.team1Id)?.name
                                  : '未定'}
                              </div>
                              <div className="font-mono font-black text-base sm:text-lg text-indigo-700 dark:text-indigo-400 shrink-0">
                                {matchToShow.team1Sets}
                              </div>
                            </div>

                            {/* チーム2 */}
                            <div
                              className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors shadow-2xs ${
                                matchToShow.winnerId === matchToShow.team2Id
                                  ? 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 font-bold'
                                  : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700'
                              }`}
                            >
                              <div className="truncate pr-2 text-xs sm:text-sm text-zinc-950 dark:text-zinc-50 font-bold">
                                {matchToShow.team2Id
                                  ? teamMap.get(matchToShow.team2Id)?.name
                                  : '未定'}
                              </div>
                              <div className="font-mono font-black text-base sm:text-lg text-indigo-700 dark:text-indigo-400 shrink-0">
                                {matchToShow.team2Sets}
                              </div>
                            </div>

                            {/* 現在セットの得点状況 */}
                            {matchToShow.sets && matchToShow.sets.length > 0 && (
                              <div className="pt-1.5 flex items-center justify-between text-xs font-mono text-zinc-800 dark:text-zinc-200">
                                <span className="font-bold text-zinc-600 dark:text-zinc-400">得点:</span>
                                <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                                  {matchToShow.sets
                                    .map((s, idx) => `S${idx + 1}: ${s.team1 ?? 0}-${s.team2 ?? 0}`)
                                    .join(' | ')}
                                </span>
                              </div>
                            )}

                            {/* 審判担当 */}
                            {matchToShow.referee && (
                              <div className="text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 truncate pt-1">
                                <span className="font-bold text-indigo-700 dark:text-indigo-400 shrink-0">📢 審判:</span>
                                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                                  {matchToShow.referee}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs font-semibold text-zinc-500">
                            予定された試合はありません
                          </div>
                        )}
                      </div>

                      {/* 次の試合予告 */}
                      {nextMatch && (
                        <div className="mt-3 pt-2.5 border-t border-zinc-300/80 dark:border-zinc-700/80 text-xs text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                          <span className="font-black text-indigo-700 dark:text-indigo-400 shrink-0">
                            次戦:
                          </span>
                          <span className="truncate ml-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                            {nextMatch.team1Id ? teamMap.get(nextMatch.team1Id)?.name : '未定'} vs{' '}
                            {nextMatch.team2Id ? teamMap.get(nextMatch.team2Id)?.name : '未定'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </section>

        {/* セクション3: 決勝トーナメント ブラケット */}
        <section id="section-bracket" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              決勝トーナメント (8チーム)
            </h2>
            <span className="text-xs opacity-75">上ブロック・下ブロック</span>
          </div>
          <div
            className={`p-3 sm:p-6 rounded-2xl ${theme.classes.cardBg} border ${theme.classes.cardBorder} overflow-x-auto`}
          >
            <BracketView matches={matches} teams={teams} isDark={theme.isDark} />
          </div>
        </section>

        {/* セクション4: 予選リーグ順位表 */}
        <section id="section-standings" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              予選リーグ順位 (全5グループ A〜E)
            </h2>
            <span className="text-xs opacity-75">上位8チームが決勝T進出</span>
          </div>
          <StandingsTable standings={standings} isDark={theme.isDark} />
        </section>

        {/* セクション5: 最近完了した試合一覧 */}
        {finishedMatches.length > 0 && (
          <section id="section-results" className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              最近の試合結果
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {finishedMatches.map((m) => {
                const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name : '未定';
                const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name : '未定';
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl ${theme.classes.cardBg} border ${theme.classes.cardBorder} text-xs space-y-2`}
                  >
                    <div className="text-[11px] opacity-75 flex justify-between">
                      <span className="font-semibold">{m.roundName}</span>
                      <span className="text-emerald-500 font-bold">終了</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span
                        className={`truncate ${m.winnerId === m.team1Id ? 'font-bold text-indigo-500' : 'opacity-75'}`}
                      >
                        {t1}
                      </span>
                      <span className="font-mono font-bold ml-2">{m.team1Sets}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span
                        className={`truncate ${m.winnerId === m.team2Id ? 'font-bold text-indigo-500' : 'opacity-75'}`}
                      >
                        {t2}
                      </span>
                      <span className="font-mono font-bold ml-2">{m.team2Sets}</span>
                    </div>
                    {/* セット得点 */}
                    {m.sets && m.sets.length > 0 && (
                      <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        <span>得点:</span>
                        <span className="font-bold">
                          {m.sets.map((s, idx) => `S${idx + 1}:${s.team1 ?? 0}-${s.team2 ?? 0}`).join(' ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 最終更新表示 */}
        <footer className="pt-6 border-t border-zinc-500/20 flex flex-col sm:flex-row items-center justify-between text-xs opacity-75 gap-2">
          <div>
            最終同期: {updatedAt ? new Date(updatedAt).toLocaleTimeString('ja-JP') : '未同期'}
            {updatedBy && ` (${updatedBy})`}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAwardsOpen(true)}
              className="hover:underline font-semibold"
            >
              表彰状・結果サマリー
            </button>
            <span>•</span>
            <Link to="/monitor" className="hover:underline font-semibold">
              大型モニター
            </Link>
          </div>
        </footer>
      </main>

      {/* スマホ固定ボトムナビゲーションバー */}
      <MobileNavBar
        activeTab={activeNavTab}
        onSelectTab={handleSelectNavTab}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenMvp={() => setIsMvpOpen(true)}
        onOpenAwards={() => setIsAwardsOpen(true)}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* モバイル用スライドオーバードロワー / フルメニュー */}
      {isMobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
          }}
        >
          <div
            className="w-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏐</span>
                <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  大会メニュー
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* テーマ変更セクション */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span>🎨</span>
                <span>カラーテーマの変更 (4パターン)</span>
              </div>
              <ThemeSelector variant="inline" />
            </div>

            {/* クイックアクションボタン */}
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                大会コンテンツ
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsRulesOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                  <span className="text-base">📋</span>
                  <span>大会ルール</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsMvpOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                  <span className="text-base">⭐</span>
                  <span>MVP投票</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAwardsOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-yellow-200 dark:border-yellow-900/60 bg-yellow-50/50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                  <span className="text-base">🏆</span>
                  <span>表彰状・結果</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsPrintOpen(true);
                  }}
                  className="p-3 rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center gap-2 text-xs font-bold cursor-pointer"
                >
                  <span className="text-base">📸</span>
                  <span>A4画像保存・印刷</span>
                </button>

                <Link
                  to="/referee"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 flex items-center gap-2 text-xs font-bold"
                >
                  <span className="text-base">🏐</span>
                  <span>審判・得点板</span>
                </Link>

                <Link
                  to="/monitor"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs font-bold"
                >
                  <span className="text-base">📺</span>
                  <span>大型モニター</span>
                </Link>

                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center gap-2 text-xs font-bold"
                >
                  <span className="text-base">⚙️</span>
                  <span>運営管理</span>
                </Link>
              </div>

              {/* 閲覧専用共有URL発行 */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsShareModalOpen(true);
                }}
                className="w-full mt-3 p-3 rounded-2xl bg-indigo-600 text-white flex items-center justify-center gap-2 text-xs font-bold shadow-xs cursor-pointer"
              >
                <span className="text-base">🔗</span>
                <span>閲覧専用共有URLを発行 (QRコード)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs shadow-sm mt-2"
            >
              メニューを閉じる
            </button>
          </div>
        </div>
      )}

      {/* 表彰状＆サマリーモーダル */}
      <AwardsModal
        isOpen={isAwardsOpen}
        onClose={() => setIsAwardsOpen(false)}
        teams={teams}
        matches={matches}
        settings={settings}
        standings={standings}
      />

      {/* A4大会シート印刷・画像保存モーダル */}
      <PrintSheetsModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        teams={teams}
        matches={matches}
        settings={settings}
        standings={standings}
      />

      {/* 大会ルール＆注意事項モーダル */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* 閲覧専用URL発行モーダル */}
      <ShareUrlModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* MVP＆敢闘賞投票モーダル */}
      <MvpVotingModal isOpen={isMvpOpen} onClose={() => setIsMvpOpen(false)} />
    </div>
  );
};
