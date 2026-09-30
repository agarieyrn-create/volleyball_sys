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
  if (a === null || b === null) return false;
  if (a < 0 || b < 0) return false;
  const maxScore = Math.max(a, b);
  const diff = Math.abs(a - b);
  return maxScore >= target && diff >= margin;
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

  for (let i = 0; i < match.sets.length; i++) {
    const set = match.sets[i];
    const target = i >= 2 ? settings.set3Points : settings.set12Points;
    const margin = settings.deuceMargin;

    if (isSetFinished(set.team1, set.team2, target, margin)) {
      if ((set.team1 ?? 0) > (set.team2 ?? 0)) {
        team1Sets++;
      } else {
        team2Sets++;
      }
    }

    if (team1Sets >= setsNeeded || team2Sets >= setsNeeded) {
      break;
    }
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
