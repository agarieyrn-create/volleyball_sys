export const COURT_NAMES: Record<number, string> = {
  1: 'Aコート',
  2: 'Bコート',
  3: 'Cコート',
  4: 'Dコート',
  5: 'Eコート',
  6: 'Fコート',
  7: 'Gコート',
  8: 'Hコート',
};

export const COURT_LETTERS: Record<number, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
  6: 'F',
  7: 'G',
  8: 'H',
};

/**
 * 有効なコート番号リストを取得 (例: courtCount=2 なら [1, 2])
 */
export function getActiveCourts(courtCount: number = 4): number[] {
  const count = Math.max(1, Math.min(8, courtCount || 4));
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * コート番号（1〜8など）を「Aコート」「Bコート」等の名称に変換します
 */
export function getCourtName(court: number | undefined | null): string {
  if (!court || court < 1) return 'Aコート';
  return COURT_NAMES[court] || `${String.fromCharCode(64 + court)}コート`;
}

/**
 * コート記号（A, B, C, Dなど）を取得します
 */
export function getCourtLetter(court: number | undefined | null): string {
  if (!court || court < 1) return 'A';
  return COURT_LETTERS[court] || String.fromCharCode(64 + court);
}

import { Match } from '../types';

/**
 * 特定チームが連続試合（直前の枠と同じチームが連続して試合出場）になっている箇所を検出
 * 返り値: Map<teamId, 連続してプレーしたslot番号[]>
 */
export function findConsecutiveMatches(matches: Match[]): Map<string, number[]> {
  const teamSlots = new Map<string, number[]>();
  for (const m of matches) {
    if (typeof m.slot !== 'number') continue;
    if (m.team1Id) {
      if (!teamSlots.has(m.team1Id)) teamSlots.set(m.team1Id, []);
      teamSlots.get(m.team1Id)!.push(m.slot);
    }
    if (m.team2Id) {
      if (!teamSlots.has(m.team2Id)) teamSlots.set(m.team2Id, []);
      teamSlots.get(m.team2Id)!.push(m.slot);
    }
  }

  const consecutiveMap = new Map<string, number[]>();
  for (const [teamId, slots] of teamSlots.entries()) {
    const sorted = Array.from(new Set(slots)).sort((a, b) => a - b);
    const badSlots: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] === 1) {
        badSlots.push(sorted[i + 1]);
      }
    }
    if (badSlots.length > 0) {
      consecutiveMap.set(teamId, badSlots);
    }
  }
  return consecutiveMap;
}

/**
 * 利用可能コート面数（1〜8面）およびリーグ数に応じて、全試合に
 * 「コート番号」「進行枠（第1試合、第2試合…）」「通し試合番号」を自動割り振りします。
 * avoidConsecutive: true の場合、同一チームが2試合連続でプレーすることを強力に防止します（連戦回避）。
 */
