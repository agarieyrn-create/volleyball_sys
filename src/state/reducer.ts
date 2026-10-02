import { DEFAULT_APP_STATE } from '../data/defaults';
import { advanceWinner, generateFinalTournament } from '../logic/bracket';
import { scheduleSimultaneousMatches } from '../logic/court';
import { distributeTeams, generateLeagueMatches } from '../logic/league';
import { autoAssignReferees } from '../logic/referee';
import { evaluateMatch, getCountedSetScores, isValidSetScoreInput } from '../logic/score';
import { computeLeagueStandings, selectFinalists } from '../logic/standings';
import {
  ensureOfficialTournamentIntegrity,
  resolveTournamentReferees,
  seedOfficialTournament,
} from '../logic/officialTournament';
import { AppState, Match, MvpVote, SetScore, Settings, Team } from '../types';

export type TournamentAction =
  | { type: 'INIT'; payload: AppState }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'DELETE_TEAM'; payload: { teamId: string } }
  | { type: 'UPDATE_TEAM_POOL'; payload: { teamId: string; pool: string } }
  | { type: 'REDISTRIBUTE_TEAMS' }
  | { type: 'GENERATE_LEAGUE' }
  | { type: 'GENERATE_FINAL' }
  | { type: 'SAVE_SCORE'; payload: { matchId: string; sets: SetScore[] } }
  | { type: 'UPDATE_REFEREE'; payload: { matchId: string; referee: string } }
  | { type: 'ASSIGN_REFEREES'; payload?: { force?: boolean } }
  | { type: 'UPDATE_MATCH_COURT'; payload: { matchId: string; court: number } }
  | { type: 'UPDATE_MATCH_MANUAL'; payload: { matchId: string; updates: Partial<Match> } }
  | { type: 'ADD_MANUAL_MATCH'; payload: Partial<Match> }
  | { type: 'DELETE_MATCH'; payload: { matchId: string } }
  | { type: 'REASSIGN_COURTS'; payload?: { courtCount?: number } }
  | { type: 'AUTO_ASSIGN_LEAGUES_AND_COURTS'; payload?: { leagueCount?: number; courtCount?: number } }
  | { type: 'SHUFFLE_TEAMS_AND_REGENERATE' }
  | { type: 'ADD_MVP_VOTE'; payload: Omit<MvpVote, 'id' | 'createdAt'> }
  | { type: 'IMPORT'; payload: AppState }
  | { type: 'LOAD_OFFICIAL_TOURNAMENT' }
  | { type: 'RESET' };

function normalizedScoreInput(sets: SetScore[], match: Match, settings: Settings): SetScore[] | null {
  if (!isValidSetScoreInput(sets, settings.bestOf)) return null;
  const extraSets = sets.slice(settings.bestOf);
  if (extraSets.some((set) => set.team1 !== null || set.team2 !== null)) return null;
  const normalized = sets.slice(0, settings.bestOf);
  const result = evaluateMatch({ ...match, sets: normalized }, settings);
  if (result.status === 'completed') {
    const playedCount = getCountedSetScores({ ...match, sets: normalized }, settings).length;
    return normalized.map((set, index) => index < playedCount ? set : { team1: null, team2: null });
  }
  return normalized;
}

/**
 * 試合群の評価とトーナメント進出連鎖を正規化
 */
