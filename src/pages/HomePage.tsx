import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AwardsModal } from '../components/AwardsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { MvpVotingModal } from '../components/MvpVotingModal';
import { PrintSheetsModal } from '../components/PrintSheetsModal';
import { RulesModal } from '../components/RulesModal';
import { ShareUrlModal } from '../components/ShareUrlModal';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { exportJson, importJson } from '../data/repository';
import { useTheme } from '../state/ThemeContext';
import { useTournament } from '../state/TournamentContext';

export const HomePage: React.FC = () => {
  const { state, dispatch, standings } = useTournament();
  const { settings, teams, matches, updatedAt, updatedBy } = state;
  const { theme } = useTheme();

  const [importError, setImportError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isAwardsOpen, setIsAwardsOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isMvpOpen, setIsMvpOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedMatchesCount = matches.filter((m) => m.status === 'completed').length;
  const isFinalCompleted = matches.some((m) => m.round === 'final' && m.status === 'completed');

  // JSONエクスポート
  const handleExport = () => {
    try {
      const jsonStr = exportJson(state);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `volleyball_tournament_${settings.date || 'data'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg('大会データをJSONファイルとしてエクスポートしました。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  // JSONインポート（ファイル選択）
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importJson(text);
        dispatch({ type: 'IMPORT', payload: imported });
        setSuccessMsg('JSONファイルから大会データを復元しました。');
        setTimeout(() => setSuccessMsg(''), 4000);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'インポートに失敗しました。');
      }
    };
    reader.readAsText(file);
  };

  // 全リセット実行
  const handleExecuteReset = () => {
    dispatch({ type: 'RESET' });
    setIsResetModalOpen(false);
    setSuccessMsg('データを初期状態にリセットしました。');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div
      className={`min-h-screen ${theme.classes.pageBg} flex flex-col justify-between transition-colors duration-200`}
    >
      {/* ナビゲーションバー */}
      <header
        className={`${theme.classes.headerBg} border-b ${theme.classes.headerBorder} sticky top-0 z-30 transition-colors`}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <span className="text-xl sm:text-2xl shrink-0">🏐</span>
            <div className="min-w-0">
              <span className="font-bold text-sm sm:text-base truncate block max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-none">
                {settings.name || '社内バレーボール大会'}
              </span>
              <span className="hidden md:inline-block text-xs opacity-75 truncate">
                運営・観客リアルタイム同期システム
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* デザイン・カラーテーマ変更ボタン (最重要) */}
            <div className="block sm:hidden">
              <ThemeSelector variant="compact" />
            </div>
            <div className="hidden sm:block">
              <ThemeSelector variant="button" />
            </div>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs font-bold p-1.5 sm:px-3 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
              title="観客・選手用閲覧専用URL（QRコード）を発行・共有"
            >
              <span className="text-sm sm:text-base leading-none">🔗</span>
              <span className="inline">共有URL発行</span>
            </button>

            <button
              onClick={() => setIsRulesOpen(true)}
              className="text-xs font-semibold p-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/90 dark:bg-zinc-800/90 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
              title="大会ルール・注意事項を確認"
            >
              <span className="text-sm sm:text-base leading-none">📋</span>
              <span className="hidden md:inline">大会ルール</span>
            </button>
            <button
              onClick={() => setIsMvpOpen(true)}
              className="text-xs font-semibold p-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/90 dark:bg-zinc-800/90 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
              title="本日一番輝いた選手に投票"
            >
              <span className="text-sm sm:text-base leading-none">⭐</span>
              <span className="hidden md:inline">MVP投票</span>
            </button>
            <Link
              to="/viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap"
              title="閲覧専用モニターを別ウィンドウで開く"
            >
              <span>👁️</span>
              <span className="inline">閲覧モニター</span>
              <span className="text-[10px] opacity-80">↗</span>
            </Link>
            <Link
              to="/admin"
              className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white shadow-xs flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>⚙️</span>
              <span className="hidden xs:inline">管理</span>
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1 w-full">
        {/* 通知メッセージ */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-sm font-medium flex items-center justify-between animate-fade-in">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500">✕</button>
          </div>
        )}
        {importError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-sm font-medium flex items-center justify-between animate-fade-in">
            <span>⚠️ {importError}</span>
            <button onClick={() => setImportError('')} className="text-red-500">✕</button>
          </div>
        )}

        {/* 大会概要カード */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SyncStatusBadge />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                (最終更新: {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              {settings.name}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              5グループ（A〜E組）並列予選リーグから決勝トーナメント・下位順位戦まで、全自動順位集計と審判自動割当・リアルタイム同期に対応しています。
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block font-medium">開催日程</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                {settings.date || '本日'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block font-medium">開催会場</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block truncate">
                {settings.venue}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block font-medium">参加チーム</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block font-mono">
                {teams.length} チーム
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400 block font-medium">消化試合数</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block font-mono">
                {completedMatchesCount} / {matches.length}
              </span>
            </div>
          </div>

          {/* カラーテーマ変更パレット (4種類をその場で切り替え可能) */}
          <div
            id="homepage-theme-palette"
            className="p-4 sm:p-5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎨</span>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>デザイン・カラーテーマの変更</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-mono font-bold">
                      全4パターン
                    </span>
                  </h3>
                  <p className="text-xs opacity-75">
                    ワンタップで全体の配色（ダーク/ライト/アリーナ/サンセット）が即座に切り替わります
                  </p>
                </div>
              </div>
              <div className="text-xs font-bold shrink-0">
                現在適用中: <span className="text-indigo-500 font-extrabold">{theme.name}</span>
              </div>
            </div>
            <ThemeSelector variant="inline" />
          </div>

          {/* 画面遷移ショートカット */}
          <div className="space-y-3 pt-2">
            {/* 共有用閲覧専用モニター（特別ハイライト・別ウィンドウで開く） */}
            <Link
              to="/viewer"
              target="_blank"
              rel="noopener noreferrer"
              id="goto-viewer-page-btn"
              className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 hover:from-indigo-500/20 hover:via-purple-500/20 hover:to-pink-500/20 border-2 border-indigo-400 dark:border-indigo-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xs shrink-0">
                  🔒
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                      参加者・観客共有用（閲覧専用）
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span>別ウィンドウで開く</span>
                      <span>↗</span>
                    </span>
                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      管理操作・編集不可ガード
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-2">
                    <span>閲覧専用モニター / 観戦ポータル</span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">↗</span>
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    コート進行状況、マイチームの試合・審判、予選星取表＆決勝トーナメントのみを安全に閲覧できます
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-center font-bold text-xs text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0">
                <span>別ウィンドウで開く</span>
                <span>↗</span>
              </div>
            </Link>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Link
                to="/referee"
                id="goto-referee-page-btn"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-600 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      審判・得点係向け（スマホ対応）
                    </span>
                    <span className="text-base text-zinc-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all">→</span>
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2.5 flex items-center gap-2">
                    <span className="text-xl">🏐</span>
                    <span>審判・得点板モード</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    スマホタップで＋1点／特別ルール女子得点＋2点／即座同期
                  </p>
                </div>
              </Link>

              <Link
                to="/monitor"
                id="goto-monitor-page-btn"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      体育館プロジェクター用
                    </span>
                    <span className="text-base text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all">→</span>
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2.5 flex items-center gap-2">
                    <span className="text-xl">📺</span>
                    <span>大型モニター表示モード</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    全コートの進行状況・現在スコア・審判を大画面表示
                  </p>
                </div>
              </Link>

              <Link
                to="/admin"
                id="goto-admin-page-btn"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      運営本部専用
                    </span>
                    <span className="text-base text-zinc-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">→</span>
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-2.5 flex items-center gap-2">
                    <span className="text-xl">⚙️</span>
                    <span>運営管理コンソール</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    コート面数・リーグ数設定、自動割り振り、チーム管理
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* 当日用クイックアクションツール群 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* 大会ルール・注意事項ボタン */}
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all flex items-center gap-3 font-bold text-xs text-left shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl shrink-0">
                📋
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">大会ルール・特別ルール・注意事項</div>
                <div className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400 truncate">
                  15点先取（3セット目10点・デュース無）・女子得点2点等
                </div>
              </div>
            </button>

            {/* A4印刷 & 画像保存モーダルボタン */}
            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all flex items-center gap-3 font-bold text-xs text-left shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-xl shrink-0">
                📸
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>A4印刷 ＆ 高画質画像保存</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold">PNG保存</span>
                </div>
                <div className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400 truncate">
                  星取表・トーナメント表・進行表をA4印刷や画像保存
                </div>
              </div>
            </button>

            {/* MVP投票ボタン */}
            <button
              type="button"
              onClick={() => setIsMvpOpen(true)}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all flex items-center gap-3 font-bold text-xs text-left shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xl shrink-0">
                ⭐
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">大会MVP ＆ 敢闘賞 リアルタイム投票</div>
                <div className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400 truncate">
                  本日輝いていた選手に1票！推薦コメント＆結果集計
                </div>
              </div>
            </button>

            {/* 表彰状・結果サマリー自動作成ボタン */}
            <button
              type="button"
              onClick={() => setIsAwardsOpen(true)}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all flex items-center gap-3 font-bold text-xs text-left shadow-xs cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-xl shrink-0">
                🏆
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">表彰状 ＆ 社内連絡用サマリー作成</div>
                <div className="text-[11px] font-normal text-zinc-600 dark:text-zinc-400 truncate">
                  賞状A4印刷 ＆ Slack/Teams報告テキストを即時生成
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* データバックアップ & 復元 / 初期化 */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              データのエクスポート・インポート・初期化
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              オフライン保存や大会引き継ぎ用のJSONバックアップ、および全リセット機能です。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="export-json-btn"
              type="button"
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5"
            >
              <span>📥</span>
              <span>JSONエクスポート</span>
            </button>

            <label className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
              <span>📤</span>
              <span>JSONインポート</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <button
              id="reset-all-btn"
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold text-xs flex items-center gap-1.5 ml-auto transition-colors"
            >
              <span>🗑️</span>
              <span>全データをリセット</span>
            </button>
          </div>
        </section>
      </main>

      {/* リセット確認モーダル */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="全データ初期化（リセット）"
        message={`⚠️ 本当に大会データを初期化（全リセット）しますか？\n現在の試合結果、スコア、チーム構成などはすべて初期状態に戻ります。\n\n※この操作は取り消せません。事前にJSONエクスポートでのバックアップをお勧めします。`}
        confirmText="初期状態にリセット"
        isDangerous={true}
        onConfirm={handleExecuteReset}
        onCancel={() => setIsResetModalOpen(false)}
      />

      {/* 表彰状＆サマリーモーダル */}
      <AwardsModal
        isOpen={isAwardsOpen}
        onClose={() => setIsAwardsOpen(false)}
        teams={teams}
        matches={matches}
        settings={settings}
        standings={standings}
      />

      {/* 大会ルール＆注意事項モーダル */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* MVP＆敢闘賞投票モーダル */}
      <MvpVotingModal isOpen={isMvpOpen} onClose={() => setIsMvpOpen(false)} />

      {/* A4印刷＆PDF保存モーダル */}
      <PrintSheetsModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        teams={teams}
        matches={matches}
        settings={settings}
        standings={standings}
      />

      {/* 閲覧専用URL発行モーダル */}
      <ShareUrlModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* フッター */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 gap-2">
          <div>
            最終同期: {updatedAt ? new Date(updatedAt).toLocaleString('ja-JP') : '未同期'}
            {updatedBy && ` (${updatedBy})`}
          </div>
          <div>社内バレーボール大会運営Webアプリ</div>
        </div>
      </footer>
    </div>
  );
};
