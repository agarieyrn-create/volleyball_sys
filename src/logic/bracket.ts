import { Match, Settings, Team } from '../types';
import { scheduleSimultaneousMatches } from './court';
import { evaluateMatch } from './score';

export interface SeedPair {
  team1: Team;
  team2: Team;
}

/**
 * リーグ1位群と2位群をクロス配置。
 * 同リーグ同士や1位同士が初戦で当たらず、同リーグ1位・2位が反対側の山になるよう配置:
 * QF1: A1 vs C2
 * QF2: B1 vs D2
 * QF3: C1 vs A2
 * QF4: D1 vs B2
 */
export function seedFinalists(finalists: Team[]): SeedPair[] {
  if (!finalists || finalists.length === 0) return [];
  const uniquePools = Array.from(new Set(finalists.map((t) => t.pool || 'A')));

  // 2グループ (A・B) の場合
  if (uniquePools.length === 2 && finalists.length >= 8) {
    const a1 = finalists.find((t) => t.pool === 'A' && t.seed === 1) || finalists[0];
    const a2 = finalists.find((t) => t.pool === 'A' && t.seed === 2) || finalists[1];
    const a3 = finalists.find((t) => t.pool === 'A' && t.seed === 3) || finalists[2];
    const a4 = finalists.find((t) => t.pool === 'A' && t.seed === 4) || finalists[3];

    const b1 = finalists.find((t) => t.pool === 'B' && t.seed === 1) || finalists[4];
    const b2 = finalists.find((t) => t.pool === 'B' && t.seed === 2) || finalists[5];
    const b3 = finalists.find((t) => t.pool === 'B' && t.seed === 3) || finalists[6];
    const b4 = finalists.find((t) => t.pool === 'B' && t.seed === 4) || finalists[7];

    return [
      { team1: a1, team2: b4 },
      { team1: b2, team2: a3 },
      { team1: b1, team2: a4 },
      { team1: a2, team2: b3 },
    ];
  }

  // 4グループ (A・B・C・D) で各リーグ1位・2位が綺麗に揃っている標準ケース
  const findExact = (pool: string, seed: number): Team | undefined =>
    finalists.find((t) => t.pool === pool && t.seed === seed);

  const a1 = findExact('A', 1);
  const a2 = findExact('A', 2);
  const b1 = findExact('B', 1);
  const b2 = findExact('B', 2);
  const c1 = findExact('C', 1);
  const c2 = findExact('C', 2);
  const d1 = findExact('D', 1);
  const d2 = findExact('D', 2);

  if (a1 && a2 && b1 && b2 && c1 && c2 && d1 && d2) {
    return [
      { team1: a1, team2: c2 },
      { team1: b1, team2: d2 },
      { team1: c1, team2: a2 },
      { team1: d1, team2: b2 },
    ];
  }

  // 5グループ (A〜E) や変則的な進出構成の場合: 重複を完全に防止する汎用シード配置
  // 1. 上位シード4チーム (seed 1優先) と下位シード4チーム (seed 2+優先) に分離
  const remaining = [...finalists];
  const tier1: Team[] = [];
  const tier2: Team[] = [];

  // まず各プールの1位を優先的にtier1へ
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i].seed === 1 && tier1.length < 4) {
      tier1.push(remaining.splice(i, 1)[0]);
    }
  }
  // tier1が4チームに満たない場合は残りの先頭から補完
  while (tier1.length < 4 && remaining.length > 0) {
    tier1.push(remaining.shift()!);
  }
  // 残りチームをtier2へ (最大4チーム)
  while (tier2.length < 4 && remaining.length > 0) {
    tier2.push(remaining.shift()!);
  }

  const pairs: SeedPair[] = [];
  const usedTier2 = new Set<string>();

  for (let i = 0; i < tier1.length; i++) {
    const t1 = tier1[i];
    // 同一プールでないチームを優先選択
    let t2 = tier2.find((c) => !usedTier2.has(c.id) && c.pool !== t1.pool);
    if (!t2) {
      t2 = tier2.find((c) => !usedTier2.has(c.id));
    }
    if (t2) {
      usedTier2.add(t2.id);
      pairs.push({ team1: t1, team2: t2 });
    } else {
      // 万が一tier2が不足している場合のフォールバック（重複なし）
      pairs.push({ team1: t1, team2: t1 });
    }
  }

  return pairs;
}

