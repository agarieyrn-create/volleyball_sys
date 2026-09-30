import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AwardsModal } from '../components/AwardsModal';
import { BracketView } from '../components/BracketView';
import { ConfirmModal } from '../components/ConfirmModal';
import { CourtScheduleView } from '../components/CourtScheduleView';
import { ManualMatchEditModal } from '../components/ManualMatchEditModal';
import { PasswordGate } from '../components/PasswordGate';
import { PrintSheetsModal } from '../components/PrintSheetsModal';
import { RefereeBalanceModal } from '../components/RefereeBalanceModal';
import { RulesModal } from '../components/RulesModal';
import { ScoreModal } from '../components/ScoreModal';
import { ShareUrlModal } from '../components/ShareUrlModal';
import { StandingsTable } from '../components/StandingsTable';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { CourtLeagueConfigPanel } from '../components/CourtLeagueConfigPanel';
import { PRESET_EXPAND_TEAMS_UP_TO_20 } from '../data/defaults';
import { isSessionUnlocked, setSessionUnlocked } from '../auth/gate';
import { getCourtName } from '../logic/court';
import { useTournament } from '../state/TournamentContext';
import { Match, SetScore, Settings, Team } from '../types';

type AdminTab = 'settings' | 'teams' | 'league' | 'tournament' | 'standings';

