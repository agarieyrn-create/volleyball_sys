import { Match, Settings, Standing, Team } from '../types';

/**
 * 予選リーグの順位を計算（各リーグ内で独立。同着なし）
 * 1) 勝利数（多い順）
 * 2) セット率 = 獲得セット / max(喪失セット, 1)（高い順）
 * 3) 得点差 = 総得点 - 総失点（大きい順）
 * 4) 直接対決の勝者
 * 5) チーム名（昇順）
 */
export function computeLeagueStandings(
  teams: Team[],
  matches: Match[],
  _settings?: Settings
): Standing[] {
  const leagueMatches = matches.filter((m) => m.round === 'league' && m.status === 'completed');

  // 各チームの統計情報マップ
  const statsMap = new Map<string, {
    team: Team;
    played: number;
    win: number;
    loss: number;
    setsWon: number;
    setsLost: number;
    pointsFor: number;
    pointsAgainst: number;
  }>();

  for (const team of teams) {
    statsMap.set(team.id, {
      team,
      played: 0,
      win: 0,
      loss: 0,
      setsWon: 0,
      setsLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of leagueMatches) {
    if (!match.team1Id || !match.team2Id) continue;
    const s1 = statsMap.get(match.team1Id);
    const s2 = statsMap.get(match.team2Id);

    if (s1 && s2) {
      s1.played++;
      s2.played++;

      s1.setsWon += match.team1Sets;
      s1.setsLost += match.team2Sets;
      s2.setsWon += match.team2Sets;
      s2.setsLost += match.team1Sets;

      let matchPts1 = 0;
      let matchPts2 = 0;
      for (const set of match.sets) {
        if (set.team1 !== null && set.team2 !== null) {
          matchPts1 += set.team1;
          matchPts2 += set.team2;
        }
      }
      s1.pointsFor += matchPts1;
      s1.pointsAgainst += matchPts2;
      s2.pointsFor += matchPts2;
      s2.pointsAgainst += matchPts1;

      if (match.winnerId === match.team1Id) {
        s1.win++;
        s2.loss++;
      } else if (match.winnerId === match.team2Id) {
        s2.win++;
        s1.loss++;
      }
    }
  }

  // プールごとにチームを分類 (A, B, C, D, E 等)
  const defaultPools = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const pools = new Map<string, string[]>();

  teams.forEach((team, idx) => {
    const fallbackPool = defaultPools[idx % Math.max(1, _settings?.leagueCount || 5)];
    const pool = team.pool ? team.pool : fallbackPool;
    if (!pools.has(pool)) {
      pools.set(pool, []);
    }
    pools.get(pool)!.push(team.id);
  });

  const allStandings: Standing[] = [];
  const sortedPools = Array.from(pools.keys()).sort();

  for (const pool of sortedPools) {
    const teamIds = pools.get(pool)!;

    // ソート比較
    const sortedTeamIds = [...teamIds].sort((aId, bId) => {
      const a = statsMap.get(aId)!;
      const b = statsMap.get(bId)!;

      // 1) 勝利数
      if (b.win !== a.win) {
        return b.win - a.win;
      }

      // 2) セット率 = 獲得セット / max(喪失セット, 1)
      const ratioA = a.setsWon / Math.max(a.setsLost, 1);
      const ratioB = b.setsWon / Math.max(b.setsLost, 1);
      if (Math.abs(ratioB - ratioA) > 1e-6) {
        return ratioB - ratioA;
      }

      // 3) 得点差 = 総得点 - 総失点
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      if (diffB !== diffA) {
        return diffB - diffA;
      }

      // 4) 直接対決の勝者
      const h2h = leagueMatches.filter(
        (m) =>
          (m.team1Id === aId && m.team2Id === bId) ||
          (m.team1Id === bId && m.team2Id === aId)
      );
      let aH2hWins = 0;
      let bH2hWins = 0;
      for (const m of h2h) {
        if (m.winnerId === aId) aH2hWins++;
        if (m.winnerId === bId) bH2hWins++;
      }
      if (aH2hWins !== bH2hWins) {
        return bH2hWins - aH2hWins;
      }

      // 5) チーム名
      return a.team.name.localeCompare(b.team.name);
    });

    // 順位番号を付与
    sortedTeamIds.forEach((id, index) => {
      const s = statsMap.get(id)!;
      allStandings.push({
        rank: index + 1,
        teamId: id,
        teamName: s.team.name,
        pool,
        played: s.played,
        win: s.win,
        loss: s.loss,
        setsWon: s.setsWon,
        setsLost: s.setsLost,
        setRatio: Math.round((s.setsWon / Math.max(s.setsLost, 1)) * 1000) / 1000,
        pointsFor: s.pointsFor,
        pointsAgainst: s.pointsAgainst,
        pointDiff: s.pointsFor - s.pointsAgainst,
      });
    });
  }

  return allStandings;
}

/**
 * 各リーグの上位チームから決勝トーナメント進出チーム（最大8チーム）を抽出。
 * 2リーグなら各上位4チーム、4リーグなら各上位2チーム、3リーグなら各上位2チーム+成績上位3位の計8チーム等、
 * リーグ数に合わせて柔軟に選出。
 */
export function selectFinalists(
  teams: Team[],
  matches: Match[],
  settings: Settings
): Team[] {
  const standings = computeLeagueStandings(teams, matches, settings);
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // 存在するプール一覧を抽出
  const uniquePools = Array.from(new Set(standings.map((s) => s.pool || 'A'))).sort();
  const poolCount = uniquePools.length;

  const finalists: Team[] = [];
  const targetCount = Math.min(8, teams.length);

  if (poolCount === 2) {
    // 2リーグ: 各リーグ上位4チーム（計8チーム）
    for (let rank = 1; rank <= 4; rank++) {
      for (const pool of uniquePools) {
        const st = standings.find((s) => s.pool === pool && s.rank === rank);
        if (st && finalists.length < targetCount) {
          const team = teamMap.get(st.teamId);
          if (team) {
            finalists.push({ ...team, pool, seed: rank });
          }
        }
      }
    }
  } else if (poolCount === 4) {
    // 4リーグ: 各リーグ上位2チーム（計8チーム）
    for (const pool of uniquePools) {
      for (let rank = 1; rank <= 2; rank++) {
        const st = standings.find((s) => s.pool === pool && s.rank === rank);
        if (st && finalists.length < targetCount) {
          const team = teamMap.get(st.teamId);
          if (team) {
            finalists.push({ ...team, pool, seed: rank });
          }
        }
      }
    }
  } else {
    // 3リーグ、単一リーグ、5〜8リーグ等: 各リーグの1位群、次に2位群、次に3位群...の順で最大8チーム集める
    let currentRank = 1;
    while (finalists.length < targetCount && currentRank <= 8) {
      // 当該ランクのチームを成績順（勝率・セット率・得点差）でソートして追加
      const rankCandidates = standings
        .filter((s) => s.rank === currentRank && !finalists.some((f) => f.id === s.teamId))
        .sort((a, b) => {
          if (b.win !== a.win) return b.win - a.win;
          if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
          return b.pointDiff - a.pointDiff;
        });

      for (const st of rankCandidates) {
        if (finalists.length >= targetCount) break;
        const team = teamMap.get(st.teamId);
        if (team) {
          finalists.push({ ...team, pool: st.pool, seed: currentRank });
        }
      }
      currentRank++;
    }
  }

  return finalists;
}

/**
 * 総合順位の算出。
 * 決勝トーナメント完了後は最終結果 (1位/2位/3位/4位/ベスト8等) を返す。
 */
export function computeStandings(
  teams: Team[],
  matches: Match[],
  settings: Settings
): Standing[] {
  const leagueStandings = computeLeagueStandings(teams, matches, settings);
  if (settings.format === 'league') {
    return leagueStandings;
  }

  const finalMatch = matches.find((m) => m.round === 'final' || m.matchCode === 'A8' || m.id === 'match_A8');
  const thirdPlaceMatch = matches.find(
    (m) => m.round === 'third_place' || m.matchCode === 'B8' || m.id === 'match_B8' || m.id === 'final_3rd'
  );
  const semiA7 = matches.find((m) => m.matchCode === 'A7' || m.id === 'match_A7');
  const semiB7 = matches.find((m) => m.matchCode === 'B7' || m.id === 'match_B7');
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // 決勝または3位決定戦、または準決勝のいずれかが完了している場合、判明している最終順位を生成
  const isFinalCompleted = finalMatch && finalMatch.status === 'completed' && finalMatch.winnerId;
  const isThirdCompleted =
    thirdPlaceMatch && thirdPlaceMatch.status === 'completed' && thirdPlaceMatch.winnerId;
  const isSemisCompleted =
    semiA7 && semiA7.status === 'completed' && semiA7.winnerId &&
    semiB7 && semiB7.status === 'completed' && semiB7.winnerId;

  if (isFinalCompleted || isThirdCompleted || isSemisCompleted) {
    const winnerId = isFinalCompleted ? finalMatch.winnerId : null;
    const runnerUpId =
      isFinalCompleted && finalMatch.winnerId
        ? finalMatch.winnerId === finalMatch.team1Id
          ? finalMatch.team2Id
          : finalMatch.team1Id
        : null;

    let thirdWinnerId = isThirdCompleted ? thirdPlaceMatch.winnerId : null;
    let fourthId =
      isThirdCompleted && thirdPlaceMatch.winnerId
        ? thirdWinnerId === thirdPlaceMatch.team1Id
          ? thirdPlaceMatch.team2Id
          : thirdPlaceMatch.team1Id
        : null;

    // 3位決定戦が無い場合は、準決勝敗者2チーム（ベスト4）から決定（予選順位・得失点差上位を3位とする）
    if (!thirdWinnerId && isSemisCompleted) {
      const loserA7 = semiA7.winnerId === semiA7.team1Id ? semiA7.team2Id : semiA7.team1Id;
      const loserB7 = semiB7.winnerId === semiB7.team1Id ? semiB7.team2Id : semiB7.team1Id;
      const rankA = leagueStandings.findIndex((s) => s.teamId === loserA7);
      const rankB = leagueStandings.findIndex((s) => s.teamId === loserB7);
      if (rankA !== -1 && rankB !== -1 && rankA <= rankB) {
        thirdWinnerId = loserA7;
        fourthId = loserB7;
      } else {
        thirdWinnerId = loserB7;
        fourthId = loserA7;
      }
    }

    const rankList: { rank: number; teamId: string | null }[] = [
      { rank: 1, teamId: winnerId },
      { rank: 2, teamId: runnerUpId },
      { rank: 3, teamId: thirdWinnerId },
      { rank: 4, teamId: fourthId },
    ];

    const result: Standing[] = [];

    // 上位4チームの追加
    for (const item of rankList) {
      if (!item.teamId) continue;
      const t = teamMap.get(item.teamId);
      const ls = leagueStandings.find((s) => s.teamId === item.teamId);
      result.push({
        rank: item.rank,
        teamId: item.teamId,
        teamName: t?.name || '未定',
        pool: t?.pool,
        played: ls?.played ?? 0,
        win: ls?.win ?? 0,
        loss: ls?.loss ?? 0,
        setsWon: ls?.setsWon ?? 0,
        setsLost: ls?.setsLost ?? 0,
        setRatio: ls?.setRatio ?? 0,
        pointsFor: ls?.pointsFor ?? 0,
        pointsAgainst: ls?.pointsAgainst ?? 0,
        pointDiff: ls?.pointDiff ?? 0,
      });
    }

    // 残りのチームをリーグ成績順に追加
    const addedIds = new Set(result.map((r) => r.teamId));
    const remaining = leagueStandings.filter((s) => !addedIds.has(s.teamId));
    let nextRank = 5;
    for (const rem of remaining) {
      result.push({
        ...rem,
        rank: nextRank++,
      });
    }

    return result;
  }

  // 予選中または決勝トーナメント途中は予選順位を返す
  return leagueStandings;
}

/**
 * 下位交流リーグ（X組・Y組・Z組）の順位表を計算
 */
export function computeExchangeLeagueStandings(
  teams: Team[],
  matches: Match[]
): Standing[] {
  const exchangeMatches = matches.filter(
    (m) => m.round === 'exchange_league' && m.status === 'completed'
  );

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  // 交流戦に参加している、または参加予定のチーム一覧
  const exchangePools: Record<string, string[]> = { X: [], Y: [], Z: [] };

  matches
    .filter((m) => m.round === 'exchange_league')
    .forEach((m) => {
      const p = m.pool || 'X';
      if (!exchangePools[p]) exchangePools[p] = [];
      if (m.team1Id && !exchangePools[p].includes(m.team1Id)) exchangePools[p].push(m.team1Id);
      if (m.team2Id && !exchangePools[p].includes(m.team2Id)) exchangePools[p].push(m.team2Id);
    });

  const statsMap = new Map<
    string,
    {
      played: number;
      win: number;
      loss: number;
      setsWon: number;
      setsLost: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();

  for (const m of exchangeMatches) {
    if (!m.team1Id || !m.team2Id) continue;
    if (!statsMap.has(m.team1Id)) {
      statsMap.set(m.team1Id, { played: 0, win: 0, loss: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    if (!statsMap.has(m.team2Id)) {
      statsMap.set(m.team2Id, { played: 0, win: 0, loss: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 });
    }

    const s1 = statsMap.get(m.team1Id)!;
    const s2 = statsMap.get(m.team2Id)!;

    s1.played++;
    s2.played++;
    s1.setsWon += m.team1Sets;
    s1.setsLost += m.team2Sets;
    s2.setsWon += m.team2Sets;
    s2.setsLost += m.team1Sets;

    let pts1 = 0;
    let pts2 = 0;
    for (const set of m.sets) {
      if (set.team1 !== null && set.team2 !== null) {
        pts1 += set.team1;
        pts2 += set.team2;
      }
    }
    s1.pointsFor += pts1;
    s1.pointsAgainst += pts2;
    s2.pointsFor += pts2;
    s2.pointsAgainst += pts1;

    if (m.winnerId === m.team1Id) {
      s1.win++;
      s2.loss++;
    } else if (m.winnerId === m.team2Id) {
      s2.win++;
      s1.loss++;
    }
  }

  const results: Standing[] = [];

  for (const poolKey of ['X', 'Y', 'Z']) {
    const tIds = exchangePools[poolKey] || [];
    const poolStandings: Standing[] = tIds.map((tid) => {
      const t = teamMap.get(tid);
      const st = statsMap.get(tid) || {
        played: 0,
        win: 0,
        loss: 0,
        setsWon: 0,
        setsLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      const pointDiff = st.pointsFor - st.pointsAgainst;
      const setRatio = st.setsLost === 0 ? st.setsWon : st.setsWon / st.setsLost;
      return {
        rank: 1,
        teamId: tid,
        teamName: t?.name || tid,
        pool: poolKey,
        played: st.played,
        win: st.win,
        loss: st.loss,
        setsWon: st.setsWon,
        setsLost: st.setsLost,
        setRatio,
        pointsFor: st.pointsFor,
        pointsAgainst: st.pointsAgainst,
        pointDiff,
      };
    });

    poolStandings.sort((a, b) => {
      if (b.win !== a.win) return b.win - a.win;
      if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.pointsFor - a.pointsFor;
    });

    poolStandings.forEach((s, idx) => {
      s.rank = idx + 1;
      results.push(s);
    });
  }

  return results;
}

export interface TeamMatchScheduleInfo {
  teamId: string;
  teamName: string;
  pool?: string;
  playedCount: number;
  scheduledCount: 4 | 5;
  prelimMatches: Match[];
  afternoonMatches: Match[];
  allMatches: Match[];
  isUpper: boolean;
  statusText: string;
}

/**
 * 全チームの「4〜5試合消化状況・予定」を計算
 * ユーザーの「1チーム4〜5試合になっているか見た目でわかる」要求に100%応える
 */
export function computeAllTeamsMatchProgress(
  teams: Team[],
  matches: Match[]
): TeamMatchScheduleInfo[] {
  const upperMatchCodes = new Set(['A5', 'B5', 'A6', 'B6', 'A7', 'B7', 'A8', 'B8', 'C8', 'D8']);

  return teams.map((team) => {
    const teamMatches = matches.filter(
      (m) => m.team1Id === team.id || m.team2Id === team.id
    );

    const prelimMatches = teamMatches.filter((m) => m.round === 'league');
    const afternoonMatches = teamMatches.filter((m) => m.round !== 'league');
    const completedMatches = teamMatches.filter((m) => m.status === 'completed');

    // 決勝・3位決定戦に進出する上位4チームは5試合、それ以外は4試合
    // 上位トーナメント進出判定
    const isUpper = afternoonMatches.some((m) => upperMatchCodes.has(m.matchCode || ''));

    // 予定試合数：上位トーナメントでQF勝利、または進出中のチームは最大5試合、交流リーグまたはQF敗者は4試合
    const playedCount = completedMatches.length;
    let scheduledCount: 4 | 5 = 4;
    if (isUpper) {
      // 準決勝勝者/敗者（決勝・3位決定戦）は5試合
      const reachesFinals = afternoonMatches.some(
        (m) => m.matchCode === 'A8' || m.matchCode === 'B8'
      );
      const inSemis = afternoonMatches.some(
        (m) => m.matchCode === 'A7' || m.matchCode === 'B7'
      );
      if (reachesFinals || inSemis) {
        scheduledCount = 5;
      }
    }

    let statusText = `${scheduledCount}試合中 ${playedCount}試合 終了`;
    if (playedCount >= scheduledCount) {
      statusText = `全${scheduledCount}試合 完了 🎉`;
    }

    return {
      teamId: team.id,
      teamName: team.name,
      pool: team.pool,
      playedCount,
      scheduledCount,
      prelimMatches,
      afternoonMatches,
      allMatches: teamMatches,
      isUpper,
      statusText,
    };
  });
}