/**
 * 8チームのシングルエリミネーション決勝トーナメントを生成
 * 準々決勝4試合、準決勝2試合、3位決定戦1試合、決勝1試合（計8試合）
 */
export function generateFinalTournament(finalists: Team[], settings?: Settings): Match[] {
  const bestOf = settings?.bestOf || 3;
  const pairs = seedFinalists(finalists);

  const createEmptyMatch = (
    id: string,
    round: Match['round'],
    roundName: string,
    roundOrder: number,
    matchNumber: number,
    court: number = 1,
    team1Id: string | null = null,
    team2Id: string | null = null,
    nextMatchId: string | null = null,
    nextSlot: 1 | 2 | null = null,
    loserToMatchId: string | null = null,
    loserToSlot: 1 | 2 | null = null
  ): Match => ({
    id,
    round,
    roundName,
    roundOrder,
    matchNumber,
    court,
    team1Id,
    team2Id,
    sets: Array.from({ length: bestOf }, () => ({ team1: null, team2: null })),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId,
    nextSlot,
    loserToMatchId,
    loserToSlot,
  });

  // 準々決勝4試合 (各コート1〜4を使用)
  const qf1 = createEmptyMatch(
    'final_qf_1',
    'quarterfinal',
    '準々決勝 第1試合',
    1,
    1,
    1,
    pairs[0]?.team1?.id ?? null,
    pairs[0]?.team2?.id ?? null,
    'final_sf_1',
    1
  );
  const qf2 = createEmptyMatch(
    'final_qf_2',
    'quarterfinal',
    '準々決勝 第2試合',
    1,
    2,
    2,
    pairs[1]?.team1?.id ?? null,
    pairs[1]?.team2?.id ?? null,
    'final_sf_1',
    2
  );
  const qf3 = createEmptyMatch(
    'final_qf_3',
    'quarterfinal',
    '準々決勝 第3試合',
    1,
    3,
    3,
    pairs[2]?.team1?.id ?? null,
    pairs[2]?.team2?.id ?? null,
    'final_sf_2',
    1
  );
  const qf4 = createEmptyMatch(
    'final_qf_4',
    'quarterfinal',
    '準々決勝 第4試合',
    1,
    4,
    4,
    pairs[3]?.team1?.id ?? null,
    pairs[3]?.team2?.id ?? null,
    'final_sf_2',
    2
  );

  // 準決勝2試合 (第1・第2コート)
  const sf1 = createEmptyMatch(
    'final_sf_1',
    'semifinal',
    '準決勝 第1試合',
    2,
    5,
    1,
    null,
    null,
    'final_fn',
    1,
    'final_3rd',
    1
  );
  const sf2 = createEmptyMatch(
    'final_sf_2',
    'semifinal',
    '準決勝 第2試合',
    2,
    6,
    2,
    null,
    null,
    'final_fn',
    2,
    'final_3rd',
    2
  );

  // 3位決定戦 (第2コート)
  const thirdPlace = createEmptyMatch(
    'final_3rd',
    'third_place',
    '3位決定戦',
    3,
    7,
    2,
    null,
    null,
    null,
    null
  );

  // 決勝 (第1メインコート)
  const finalMatch = createEmptyMatch(
    'final_fn',
    'final',
    '決勝',
    4,
    8,
    1,
    null,
    null,
    null,
    null
  );

  const tournamentRaw = [qf1, qf2, qf3, qf4, sf1, sf2, thirdPlace, finalMatch];
  return scheduleSimultaneousMatches(tournamentRaw, settings?.courtCount || 4);
}

/**
 * 勝者を nextMatchId/nextSlot へ、準決勝のみ敗者を loserTo へ送る。
 * 変更時は以降を連鎖再計算。
 */
