import { evaluateMatch } from '../logic/score';
import { AppState, Match, RoundKey, Settings } from '../types';

const formats = new Set(['tournament', 'league', 'league_then_tournament']);
const rounds = new Set<RoundKey>([
  'league', 'quarterfinal', 'semifinal', 'final', 'third_place',
  'lower_bracket', 'consolation', 'exchange_league',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireInteger(value: unknown, label: string, minimum = 0): void {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new Error(`${label}は${minimum}以上の整数である必要があります。`);
  }
}

function validateSettings(value: unknown): asserts value is Settings {
  if (!isRecord(value)) throw new Error('大会設定(settings)が正しくありません。');
  for (const key of ['name', 'date', 'venue'] as const) {
    if (typeof value[key] !== 'string') throw new Error(`大会設定の${key}が正しくありません。`);
  }
  if (!formats.has(String(value.format))) throw new Error('大会形式(format)が正しくありません。');
  requireInteger(value.set12Points, '通常セットの目標点', 1);
  requireInteger(value.set3Points, '最終セットの目標点', 1);
  requireInteger(value.deuceMargin, 'デュース点差', 0);
  if (!Number.isInteger(value.bestOf) || ![1, 3, 5].includes(value.bestOf as number)) {
    throw new Error('bestOfは1・3・5のいずれかである必要があります。');
  }
  requireInteger(value.leagueCount, 'リーグ数', 1);
  requireInteger(value.matchesPerTeam, 'チームごとの試合数', 1);
  requireInteger(value.finalistsCount, '決勝進出チーム数', 1);
  if (value.courtCount !== undefined) requireInteger(value.courtCount, 'コート数', 1);
  if (value.avoidConsecutiveMatches !== undefined && typeof value.avoidConsecutiveMatches !== 'boolean') {
    throw new Error('連戦回避設定が正しくありません。');
  }
}

function validateScore(value: unknown, label: string): void {
  if (value !== null && (!Number.isInteger(value) || (value as number) < 0)) {
    throw new Error(`${label}は0以上の整数またはnullである必要があります。`);
  }
}

function validateMatch(value: unknown, index: number, settings: Settings): asserts value is Match {
  const label = `試合${index + 1}`;
  if (!isRecord(value)) throw new Error(`${label}のデータが正しくありません。`);
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error(`${label}のidがありません。`);
  if (!rounds.has(value.round as RoundKey)) throw new Error(`${label}のroundが正しくありません。`);
  if (typeof value.roundName !== 'string') throw new Error(`${label}のroundNameが正しくありません。`);
  requireInteger(value.roundOrder, `${label}のroundOrder`);
  requireInteger(value.matchNumber, `${label}のmatchNumber`, 1);
  for (const key of ['team1Id', 'team2Id', 'winnerId', 'nextMatchId', 'referee'] as const) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') {
      throw new Error(`${label}の${key}が正しくありません。`);
    }
  }
  if (!Array.isArray(value.sets)) {
    throw new Error(`${label}のセット数が大会設定と一致しません。`);
  }
  value.sets.forEach((set, setIndex) => {
    if (!isRecord(set)) throw new Error(`${label} 第${setIndex + 1}セットの形式が正しくありません。`);
    validateScore(set.team1, `${label} 第${setIndex + 1}セットのチーム1得点`);
    validateScore(set.team2, `${label} 第${setIndex + 1}セットのチーム2得点`);
  });
  if (value.sets.slice(settings.bestOf).some((set) => set.team1 !== null || set.team2 !== null)) {
    throw new Error(`${label}に大会設定の上限を超える得点が入力されています。`);
  }
  requireInteger(value.team1Sets, `${label}のチーム1セット数`);
  requireInteger(value.team2Sets, `${label}のチーム2セット数`);
  if (!['pending', 'completed', 'bye'].includes(String(value.status))) {
    throw new Error(`${label}のstatusが正しくありません。`);
  }
  if (value.nextSlot !== undefined && value.nextSlot !== null && ![1, 2].includes(Number(value.nextSlot))) {
    throw new Error(`${label}のnextSlotが正しくありません。`);
  }
  if (value.loserToSlot !== undefined && value.loserToSlot !== null && ![1, 2].includes(Number(value.loserToSlot))) {
    throw new Error(`${label}のloserToSlotが正しくありません。`);
  }
}

export interface ValidateAppStateOptions {
  strictResults?: boolean;
  strictTeamReferences?: boolean;
}

/** Validate the persisted shape before importing or using untrusted saved data. */
export function validateAppState(value: unknown, options: ValidateAppStateOptions = {}): AppState {
  if (!isRecord(value)) throw new Error('大会データがオブジェクトではありません。');
  validateSettings(value.settings);
  if (!Array.isArray(value.teams)) throw new Error('チーム情報(teams)の配列が見つかりません。');
  if (!Array.isArray(value.matches)) throw new Error('試合データ(matches)の配列が見つかりません。');

  const teamIds = new Set<string>();
  value.teams.forEach((team, index) => {
    if (!isRecord(team) || typeof team.id !== 'string' || !team.id.trim() || typeof team.name !== 'string' || !team.name.trim()) {
      throw new Error(`チーム${index + 1}のidまたはnameが正しくありません。`);
    }
    if (teamIds.has(team.id)) throw new Error(`チームid「${team.id}」が重複しています。`);
    teamIds.add(team.id);
  });

  const matchIds = new Set<string>();
  value.matches.forEach((match, index) => {
    validateMatch(match, index, value.settings as Settings);
    if (matchIds.has(match.id)) throw new Error(`試合id「${match.id}」が重複しています。`);
    matchIds.add(match.id);

    if (options.strictTeamReferences) {
      for (const teamId of [match.team1Id, match.team2Id]) {
        if (teamId && !teamIds.has(teamId)) {
          throw new Error(`${match.id}が存在しないチーム「${teamId}」を参照しています。`);
        }
      }
    }
    if (match.winnerId && match.winnerId !== match.team1Id && match.winnerId !== match.team2Id) {
      throw new Error(`${match.id}の勝者が対戦チームと一致しません。`);
    }

    if (options.strictResults && match.status !== 'bye') {
      const result = evaluateMatch(match, value.settings as Settings);
      if (
        result.status !== match.status ||
        result.winnerId !== match.winnerId ||
        result.team1Sets !== match.team1Sets ||
        result.team2Sets !== match.team2Sets
      ) {
        throw new Error(`${match.id}の勝敗・セット数が得点と一致しません。`);
      }
    }
  });

  if (value.mvpVotes !== undefined && !Array.isArray(value.mvpVotes)) {
    throw new Error('MVP投票(mvpVotes)の形式が正しくありません。');
  }
  if (Array.isArray(value.mvpVotes)) {
    value.mvpVotes.forEach((vote, index) => {
      if (
        !isRecord(vote) ||
        typeof vote.id !== 'string' ||
        typeof vote.nomineeName !== 'string' ||
        typeof vote.createdAt !== 'string'
      ) {
        throw new Error(`MVP投票${index + 1}の形式が正しくありません。`);
      }
    });
  }
  if (value.schemaVersion !== undefined && !Number.isInteger(value.schemaVersion)) {
    throw new Error('schemaVersionが正しくありません。');
  }

  return value as unknown as AppState;
}