function normalizeTournamentMatches(matches: Match[], settings: Settings, teams?: Team[]): Match[] {
  const leagueMatches = matches.filter((m) => m.round === 'league');
  const tournamentMatches = matches.filter((m) => m.round !== 'league');

  // 予選試合の slot 判定：未設定または全試合が同一 slot に集中している場合は自動再スケジュール
  const needsLeagueScheduling =
    leagueMatches.length > 0 &&
    (leagueMatches.some((m) => typeof m.slot !== 'number' || m.slot < 1) ||
      (leagueMatches.length > 4 && new Set(leagueMatches.map((m) => m.slot)).size <= 1));

  let scheduledLeague = leagueMatches;
  if (needsLeagueScheduling) {
    const courtCount = settings.courtCount || 4;
    const avoid = settings.avoidConsecutiveMatches ?? true;
    scheduledLeague = scheduleSimultaneousMatches(leagueMatches, courtCount, avoid);
  }

  let currentMatches: Match[] = [...scheduledLeague, ...tournamentMatches].map((m) => {
    const fallbackCourt = m.court || (m.pool ? Math.max(1, m.pool.charCodeAt(0) - 64) : 1);
    return {
      ...m,
      court: m.court || fallbackCourt,
      slot: typeof m.slot === 'number' && m.slot >= 1 ? m.slot : 1,
    };
  });

  // チーム情報が提供されている場合、審判が同一コートか自動監査・補正
  if (teams && teams.length > 0) {
    currentMatches = autoAssignReferees(currentMatches, teams, false);
  }

  // まず予選試合の評価
  currentMatches = currentMatches.map((m) => {
    if (m.round === 'league') {
      const res = evaluateMatch(m, settings);
      return {
        ...m,
        team1Sets: res.team1Sets,
        team2Sets: res.team2Sets,
        winnerId: res.winnerId,
        status: res.status,
      };
    }
    return m;
  });

  // 決勝トーナメント試合があれば advanceWinner で連鎖伝播
  const finalMatches = currentMatches.filter((m) => m.round !== 'league');
  if (finalMatches.length > 0) {
    // QF1 から順に advanceWinner を適用
    for (const tm of finalMatches) {
      currentMatches = advanceWinner(currentMatches, tm, settings);
    }
    // 確定した敗者を自動で審判担当名へ解決反映
    if (teams && teams.length > 0) {
      currentMatches = resolveTournamentReferees(currentMatches, teams);
    }
  }

  return currentMatches;
}

