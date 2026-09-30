export type Format = 'tournament' | 'league' | 'league_then_tournament';
export type MatchStatus = 'pending' | 'completed' | 'bye';
export type RoundKey =
  | 'league'
  | 'quarterfinal'
  | 'semifinal'
  | 'final'
  | 'third_place'
  | 'lower_bracket'
  | 'consolation'
  | 'exchange_league';

export interface Settings {
  name: string;
  date: string;
  venue: string;
  format: Format;              // 既定 'league_then_tournament'
  set12Points: number;         // 既定15
  set3Points: number;          // 既定10
  deuceMargin: number;         // 既定2 (または0)
  bestOf: number;              // 既定3
  leagueCount: number;         // 既定5
  matchesPerTeam: number;      // 既定2
  finalistsCount: number;      // 既定8
  courtCount?: number;         // 体育館の利用可能コート面数 (1〜8, 既定5)
  avoidConsecutiveMatches?: boolean; // 連続試合防止フラグ (既定true)
}

export interface Team {
  id: string;
  name: string;
  pool?: string;
  seed?: number;
}

export interface SetScore {
  team1: number | null;
  team2: number | null;
}

export interface Match {
  id: string;
  round: RoundKey;
  roundName: string;
  roundOrder: number;
  matchNumber: number;
  matchCode?: string;          // 例: 'A1', 'A5', 'B6', 'C4', 'E6' 等
  bracketGroup?: 'upper' | 'lower_left' | 'lower_right' | 'consolation' | 'exchange_league'; // 上ブロック, 下ブロック, 順位交流戦, 交流リーグ
  bracketSlotLabel1?: string;  // 例: 'A組2位', 'A5の勝者'
  bracketSlotLabel2?: string;  // 例: 'D組1位', 'A6の勝者'
  slot?: number;               // 進行スロット番号（第1試合, 第2試合... 同時進行枠）
  court?: number;              // コート番号 (1〜8)
  pool?: string;
  team1Id: string | null;
  team2Id: string | null;
  referee?: string;
  sets: SetScore[];
  team1Sets: number;
  team2Sets: number;
  winnerId: string | null;
  status: MatchStatus;
  nextMatchId: string | null;
  nextSlot: 1 | 2 | null;
  loserToMatchId: string | null;
  loserToSlot: 1 | 2 | null;  // 準決勝→3位決定戦の敗者ルート
}

export interface Standing {
  rank: number;
  teamId: string;
  teamName: string;
  pool?: string;
  played: number;
  win: number;
  loss: number;
  setsWon: number;
  setsLost: number;
  setRatio: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export interface MvpVote {
  id: string;
  nomineeName: string;
  nomineeTeamId?: string;
  reason?: string;
  voterName?: string;
  createdAt: string;
}

export interface AppState {
  schemaVersion: 1;
  settings: Settings;
  teams: Team[];
  matches: Match[];
  mvpVotes?: MvpVote[];
  updatedAt: string;
  updatedBy: string;
}
