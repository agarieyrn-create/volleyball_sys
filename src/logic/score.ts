import { Match, MatchStatus, Settings } from '../types';

/**
 * どちらかが target 点以上かつ margin 点差以上でセット終了（デュース無制限）
 */
export function isSetFinished(
  a: number | null,
  b: number | null,
  target: number,
  margin: number
): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a === null || b === null || a < 0 || b < 0) return false;
  if (!Number.isInteger(target) || target < 1 || !Number.isInteger(margin) || margin < 0) return false;
  const maxScore = Math.max(a, b);
  const diff = Math.abs(a - b);
  return maxScore >= target && diff >= margin;
}

/** Scores must be whole, non-negative values. A null value is allowed while entering a set. */
export function isValidSetScoreInput(sets: unknown, bestOf: number): sets is Match['sets'] {
  if (!Array.isArray(sets) || !Number.isInteger(bestOf) || bestOf < 1) return false;
  return sets.every((set) => {
    if (!set || typeof set !== 'object') return false;
    const score = set as { team1?: unknown; team2?: unknown };
    return (
      (score.team1 === null || (Number.isInteger(score.team1) && (score.team1 as number) >= 0)) &&
      (score.team2 === null || (Number.isInteger(score.team2) && (score.team2 as number) >= 0))
    );
  });
}

/** Return only completed sets up to the point the match is decided. */
export function getCountedSetScores(match: Match, settings: Settings): Match['sets'] {
  if (match.status === 'bye') return [];

  const setsNeeded = Math.floor(settings.bestOf / 2) + 1;
  const setLimit = Math.min(match.sets.length, Math.max(1, Math.floor(settings.bestOf)));
  const counted: Match['sets'] = [];
  let team1Sets = 0;
  let team2Sets = 0;

  for (let i = 0; i < setLimit; i++) {
    const set = match.sets[i];
    if (!set || !isSetFinished(set.team1, set.team2, i >= 2 ? settings.set3Points : settings.set12Points, settings.deuceMargin)) {
      break;
    }

    counted.push(set);
    if ((set.team1 ?? 0) > (set.team2 ?? 0)) team1Sets++;
    else team2Sets++;

    if (team1Sets >= setsNeeded || team2Sets >= setsNeeded) break;
  }

  return counted;
}

/**
 * 各セットを判定し、勝者および試合ステータスを評価
 * 第3セット以降は set3Points、それ以前は set12Points を target に使用
 * bestOf の過半数先取で勝者確定。未確定は pending
 */
export function evaluateMatch(
  match: Match,
  settings: Settings
): {
  team1Sets: number;
  team2Sets: number;
  winnerId: string | null;
  status: MatchStatus;
} {
  if (match.status === 'bye') {
    return {
      team1Sets: match.team1Sets,
      team2Sets: match.team2Sets,
      winnerId: match.team1Id || match.team2Id,
      status: 'bye',
    };
  }

  let team1Sets = 0;
  let team2Sets = 0;
  const setsNeeded = Math.floor(settings.bestOf / 2) + 1;

  for (const set of getCountedSetScores(match, settings)) {
    if ((set.team1 ?? 0) > (set.team2 ?? 0)) team1Sets++;
    else team2Sets++;
  }

  let winnerId: string | null = null;
  let status: MatchStatus = 'pending';

  if (team1Sets >= setsNeeded && match.team1Id) {
    winnerId = match.team1Id;
    status = 'completed';
  } else if (team2Sets >= setsNeeded && match.team2Id) {
    winnerId = match.team2Id;
    status = 'completed';
  }

  return {
    team1Sets,
    team2Sets,
    winnerId,
    status,
  };
}