export function tournamentReducer(state: AppState, action: TournamentAction): AppState {
  switch (action.type) {
    case 'INIT': {
      const payload = action.payload;
      const leagueCount = payload.settings?.leagueCount || 5;
      const courtCount = payload.settings?.courtCount || 5;

      const validPools = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      // 1) チームに pool が設定されていないチームがあるか確認し、あれば均等配分
      const hasMissingPool = payload.teams.some((t) => !t.pool || !validPools.includes(t.pool));
      let normalizedTeams = payload.teams;
      if (hasMissingPool && payload.teams.length > 0) {
        normalizedTeams = distributeTeams(payload.teams, leagueCount);
      }

      // 2) 試合が空の場合は初期予選対戦カードを自動生成
      let normalizedMatches = payload.matches || [];
      if (normalizedMatches.length === 0 && normalizedTeams.length >= 2) {
        const leagueMatches = generateLeagueMatches(normalizedTeams, payload.settings);
        const avoid = payload.settings?.avoidConsecutiveMatches ?? true;
        const scheduled = scheduleSimultaneousMatches(leagueMatches, courtCount, avoid);
        normalizedMatches = autoAssignReferees(scheduled, normalizedTeams, true);
      } else if (normalizedMatches.length > 0 && normalizedTeams.length > 0) {
        // 既存の試合がある場合でも、審判が他コートになっていないか自動監査・自コート審判に補正
        normalizedMatches = autoAssignReferees(normalizedMatches, normalizedTeams, false);
      }

      return {
        ...payload,
        teams: normalizedTeams,
        matches: normalizeTournamentMatches(normalizedMatches, payload.settings, normalizedTeams),
      };
    }

    case 'UPDATE_SETTINGS': {
      const nextSettings: Settings = {
        ...state.settings,
        ...action.payload,
      };
      let nextMatches = state.matches;
      if (
        action.payload.avoidConsecutiveMatches !== undefined ||
        action.payload.courtCount !== undefined
      ) {
        const courtCount = nextSettings.courtCount || 5;
        const avoid = nextSettings.avoidConsecutiveMatches ?? true;
        const scheduled = scheduleSimultaneousMatches(state.matches, courtCount, avoid);
        nextMatches = autoAssignReferees(scheduled, state.teams, false);
      }
      const updatedMatches = normalizeTournamentMatches(nextMatches, nextSettings, state.teams);
      return {
        ...state,
        settings: nextSettings,
        matches: updatedMatches,
      };
    }

    case 'SET_TEAMS': {
      const pools = ['A', 'B', 'C', 'D', 'E'] as const;
      // 各チームの pool を保証。未設定なら現在最も人数の少ないプールへ割り当て
      const teamsWithPool = action.payload.map((team, idx) => {
        if (team.pool && pools.includes(team.pool as any)) {
          return team;
        }
        const fallback = pools[idx % pools.length];
        return { ...team, pool: fallback };
      });

      return {
        ...state,
        teams: teamsWithPool,
      };
    }

    case 'DELETE_TEAM': {
      const { teamId } = action.payload;
      if (state.matches.some((m) =>
        m.status === 'completed' && (m.team1Id === teamId || m.team2Id === teamId)
      )) {
        return state;
      }
      const nextTeams = state.teams.filter((t) => t.id !== teamId);

      // 試合データから削除されたチームの参照を安全化（未完了試合なら空枠化）
      const nextMatches = state.matches.map((m) => {
        if (m.team1Id === teamId || m.team2Id === teamId) {
          if (m.status !== 'completed') {
            return {
              ...m,
              team1Id: m.team1Id === teamId ? null : m.team1Id,
              team2Id: m.team2Id === teamId ? null : m.team2Id,
              winnerId: null,
              status: 'pending' as const,
              sets: m.sets.map(() => ({ team1: null, team2: null })),
              team1Sets: 0,
              team2Sets: 0,
            };
          }
        }
        return m;
      });

      return {
        ...state,
        teams: nextTeams,
        matches: normalizeTournamentMatches(nextMatches, state.settings),
      };
    }

    case 'UPDATE_TEAM_POOL': {
      const { teamId, pool } = action.payload;
      const nextTeams = state.teams.map((t) => (t.id === teamId ? { ...t, pool } : t));
      return {
        ...state,
        teams: nextTeams,
      };
    }

    case 'REDISTRIBUTE_TEAMS': {
      const distributedTeams = distributeTeams(state.teams, state.settings.leagueCount || 5);
      return {
        ...state,
        teams: distributedTeams,
      };
    }

    case 'GENERATE_LEAGUE': {
      const distributedTeams = distributeTeams(state.teams, state.settings.leagueCount);
      const leagueMatches = generateLeagueMatches(distributedTeams, state.settings);
      const courtCount = state.settings.courtCount || 5;
      const avoid = state.settings.avoidConsecutiveMatches ?? true;
      const scheduledMatches = scheduleSimultaneousMatches(leagueMatches, courtCount, avoid);
      const matchesWithRef = autoAssignReferees(scheduledMatches, distributedTeams, true);

      // 既存の決勝トーナメントはクリアし、新予選試合をセット（正規化とスロット割当を適用）
      return {
        ...state,
        teams: distributedTeams,
        matches: normalizeTournamentMatches(matchesWithRef, state.settings),
      };
    }

    case 'GENERATE_FINAL': {
      const hasOfficialStructure = state.matches.some(
        (m) => m.matchCode === 'A5' || m.id === 'match_A5'
      );

      if (hasOfficialStructure) {
        // 公式大会の組み合わせ（上ブロック8チーム・下ブロック左下:C6・下ブロック右下:E6）に順位を反映
        const { state: verifiedState } = ensureOfficialTournamentIntegrity({
          ...state,
          settings: { ...state.settings, finalistsCount: 8 },
        });
        const standings = computeLeagueStandings(verifiedState.teams, verifiedState.matches, verifiedState.settings);
        const seeded = seedOfficialTournament(verifiedState.matches, standings);
        const normalized = normalizeTournamentMatches(seeded, verifiedState.settings, verifiedState.teams);
        return {
          ...verifiedState,
          matches: normalized,
        };
      }

      // 汎用トーナメント生成
      const finalists = selectFinalists(state.teams, state.matches, state.settings);
      const finalMatches = generateFinalTournament(finalists, state.settings);
      const finalMatchesWithRef = autoAssignReferees(finalMatches, state.teams);

      const leagueMatches = state.matches.filter((m) => m.round === 'league');
      const allMatches = [...leagueMatches, ...finalMatchesWithRef];

      const normalized = normalizeTournamentMatches(allMatches, state.settings);

      return {
        ...state,
        matches: normalized,
      };
    }

    case 'SAVE_SCORE': {
      const { matchId, sets } = action.payload;
      const targetMatch = state.matches.find((m) => m.id === matchId);
      if (!targetMatch || targetMatch.status === 'bye') return state;
      const safeSets = normalizedScoreInput(sets, targetMatch, state.settings);
      if (!safeSets) return state;

      const updatedMatch: Match = {
        ...targetMatch,
        sets: safeSets,
      };

      const evalRes = evaluateMatch(updatedMatch, state.settings);
      updatedMatch.team1Sets = evalRes.team1Sets;
      updatedMatch.team2Sets = evalRes.team2Sets;
      updatedMatch.winnerId = evalRes.winnerId;
      updatedMatch.status = evalRes.status;

      let nextMatches = state.matches.map((m) => (m.id === matchId ? updatedMatch : m));

      // 予選試合のスコア保存時、公式トーナメント枠（A5..E6）が存在していれば順位を自動シード反映
      if (
        updatedMatch.round === 'league' &&
        nextMatches.some((m) => m.matchCode === 'A5' || m.id === 'match_A5')
      ) {
        const currentStandings = computeLeagueStandings(state.teams, nextMatches, state.settings);
        nextMatches = seedOfficialTournament(nextMatches, currentStandings);
      }

      // 決勝トーナメントの進行反映
      if (updatedMatch.round !== 'league') {
        nextMatches = advanceWinner(nextMatches, updatedMatch, state.settings);
      }

      const normalized = normalizeTournamentMatches(nextMatches, state.settings, state.teams);

      return {
        ...state,
        matches: normalized,
      };
    }

    case 'LOAD_OFFICIAL_TOURNAMENT': {
      return {
        ...DEFAULT_APP_STATE,
        updatedAt: new Date().toISOString(),
      };
    }

    case 'UPDATE_REFEREE': {
      const { matchId, referee } = action.payload;
      return {
        ...state,
        matches: state.matches.map((m) => (m.id === matchId ? { ...m, referee } : m)),
      };
    }

    case 'ASSIGN_REFEREES': {
      const courtCount = state.settings.courtCount || 4;
      const avoid = state.settings.avoidConsecutiveMatches ?? true;
      const scheduled = scheduleSimultaneousMatches(state.matches, courtCount, avoid);
      const reassigned = autoAssignReferees(scheduled, state.teams, action.payload?.force ?? true);
      return {
        ...state,
        matches: normalizeTournamentMatches(reassigned, state.settings),
      };
    }

    case 'UPDATE_MATCH_COURT': {
      const { matchId, court } = action.payload;
      return {
        ...state,
        matches: state.matches.map((m) => (m.id === matchId ? { ...m, court } : m)),
      };
    }

    case 'REASSIGN_COURTS': {
      const courtCount = action.payload?.courtCount || state.settings.courtCount || 4;
      const avoid = state.settings.avoidConsecutiveMatches ?? true;
      const scheduled = scheduleSimultaneousMatches(state.matches, courtCount, avoid);
      const scheduledWithRef = autoAssignReferees(scheduled, state.teams, false);
      const nextSettings: Settings = {
        ...state.settings,
        courtCount,
      };
      return {
        ...state,
        settings: nextSettings,
        matches: normalizeTournamentMatches(scheduledWithRef, nextSettings),
      };
    }

    case 'AUTO_ASSIGN_LEAGUES_AND_COURTS': {
      const leagueCount = action.payload?.leagueCount ?? state.settings.leagueCount ?? 4;
      const courtCount = action.payload?.courtCount ?? state.settings.courtCount ?? 4;
      const nextSettings: Settings = {
        ...state.settings,
        leagueCount,
        courtCount,
      };

      // 1. チームを任意リーグ数に均等配分
      const distributedTeams = distributeTeams(state.teams, leagueCount);

      // 2. 予選リーグの対戦カードを生成
      const leagueMatches = generateLeagueMatches(distributedTeams, nextSettings);

      // 3. 利用可能コート数（1〜8面）に応じて同時進行スロットとコート番号を最適割当
      const avoid = nextSettings.avoidConsecutiveMatches ?? true;
      const scheduledMatches = scheduleSimultaneousMatches(leagueMatches, courtCount, avoid);

      // 4. コート割当完了後に、各コートで試合を行うチームから審判を自動割当（自コート審判を厳格遵守）
      const matchesWithRef = autoAssignReferees(scheduledMatches, distributedTeams, true);

      return {
        ...state,
        settings: nextSettings,
        teams: distributedTeams,
        matches: normalizeTournamentMatches(matchesWithRef, nextSettings, distributedTeams),
      };
    }

    case 'SHUFFLE_TEAMS_AND_REGENERATE': {
      if (state.teams.length < 2) return state;

      // 1. チームをランダムシャッフル (Fisher-Yates)
      const shuffledTeams = [...state.teams];
      for (let i = shuffledTeams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
      }

      const leagueCount = state.settings.leagueCount || 4;
      const courtCount = state.settings.courtCount || 4;

      // 2. シャッフル順に従ってグループ（Pool）を均等再配分
      const distributedTeams = distributeTeams(shuffledTeams, leagueCount);

      // 3. 新しい予選リーグ対戦カードを生成
      const leagueMatches = generateLeagueMatches(distributedTeams, state.settings);

      // 4. コート・進行スロットを割当（連戦回避）
      const avoid = state.settings.avoidConsecutiveMatches ?? true;
      const scheduledMatches = scheduleSimultaneousMatches(leagueMatches, courtCount, avoid);

      // 5. 各コートで試合を行うチームから自コート審判を厳格割り当て
      const matchesWithRef = autoAssignReferees(scheduledMatches, distributedTeams, true);

      return {
        ...state,
        teams: distributedTeams,
        matches: normalizeTournamentMatches(matchesWithRef, state.settings, distributedTeams),
      };
    }

    case 'UPDATE_MATCH_MANUAL': {
      const { matchId, updates } = action.payload;
      const targetMatch = state.matches.find((m) => m.id === matchId);
      if (!targetMatch) return state;

      const safeSets = updates.sets
        ? normalizedScoreInput(updates.sets, targetMatch, state.settings)
        : undefined;
      if (updates.sets && !safeSets) return state;

      const mergedMatch: Match = {
        ...targetMatch,
        ...updates,
        ...(safeSets ? { sets: safeSets } : {}),
      };

      // スコア入力時は保存済みのwinner/statusを信用せず、得点から再計算する。
      if (safeSets) {
        const evalRes = evaluateMatch(mergedMatch, state.settings);
        mergedMatch.team1Sets = evalRes.team1Sets;
        mergedMatch.team2Sets = evalRes.team2Sets;
        mergedMatch.winnerId = evalRes.winnerId;
        mergedMatch.status = evalRes.status;
      }

      let nextMatches = state.matches.map((m) => (m.id === matchId ? mergedMatch : m));

      // 予選スコア更新時、公式トーナメント枠があればシード反映
      if (
        mergedMatch.round === 'league' &&
        nextMatches.some((m) => m.matchCode === 'A5' || m.id === 'match_A5')
      ) {
        const currentStandings = computeLeagueStandings(state.teams, nextMatches, state.settings);
        nextMatches = seedOfficialTournament(nextMatches, currentStandings);
      }

      // 決勝トーナメントで勝者が確定・変更された場合は次戦へ伝播
      if (mergedMatch.round !== 'league') {
        nextMatches = advanceWinner(nextMatches, mergedMatch, state.settings);
      }

      return {
        ...state,
        matches: nextMatches,
      };
    }

    case 'ADD_MANUAL_MATCH': {
      const customMatch: Match = {
        id: `match_custom_${Date.now()}`,
        round: (action.payload.round as any) || 'league',
        roundName: action.payload.roundName || '臨時試合',
        roundOrder: action.payload.roundOrder || 99,
        matchNumber: action.payload.matchNumber || (state.matches.length + 1),
        court: action.payload.court || 1,
        slot: action.payload.slot || 1,
        pool: action.payload.pool,
        team1Id: action.payload.team1Id ?? null,
        team2Id: action.payload.team2Id ?? null,
        sets: action.payload.sets || [
          { team1: null, team2: null },
          { team1: null, team2: null },
          { team1: null, team2: null },
        ],
        team1Sets: action.payload.team1Sets || 0,
        team2Sets: action.payload.team2Sets || 0,
        winnerId: action.payload.winnerId || null,
        status: action.payload.status || 'pending',
        referee: action.payload.referee || '',
        nextMatchId: action.payload.nextMatchId || null,
        nextSlot: action.payload.nextSlot || null,
        loserToMatchId: action.payload.loserToMatchId || null,
        loserToSlot: action.payload.loserToSlot || null,
      };
      return {
        ...state,
        matches: [...state.matches, customMatch],
      };
    }

    case 'DELETE_MATCH': {
      const { matchId } = action.payload;
      return {
        ...state,
        matches: state.matches.filter((m) => m.id !== matchId),
      };
    }

    case 'ADD_MVP_VOTE': {
      const newVote: MvpVote = {
        ...action.payload,
        id: 'vote_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        mvpVotes: [...(state.mvpVotes || []), newVote],
      };
    }

    case 'IMPORT': {
      const normalized = normalizeTournamentMatches(action.payload.matches, action.payload.settings);
      return {
        ...action.payload,
        matches: normalized,
      };
    }

    case 'RESET': {
      return {
        ...DEFAULT_APP_STATE,
        updatedAt: new Date().toISOString(),
      };
    }

    default:
      return state;
  }
}
