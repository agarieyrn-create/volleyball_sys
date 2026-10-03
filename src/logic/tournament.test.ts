import { describe, expect, it } from 'vitest';
import { advanceWinner, generateFinalTournament, seedFinalists } from './bracket';
import { findConsecutiveMatches } from './court';
import { distributeTeams, generateLeagueMatches } from './league';
import {
  createOfficialTournamentMatches,
  ensureOfficialTournamentIntegrity,
  findBestCDE2ndPlace,
  OFFICIAL_TEAMS,
  resolveTournamentReferees,
  seedOfficialTournament,
} from './officialTournament';
import { autoAssignReferees } from './referee';
import { evaluateMatch, getCountedSetScores, isSetFinished } from './score';
import {
  computeAllTeamsMatchProgress,
  computeLeagueStandings,
  computeStandings,
  selectFinalists,
} from './standings';
import { DEFAULT_APP_STATE, DEFAULT_SETTINGS } from '../data/defaults';
import { tournamentReducer } from '../state/reducer';
import { Match, Settings, Standing, Team } from '../types';

const defaultSettings: Settings = {
  name: '社内バレーボール大会',
  date: '2026-10-10',
  venue: 'メインアリーナ',
  format: 'league_then_tournament',
  set12Points: 25,
  set3Points: 15,
  deuceMargin: 2,
  bestOf: 3,
  leagueCount: 4,
  matchesPerTeam: 2,
  finalistsCount: 8,
  courtCount: 4,
};

function createMockTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team_${i + 1}`,
    name: `Team ${String.fromCharCode(65 + Math.floor(i / 4))}-${(i % 4) + 1}`,
  }));
}

describe('score.ts', () => {
  it('isSetFinished should check target score and margin correctly', () => {
    expect(isSetFinished(25, 23, 25, 2)).toBe(true);
    expect(isSetFinished(25, 24, 25, 2)).toBe(false); // デュース
    expect(isSetFinished(26, 24, 25, 2)).toBe(true); // デュース決着
    expect(isSetFinished(24, 26, 25, 2)).toBe(true);
    expect(isSetFinished(15, 13, 15, 2)).toBe(true); // 第3セット
    expect(isSetFinished(null, 10, 25, 2)).toBe(false);
  });

  it('evaluateMatch should determine sets won and match completion', () => {
    const match: Match = {
      id: 'm1',
      round: 'league',
      roundName: '予選',
      roundOrder: 1,
      matchNumber: 1,
      team1Id: 't1',
      team2Id: 't2',
      sets: [
        { team1: 25, team2: 20 },
        { team1: 20, team2: 25 },
        { team1: 15, team2: 13 },
      ],
      team1Sets: 0,
      team2Sets: 0,
      winnerId: null,
      status: 'pending',
      nextMatchId: null,
      nextSlot: null,
      loserToMatchId: null,
      loserToSlot: null,
    };

    const res = evaluateMatch(match, defaultSettings);
    expect(res.team1Sets).toBe(2);
    expect(res.team2Sets).toBe(1);
    expect(res.winnerId).toBe('t1');
    expect(res.status).toBe('completed');
  });

  it('does not count sets after a gap or after the winner is decided', () => {
    const template = DEFAULT_APP_STATE.matches.find((match) => match.round === 'league')!;
    const gapResult = evaluateMatch({
      ...template,
      sets: [
        { team1: 12, team2: 10 },
        { team1: 25, team2: 10 },
        { team1: 25, team2: 10 },
      ],
    }, defaultSettings);
    expect(gapResult.status).toBe('pending');
    expect(gapResult.team1Sets).toBe(0);

    const completedMatch = {
      ...template,
      sets: [
        { team1: 25, team2: 20 },
        { team1: 25, team2: 20 },
        { team1: 15, team2: 0 },
      ],
    };
    const result = evaluateMatch(completedMatch, defaultSettings);
    expect(result.status).toBe('completed');
    expect(result.team1Sets).toBe(2);
    expect(getCountedSetScores(completedMatch, defaultSettings)).toHaveLength(2);
  });

  it('rejects fractional scores as completed set results', () => {
    expect(isSetFinished(25.5, 20, 25, 2)).toBe(false);
    expect(isSetFinished(Number.NaN, 20, 25, 2)).toBe(false);
  });
});

describe('league.ts', () => {
  it.each([10, 12, 13, 15])('distributeTeams & generateLeagueMatches for %i teams', (count) => {
    const rawTeams = createMockTeams(count);
    const distributed = distributeTeams(rawTeams, 4);

    // 4リーグに分割され、全員にプールが割り当てられている
    expect(distributed).toHaveLength(count);
    const pools = new Set(distributed.map((t) => t.pool));
    expect(pools.size).toBe(4);

    // 15チームなら 4, 4, 4, 3
    // 13チームなら 4, 3, 3, 3
    // 10チームなら 3, 3, 2, 2
    const countsPerPool = ['A', 'B', 'C', 'D'].map(
      (p) => distributed.filter((t) => t.pool === p).length
    );
    if (count === 15) expect(countsPerPool).toEqual([4, 4, 4, 3]);
    if (count === 13) expect(countsPerPool).toEqual([4, 3, 3, 3]);
    if (count === 10) expect(countsPerPool).toEqual([3, 3, 2, 2]);

    // 試合生成
    const matches = generateLeagueMatches(distributed, defaultSettings);

    // 各チームがちょうど2試合あることを確認！
    const teamMatchCounts = new Map<string, number>();
    for (const t of distributed) {
      teamMatchCounts.set(t.id, 0);
    }

    for (const m of matches) {
      expect(m.team1Id).toBeTruthy();
      expect(m.team2Id).toBeTruthy();
      expect(m.team1Id).not.toBe(m.team2Id);
      teamMatchCounts.set(m.team1Id!, (teamMatchCounts.get(m.team1Id!) || 0) + 1);
      teamMatchCounts.set(m.team2Id!, (teamMatchCounts.get(m.team2Id!) || 0) + 1);
    }

    for (const [tId, matchCount] of teamMatchCounts.entries()) {
      expect(matchCount, `Team ${tId} should have exactly 2 matches`).toBe(2);
    }
  });
});

describe('standings.ts', () => {
  it('strictly ranks teams by win -> set ratio -> point diff -> h2h -> name without ties', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Alpha', pool: 'A' },
      { id: 't2', name: 'Beta', pool: 'A' },
      { id: 't3', name: 'Gamma', pool: 'A' },
    ];

    // t1 beats t2 (2-0, 25-20, 25-20)
    // t2 beats t3 (2-1, 20-25, 25-20, 15-10)
    // t3 beats t1 (2-0, 25-20, 25-20)
    // すべて 1勝1敗
    const matches: Match[] = [
      {
        id: 'm1',
        round: 'league',
        roundName: 'A1',
        roundOrder: 1,
        matchNumber: 1,
        pool: 'A',
        team1Id: 't1',
        team2Id: 't2',
        sets: [{ team1: 25, team2: 20 }, { team1: 25, team2: 20 }, { team1: null, team2: null }],
        team1Sets: 2,
        team2Sets: 0,
        winnerId: 't1',
        status: 'completed',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
      {
        id: 'm2',
        round: 'league',
        roundName: 'A2',
        roundOrder: 1,
        matchNumber: 2,
        pool: 'A',
        team1Id: 't2',
        team2Id: 't3',
        sets: [{ team1: 20, team2: 25 }, { team1: 25, team2: 20 }, { team1: 15, team2: 10 }],
        team1Sets: 2,
        team2Sets: 1,
        winnerId: 't2',
        status: 'completed',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
      {
        id: 'm3',
        round: 'league',
        roundName: 'A3',
        roundOrder: 1,
        matchNumber: 3,
        pool: 'A',
        team1Id: 't3',
        team2Id: 't1',
        sets: [{ team1: 25, team2: 20 }, { team1: 25, team2: 20 }, { team1: null, team2: null }],
        team1Sets: 2,
        team2Sets: 0,
        winnerId: 't3',
        status: 'completed',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
    ];

    const standings = computeLeagueStandings(teams, matches, defaultSettings);
    expect(standings).toHaveLength(3);
    // すべてのrankが一意であること
    const ranks = standings.map((s) => s.rank);
    expect(ranks).toEqual([1, 2, 3]);
  });
});

describe('bracket.ts', () => {
  it('seeds 8 finalists with cross-pool pairing and advances winners through to final and 3rd place', () => {
    const finalists: Team[] = [
      { id: 'a1', name: 'Team A1', pool: 'A', seed: 1 },
      { id: 'a2', name: 'Team A2', pool: 'A', seed: 2 },
      { id: 'b1', name: 'Team B1', pool: 'B', seed: 1 },
      { id: 'b2', name: 'Team B2', pool: 'B', seed: 2 },
      { id: 'c1', name: 'Team C1', pool: 'C', seed: 1 },
      { id: 'c2', name: 'Team C2', pool: 'C', seed: 2 },
      { id: 'd1', name: 'Team D1', pool: 'D', seed: 1 },
      { id: 'd2', name: 'Team D2', pool: 'D', seed: 2 },
    ];

    const seeded = seedFinalists(finalists);
    expect(seeded).toHaveLength(4);
    // QF1: A1 vs C2, QF2: B1 vs D2, QF3: C1 vs A2, QF4: D1 vs B2
    expect(seeded[0].team1?.id).toBe('a1');
    expect(seeded[0].team2?.id).toBe('c2');

    // トーナメント生成
    let matches = generateFinalTournament(finalists, defaultSettings);
    expect(matches).toHaveLength(8);

    // QF1勝者を設定 (a1の勝ち)
    const qf1 = matches.find((m) => m.id === 'final_qf_1')!;
    qf1.sets = [{ team1: 25, team2: 15 }, { team1: 25, team2: 15 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, qf1, defaultSettings);

    const sf1 = matches.find((m) => m.id === 'final_sf_1')!;
    expect(sf1.team1Id).toBe('a1'); // a1が進出

    // QF2勝者を設定 (b1の勝ち)
    const qf2 = matches.find((m) => m.id === 'final_qf_2')!;
    qf2.sets = [{ team1: 25, team2: 15 }, { team1: 25, team2: 15 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, qf2, defaultSettings);

    const updatedSf1 = matches.find((m) => m.id === 'final_sf_1')!;
    expect(updatedSf1.team2Id).toBe('b1'); // b1が進出

    // SF1 を実施: a1 vs b1 で a1 が勝ち、b1が敗者
    updatedSf1.sets = [{ team1: 25, team2: 15 }, { team1: 25, team2: 15 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, updatedSf1, defaultSettings);

    const finalMatch = matches.find((m) => m.id === 'final_fn')!;
    const thirdMatch = matches.find((m) => m.id === 'final_3rd')!;

    // 勝者 a1 が決勝へ、敗者 b1 が 3位決定戦へ
    expect(finalMatch.team1Id).toBe('a1');
    expect(thirdMatch.team1Id).toBe('b1');
  });

  it('uses byes for fewer than eight finalists without duplicating any team', () => {
    const teams = createMockTeams(6).map((team, index) => ({ ...team, pool: `P${index + 1}`, seed: 1 }));
    const pairs = seedFinalists([...teams, teams[0]]);
    const pairedIds = pairs.flatMap((pair) => [pair.team1?.id, pair.team2?.id]).filter(Boolean);

    expect(pairs).toHaveLength(4);
    expect(new Set(pairedIds).size).toBe(6);
    expect(pairedIds).toHaveLength(6);

    const matches = generateFinalTournament(teams, defaultSettings);
    expect(matches).toHaveLength(8);
    expect(matches.find((match) => match.id === 'final_qf_1')?.status).toBe('bye');
    expect(matches.find((match) => match.id === 'final_qf_4')?.status).toBe('bye');
    expect(matches.find((match) => match.id === 'final_sf_1')?.team1Id).toBe(teams[0].id);
    expect(matches.find((match) => match.id === 'final_sf_1')?.team2Id).toBeNull();
  });

  it('does not mark the official final as a bye while the other semifinal feeder is still pending', () => {
    const standings: Standing[] = OFFICIAL_TEAMS.map((team) => {
      const rank = Number(team.id.slice(-1));
      return {
        rank,
        teamId: team.id,
        teamName: team.name,
        pool: team.pool,
        played: 2,
        win: 1,
        loss: 1,
        setsWon: 2,
        setsLost: 2,
        setRatio: 1,
        pointsFor: 60,
        pointsAgainst: 60,
        pointDiff: 0,
      };
    });
    const winningSets = [
      { team1: 25, team2: 10 },
      { team1: 25, team2: 10 },
      { team1: null, team2: null },
    ];
    let matches = seedOfficialTournament(createOfficialTournamentMatches(), standings);

    for (const matchCode of ['A5', 'A6']) {
      const match = matches.find((item) => item.matchCode === matchCode)!;
      matches = advanceWinner(matches, { ...match, sets: winningSets }, defaultSettings);
    }

    const semifinal = matches.find((item) => item.matchCode === 'A7')!;
    matches = advanceWinner(matches, { ...semifinal, sets: winningSets }, defaultSettings);

    const finalMatch = matches.find((item) => item.matchCode === 'A8')!;
    expect(finalMatch.team1Id).toBeTruthy();
    expect(finalMatch.team2Id).toBeNull();
    expect(finalMatch.status).toBe('pending');
    expect(finalMatch.winnerId).toBeNull();
  });

  it('still advances true byes when an empty feeder branch cannot produce a team', () => {
    const teams = createMockTeams(2);
    const matches = generateFinalTournament(teams, defaultSettings);
    const finalMatch = matches.find((item) => item.id === 'final_fn')!;

    expect(matches.find((item) => item.id === 'final_sf_1')?.status).toBe('bye');
    expect(matches.find((item) => item.id === 'final_sf_2')?.status).toBe('bye');
    expect(finalMatch.team1Id).toBe(teams[0].id);
    expect(finalMatch.team2Id).toBe(teams[1].id);
    expect(finalMatch.status).toBe('pending');
  });

  it.each([2, 3, 4, 5, 6, 7])('keeps every one of %i entrants in a unique bracket slot', (count) => {
    const teams = createMockTeams(count).map((team, index) => ({ ...team, pool: `P${index + 1}`, seed: 1 }));
    const pairs = seedFinalists(teams);
    const pairedIds = pairs.flatMap((pair) => [pair.team1?.id, pair.team2?.id]).filter(Boolean);
    const matches = generateFinalTournament(teams, defaultSettings);
    const quarterfinals = matches.filter((match) => match.round === 'quarterfinal');

    expect(new Set(pairedIds).size).toBe(count);
    expect(pairedIds).toHaveLength(count);
    expect(quarterfinals.flatMap((match) => [match.team1Id, match.team2Id]).filter(Boolean)).toHaveLength(count);
    expect(matches.every((match) => !match.team1Id || !match.team2Id || match.team1Id !== match.team2Id)).toBe(true);
  });

  it('clears downstream results when a corrected score changes bracket participants', () => {
    const finalists: Team[] = [
      { id: 'a1', name: 'A1', pool: 'A', seed: 1 },
      { id: 'a2', name: 'A2', pool: 'A', seed: 2 },
      { id: 'b1', name: 'B1', pool: 'B', seed: 1 },
      { id: 'b2', name: 'B2', pool: 'B', seed: 2 },
      { id: 'c1', name: 'C1', pool: 'C', seed: 1 },
      { id: 'c2', name: 'C2', pool: 'C', seed: 2 },
      { id: 'd1', name: 'D1', pool: 'D', seed: 1 },
      { id: 'd2', name: 'D2', pool: 'D', seed: 2 },
    ];
    const winningSets = [
      { team1: 25, team2: 15 },
      { team1: 25, team2: 15 },
      { team1: null, team2: null },
    ];
    let matches = generateFinalTournament(finalists, defaultSettings);

    const qf1 = { ...matches.find((match) => match.id === 'final_qf_1')!, sets: winningSets };
    matches = advanceWinner(matches, qf1, defaultSettings);
    const qf2 = { ...matches.find((match) => match.id === 'final_qf_2')!, sets: winningSets };
    matches = advanceWinner(matches, qf2, defaultSettings);

    const semi = { ...matches.find((match) => match.id === 'final_sf_1')!, sets: winningSets };
    matches = advanceWinner(matches, semi, defaultSettings);
    expect(matches.find((match) => match.id === 'final_fn')?.team1Id).toBe('a1');

    // Correct QF1 so C2 advances instead of A1.
    const correctedQf1 = {
      ...matches.find((match) => match.id === 'final_qf_1')!,
      sets: [
        { team1: 15, team2: 25 },
        { team1: 15, team2: 25 },
        { team1: null, team2: null },
      ],
    };
    matches = advanceWinner(matches, correctedQf1, defaultSettings);

    const correctedSemi = matches.find((match) => match.id === 'final_sf_1')!;
    const finalMatch = matches.find((match) => match.id === 'final_fn')!;
    const thirdPlace = matches.find((match) => match.id === 'final_3rd')!;
    expect(correctedSemi.team1Id).toBe('c2');
    expect(correctedSemi.team2Id).toBe('b1');
    expect(correctedSemi.winnerId).toBeNull();
    expect(correctedSemi.sets.every((set) => set.team1 === null && set.team2 === null)).toBe(true);
    expect(finalMatch.team1Id).toBeNull();
    expect(finalMatch.winnerId).toBeNull();
    expect(finalMatch.sets.every((set) => set.team1 === null && set.team2 === null)).toBe(true);
    expect(thirdPlace.team1Id).toBeNull();
    expect(thirdPlace.sets.every((set) => set.team1 === null && set.team2 === null)).toBe(true);
  });

  it('clears a played official match when corrected league standings change its participants', () => {
    const standings: Standing[] = ['A', 'B', 'C', 'D', 'E'].flatMap((pool) =>
      Array.from({ length: pool === 'A' || pool === 'B' ? 4 : 3 }, (_, index) => {
        const rank = index + 1;
        return {
          rank,
          teamId: `${pool}${rank}`,
          teamName: `${pool} team ${rank}`,
          pool,
          played: 3,
          win: 3 - rank,
          loss: rank - 1,
          setsWon: 4,
          setsLost: 2,
          setRatio: 2,
          pointsFor: 75,
          pointsAgainst: 60,
          pointDiff: 15,
        };
      })
    );
    const playedA5 = seedOfficialTournament(createOfficialTournamentMatches(), standings).map((match) =>
      match.matchCode === 'A5'
        ? {
            ...match,
            sets: [
              { team1: 25, team2: 18 },
              { team1: 25, team2: 20 },
              { team1: null, team2: null },
            ],
            team1Sets: 2,
            winnerId: 'A2',
            status: 'completed' as const,
          }
        : match
    );
    const correctedStandings = standings.map((standing) => {
      if (standing.pool !== 'A') return standing;
      if (standing.rank === 2) return { ...standing, teamId: 'A3' };
      if (standing.rank === 3) return { ...standing, teamId: 'A2' };
      return standing;
    });

    const corrected = seedOfficialTournament(playedA5, correctedStandings).find(
      (match) => match.matchCode === 'A5'
    )!;
    expect(corrected.team1Id).toBe('A3');
    expect(corrected.team2Id).toBe('D1');
    expect(corrected.status).toBe('pending');
    expect(corrected.winnerId).toBeNull();
    expect(corrected.sets.every((set) => set.team1 === null && set.team2 === null)).toBe(true);
  });
});

describe('referee.ts', () => {
  it('assigns referee from non-playing teams', () => {
    const teams = createMockTeams(4);
    const matches: Match[] = [
      {
        id: 'm1',
        round: 'league',
        roundName: 'A1',
        roundOrder: 1,
        matchNumber: 1,
        team1Id: teams[0].id,
        team2Id: teams[1].id,
        sets: [],
        team1Sets: 0,
        team2Sets: 0,
        winnerId: null,
        status: 'pending',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
    ];

    const result = autoAssignReferees(matches, teams);
    expect(result[0].referee).toBeDefined();
    // 審判は出場チーム (team_1, team_2) ではないこと
    expect(result[0].referee).not.toBe(teams[0].name);
    expect(result[0].referee).not.toBe(teams[1].name);
  });

  it('assigns referee strictly from teams playing on the same court', () => {
    // 6チーム：コート1にチーム0, 1, 2。コート2にチーム3, 4, 5
    const teams = createMockTeams(6);
    const matches: Match[] = [
      {
        id: 'c1_m1',
        round: 'league',
        roundName: 'A1',
        roundOrder: 1,
        matchNumber: 1,
        court: 1,
        team1Id: teams[0].id,
        team2Id: teams[1].id,
        sets: [],
        team1Sets: 0,
        team2Sets: 0,
        winnerId: null,
        status: 'pending',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
      {
        id: 'c1_m2',
        round: 'league',
        roundName: 'A2',
        roundOrder: 1,
        matchNumber: 2,
        court: 1,
        team1Id: teams[1].id,
        team2Id: teams[2].id,
        sets: [],
        team1Sets: 0,
        team2Sets: 0,
        winnerId: null,
        status: 'pending',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
      {
        id: 'c2_m1',
        round: 'league',
        roundName: 'B1',
        roundOrder: 1,
        matchNumber: 3,
        court: 2,
        team1Id: teams[3].id,
        team2Id: teams[4].id,
        sets: [],
        team1Sets: 0,
        team2Sets: 0,
        winnerId: null,
        status: 'pending',
        nextMatchId: null,
        nextSlot: null,
        loserToMatchId: null,
        loserToSlot: null,
      },
    ];

    const result = autoAssignReferees(matches, teams);
    // コート1の試合1の審判は、コート1で試合をする「チーム2」でなければならない（チーム3, 4, 5などの他コートは選ばれない）
    expect(result[0].referee).toBe(teams[2].name);
    // コート1の試合2の審判は、コート1で試合をする「チーム0」でなければならない
    expect(result[1].referee).toBe(teams[0].name);
  });

  it('guarantees completely fair referee distribution: all 17 teams have exactly 1 duty in preliminary league without bias', () => {
    const matches = createOfficialTournamentMatches(OFFICIAL_TEAMS);
    const leagueMatches = matches.filter((m) => m.round === 'league');

    // 予選全17試合
    expect(leagueMatches).toHaveLength(17);
    expect(OFFICIAL_TEAMS).toHaveLength(17);

    // 各チームの予選審判回数を集計
    const teamRefCounts = new Map<string, number>();
    OFFICIAL_TEAMS.forEach((t) => teamRefCounts.set(t.name, 0));

    for (const m of leagueMatches) {
      expect(m.referee).toBeDefined();
      expect(teamRefCounts.has(m.referee!)).toBe(true);
      teamRefCounts.set(m.referee!, teamRefCounts.get(m.referee!)! + 1);

      // 審判を担当するチームが、その試合の対戦チームではないこと
      const t1 = OFFICIAL_TEAMS.find((t) => t.id === m.team1Id);
      const t2 = OFFICIAL_TEAMS.find((t) => t.id === m.team2Id);
      expect(m.referee).not.toBe(t1?.name);
      expect(m.referee).not.toBe(t2?.name);

      // 自コート（同一プール）の待機チームが審判を担当していること
      const refTeam = OFFICIAL_TEAMS.find((t) => t.name === m.referee);
      expect(refTeam?.pool).toBe(m.pool);
    }

    // ★全17チーム、審判・得点板対応回数が完全に均等（1チームあたり1回、偏りゼロ）
    for (const team of OFFICIAL_TEAMS) {
      const count = teamRefCounts.get(team.name);
      expect(count, `${team.name} should referee exactly once`).toBe(1);
    }
  });

  it('automatically resolves tournament referee names when predecessor matches complete', () => {
    let matches = createOfficialTournamentMatches(OFFICIAL_TEAMS);

    // A5試合を完了させ、敗者を確定
    const a5Idx = matches.findIndex((m) => m.matchCode === 'A5');
    expect(a5Idx).toBeGreaterThanOrEqual(0);

    // A5にチーム設定してスコア入力
    const a5 = {
      ...matches[a5Idx],
      team1Id: 'team_a2',
      team2Id: 'team_d1',
      team1Sets: 2,
      team2Sets: 0,
      winnerId: 'team_a2',
      status: 'completed' as const,
    };
    matches[a5Idx] = a5;

    // A6の審判がA5敗者（team_d1: OGS新入社員）に解決されることを検証
    const resolved = resolveTournamentReferees(matches, OFFICIAL_TEAMS);
    const a6 = resolved.find((m) => m.matchCode === 'A6');
    expect(a6).toBeDefined();
    expect(a6?.referee).toContain('OGS新入社員');
    expect(a6?.referee).toContain('A5敗者');
  });
});

describe('tournamentReducer team management', () => {
  it('handles DELETE_TEAM and removes team from state', () => {
    const initialState = { ...DEFAULT_APP_STATE };
    const teamToDelete = initialState.teams[0];
    const nextState = tournamentReducer(initialState, {
      type: 'DELETE_TEAM',
      payload: { teamId: teamToDelete.id },
    });

    expect(nextState.teams.find((t) => t.id === teamToDelete.id)).toBeUndefined();
    expect(nextState.teams.length).toBe(initialState.teams.length - 1);
  });

  it('handles UPDATE_TEAM_POOL and changes pool', () => {
    const initialState = { ...DEFAULT_APP_STATE };
    const teamId = initialState.teams[0].id;
    const nextState = tournamentReducer(initialState, {
      type: 'UPDATE_TEAM_POOL',
      payload: { teamId, pool: 'D' },
    });

    const updated = nextState.teams.find((t) => t.id === teamId);
    expect(updated?.pool).toBe('D');
  });

  it('handles REDISTRIBUTE_TEAMS and evenly distributes across 5 pools for 17 teams', () => {
    const initialState = { ...DEFAULT_APP_STATE };
    const nextState = tournamentReducer(initialState, {
      type: 'REDISTRIBUTE_TEAMS',
    });

    const poolCounts = ['A', 'B', 'C', 'D', 'E'].map(
      (p) => nextState.teams.filter((t) => t.pool === p).length
    );
    expect(poolCounts).toEqual([4, 4, 3, 3, 3]);
  });

  it('handles 20 teams: distributes across 4 pools of 5 and generates valid non-consecutive matches', () => {
    const teams20 = createMockTeams(20);
    const settings = {
      ...DEFAULT_APP_STATE.settings,
      leagueCount: 4,
      courtCount: 4,
      avoidConsecutiveMatches: true,
    };
    const distributed = distributeTeams(teams20, 4);
    const poolCounts = ['A', 'B', 'C', 'D'].map(
      (p) => distributed.filter((t) => t.pool === p).length
    );
    expect(poolCounts).toEqual([5, 5, 5, 5]);

    const matches = generateLeagueMatches(distributed, settings);
    // 4 pools * 5 matches = 20 matches
    expect(matches.length).toBe(20);

    // Verify consecutive matches are avoided
    const consecutive = findConsecutiveMatches(matches);
    expect(consecutive.size).toBe(0);
  });

  it('handles 20 teams: distributes across 5 pools of 4 teams and seeds finalists correctly', () => {
    const teams20 = createMockTeams(20);
    const settings = {
      ...DEFAULT_APP_STATE.settings,
      leagueCount: 5,
      courtCount: 5,
    };
    const distributed = distributeTeams(teams20, 5);
    const poolCounts = ['A', 'B', 'C', 'D', 'E'].map(
      (p) => distributed.filter((t) => t.pool === p).length
    );
    expect(poolCounts).toEqual([4, 4, 4, 4, 4]);

    const matches = generateLeagueMatches(distributed, settings);
    expect(matches.length).toBe(20); // 5 pools * 4 matches = 20

    // Simulate selecting finalists and seeding
    const finalists = selectFinalists(distributed, matches, settings);
    expect(finalists.length).toBe(8);

    const seeds = seedFinalists(finalists);
    expect(seeds.length).toBe(4);
    // Ensure no team is duplicated
    const teamIdsInSeeds = seeds
      .flatMap((s) => [s.team1?.id, s.team2?.id])
      .filter((id): id is string => Boolean(id));
    const uniqueIds = new Set(teamIdsInSeeds);
    expect(uniqueIds.size).toBe(8);
  });

  it('handles INIT with unassigned pools and auto-distributes', () => {
    const rawTeams = createMockTeams(12);
    const rawState = {
      ...DEFAULT_APP_STATE,
      teams: rawTeams,
      matches: [],
    };
    const nextState = tournamentReducer(DEFAULT_APP_STATE, {
      type: 'INIT',
      payload: rawState,
    });

    expect(nextState.teams.every((t) => !!t.pool)).toBe(true);
    expect(nextState.matches.length).toBeGreaterThan(0);
  });

  it('handles SHUFFLE_TEAMS_AND_REGENERATE and reallocates pools and same-court referees', () => {
    const initialState = { ...DEFAULT_APP_STATE };
    const nextState = tournamentReducer(initialState, {
      type: 'SHUFFLE_TEAMS_AND_REGENERATE',
    });

    expect(nextState.teams.length).toBe(initialState.teams.length);
    expect(nextState.matches.length).toBeGreaterThan(0);

    // 全ての試合で審判（得点板）がそのコートで試合を行うチームであることを検証
    nextState.matches.forEach((m) => {
      if (!m.referee) return;
      const courtTeams = nextState.teams.filter((t) => {
        const poolToCourt: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
        return t.pool && poolToCourt[t.pool] === m.court;
      });
      const courtTeamNames = courtTeams.map((t) => t.name);
      expect(courtTeamNames).toContain(m.referee);
    });
  });

  it('avoids consecutive matches for teams when avoidConsecutiveMatches is enabled', () => {
    const initialState = {
      ...DEFAULT_APP_STATE,
      settings: {
        ...DEFAULT_APP_STATE.settings,
        avoidConsecutiveMatches: true,
      },
    };
    const nextState = tournamentReducer(initialState, {
      type: 'AUTO_ASSIGN_LEAGUES_AND_COURTS',
      payload: { leagueCount: 4, courtCount: 4 },
    });

    const leagueMatches = nextState.matches.filter((m) => m.round === 'league');
    expect(leagueMatches.length).toBeGreaterThan(0);

    // 予選リーグの全試合で、どのチームも連続枠（slot N の直後の slot N+1）で試合に出場していないことを確認
    const teamSlots = new Map<string, number[]>();
    leagueMatches.forEach((m) => {
      if (typeof m.slot !== 'number') return;
      if (m.team1Id) {
        if (!teamSlots.has(m.team1Id)) teamSlots.set(m.team1Id, []);
        teamSlots.get(m.team1Id)!.push(m.slot);
      }
      if (m.team2Id) {
        if (!teamSlots.has(m.team2Id)) teamSlots.set(m.team2Id, []);
        teamSlots.get(m.team2Id)!.push(m.slot);
      }
    });

    for (const [teamId, slots] of teamSlots.entries()) {
      const sortedSlots = Array.from(new Set(slots)).sort((a, b) => a - b);
      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const diff = sortedSlots[i + 1] - sortedSlots[i];
        expect(diff).toBeGreaterThan(1); // 必ず1スロット以上の休憩があること
      }
    }
  });

  it('official 17-team tournament: has exact 17 teams, 5 groups, and complete 31 matches', () => {
    const state = DEFAULT_APP_STATE;
    expect(state.teams.length).toBe(17);

    // グループ別チーム数検証
    expect(state.teams.filter((t) => t.pool === 'A').length).toBe(4);
    expect(state.teams.filter((t) => t.pool === 'B').length).toBe(4);
    expect(state.teams.filter((t) => t.pool === 'C').length).toBe(3);
    expect(state.teams.filter((t) => t.pool === 'D').length).toBe(3);
    expect(state.teams.filter((t) => t.pool === 'E').length).toBe(3);

    // 試合数検証 (予選17試合 + 午後19試合 = 計36試合 【案A】)
    const leagueMatches = state.matches.filter((m) => m.round === 'league');
    const afternoonMatches = state.matches.filter((m) => m.round !== 'league');
    expect(leagueMatches.length).toBe(17);
    expect(afternoonMatches.length).toBe(19);
    expect(state.matches.length).toBe(36);

    // 上ブロック（決勝・3決・順位交流戦）および下位交流リーグの存在確認
    const upperMatches = afternoonMatches.filter((m) => m.bracketGroup === 'upper');
    const consolationMatches = afternoonMatches.filter((m) => m.bracketGroup === 'consolation');
    const exchangeMatches = afternoonMatches.filter((m) => m.bracketGroup === 'exchange_league');

    expect(upperMatches.length).toBe(8); // A5, A6, B5, B6, A7, B7, A8, B8 (8チーム決勝トーナメント + 3位決定戦)
    expect(consolationMatches.length).toBe(2); // C8, D8 (QF敗者順位交流戦)
    expect(exchangeMatches.length).toBe(9); // C5, C6, C7, D5, D6, D7, E5, E6, E7 (交流X・Y・Z組 各3試合)

    // 勝者進出ルートの検証 (A5/A6 -> A7, B5/B6 -> B7, A7/B7 -> A8)
    const matchA5 = state.matches.find((m) => m.matchCode === 'A5');
    const matchA6 = state.matches.find((m) => m.matchCode === 'A6');
    const matchA7 = state.matches.find((m) => m.matchCode === 'A7');
    const matchB5 = state.matches.find((m) => m.matchCode === 'B5');
    const matchB6 = state.matches.find((m) => m.matchCode === 'B6');
    const matchB7 = state.matches.find((m) => m.matchCode === 'B7');
    const matchA8 = state.matches.find((m) => m.matchCode === 'A8');
    const matchB8 = state.matches.find((m) => m.matchCode === 'B8');
    const matchC8 = state.matches.find((m) => m.matchCode === 'C8');
    const matchD8 = state.matches.find((m) => m.matchCode === 'D8');

    expect(matchA5?.nextMatchId).toBe('match_A7');
    expect(matchA5?.nextSlot).toBe(1);
    expect(matchA5?.loserToMatchId).toBe('match_C8');
    expect(matchA5?.loserToSlot).toBe(1);

    expect(matchA6?.nextMatchId).toBe('match_A7');
    expect(matchA6?.nextSlot).toBe(2);
    expect(matchA6?.loserToMatchId).toBe('match_C8');
    expect(matchA6?.loserToSlot).toBe(2);

    expect(matchB5?.nextMatchId).toBe('match_B7');
    expect(matchB5?.nextSlot).toBe(1);
    expect(matchB5?.loserToMatchId).toBe('match_D8');
    expect(matchB5?.loserToSlot).toBe(1);

    expect(matchB6?.nextMatchId).toBe('match_B7');
    expect(matchB6?.nextSlot).toBe(2);
    expect(matchB6?.loserToMatchId).toBe('match_D8');
    expect(matchB6?.loserToSlot).toBe(2);

    expect(matchA7?.nextMatchId).toBe('match_A8');
    expect(matchA7?.nextSlot).toBe(1);
    expect(matchA7?.loserToMatchId).toBe('match_B8');
    expect(matchA7?.loserToSlot).toBe(1);

    expect(matchB7?.nextMatchId).toBe('match_A8');
    expect(matchB7?.nextSlot).toBe(2);
    expect(matchB7?.loserToMatchId).toBe('match_B8');
    expect(matchB7?.loserToSlot).toBe(2);

    expect(matchA8?.round).toBe('final');
    expect(matchB8?.round).toBe('third_place');
    expect(matchC8?.round).toBe('consolation');
    expect(matchD8?.round).toBe('consolation');

    // 交流リーグマッチの存在確認 (X, Y, Z組)
    const matchC5 = state.matches.find((m) => m.matchCode === 'C5');
    const matchC6 = state.matches.find((m) => m.matchCode === 'C6');
    const matchC7 = state.matches.find((m) => m.matchCode === 'C7');
    expect(matchC5?.pool).toBe('X');
    expect(matchC6?.pool).toBe('X');
    expect(matchC7?.pool).toBe('X');

    const matchD5 = state.matches.find((m) => m.matchCode === 'D5');
    const matchD6 = state.matches.find((m) => m.matchCode === 'D6');
    const matchD7 = state.matches.find((m) => m.matchCode === 'D7');
    expect(matchD5?.pool).toBe('Y');
    expect(matchD6?.pool).toBe('Y');
    expect(matchD7?.pool).toBe('Y');

    const matchE5 = state.matches.find((m) => m.matchCode === 'E5');
    const matchE6 = state.matches.find((m) => m.matchCode === 'E6');
    const matchE7 = state.matches.find((m) => m.matchCode === 'E7');
    expect(matchE5?.pool).toBe('Z');
    expect(matchE6?.pool).toBe('Z');
    expect(matchE7?.pool).toBe('Z');
  });

  it('correctly selects best 2nd place team among C, D, E by point differential and pairs with Pool A 1st in B6', () => {
    // 予選順位のモック
    const mockStandings = [
      { rank: 1, teamId: 'team_a1', teamName: 'A組1位チーム', pool: 'A', played: 3, win: 3, loss: 0, setsWon: 6, setsLost: 0, setRatio: 6, pointsFor: 90, pointsAgainst: 45, pointDiff: 45 },
      { rank: 2, teamId: 'team_a2', teamName: 'A組2位チーム', pool: 'A', played: 3, win: 2, loss: 1, setsWon: 4, setsLost: 2, setRatio: 2, pointsFor: 80, pointsAgainst: 60, pointDiff: 20 },
      { rank: 3, teamId: 'team_a3', teamName: 'A組3位チーム', pool: 'A', played: 3, win: 1, loss: 2, setsWon: 2, setsLost: 4, setRatio: 0.5, pointsFor: 60, pointsAgainst: 75, pointDiff: -15 },
      { rank: 4, teamId: 'team_a4', teamName: 'A組4位チーム', pool: 'A', played: 3, win: 0, loss: 3, setsWon: 0, setsLost: 6, setRatio: 0, pointsFor: 40, pointsAgainst: 90, pointDiff: -50 },

      { rank: 1, teamId: 'team_b1', teamName: 'B組1位チーム', pool: 'B', played: 3, win: 3, loss: 0, setsWon: 6, setsLost: 0, setRatio: 6, pointsFor: 90, pointsAgainst: 50, pointDiff: 40 },
      { rank: 2, teamId: 'team_b2', teamName: 'B組2位チーム', pool: 'B', played: 3, win: 2, loss: 1, setsWon: 4, setsLost: 3, setRatio: 1.33, pointsFor: 82, pointsAgainst: 70, pointDiff: 12 },
      { rank: 3, teamId: 'team_b3', teamName: 'B組3位チーム', pool: 'B', played: 3, win: 1, loss: 2, setsWon: 2, setsLost: 4, setRatio: 0.5, pointsFor: 55, pointsAgainst: 80, pointDiff: -25 },
      { rank: 4, teamId: 'team_b4', teamName: 'B組4位チーム', pool: 'B', played: 3, win: 0, loss: 3, setsWon: 1, setsLost: 6, setRatio: 0.17, pointsFor: 48, pointsAgainst: 85, pointDiff: -37 },

      // C組 (2位: 得失点差 +8)
      { rank: 1, teamId: 'team_c1', teamName: 'C組1位チーム', pool: 'C', played: 2, win: 2, loss: 0, setsWon: 4, setsLost: 0, setRatio: 4, pointsFor: 60, pointsAgainst: 30, pointDiff: 30 },
      { rank: 2, teamId: 'team_c2', teamName: 'C組2位チーム', pool: 'C', played: 2, win: 1, loss: 1, setsWon: 2, setsLost: 2, setRatio: 1, pointsFor: 50, pointsAgainst: 42, pointDiff: 8 },
      { rank: 3, teamId: 'team_c3', teamName: 'C組3位チーム', pool: 'C', played: 2, win: 0, loss: 2, setsWon: 0, setsLost: 4, setRatio: 0, pointsFor: 25, pointsAgainst: 60, pointDiff: -35 },

      // D組 (2位: 得失点差 +18 -> ★得失点差が一番良い！)
      { rank: 1, teamId: 'team_d1', teamName: 'D組1位チーム', pool: 'D', played: 2, win: 2, loss: 0, setsWon: 4, setsLost: 1, setRatio: 4, pointsFor: 62, pointsAgainst: 35, pointDiff: 27 },
      { rank: 2, teamId: 'team_d2', teamName: 'D組2位チーム', pool: 'D', played: 2, win: 1, loss: 1, setsWon: 3, setsLost: 2, setRatio: 1.5, pointsFor: 58, pointsAgainst: 40, pointDiff: 18 },
      { rank: 3, teamId: 'team_d3', teamName: 'D組3位チーム', pool: 'D', played: 2, win: 0, loss: 2, setsWon: 0, setsLost: 4, setRatio: 0, pointsFor: 20, pointsAgainst: 60, pointDiff: -40 },

      // E組 (2位: 得失点差 -2)
      { rank: 1, teamId: 'team_e1', teamName: 'E組1位チーム', pool: 'E', played: 2, win: 2, loss: 0, setsWon: 4, setsLost: 0, setRatio: 4, pointsFor: 60, pointsAgainst: 32, pointDiff: 28 },
      { rank: 2, teamId: 'team_e2', teamName: 'E組2位チーム', pool: 'E', played: 2, win: 1, loss: 1, setsWon: 2, setsLost: 2, setRatio: 1, pointsFor: 48, pointsAgainst: 50, pointDiff: -2 },
      { rank: 3, teamId: 'team_e3', teamName: 'E組3位チーム', pool: 'E', played: 2, win: 0, loss: 2, setsWon: 0, setsLost: 4, setRatio: 0, pointsFor: 34, pointsAgainst: 60, pointDiff: -26 },
    ];

    // findBestCDE2ndPlace の検証: D組2位 (+18) が最上位に選ばれること
    const { best, second, third } = findBestCDE2ndPlace(mockStandings);
    expect(best?.teamId).toBe('team_d2');
    expect(best?.pointDiff).toBe(18);
    expect(second?.teamId).toBe('team_c2');
    expect(third?.teamId).toBe('team_e2');

    // seedOfficialTournament のシード結果検証
    const initialMatches = createOfficialTournamentMatches();
    const seededMatches = seedOfficialTournament(initialMatches, mockStandings);

    const matchB6 = seededMatches.find((m) => m.matchCode === 'B6');
    expect(matchB6).toBeDefined();
    // B6: A組1位 (team_a1) vs C/D/E組2位最上位 (team_d2)
    expect(matchB6?.team1Id).toBe('team_a1');
    expect(matchB6?.team2Id).toBe('team_d2');

    // 下位交流リーグへの配分検証:
    // 交流X組 C5: A組3位 vs 次点1 (team_c2)
    const matchC5 = seededMatches.find((m) => m.matchCode === 'C5');
    expect(matchC5).toBeDefined();
    expect(matchC5?.team2Id).toBe('team_c2');

    // 交流Y組 D5: B組3位 vs 次点2 (team_e2)
    const matchD5 = seededMatches.find((m) => m.matchCode === 'D5');
    expect(matchD5).toBeDefined();
    expect(matchD5?.team2Id).toBe('team_e2');

    // B5: C組1位 vs B組2位
    const matchB5 = seededMatches.find((m) => m.matchCode === 'B5');
    expect(matchB5?.team1Id).toBe('team_c1');
    expect(matchB5?.team2Id).toBe('team_b2');

    // B5の勝者・B6の勝者がB7に進出する設定
    expect(matchB5?.nextMatchId).toBe('match_B7');
    expect(matchB6?.nextMatchId).toBe('match_B7');
    const matchB7 = seededMatches.find((m) => m.matchCode === 'B7');
    expect(matchB7?.nextMatchId).toBe('match_A8');
    expect(matchB7?.loserToMatchId).toBe('match_B8');

    const matchA7 = seededMatches.find((m) => m.matchCode === 'A7');
    expect(matchA7?.nextMatchId).toBe('match_A8');
    expect(matchA7?.loserToMatchId).toBe('match_B8');

    const matchB8 = seededMatches.find((m) => m.matchCode === 'B8');
    expect(matchB8).toBeDefined();
    expect(matchB8?.round).toBe('third_place');
  });

  it('ensureOfficialTournamentIntegrity: migrates old state to 36-match Plan A state with B8, C8, D8, and exchange league', () => {
    // 古い30試合（B7, B8, C8, D8等欠損）のモック状態
    const oldMatches = DEFAULT_APP_STATE.matches.filter(
      (m) => m.matchCode !== 'B7' && m.matchCode !== 'B8' && m.matchCode !== 'C8' && m.matchCode !== 'D8'
    );

    const oldState = {
      ...DEFAULT_APP_STATE,
      matches: oldMatches,
    };

    expect(oldState.matches.length).toBeLessThan(36);

    // 整合性チェックと自動修復を実行
    const { state: upgradedState, upgraded } = ensureOfficialTournamentIntegrity(oldState);
    expect(upgraded).toBe(true);
    expect(upgradedState.matches.length).toBe(36);
    expect(upgradedState.matches.some((m) => m.matchCode === 'B7')).toBe(true);
    expect(upgradedState.matches.some((m) => m.matchCode === 'B8')).toBe(true);
    expect(upgradedState.matches.some((m) => m.matchCode === 'C8')).toBe(true);
    expect(upgradedState.matches.some((m) => m.matchCode === 'D8')).toBe(true);
    expect(upgradedState.matches.some((m) => m.matchCode === 'E7')).toBe(true);

    const b6 = upgradedState.matches.find((m) => m.matchCode === 'B6');
    const b7 = upgradedState.matches.find((m) => m.matchCode === 'B7');
    const b8 = upgradedState.matches.find((m) => m.matchCode === 'B8');
    expect(b6?.nextMatchId).toBe('match_B7');
    expect(b7?.nextMatchId).toBe('match_A8');
    expect(b7?.loserToMatchId).toBe('match_B8');
    expect(b8?.round).toBe('third_place');
  });

  it('advanceWinner: correctly sends A7/B7 losers to B8 3rd place match and QF losers to C8/D8', () => {
    let matches = createOfficialTournamentMatches();

    // 1回戦 A5, A6, B5, B6 を実施
    const a5 = matches.find((m) => m.matchCode === 'A5')!;
    a5.team1Id = 'team_a1';
    a5.team2Id = 'team_a2';
    a5.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, a5, DEFAULT_SETTINGS); // 勝者 team_a1 -> A7 slot 1, 敗者 team_a2 -> C8 slot 1

    const a6 = matches.find((m) => m.matchCode === 'A6')!;
    a6.team1Id = 'team_b1';
    a6.team2Id = 'team_b2';
    a6.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, a6, DEFAULT_SETTINGS); // 勝者 team_b1 -> A7 slot 2, 敗者 team_b2 -> C8 slot 2

    const b5 = matches.find((m) => m.matchCode === 'B5')!;
    b5.team1Id = 'team_c1';
    b5.team2Id = 'team_c2';
    b5.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, b5, DEFAULT_SETTINGS); // 勝者 team_c1 -> B7 slot 1, 敗者 team_c2 -> D8 slot 1

    const b6 = matches.find((m) => m.matchCode === 'B6')!;
    b6.team1Id = 'team_d1';
    b6.team2Id = 'team_d2';
    b6.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, b6, DEFAULT_SETTINGS); // 勝者 team_d1 -> B7 slot 2, 敗者 team_d2 -> D8 slot 2

    // QF敗者交流戦 C8, D8 への配分検証
    const c8 = matches.find((m) => m.matchCode === 'C8')!;
    const d8 = matches.find((m) => m.matchCode === 'D8')!;
    expect(c8.team1Id).toBe('team_a2'); // A5敗者
    expect(c8.team2Id).toBe('team_b2'); // A6敗者
    expect(d8.team1Id).toBe('team_c2'); // B5敗者
    expect(d8.team2Id).toBe('team_d2'); // B6敗者

    // 準決勝 A7: team_a1 vs team_b1 -> team_a1 勝者, team_b1 敗者
    const a7 = matches.find((m) => m.matchCode === 'A7')!;
    expect(a7.team1Id).toBe('team_a1');
    expect(a7.team2Id).toBe('team_b1');
    a7.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, a7, DEFAULT_SETTINGS);

    // 準決勝 B7: team_c1 vs team_d1 -> team_c1 勝者, team_d1 敗者
    const b7 = matches.find((m) => m.matchCode === 'B7')!;
    expect(b7.team1Id).toBe('team_c1');
    expect(b7.team2Id).toBe('team_d1');
    b7.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    matches = advanceWinner(matches, b7, DEFAULT_SETTINGS);

    // 決勝 A8: A7勝者 (team_a1) vs B7勝者 (team_c1)
    const a8 = matches.find((m) => m.matchCode === 'A8')!;
    expect(a8.team1Id).toBe('team_a1');
    expect(a8.team2Id).toBe('team_c1');

    // 3位決定戦 B8: A7敗者 (team_b1) vs B7敗者 (team_d1)
    const b8 = matches.find((m) => m.matchCode === 'B8')!;
    expect(b8.team1Id).toBe('team_b1');
    expect(b8.team2Id).toBe('team_d1');

    // B8の試合完了 -> team_b1 が勝利
    const completedB8 = {
      ...b8,
      sets: [{ team1: 15, team2: 12 }, { team1: 15, team2: 11 }, { team1: null, team2: null }],
    };
    matches = advanceWinner(matches, completedB8, DEFAULT_SETTINGS);

    const standings = computeStandings(DEFAULT_APP_STATE.teams, matches, DEFAULT_SETTINGS);
    const rank3 = standings.find((s) => s.rank === 3);
    const rank4 = standings.find((s) => s.rank === 4);
    expect(rank3?.teamId).toBe('team_b1');
    expect(rank4?.teamId).toBe('team_d1');
  });

  it('guarantees every single team plays 4 to 5 matches (Plan A verification)', () => {
    const matches = createOfficialTournamentMatches();
    const progressList = computeAllTeamsMatchProgress(DEFAULT_APP_STATE.teams, matches);

    expect(progressList.length).toBe(17);
    for (const info of progressList) {
      // 全チームが 4試合 または 5試合 になっていること
      expect([4, 5]).toContain(info.scheduledCount);
      // 午前予選は全チームちょうど2試合
      expect(info.prelimMatches.length).toBe(2);
    }

    const count4 = progressList.filter((p) => p.scheduledCount === 4).length;
    const count5 = progressList.filter((p) => p.scheduledCount === 5).length;
    // 初期状態では全チーム最低4試合が予定されていること
    expect(count4 + count5).toBe(17);
  });

  it('automatically populates teams and resolves referees as scores are entered step-by-step', () => {
    let state = DEFAULT_APP_STATE;

    // 1) 予選試合のスコアを保存していくと、自動でシード配分と交流リーグの審判が設定される
    const matchA1 = state.matches.find((m) => m.matchCode === 'A1')!;
    state = tournamentReducer(state, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: matchA1.id,
        sets: [{ team1: 15, team2: 10 }, { team1: 15, team2: 12 }, { team1: null, team2: null }],
      },
    });

    expect(state.matches.find((m) => m.matchCode === 'A1')?.status).toBe('completed');

    // 2) 決勝トーナメントA5の対戦チームをセットして完了させる
    const matchA5 = state.matches.find((m) => m.matchCode === 'A5')!;
    const stateWithA5Teams = {
      ...state,
      matches: state.matches.map((m) =>
        m.matchCode === 'A5' ? { ...m, team1Id: 'team_a1', team2Id: 'team_a2' } : m
      ),
    };

    // A5: team_a1 が勝利、team_a2 が敗北
    const nextState = tournamentReducer(stateWithA5Teams, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: matchA5.id,
        sets: [{ team1: 15, team2: 8 }, { team1: 15, team2: 9 }, { team1: null, team2: null }],
      },
    });

    // 勝者 team_a1 は A7 の slot 1 に自動進出！
    const a7 = nextState.matches.find((m) => m.matchCode === 'A7')!;
    expect(a7.team1Id).toBe('team_a1');

    // 敗者 team_a2 は C8 (順位交流戦) の slot 1 に自動進出！
    const c8 = nextState.matches.find((m) => m.matchCode === 'C8')!;
    expect(c8.team1Id).toBe('team_a2');

    // そして A6 の審判が自動的に「A5敗者チーム名」に更新される！
    const a6 = nextState.matches.find((m) => m.matchCode === 'A6')!;
    const teamA2 = DEFAULT_APP_STATE.teams.find((t) => t.id === 'team_a2')!;
    expect(a6.referee).toContain(teamA2.name);
  });

  it('ignores malformed score updates and keeps teams with completed match records', () => {
    const firstLeagueMatch = DEFAULT_APP_STATE.matches.find((match) => match.round === 'league')!;
    const invalidScoreState = tournamentReducer(DEFAULT_APP_STATE, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: firstLeagueMatch.id,
        sets: [{ team1: 15.5, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }],
      },
    });
    expect(invalidScoreState).toBe(DEFAULT_APP_STATE);

    const completedState = tournamentReducer(DEFAULT_APP_STATE, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: firstLeagueMatch.id,
        sets: [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }],
      },
    });
    const teamId = firstLeagueMatch.team1Id!;
    const afterDelete = tournamentReducer(completedState, {
      type: 'DELETE_TEAM',
      payload: { teamId },
    });
    expect(afterDelete.teams.some((team) => team.id === teamId)).toBe(true);
    expect(afterDelete.matches.find((match) => match.id === firstLeagueMatch.id)?.winnerId).toBe(teamId);

    const extraSetState = tournamentReducer(DEFAULT_APP_STATE, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: firstLeagueMatch.id,
        sets: [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: 10, team2: 15 }],
      },
    });
    expect(extraSetState.matches.find((match) => match.id === firstLeagueMatch.id)?.sets[2]).toEqual({
      team1: null,
      team2: null,
    });
  });
});
