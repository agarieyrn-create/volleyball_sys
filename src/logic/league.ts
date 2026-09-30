import { getCourtName, scheduleSimultaneousMatches } from './court';
import { Match, Settings, Team } from '../types';

export const POOL_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export function getPoolLetter(index: number): string {
  if (index < POOL_NAMES.length) return POOL_NAMES[index];
  return String.fromCharCode(65 + index);
}

/**
 * チームを任意数（1〜8など）のリーグへできるだけ均等に配分する。
 * 余りは先頭リーグから1つずつ配る（例: 12チーム/3リーグ→4/4/4, 12チーム/2リーグ→6/6, 12チーム/4リーグ→3/3/3/3）。
 */
export function distributeTeams(teams: Team[], leagueCount: number = 4): Team[] {
  if (teams.length === 0 || leagueCount <= 0) return [];

  const count = Math.max(1, Math.min(8, leagueCount));
  const baseCount = Math.floor(teams.length / count);
  const remainder = teams.length % count;

  const result: Team[] = [];
  let currentIndex = 0;

  for (let i = 0; i < count; i++) {
    const groupTeamCount = baseCount + (i < remainder ? 1 : 0);
    const poolName = getPoolLetter(i);

    for (let j = 0; j < groupTeamCount; j++) {
      if (currentIndex < teams.length) {
        result.push({
          ...teams[currentIndex],
          pool: poolName,
        });
        currentIndex++;
      }
    }
  }

  return result;
}

/**
 * 各リーグ内で、各チームがちょうど matchesPerTeam (既定2) 試合になるよう円環状に対戦カードを生成。
 */
export function generateLeagueMatches(teams: Team[], settings: Settings): Match[] {
  const matches: Match[] = [];
  let matchNumber = 1;

  // リーグごとにグループ化
  const pools = new Map<string, Team[]>();
  for (const team of teams) {
    const pool = team.pool || 'A';
    if (!pools.has(pool)) {
      pools.set(pool, []);
    }
    pools.get(pool)!.push(team);
  }

  // 既定のプール順に処理
  const sortedPoolKeys = Array.from(pools.keys()).sort();

  for (const pool of sortedPoolKeys) {
    const poolTeams = pools.get(pool)!;
    const n = poolTeams.length;
    if (n < 2) continue;

    const matchesPerTeam = settings.matchesPerTeam || 2;

    if (n === 2) {
      // 2チームの場合: 同一カードを matchesPerTeam 回（例: 2試合）
      for (let m = 0; m < matchesPerTeam; m++) {
        matches.push(createEmptyLeagueMatch(
          `league_${pool}_${m + 1}`,
          pool,
          matchNumber++,
          poolTeams[0].id,
          poolTeams[1].id,
          settings.bestOf
        ));
      }
    } else if (n === 3) {
      // 3チームの場合: 総当たりで各チーム2試合 (0-1, 1-2, 2-0)
      const pairs: [number, number][] = [
        [0, 1],
        [1, 2],
        [2, 0],
      ];
      for (let m = 0; m < pairs.length; m++) {
        const [t1, t2] = pairs[m];
        matches.push(createEmptyLeagueMatch(
          `league_${pool}_${m + 1}`,
          pool,
          matchNumber++,
          poolTeams[t1].id,
          poolTeams[t2].id,
          settings.bestOf
        ));
      }
    } else if (n === 4) {
      // 4チームの場合: 各チーム2試合かつ連戦を最小化する順序
      // M1: 0-1, M2: 2-3 (M1とM2で全4チームが1試合ずつプレー、連続なし)
      // M3: 0-2, M4: 1-3
      const pairs: [number, number][] = [
        [0, 1],
        [2, 3],
        [0, 2],
        [1, 3],
      ];
      for (let m = 0; m < pairs.length; m++) {
        const [t1, t2] = pairs[m];
        matches.push(createEmptyLeagueMatch(
          `league_${pool}_${m + 1}`,
          pool,
          matchNumber++,
          poolTeams[t1].id,
          poolTeams[t2].id,
          settings.bestOf
        ));
      }
    } else if (n === 5) {
      // 5チームの場合: 20チーム4グループ（各5チーム）に最適
      // [0,1], [2,3], [4,0], [1,2], [3,4] の順で並べることで、
      // 直前試合の出場チームとの重複が0（全チームが必ず1試合以上の休憩を挟む）
      const pairs: [number, number][] = [
        [0, 1],
        [2, 3],
        [4, 0],
        [1, 2],
        [3, 4],
      ];
      for (let m = 0; m < pairs.length; m++) {
        const [t1, t2] = pairs[m];
        matches.push(createEmptyLeagueMatch(
          `league_${pool}_${m + 1}`,
          pool,
          matchNumber++,
          poolTeams[t1].id,
          poolTeams[t2].id,
          settings.bestOf
        ));
      }
    } else {
      // 6チーム以上: 円環状スケジュール
      for (let i = 0; i < n; i++) {
        const t1 = i;
        const t2 = (i + 1) % n;
        matches.push(createEmptyLeagueMatch(
          `league_${pool}_${i + 1}`,
          pool,
          matchNumber++,
          poolTeams[t1].id,
          poolTeams[t2].id,
          settings.bestOf
        ));
      }
    }
  }

  // 設定された利用可能コート数（1〜8面）および連戦回避設定に応じて同時進行スロット・コート番号を割り当て
  const avoid = settings.avoidConsecutiveMatches ?? true;
  return scheduleSimultaneousMatches(matches, settings.courtCount || 4, avoid);
}

function createEmptyLeagueMatch(
  id: string,
  pool: string,
  matchNumber: number,
  team1Id: string,
  team2Id: string,
  bestOf: number
): Match {
  const setsCount = bestOf || 3;
  const poolIndex = pool ? Math.max(1, pool.charCodeAt(0) - 64) : 1;
  const court = poolIndex;

  return {
    id,
    round: 'league',
    roundName: `予選リーグ ${pool}`,
    roundOrder: 1,
    matchNumber,
    court,
    pool,
    team1Id,
    team2Id,
    sets: Array.from({ length: setsCount }, () => ({ team1: null, team2: null })),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  };
}