export const AdminPage: React.FC = () => {
  const { state, dispatch, standings, deviceLabel, updateDeviceLabel, saveNow } = useTournament();
  const { settings, teams, matches, updatedAt, updatedBy } = state;

  const [activeTab, setActiveTab] = useState<AdminTab>('league');
  const [leagueSubTab, setLeagueSubTab] = useState<'schedule' | 'pools' | 'allMatches'>('schedule');
  const [tournamentSubTab, setTournamentSubTab] = useState<'bracket' | 'schedule'>('bracket');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [manualEditMatch, setManualEditMatch] = useState<Match | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState<boolean>(false);
  const [isManualEditOpen, setIsManualEditOpen] = useState<boolean>(false);
  const [isAwardsOpen, setIsAwardsOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isRefereeBalanceOpen, setIsRefereeBalanceOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamPool, setNewTeamPool] = useState<string>('auto');
  const [saveToast, setSaveToast] = useState<string>('');
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);

  useEffect(() => {
    setAdminUnlocked(isSessionUnlocked());
    const handleAuthChange = () => setAdminUnlocked(isSessionUnlocked());
    window.addEventListener('admin_auth_change', handleAuthChange);
    return () => window.removeEventListener('admin_auth_change', handleAuthChange);
  }, []);

  // カスタム確認モーダル用の state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const closeConfirm = () => {
    setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // 予選完了チェック
  const leagueMatches = matches.filter((m) => m.round === 'league');
  const completedLeagueMatches = leagueMatches.filter((m) => m.status === 'completed');
  const isLeagueAllCompleted = leagueMatches.length > 0 && completedLeagueMatches.length === leagueMatches.length;

  const handleOpenScoreModal = (match: Match) => {
    setSelectedMatch(match);
    setIsScoreModalOpen(true);
  };

  const handleOpenManualEditModal = (match: Match) => {
    setManualEditMatch(match);
    setIsManualEditOpen(true);
  };

  const handleSaveManualMatch = (matchId: string, updates: Partial<Match>) => {
    dispatch({
      type: 'UPDATE_MATCH_MANUAL',
      payload: { matchId, updates },
    });
    showToast('試合データを手動更新しました');
  };

  const handleDeleteMatch = (matchId: string) => {
    dispatch({
      type: 'DELETE_MATCH',
      payload: { matchId },
    });
    showToast('試合を削除しました');
  };

  const handleAddManualMatch = () => {
    const nextMatchNumber = matches.length + 1;
    dispatch({
      type: 'ADD_MANUAL_MATCH',
      payload: {
        round: 'league',
        roundName: '臨時追加試合',
        matchNumber: nextMatchNumber,
        court: 1,
        slot: 1,
        status: 'pending',
      },
    });
    showToast('臨時試合を追加しました。「🛠️ 手動修正」から詳細を設定できます');
  };

  const handleReassignCourts = (count: number) => {
    dispatch({
      type: 'REASSIGN_COURTS',
      payload: { courtCount: count },
    });
    showToast(`${count}面コートに合わせて全試合の同時進行枠とコートを自動再割り当てしました`);
  };

  const handleAssignReferees = (force: boolean = true) => {
    dispatch({
      type: 'ASSIGN_REFEREES',
      payload: { force },
    });
    showToast('全試合の得点板担当を「自分たちの試合コートと同じコート」から自動再割り当てしました！');
  };

  const handleShuffleTeamsAndRegenerate = () => {
    if (
      window.confirm(
        '【チーム組み合わせのランダム再編成】\n参加チームのグループ分けをランダムにシャッフルし、予選リーグ対戦表と自コート得点板担当を新しく再生成します。\n現在のスコア結果はリセットされます。実行してもよろしいですか？'
      )
    ) {
      dispatch({ type: 'SHUFFLE_TEAMS_AND_REGENERATE' });
      showToast('🎲 チーム組み合わせをランダムに再編成し、予選リーグと自コート得点板を更新しました！');
    }
  };

  const handleSaveScore = (matchId: string, sets: SetScore[]) => {
    dispatch({
      type: 'SAVE_SCORE',
      payload: { matchId, sets },
    });
    showToast('スコアを保存し、順位・トーナメントを再計算しました');
  };

  const handleRefereeBlur = (matchId: string, referee: string) => {
    dispatch({
      type: 'UPDATE_REFEREE',
      payload: { matchId, referee },
    });
  };

  const handleCourtChange = (matchId: string, court: number) => {
    dispatch({
      type: 'UPDATE_MATCH_COURT',
      payload: { matchId, court },
    });
    showToast(`試合のコートを「${getCourtName(court)}」に変更しました`);
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 3500);
  };

  // チーム追加
  const handleAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    let targetPool = 'A';
    const leagueCount = settings.leagueCount || 4;
    const availablePools = Array.from({ length: leagueCount }, (_, i) => String.fromCharCode(65 + i));

    if (newTeamPool === 'auto') {
      // チーム数が最少のプールを探索
      const counts: Record<string, number> = {};
      availablePools.forEach((p) => { counts[p] = 0; });
      teams.forEach((t) => {
        if (t.pool && counts[t.pool] !== undefined) {
          counts[t.pool]++;
        }
      });
      targetPool = availablePools.reduce((a, b) =>
        counts[a] <= counts[b] ? a : b
      , availablePools[0]);
    } else {
      targetPool = newTeamPool;
    }

    const newTeam: Team = {
      id: `team_${Date.now()}`,
      name: newTeamName.trim(),
      pool: targetPool,
    };
    dispatch({
      type: 'SET_TEAMS',
      payload: [...teams, newTeam],
    });
    setNewTeamName('');
    showToast(`チーム「${newTeam.name}」をグループ ${targetPool} に追加しました（現在${teams.length + 1}チーム）`);
  };

  // 最大20チームまでのワンクリック拡充
  const handleExpandTo20Teams = () => {
    if (teams.length >= 20) {
      showToast('チーム数は既に20チームに達しています。');
      return;
    }
    const needed = 20 - teams.length;
    const existingNames = new Set(teams.map((t) => t.name));
    const newTeams: Team[] = [];

    // プリセットから未登録のチームを優先補完
    for (const p of PRESET_EXPAND_TEAMS_UP_TO_20) {
      if (newTeams.length >= needed) break;
      if (!existingNames.has(p.name)) {
        newTeams.push({
          id: `team_${Date.now()}_${newTeams.length}`,
          name: p.name,
          pool: p.pool || 'A',
        });
      }
    }

    // それでも不足する場合は連番で補完
    let counter = 1;
    while (newTeams.length < needed) {
      const candidate = `第${teams.length + newTeams.length + 1}チーム`;
      if (!existingNames.has(candidate)) {
        newTeams.push({
          id: `team_${Date.now()}_${newTeams.length}`,
          name: candidate,
          pool: 'A',
        });
      }
      counter++;
      if (counter > 50) break;
    }

    const nextTeams = [...teams, ...newTeams];
    dispatch({
      type: 'SET_TEAMS',
      payload: nextTeams,
    });
    // 均等配分も適用
    dispatch({ type: 'REDISTRIBUTE_TEAMS' });
    showToast(`20チームまでワンクリック拡充しました（＋${newTeams.length}チーム追加）`);
  };

  // チーム名編集
  const handleUpdateTeamName = (id: string, name: string) => {
    const updated = teams.map((t) => (t.id === id ? { ...t, name } : t));
    dispatch({ type: 'SET_TEAMS', payload: updated });
  };

  // チームグループ変更
  const handleUpdateTeamPool = (id: string, pool: string) => {
    dispatch({
      type: 'UPDATE_TEAM_POOL',
      payload: { teamId: id, pool },
    });
    showToast(`所属グループをグループ ${pool} に変更しました`);
  };

  // チーム削除（自前モーダルで安全に確認）
  const handleDeleteTeam = (id: string, teamName: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'チームの削除',
      message: `チーム「${teamName}」を削除しますか？\n削除すると、このチームの未完了試合からも除外されます。`,
      confirmText: '削除する',
      isDangerous: true,
      onConfirm: () => {
        dispatch({ type: 'DELETE_TEAM', payload: { teamId: id } });
        closeConfirm();
        showToast(`チーム「${teamName}」を削除しました`);
      },
    });
  };

  // リーグ数に応じた均等自動再配分
  const handleRedistributeTeams = () => {
    const currentLeagueCount = settings.leagueCount || 4;
    setConfirmConfig({
      isOpen: true,
      title: `${currentLeagueCount}グループ均等再配分`,
      message: `全チームを${currentLeagueCount}グループに均等に再配分しますか？\n配分後は予選リーグ対戦表の再生成を行ってください。`,
      confirmText: '均等再配分する',
      isDangerous: false,
      onConfirm: () => {
        dispatch({ type: 'REDISTRIBUTE_TEAMS' });
        closeConfirm();
        showToast(`全チームを${currentLeagueCount}グループに均等再配分しました`);
      },
    });
  };

  // リーグ数・コート数の任意変更＆ワンクリック自動割り振り
  const handleAutoAssign = (targetLeagueCount: number, targetCourtCount: number) => {
    if (teams.length < 2) {
      showToast('⚠️ 予選リーグを編成するには最低2チーム必要です。');
      return;
    }
    const hasScores = matches.some(
      (m) =>
        m.status === 'completed' ||
        (m.sets && m.sets.some((s) => (s.team1 || 0) > 0 || (s.team2 || 0) > 0))
    );

    const execute = () => {
      dispatch({
        type: 'AUTO_ASSIGN_LEAGUES_AND_COURTS',
        payload: { leagueCount: targetLeagueCount, courtCount: targetCourtCount },
      });
      showToast(
        `全${teams.length}チームを【${targetLeagueCount}リーグ】・【コート${targetCourtCount}面】に自動割り振りました！`
      );
      saveNow();
    };

    if (hasScores) {
      setConfirmConfig({
        isOpen: true,
        title: 'リーグ編成＆コート自動割り振りの確認',
        message: `リーグ数を【${targetLeagueCount}リーグ】、使用コート数を【${targetCourtCount}面】に設定し、チーム均等配分・対戦表生成・コート進行枠・審判割当をすべて自動再編成します。\n※現在の入力済みスコアや結果はリセットされます。よろしいですか？`,
        confirmText: '自動割り振りを実行',
        isDangerous: true,
        onConfirm: () => {
          closeConfirm();
          execute();
        },
      });
    } else {
      execute();
    }
  };

  // 予選リーグ生成
  const handleGenerateLeague = () => {
    if (teams.length < 4) {
      showToast('⚠️ 予選リーグを生成するには最低4チーム必要です。');
      return;
    }
    if (matches.length > 0) {
      setConfirmConfig({
        isOpen: true,
        title: '予選リーグ再生成の確認',
        message: '予選リーグを再生成すると、現在の試合結果・スコア・審判割当がリセットされます。\n実行しますか？',
        confirmText: '再生成する',
        isDangerous: true,
        onConfirm: () => {
          dispatch({ type: 'GENERATE_LEAGUE' });
          closeConfirm();
          showToast('4リーグの予選対戦表（各チーム2試合）を生成しました');
        },
      });
      return;
    }
    dispatch({ type: 'GENERATE_LEAGUE' });
    showToast('4リーグの予選対戦表（各チーム2試合）を生成しました');
  };

  // 決勝トーナメント生成
  const handleGenerateFinal = () => {
    if (!isLeagueAllCompleted) {
      setConfirmConfig({
        isOpen: true,
        title: '決勝トーナメント生成の確認',
        message: '予選リーグの全試合がまだ完了していません。\n現在の暫定上位8チームで決勝トーナメントを生成しますか？',
        confirmText: 'トーナメント生成',
        isDangerous: false,
        onConfirm: () => {
          dispatch({ type: 'GENERATE_FINAL' });
          setActiveTab('tournament');
          closeConfirm();
          showToast('決勝トーナメント（8チーム・上/下ブロック）を生成しました');
        },
      });
      return;
    }
    dispatch({ type: 'GENERATE_FINAL' });
    setActiveTab('tournament');
    showToast('決勝トーナメント（8チーム・上/下ブロック）を生成しました');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16">
      {/* 管理ヘッダー */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <Link to="/" className="text-xl sm:text-2xl shrink-0">🏐</Link>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base leading-tight flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="truncate">運営管理</span>
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  ADMIN
                </span>
                {adminUnlocked && (
                  <button
                    type="button"
                    onClick={() => setSessionUnlocked(false)}
                    className="text-[10px] text-rose-600 hover:text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="管理画面をロックしてログアウト"
                  >
                    🔒 ロック
                  </button>
                )}
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-500 truncate">{settings.name} • {settings.venue}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 shrink min-w-0 scrollbar-none">
            {/* クラウド同期ステータス */}
            <SyncStatusBadge />

            {/* テーマ・デザイン切替 */}
            <ThemeSelector variant="compact" />

            {/* 閲覧専用URL発行（QRコード・リンク） */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 p-1.5 sm:px-3 sm:py-1.5 rounded-xl flex items-center gap-1 font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="観客・選手用閲覧専用URL（QRコード）を発行・共有"
            >
              <span>🔗</span>
              <span className="inline">共有URL発行</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 flex items-center gap-1 font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="大会ルール・特別ルール・注意事項を確認"
            >
              <span>📋</span>
              <span className="hidden xl:inline">ルール</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintOpen(true)}
              className="text-xs text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 flex items-center gap-1 font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="A4サイズ対戦表・進行表の一括印刷・PNG画像保存"
            >
              <span>📸</span>
              <span className="hidden xl:inline">印刷/A4</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAwardsOpen(true)}
              className="text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 flex items-center gap-1 font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="表彰状・大会結果サマリーを開く"
            >
              <span>🏆</span>
              <span className="hidden xl:inline">表彰状</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRefereeBalanceOpen(true)}
              className="text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 flex items-center gap-1 font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="得点板・審判の担当バランス確認（偏りなし検証）"
            >
              <span>⚖️</span>
              <span className="hidden xl:inline">得点板バランス</span>
            </button>

            <Link
              to="/referee"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/40 flex items-center gap-1 font-bold transition-colors shrink-0 whitespace-nowrap"
              title="審判・得点板モードを開く"
            >
              <span>🏐</span>
              <span className="hidden lg:inline">得点板</span>
            </Link>

            <Link
              to="/monitor"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 flex items-center gap-1 font-bold transition-colors shrink-0 whitespace-nowrap"
              title="体育館用大型モニター画面を開く"
            >
              <span>📺</span>
              <span className="hidden lg:inline">モニター</span>
            </Link>

            <Link
              to="/viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 flex items-center gap-1 font-bold transition-colors shrink-0 whitespace-nowrap"
              title="閲覧専用モニターを別ウィンドウで開く（観客・選手共有用・管理操作ガード）"
            >
              <span>👁️</span>
              <span className="hidden lg:inline">閲覧モニター</span>
              <span className="text-[10px] opacity-70">↗</span>
            </Link>
            <Link
              to="/"
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 shrink-0 whitespace-nowrap"
            >
              トップ
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {saveToast && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-between animate-fade-in">
            <span>✓ {saveToast}</span>
            <button onClick={() => setSaveToast('')} className="text-emerald-200 hover:text-white">✕</button>
          </div>
        )}

        <PasswordGate>
          {/* タブナビゲーション */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto gap-1">
            {[
              { key: 'league', label: '予選リーグ', icon: '🏐' },
              { key: 'tournament', label: '決勝トーナメント', icon: '🏆' },
              { key: 'standings', label: '順位表', icon: '📊' },
              { key: 'teams', label: `チーム管理 (${teams.length})`, icon: '👥' },
              { key: 'settings', label: '大会設定', icon: '⚙️' },
            ].map((tab) => (
              <button
                key={tab.key}
                id={`admin-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key as AdminTab)}
                className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 1. 予選リーグ タブ */}
          {activeTab === 'league' && (
            <div className="space-y-6">
              {/* 大会公式組み合わせステータスバナー */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-zinc-900/30 border border-indigo-400/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">🏐</span>
                    <span className="font-black text-base text-zinc-950 dark:text-white">
                      社内バレーボール大会 公式組み合わせ
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      17チーム・5面コート・3ブロック対戦
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    予選リーグ（A組4、B組4、C組3、D組3、E組3）＆ 決勝（上ブロックA8、下ブロック左下C6、下ブロック右下E6）が完全連動しています。
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('社内バレーボール大会の公式組み合わせ（17チーム・予選＆全トーナメント枠）を再適用しますか？')) {
                        dispatch({ type: 'LOAD_OFFICIAL_TOURNAMENT' });
                        showToast('社内バレーボール大会の公式組み合わせを反映しました');
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡</span>
                    <span>公式組み合わせを再セット</span>
                  </button>
                </div>
              </div>

              {/* コート数・リーグ数 任意設定＆ワンクリック自動割り振りパネル */}
              <CourtLeagueConfigPanel
                settings={settings}
                teams={teams}
                matches={matches}
                onAutoAssign={handleAutoAssign}
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div>
                  <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    予選リーグ進行管理 (全{settings.leagueCount || 4}グループ・使用コート{settings.courtCount || 4}面)
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    完了状況: {completedLeagueMatches.length} / {leagueMatches.length} 試合
                    {isLeagueAllCompleted && (
                      <span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
                        ★全予選完了
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddManualMatch}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-xs transition-colors"
                  >
                    ＋ 臨時試合を手動追加
                  </button>
                  <button
                    type="button"
                    onClick={handleShuffleTeamsAndRegenerate}
                    className="px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="ボタンをクリックするたびにチームの組み合わせ（所属グループ）をランダムに入れ替えて予選対戦表を再生成します"
                  >
                    <span>🎲</span>
                    <span>組み合わせランダム再編</span>
                  </button>
                  <button
                    id="generate-league-btn"
                    onClick={handleGenerateLeague}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  >
                    {leagueMatches.length > 0 ? '予選リーグ再生成' : '予選リーグ生成'}
                  </button>
                  {leagueMatches.length > 0 && (
                    <button
                      id="advance-to-final-btn"
                      onClick={handleGenerateFinal}
                      className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white shadow-xs transition-all ${
                        isLeagueAllCompleted
                          ? 'bg-amber-600 hover:bg-amber-700 animate-pulse'
                          : 'bg-zinc-700 hover:bg-zinc-600'
                      }`}
                      title={
                        isLeagueAllCompleted
                          ? '予選全試合完了：決勝トーナメントを生成します'
                          : '予選が一部未完了でも現在の上位8チームで決勝トーナメントを生成（緊急手動進行可能）'
                      }
                    >
                      🏆 決勝トーナメント{isLeagueAllCompleted ? '生成' : '手動生成/進行'}
                    </button>
                  )}
                </div>
              </div>

              {/* 予選リーグ全試合ステータス早見ボード */}
              {leagueMatches.length > 0 && (
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
                  {/* 得点板・審判 割当バランス通知バナー */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base shrink-0">⚖️</span>
                      <div>
                        <span className="font-black text-amber-900 dark:text-amber-200">
                          得点板・審判担当バランス：
                        </span>
                        <span className="ml-1 text-zinc-700 dark:text-zinc-300">
                          全17チーム 各1回ずつ完全に均等分散（偏りゼロ・自コート待機枠完結）
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRefereeBalanceOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center gap-1 justify-center self-start sm:self-auto text-[11px]"
                    >
                      <span>割当内訳・均等表</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏐</span>
                      <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        予選リーグ全試合ステータス ({completedLeagueMatches.length}/{leagueMatches.length}試合完了)
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        完了: {completedLeagueMatches.length}試合
                      </span>
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        未入力: {leagueMatches.length - completedLeagueMatches.length}試合
                      </span>
                    </div>
                  </div>

                  {/* 全試合クイックチップ一覧 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {leagueMatches.map((m) => {
                      const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name : '未定';
                      const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name : '未定';
                      const isDone = m.status === 'completed';

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleOpenScoreModal(m)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isDone
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-300'
                              : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 hover:border-amber-400'
                          }`}
                          title={`第${m.matchNumber}試合 (第${m.slot || 1}試合枠・${getCourtName(m.court || 1)}) - クリックしてスコア入力`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-zinc-700 dark:text-zinc-300">
                              #{m.matchNumber} {m.pool ? `(${m.pool})` : ''}
                            </span>
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                isDone
                                  ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                              }`}
                            >
                              {isDone ? '完了' : '未入力'}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 break-words leading-tight line-clamp-2" title={`${t1} vs ${t2}`}>
                            {t1} vs {t2}
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            <span>{getCourtName(m.court || 1)}</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {isDone ? `${m.team1Sets}-${m.team2Sets}` : 'スコア入力'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* サブ表示切替 & 自動割当 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="inline-flex rounded-xl bg-zinc-200 dark:bg-zinc-700 p-1 text-xs font-semibold flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setLeagueSubTab('schedule')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      leagueSubTab === 'schedule'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <span>⚡ コート別同時進行スケジュール</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                      {settings.courtCount || 4}面同時
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeagueSubTab('pools')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      leagueSubTab === 'pools'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <span>📋 グループ別カード一覧</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeagueSubTab('allMatches')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      leagueSubTab === 'allMatches'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <span>📝 全予選試合一覧（{leagueMatches.length}試合）</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleReassignCourts(settings.courtCount || 4)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                    title="現在のコート数に合わせて全試合の進行枠（第1試合、第2試合…）とコート番号を自動再割り当てします"
                  >
                    ⚡ コート割当を自動再計算
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignReferees(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-200 transition-colors cursor-pointer"
                    title="全試合の得点板担当を『同じ試合コートの出場チーム』から自動割り当てし直します（他コートへの移動なし）"
                  >
                    🚩 自コート得点板を自動割当
                  </button>
                </div>
              </div>

              {leagueMatches.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <div className="text-3xl mb-2">🏐</div>
                  <h3 className="font-bold text-base">予選リーグがまだ生成されていません</h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
                    「予選リーグ生成」ボタンを押すと、登録されたチーム（現在{teams.length}チーム）を4つのグループに均等配分し、各チーム2試合の対戦カードを自動作成します。
                  </p>
                </div>
              ) : leagueSubTab === 'schedule' ? (
                <CourtScheduleView
                  matches={matches}
                  teams={teams}
                  settings={settings}
                  adminMode={true}
                  onOpenScoreModal={handleOpenScoreModal}
                  onOpenManualEditModal={handleOpenManualEditModal}
                />
              ) : leagueSubTab === 'pools' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from(
                    new Set([
                      ...Array.from({ length: settings.leagueCount || 4 }, (_, i) => String.fromCharCode(65 + i)),
                      ...leagueMatches.map((m) => m.pool).filter((p): p is string => Boolean(p)),
                    ])
                  )
                    .sort()
                    .map((pool) => {
                      const poolMatches = leagueMatches.filter((m) => m.pool === pool);
                      return (
                        <div
                          key={pool}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <h3 className="font-bold text-sm flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                              グループ {pool} ({poolMatches.length}試合)
                            </h3>
                            <span className="text-[11px] text-zinc-400">各チーム2試合</span>
                          </div>

                          <div className="space-y-2.5">
                            {poolMatches.map((match) => {
                              const t1 = match.team1Id ? teamMap.get(match.team1Id)?.name : '未定';
                              const t2 = match.team2Id ? teamMap.get(match.team2Id)?.name : '未定';
                              const isDone = match.status === 'completed';

                              return (
                                <div
                                  key={match.id}
                                  className={`p-3 rounded-xl border transition-all ${
                                    isDone
                                      ? 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800'
                                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold">第{match.matchNumber}試合</span>
                                      {match.slot && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                                          第{match.slot}試合枠
                                        </span>
                                      )}
                                      {/* コート変更セレクター */}
                                      <select
                                        value={match.court || 1}
                                        onChange={(e) => handleCourtChange(match.id, Number(e.target.value))}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                        title="試合コートを変更"
                                      >
                                        {Array.from({ length: settings.courtCount || 4 }, (_, i) => i + 1).map((c) => (
                                          <option key={c} value={c}>
                                            {getCourtName(c)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          isDone
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                        }`}
                                      >
                                        {isDone ? '終了' : 'スコア未入力'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenManualEditModal(match)}
                                        title="緊急手動修正 (全項目手入力上書き)"
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                                      >
                                        🛠️
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 break-words leading-tight" title={t1}>
                                      {t1}
                                    </div>
                                    <button
                                      onClick={() => handleOpenScoreModal(match)}
                                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm cursor-pointer shrink-0"
                                    >
                                      {match.team1Sets} - {match.team2Sets}
                                      <span className="text-[10px] font-normal ml-1">入力</span>
                                    </button>
                                    <div className="flex-1 text-right text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 break-words leading-tight" title={t2}>
                                      {t2}
                                    </div>
                                  </div>

                                  {/* 審判担当 */}
                                  <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 flex-1">
                                      <span className="shrink-0 font-bold">審判:</span>
                                      <input
                                        type="text"
                                        defaultValue={match.referee || ''}
                                        onBlur={(e) => handleRefereeBlur(match.id, e.target.value)}
                                        placeholder="審判チーム名"
                                        className="px-2 py-0.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex-1 min-w-[160px] text-left"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                /* 全予選試合一覧（allMatches） */
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        予選リーグ全試合一覧（通し番号順・全{leagueMatches.length}試合）
                      </h3>
                      <p className="text-xs text-zinc-500">
                        各試合のコート、進行枠、スコア入力、ステータスを一覧で管理できます
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                          <th className="p-3 font-bold">試合番号</th>
                          <th className="p-3 font-bold">枠 / コート</th>
                          <th className="p-3 font-bold">グループ</th>
                          <th className="p-3 font-bold">対戦カード</th>
                          <th className="p-3 font-bold text-center">スコア</th>
                          <th className="p-3 font-bold">審判</th>
                          <th className="p-3 font-bold text-center">状態</th>
                          <th className="p-3 font-bold text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                        {leagueMatches.map((m) => {
                          const t1 = m.team1Id ? teamMap.get(m.team1Id)?.name : '未定';
                          const t2 = m.team2Id ? teamMap.get(m.team2Id)?.name : '未定';
                          const isDone = m.status === 'completed';

                          return (
                            <tr
                              key={m.id}
                              className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                                isDone ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                              }`}
                            >
                              <td className="p-3 font-bold font-mono">#{m.matchNumber}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                                    第{m.slot || 1}枠
                                  </span>
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                    {getCourtName(m.court || 1)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full font-black text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  Pool {m.pool || '-'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 max-w-[280px]">
                                  <span className={`break-words leading-tight ${m.winnerId === m.team1Id ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''}`}>
                                    {t1}
                                  </span>
                                  <span className="text-zinc-400 font-normal shrink-0">vs</span>
                                  <span className={`break-words leading-tight ${m.winnerId === m.team2Id ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''}`}>
                                    {t2}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenScoreModal(m)}
                                  className={`px-3 py-1 rounded-lg font-mono font-bold text-xs border cursor-pointer whitespace-nowrap ${
                                    isDone
                                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                                      : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100'
                                  }`}
                                >
                                  {isDone ? `${m.team1Sets} - ${m.team2Sets}` : 'スコア入力'}
                                </button>
                              </td>
                              <td className="p-3 text-zinc-600 dark:text-zinc-400 break-words leading-tight max-w-[150px]">
                                {m.referee || '未指定'}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isDone
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {isDone ? '完了' : '未入力'}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenManualEditModal(m)}
                                  className="px-2 py-1 text-[11px] rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
                                >
                                  修正
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. 決勝トーナメント タブ */}
          {activeTab === 'tournament' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div>
                  <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    決勝トーナメント (上位8チーム・上/下ブロック)
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    予選各コートの上位が進出（C/D/E組2位の得失点最上位チームがA組1位と対戦）。試合をクリックしてスコアを入力・手動修正できます。
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddManualMatch}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-xs transition-colors"
                  >
                    ＋ 臨時試合を手動追加
                  </button>
                  <button
                    id="regen-final-btn"
                    onClick={handleGenerateFinal}
                    className="px-4 py-2 text-xs sm:text-sm font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡</span>
                    <span>予選順位からトーナメントへ反映 / 再構成</span>
                  </button>
                </div>
              </div>

              {/* トーナメント表示切替 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="inline-flex rounded-xl bg-zinc-200 dark:bg-zinc-700 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTournamentSubTab('bracket')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      tournamentSubTab === 'bracket'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <span>🌲 トーナメントツリー表示</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTournamentSubTab('schedule')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      tournamentSubTab === 'schedule'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <span>⚡ トーナメント同時進行スケジュール</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold font-mono">
                      {settings.courtCount || 4}面同時
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReassignCourts(settings.courtCount || 4)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                  >
                    ⚡ コート割当を自動再計算
                  </button>
                </div>
              </div>

              {tournamentSubTab === 'bracket' ? (
                <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
                  <BracketView
                    matches={matches}
                    teams={teams}
                    onMatchClick={handleOpenScoreModal}
                    onManualEditClick={handleOpenManualEditModal}
                    isDark={false}
                  />
                </div>
              ) : (
                <CourtScheduleView
                  matches={matches.filter((m) => m.round !== 'league')}
                  teams={teams}
                  settings={settings}
                  adminMode={true}
                  onOpenScoreModal={handleOpenScoreModal}
                  onOpenManualEditModal={handleOpenManualEditModal}
                />
              )}
            </div>
          )}

          {/* 3. 順位表 タブ */}
          {activeTab === 'standings' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">順位表</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    優先順位: 1)勝数 → 2)セット率 → 3)得点差 → 4)直接対決 → 5)チーム名
                  </p>
                </div>
              </div>

              {/* 決勝または3位決定戦結果があれば最終結果も表示 */}
              {matches.some(
                (m) =>
                  (m.round === 'final' || m.round === 'third_place') && m.status === 'completed'
              ) && (
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                    🏆 最終順位結果 (1位〜4位)
                  </h3>
                  <StandingsTable standings={standings} showFinalOnly={true} />
                </div>
              )}

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                  予選リーググループ別順位
                </h3>
                <StandingsTable standings={standings} />
              </div>
            </div>
          )}

          {/* 4. チーム管理 タブ */}
          {activeTab === 'teams' && (
            <div className="space-y-6">
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                      <span>参加チーム一覧</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                        {teams.length} チーム
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                        最大20チーム対応
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      全チームは{settings.leagueCount || 4}つのグループに均等配分されます。各チームのグループは手動でも変更可能です。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {teams.length < 20 && (
                      <button
                        type="button"
                        onClick={handleExpandTo20Teams}
                        className="px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        title="プリセットチームを追加して参加数を20チームまで一括で拡張します"
                      >
                        <span>🚀</span>
                        <span>20チームへワンクリック拡充 ({teams.length}/20)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleShuffleTeamsAndRegenerate}
                      className="px-3.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      title="チームの組み合わせをランダムにシャッフルし、対戦表を新しく組み替えます"
                    >
                      <span>🎲</span>
                      <span>組み合わせランダム再編</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRedistributeTeams}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <span>🔄</span>
                      <span>{settings.leagueCount || 4}グループに自動均等配分</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateLeague}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <span>⚡</span>
                      <span>予選対戦表を再生成</span>
                    </button>
                  </div>
                </div>

                {/* チーム追加フォーム */}
                <form onSubmit={handleAddTeam} className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="新しいチーム名 (例: 営業第二部)"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newTeamPool}
                      onChange={(e) => setNewTeamPool(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="auto">所属: 自動最少グループ</option>
                      {Array.from({ length: settings.leagueCount || 4 }, (_, i) => {
                        const p = String.fromCharCode(65 + i);
                        return <option key={p} value={p}>所属: グループ {p}</option>;
                      })}
                    </select>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs whitespace-nowrap transition-colors"
                    >
                      ＋ チーム追加
                    </button>
                  </div>
                </form>
              </div>

              {/* チーム一覧テーブル */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4 w-14 text-center">#</th>
                      <th className="py-3 px-4">チーム名（クリックで編集）</th>
                      <th className="py-3 px-4 text-center w-36">所属グループ</th>
                      <th className="py-3 px-4 text-right w-24">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {teams.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-xs text-zinc-400">
                          チームが登録されていません。上のフォームからチームを追加してください。
                        </td>
                      </tr>
                    ) : (
                      teams.map((team, idx) => (
                        <tr key={team.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                          <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={team.name}
                              onChange={(e) => handleUpdateTeamName(team.id, e.target.value)}
                              className="w-full px-2 py-1 rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 bg-transparent text-sm font-medium transition-colors"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <select
                              value={team.pool || 'A'}
                              onChange={(e) =>
                                handleUpdateTeamPool(team.id, e.target.value)
                              }
                              className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                            >
                              {Array.from(
                                {
                                  length: Math.max(
                                    settings.leagueCount || 4,
                                    team.pool ? team.pool.charCodeAt(0) - 64 : 1
                                  ),
                                },
                                (_, i) => {
                                  const p = String.fromCharCode(65 + i);
                                  return (
                                    <option key={p} value={p}>
                                      グループ {p}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team.id, team.name)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                            >
                              🗑️ 削除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. 大会設定 タブ */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* コート数・リーグ数 任意設定＆ワンクリック自動割り振りパネル */}
              <CourtLeagueConfigPanel
                settings={settings}
                teams={teams}
                matches={matches}
                onAutoAssign={handleAutoAssign}
              />

              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                <div>
                  <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    大会ルール & 設定
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    点数やセット数などを変更できます。変更後は試合のセット勝敗が自動再評価されます。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      大会名称
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) =>
                        dispatch({ type: 'UPDATE_SETTINGS', payload: { name: e.target.value } })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      開催会場
                    </label>
                    <input
                      type="text"
                      value={settings.venue}
                      onChange={(e) =>
                        dispatch({ type: 'UPDATE_SETTINGS', payload: { venue: e.target.value } })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      開催日
                    </label>
                    <input
                      type="date"
                      value={settings.date}
                      onChange={(e) =>
                        dispatch({ type: 'UPDATE_SETTINGS', payload: { date: e.target.value } })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      マッチ形式 (セット数)
                    </label>
                    <select
                      value={settings.bestOf}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_SETTINGS',
                          payload: { bestOf: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    >
                      <option value={1}>1セットマッチ (先取)</option>
                      <option value={3}>3セットマッチ (2セット先取)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      第1・第2セット 目標得点
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.set12Points}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_SETTINGS',
                          payload: { set12Points: parseInt(e.target.value, 10) || 25 },
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      第3セット (ファイナル) 目標得点
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.set3Points}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_SETTINGS',
                          payload: { set3Points: parseInt(e.target.value, 10) || 15 },
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      デュース点差マージン
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.deuceMargin}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_SETTINGS',
                          payload: { deuceMargin: parseInt(e.target.value, 10) || 2 },
                        })
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      端末ラベル (updatedBy)
                    </label>
                    <input
                      type="text"
                      value={deviceLabel}
                      onChange={(e) => updateDeviceLabel(e.target.value)}
                      placeholder="例: Aコート運営タブレット"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>

                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <span>🛡️ 連続試合防止（連戦回避ロジック）</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                          推奨ON
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-650 dark:text-zinc-300 mt-0.5">
                        同一チームが連続して試合に出場することを自動で防止し、全チームに十分な休憩（インターバル）を均等に確保します。
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={settings.avoidConsecutiveMatches !== false}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_SETTINGS',
                            payload: { avoidConsecutiveMatches: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                  <button
                    onClick={() => {
                      saveNow();
                      showToast('設定を同期・保存しました');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs"
                  >
                    今すぐクラウド保存
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* スコアモーダル */}
          <ScoreModal
            isOpen={isScoreModalOpen}
            match={selectedMatch}
            teams={teams}
            settings={settings}
            onClose={() => setIsScoreModalOpen(false)}
            onSave={handleSaveScore}
          />

          {/* カスタム確認ダイアログ */}
          <ConfirmModal
            isOpen={confirmConfig.isOpen}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmText={confirmConfig.confirmText}
            isDangerous={confirmConfig.isDangerous}
            onConfirm={confirmConfig.onConfirm}
            onCancel={closeConfirm}
          />

          {/* 表彰状＆結果サマリーモーダル */}
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

          {/* A4印刷＆PDF保存モーダル */}
          <PrintSheetsModal
            isOpen={isPrintOpen}
            onClose={() => setIsPrintOpen(false)}
            teams={teams}
            matches={matches}
            settings={settings}
            standings={standings}
          />

          {/* 得点板・審判 割当バランス確認モーダル */}
          <RefereeBalanceModal
            isOpen={isRefereeBalanceOpen}
            onClose={() => setIsRefereeBalanceOpen(false)}
            teams={teams}
            matches={matches}
          />

          {/* 閲覧専用URL発行モーダル */}
          <ShareUrlModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />

          {/* 試合データ手動修正モーダル (トラブル時・手入力用) */}
          <ManualMatchEditModal
            isOpen={isManualEditOpen}
            match={manualEditMatch}
            teams={teams}
            onClose={() => {
              setIsManualEditOpen(false);
              setManualEditMatch(null);
            }}
            onSave={handleSaveManualMatch}
            onDelete={handleDeleteMatch}
          />
        </PasswordGate>

        {/* 共通フッター */}
        <footer className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-2">
          <div>
            最終同期: {updatedAt ? new Date(updatedAt).toLocaleTimeString('ja-JP') : '未同期'}
            {updatedBy && ` (${updatedBy})`}
          </div>
          <div>バレーボール大会運営管理システム</div>
        </footer>
      </main>
    </div>
  );
};