export function scheduleSimultaneousMatches(
  matches: Match[],
  courtCount: number = 4,
  avoidConsecutive: boolean = true
): Match[] {
  if (!matches || matches.length === 0) return [];
  const validCourtCount = Math.max(1, Math.min(8, courtCount || 4));

  const leagueMatches = matches.filter((m) => m.round === 'league');
  const tournamentMatches = matches.filter((m) => m.round !== 'league');

  let currentSlot = 1;
  const scheduledLeague: Match[] = [];

  if (leagueMatches.length > 0) {
    // リーグごとに試合を分類
    const poolMatches = new Map<string, Match[]>();
    for (const m of leagueMatches) {
      const p = m.pool || 'A';
      if (!poolMatches.has(p)) {
        poolMatches.set(p, []);
      }
      poolMatches.get(p)!.push({ ...m });
    }

    const sortedPools = Array.from(poolMatches.keys()).sort();
    const poolCount = sortedPools.length;

    if (poolCount > 1 && avoidConsecutive) {
      // === 連戦回避（連続試合防止）スケジューリング ===
      // プールの同一チームが連続して試合に出場することを防ぐため、
      // プールを2つ以上の交互グループ（バッチ）に分割し、進行枠を交互に配置。
      // これにより、どのチームも必ず1枠以上の休憩（インターバル）が確保されます。
      const poolCourtMap = new Map<string, number>();
      sortedPools.forEach((pool, idx) => {
        poolCourtMap.set(pool, (idx % validCourtCount) + 1);
      });

      // 交互に進行させるバッチを作成 (最低2バッチ)
      // 例: 4プール・4面 -> Batch 0: [A, B] (Court 1, 2), Batch 1: [C, D] (Court 3, 4)
      // 例: 3プール・3面 -> Batch 0: [A, B] (Court 1, 2), Batch 1: [C] (Court 3)
      // 例: 2プール・2面 -> Batch 0: [A] (Court 1), Batch 1: [B] (Court 2)
      // 例: 4プール・2面 -> Batch 0: [A, B] (Court 1, 2), Batch 1: [C, D] (Court 1, 2)
      const batchSize = Math.max(1, Math.min(validCourtCount, Math.ceil(poolCount / 2)));
      const batches: string[][] = [];
      for (let i = 0; i < poolCount; i += batchSize) {
        batches.push(sortedPools.slice(i, i + batchSize));
      }

      const maxPerPool = Math.max(...sortedPools.map((p) => poolMatches.get(p)?.length || 0));

      for (let roundIdx = 0; roundIdx < maxPerPool; roundIdx++) {
        for (const batch of batches) {
          let hasMatchInBatch = false;
          batch.forEach((pool) => {
            const list = poolMatches.get(pool)!;
            if (roundIdx < list.length) {
              hasMatchInBatch = true;
              scheduledLeague.push({
                ...list[roundIdx],
                court: poolCourtMap.get(pool) || 1,
                slot: currentSlot,
              });
            }
          });
          if (hasMatchInBatch) {
            currentSlot++;
          }
        }
      }
    } else if (poolCount > 1 && !avoidConsecutive) {
      // === 連戦回避OFF: 最短枠同時進行 ===
      if (validCourtCount >= poolCount) {
        const maxPerPool = Math.max(...sortedPools.map((p) => poolMatches.get(p)?.length || 0));
        for (let roundIdx = 0; roundIdx < maxPerPool; roundIdx++) {
          let hasMatchInSlot = false;
          sortedPools.forEach((pool, poolIdx) => {
            const list = poolMatches.get(pool)!;
            if (roundIdx < list.length) {
              hasMatchInSlot = true;
              scheduledLeague.push({
                ...list[roundIdx],
                court: poolIdx + 1,
                slot: currentSlot,
              });
            }
          });
          if (hasMatchInSlot) {
            currentSlot++;
          }
        }
      } else {
        const maxPerPool = Math.max(...sortedPools.map((p) => poolMatches.get(p)?.length || 0));
        const batches: string[][] = [];
        for (let i = 0; i < poolCount; i += validCourtCount) {
          batches.push(sortedPools.slice(i, i + validCourtCount));
        }
        for (let roundIdx = 0; roundIdx < maxPerPool; roundIdx++) {
          for (const batch of batches) {
            let hasMatchInBatch = false;
            batch.forEach((pool, idxInBatch) => {
              const list = poolMatches.get(pool)!;
              if (roundIdx < list.length) {
                hasMatchInBatch = true;
                scheduledLeague.push({
                  ...list[roundIdx],
                  court: idxInBatch + 1,
                  slot: currentSlot,
                });
              }
            });
            if (hasMatchInBatch) {
              currentSlot++;
            }
          }
        }
      }
    } else {
      // 単一リーグ (poolCount <= 1): グリーディに空きコートと空きチームをマッチングし連戦回避
      const remainingMatches = [...leagueMatches];
      let lastPlayedTeams = new Set<string>();

      while (remainingMatches.length > 0) {
        const currentSlotMatches: Match[] = [];
        const currentSlotTeams = new Set<string>();

        for (let court = 1; court <= validCourtCount; court++) {
          const matchIdx = remainingMatches.findIndex((m) => {
            const t1 = m.team1Id;
            const t2 = m.team2Id;
            if (!t1 || !t2) return false;
            if (currentSlotTeams.has(t1) || currentSlotTeams.has(t2)) return false;
            return !lastPlayedTeams.has(t1) && !lastPlayedTeams.has(t2);
          });

          if (matchIdx !== -1) {
            const [selected] = remainingMatches.splice(matchIdx, 1);
            currentSlotMatches.push({ ...selected, court, slot: currentSlot });
            if (selected.team1Id) currentSlotTeams.add(selected.team1Id);
            if (selected.team2Id) currentSlotTeams.add(selected.team2Id);
          } else if (!avoidConsecutive) {
            const fallbackIdx = remainingMatches.findIndex((m) => {
              const t1 = m.team1Id;
              const t2 = m.team2Id;
              if (!t1 || !t2) return false;
              return !currentSlotTeams.has(t1) && !currentSlotTeams.has(t2);
            });
            if (fallbackIdx !== -1) {
              const [selected] = remainingMatches.splice(fallbackIdx, 1);
              currentSlotMatches.push({ ...selected, court, slot: currentSlot });
              if (selected.team1Id) currentSlotTeams.add(selected.team1Id);
              if (selected.team2Id) currentSlotTeams.add(selected.team2Id);
            }
          }
        }

        if (currentSlotMatches.length > 0) {
          scheduledLeague.push(...currentSlotMatches);
          lastPlayedTeams = currentSlotTeams;
          currentSlot++;
        } else if (remainingMatches.length > 0) {
          // 連戦回避のためにこの枠はインターバル（休憩）とし、次スロットへ進める
          lastPlayedTeams.clear();
          currentSlot++;
        }
      }
    }
  }

  // 決勝トーナメントの割当
  const scheduledTournament: Match[] = [];
  if (tournamentMatches.length > 0) {
    const qfMatches = tournamentMatches.filter((m) => m.round === 'quarterfinal');
    const sfMatches = tournamentMatches.filter((m) => m.round === 'semifinal');
    const thirdMatch = tournamentMatches.find((m) => m.round === 'third_place');
    const finalMatch = tournamentMatches.find((m) => m.round === 'final');

    if (avoidConsecutive) {
      // === 決勝トーナメント連戦回避 ===
      // 準々決勝 (QF): 2試合ずつ進行し、QF勝者が準決勝まで1枠以上の休憩を確保
      if (qfMatches.length > 0) {
        if (validCourtCount >= 2) {
          // QF1, QF2 (Slot N)
          qfMatches.slice(0, 2).forEach((m, idx) => {
            scheduledTournament.push({ ...m, court: idx + 1, slot: currentSlot });
          });
          currentSlot++;
          // QF3, QF4 (Slot N+1)
          qfMatches.slice(2).forEach((m, idx) => {
            const court = validCourtCount >= 4 ? idx + 3 : idx + 1;
            scheduledTournament.push({ ...m, court, slot: currentSlot });
          });
          currentSlot++;
        } else {
          qfMatches.forEach((m) => {
            scheduledTournament.push({ ...m, court: 1, slot: currentSlot });
            currentSlot++;
          });
        }
      }

      // 準決勝 (SF):
      // SF1(QF1勝者 vs QF2勝者)はQF直前枠で休んでいたため先にプレー
      // SF2(QF3勝者 vs QF4勝者)はSF1の間に休憩
      if (sfMatches.length > 0) {
        if (sfMatches.length >= 2) {
          scheduledTournament.push({ ...sfMatches[0], court: 1, slot: currentSlot });
          currentSlot++;
          scheduledTournament.push({
            ...sfMatches[1],
            court: validCourtCount >= 2 ? 2 : 1,
            slot: currentSlot,
          });
          currentSlot++;
        } else {
          sfMatches.forEach((m) => {
            scheduledTournament.push({ ...m, court: 1, slot: currentSlot });
            currentSlot++;
          });
        }
      }

      // 3位決定戦 & 決勝:
      // SF2直後に決勝を行うとSF2勝者が連戦になるため、まず3位決定戦、次に決勝戦の順で進行し休憩を確保
      if (thirdMatch && finalMatch) {
        scheduledTournament.push({
          ...thirdMatch,
          court: validCourtCount >= 2 ? 2 : 1,
          slot: currentSlot,
        });
        currentSlot++;
        scheduledTournament.push({ ...finalMatch, court: 1, slot: currentSlot });
        currentSlot++;
      } else {
        if (thirdMatch) {
          scheduledTournament.push({ ...thirdMatch, court: validCourtCount >= 2 ? 2 : 1, slot: currentSlot });
          currentSlot++;
        }
        if (finalMatch) {
          scheduledTournament.push({ ...finalMatch, court: 1, slot: currentSlot });
          currentSlot++;
        }
      }
    } else {
      // === 連戦回避OFF: 最短枠コンパクト進行 ===
      if (qfMatches.length > 0) {
        if (validCourtCount >= 4) {
          qfMatches.forEach((m, idx) => {
            scheduledTournament.push({ ...m, court: idx + 1, slot: currentSlot });
          });
          currentSlot++;
        } else if (validCourtCount >= 2) {
          qfMatches.slice(0, 2).forEach((m, idx) => {
            scheduledTournament.push({ ...m, court: idx + 1, slot: currentSlot });
          });
          currentSlot++;
          qfMatches.slice(2).forEach((m, idx) => {
            scheduledTournament.push({ ...m, court: idx + 1, slot: currentSlot });
          });
          currentSlot++;
        } else {
          qfMatches.forEach((m) => {
            scheduledTournament.push({ ...m, court: 1, slot: currentSlot });
            currentSlot++;
          });
        }
      }

      if (sfMatches.length > 0) {
        if (validCourtCount >= 2) {
          sfMatches.forEach((m, idx) => {
            scheduledTournament.push({ ...m, court: idx + 1, slot: currentSlot });
          });
          currentSlot++;
        } else {
          sfMatches.forEach((m) => {
            scheduledTournament.push({ ...m, court: 1, slot: currentSlot });
            currentSlot++;
          });
        }
      }

      if (thirdMatch && finalMatch) {
        if (validCourtCount >= 2) {
          scheduledTournament.push({ ...finalMatch, court: 1, slot: currentSlot });
          scheduledTournament.push({ ...thirdMatch, court: 2, slot: currentSlot });
          currentSlot++;
        } else {
          scheduledTournament.push({ ...thirdMatch, court: 1, slot: currentSlot });
          currentSlot++;
          scheduledTournament.push({ ...finalMatch, court: 1, slot: currentSlot });
          currentSlot++;
        }
      } else {
        if (finalMatch) {
          scheduledTournament.push({ ...finalMatch, court: 1, slot: currentSlot });
          currentSlot++;
        }
        if (thirdMatch) {
          scheduledTournament.push({ ...thirdMatch, court: validCourtCount >= 2 ? 2 : 1, slot: currentSlot });
          currentSlot++;
        }
      }
    }
  }

  // 試合順を (slot 昇順, court 昇順) でソートし、matchNumber を 1, 2, 3... に整列
  const allScheduled = [...scheduledLeague, ...scheduledTournament];
  allScheduled.sort((a, b) => {
    const slotA = a.slot || 999;
    const slotB = b.slot || 999;
    if (slotA !== slotB) return slotA - slotB;
    return (a.court || 1) - (b.court || 1);
  });

  return allScheduled.map((m, idx) => ({
    ...m,
    matchNumber: idx + 1,
  }));
}