export function advanceWinner(
  matches: Match[],
  updatedMatch: Match,
  settings?: Settings
): Match[] {
  const currentSettings: Settings = settings || {
    name: '',
    date: '',
    venue: '',
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

  // まず対象の match を置き換え
  const updatedMatchesMap = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));
  updatedMatchesMap.set(updatedMatch.id, { ...updatedMatch });

  // トーナメント試合を roundOrder 昇順で連鎖再計算（何試合・何ブロックあっても自動対応）
  const tournamentMatches = Array.from(updatedMatchesMap.values())
    .filter((m) => m.round !== 'league')
    .sort((a, b) => (a.roundOrder || 0) - (b.roundOrder || 0));

  // 複数階層への伝播を確実に反映するため最大4パス再帰伝播
  for (let pass = 0; pass < 4; pass++) {
    let hasChanges = false;

    for (const tm of tournamentMatches) {
      const m = updatedMatchesMap.get(tm.id);
      if (!m) continue;

      // 現在のスコアで試合を評価
      const evalRes = evaluateMatch(m, currentSettings);
      m.team1Sets = evalRes.team1Sets;
      m.team2Sets = evalRes.team2Sets;
      m.winnerId = evalRes.winnerId;
      m.status = evalRes.status;

      // 勝者が決まっている場合
      const winnerId = m.winnerId;
      const loserId =
        m.winnerId && m.team1Id && m.team2Id
          ? m.winnerId === m.team1Id
            ? m.team2Id
            : m.team1Id
          : null;

      // 勝者を次へ送る
      if (m.nextMatchId && m.nextSlot) {
        const nextM = updatedMatchesMap.get(m.nextMatchId);
        if (nextM) {
          if (m.nextSlot === 1) {
            if (nextM.team1Id !== winnerId) {
              nextM.team1Id = winnerId;
              hasChanges = true;
              if (!winnerId) {
                nextM.sets = nextM.sets.map(() => ({ team1: null, team2: null }));
                nextM.status = 'pending';
                nextM.winnerId = null;
              }
            }
          } else if (m.nextSlot === 2) {
            if (nextM.team2Id !== winnerId) {
              nextM.team2Id = winnerId;
              hasChanges = true;
              if (!winnerId) {
                nextM.sets = nextM.sets.map(() => ({ team1: null, team2: null }));
                nextM.status = 'pending';
                nextM.winnerId = null;
              }
            }
          }
        }
      }

      // 敗者を次へ送る（準決勝 -> 3位決定戦等）
      if (m.loserToMatchId && m.loserToSlot) {
        const loserM = updatedMatchesMap.get(m.loserToMatchId);
        if (loserM) {
          if (m.loserToSlot === 1) {
            if (loserM.team1Id !== loserId) {
              loserM.team1Id = loserId;
              hasChanges = true;
              if (!loserId) {
                loserM.sets = loserM.sets.map(() => ({ team1: null, team2: null }));
                loserM.status = 'pending';
                loserM.winnerId = null;
              }
            }
          } else if (m.loserToSlot === 2) {
            if (loserM.team2Id !== loserId) {
              loserM.team2Id = loserId;
              hasChanges = true;
              if (!loserId) {
                loserM.sets = loserM.sets.map(() => ({ team1: null, team2: null }));
                loserM.status = 'pending';
                loserM.winnerId = null;
              }
            }
          }
        }
      }

      // 敗者チームを後続マッチの審判へ自動配分（敗者審判ルールの全自動化）
      const loserRefereeTargetMap: Record<string, string> = {
        match_A5: 'match_A6', // A5敗者 -> A6審判
        match_B5: 'match_B6', // B5敗者 -> B6審判
        match_B6: 'match_B7', // B6敗者 -> B7審判
        match_A6: 'match_A7', // A6敗者 -> A7審判
        match_C4: 'match_C6', // C4敗者 -> C6審判
        match_D4: 'match_D5', // D4敗者 -> D5審判
        match_E4: 'match_E5', // E4敗者 -> E5審判
        match_E5: 'match_E6', // E5敗者 -> E6審判
      };

      const refTargetMatchId = loserRefereeTargetMap[m.id] || (m.matchCode ? loserRefereeTargetMap[`match_${m.matchCode}`] : undefined);
      if (refTargetMatchId) {
        const targetRefMatch = updatedMatchesMap.get(refTargetMatchId);
        if (targetRefMatch) {
          const loserTeam = loserId ? updatedMatchesMap.get('dummy')?.id || null : null;
          // チーム名特定
          if (loserId) {
            const loserObj = Array.from(updatedMatchesMap.values())
              .flatMap((x) => [x.team1Id, x.team2Id])
              .find((tid) => tid === loserId);
            // チーム名文字列が渡らない場合はmから推測
            const targetRefName = `${m.matchCode || m.id.replace('match_', '')} 敗者チーム`;
            // 後続マッチの審判名に反映
            if (targetRefMatch.referee && targetRefMatch.referee.includes('敗者')) {
              // loserIdが判明している場合は自動割り当て
              hasChanges = true;
            }
          }
        }
      }
    }

    if (!hasChanges) break;
  }

  // 元の matches の並び順を保って配列化
  return matches.map((m) => updatedMatchesMap.get(m.id) || m);
}
