import { Match, Team } from '../types';

/**
 * 試合に審判を自動割り当てるロジック。
 * 【最重要原則】審判担当は、その試合が行われる「自分たちの試合コートと同じコート」で試合をするチームから選出する。
 * （自チームが試合を行うコート＝審判対応コート。他コートへの移動負担・混乱を完全にゼロにする）
 */
export function autoAssignReferees(matches: Match[], teams: Team[], forceReassign: boolean = false): Match[] {
  if (teams.length === 0 || matches.length === 0) return matches;

  const teamById = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const teamByName = new Map<string, Team>(teams.map((t) => [t.name, t]));

  // 各コートごとに、そのコートで試合を行うチームIDのセットを作成
  const teamsByCourt = new Map<number, Set<string>>();
  // 各プールごとに、そのプールに属するチームIDのセットを作成
  const teamsByPool = new Map<string, Set<string>>();

  for (const m of matches) {
    const court = m.court || 1;
    if (!teamsByCourt.has(court)) {
      teamsByCourt.set(court, new Set<string>());
    }
    if (m.team1Id) teamsByCourt.get(court)!.add(m.team1Id);
    if (m.team2Id) teamsByCourt.get(court)!.add(m.team2Id);

    if (m.pool) {
      if (!teamsByPool.has(m.pool)) {
        teamsByPool.set(m.pool, new Set<string>());
      }
      if (m.team1Id) teamsByPool.get(m.pool)!.add(m.team1Id);
      if (m.team2Id) teamsByPool.get(m.pool)!.add(m.team2Id);
    }
  }

  // チームごとの審判担当回数カウンター（回数の偏りを均等化）
  const refereeCounts = new Map<string, number>();
  for (const t of teams) {
    refereeCounts.set(t.name, 0);
  }

  // 直前の枠でそのコートにいたチームを記録
  const courtLastPlayed = new Map<number, string[]>();

  return matches.map((match) => {
    const court = match.court || 1;
    const courtTeams = teamsByCourt.get(court) || new Set<string>();
    const poolTeamIds = match.pool ? (teamsByPool.get(match.pool) || new Set<string>()) : new Set<string>();

    const playingIds = new Set<string>();
    if (match.team1Id) playingIds.add(match.team1Id);
    if (match.team2Id) playingIds.add(match.team2Id);

    // 候補1: 【最優先】同じコートで試合を行うチーム（かつ同一プールがあれば同一プール）のうち、この試合に出場していないチーム
    let sameCourtCandidates: Team[] = [];
    if (match.pool && poolTeamIds.size > 0) {
      sameCourtCandidates = Array.from(poolTeamIds)
        .filter((id) => !playingIds.has(id))
        .map((id) => teamById.get(id))
        .filter((t): t is Team => Boolean(t));
    }

    if (sameCourtCandidates.length === 0) {
      sameCourtCandidates = Array.from(courtTeams)
        .filter((id) => !playingIds.has(id))
        .map((id) => teamById.get(id))
        .filter((t): t is Team => Boolean(t));
    }

    // 既に審判が設定されており、forceReassign が false の場合
    if (!forceReassign && match.referee && match.referee.trim() !== '') {
      // 決勝トーナメントや本部・待機・敗者表記などは維持
      if (
        match.round !== 'league' ||
        match.referee.includes('本部') ||
        match.referee.includes('待機') ||
        match.referee.includes('敗者') ||
        match.referee.includes('勝者')
      ) {
        return match;
      }

      const refTeam = teamByName.get(match.referee);
      // その審判チームが実際に「このコートで試合をするチーム」であり、かつこの試合の対戦当事者でない場合のみ維持
      const isValidSameCourtRef = refTeam && (
        (match.pool && poolTeamIds.has(refTeam.id)) ||
        courtTeams.has(refTeam.id)
      ) && !playingIds.has(refTeam.id);

      if (isValidSameCourtRef) {
        refereeCounts.set(match.referee, (refereeCounts.get(match.referee) || 0) + 1);
        return match;
      }
      // 別コートのチームが割り当てられていた場合は、ここで確実に正しい自コートチームに再割り当て！
    }

    // 候補2: 全体の空きチーム（同一コートに空きがない極端な場合のみのフォールバック）
    const allAvailable = teams.filter((t) => !playingIds.has(t.id));

    let candidates: Team[];
    if (sameCourtCandidates.length > 0) {
      candidates = sameCourtCandidates;
    } else if (allAvailable.length > 0) {
      candidates = allAvailable;
    } else {
      candidates = teams;
    }

    // 候補の中から審判担当回数が最も少ないチームを優先（均等配分）
    candidates.sort((a, b) => {
      const countA = refereeCounts.get(a.name) || 0;
      const countB = refereeCounts.get(b.name) || 0;
      if (countA !== countB) return countA - countB;

      // 回数が同じなら、直前の試合でプレーしていなかったチーム（休憩していたチーム）を優先して連戦疲労を軽減
      const lastPlayed = courtLastPlayed.get(court) || [];
      const wasAInLast = lastPlayed.includes(a.id);
      const wasBInLast = lastPlayed.includes(b.id);
      if (!wasAInLast && wasBInLast) return -1;
      if (wasAInLast && !wasBInLast) return 1;
      return 0;
    });

    const chosen = candidates[0];
    if (chosen) {
      refereeCounts.set(chosen.name, (refereeCounts.get(chosen.name) || 0) + 1);
    }

    // 次の試合判定のために現在出場チームを記憶
    const currentPlaying: string[] = [];
    if (match.team1Id) currentPlaying.push(match.team1Id);
    if (match.team2Id) currentPlaying.push(match.team2Id);
    courtLastPlayed.set(court, currentPlaying);

    return {
      ...match,
      referee: chosen ? chosen.name : '本部審判',
    };
  });
}
