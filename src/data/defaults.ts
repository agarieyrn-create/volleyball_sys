import {
  createOfficialTournamentMatches,
  OFFICIAL_TEAMS,
  OFFICIAL_TOURNAMENT_NAME,
} from '../logic/officialTournament';
import { AppState, Match, Settings, Team } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  name: OFFICIAL_TOURNAMENT_NAME,
  date: new Date().toISOString().split('T')[0],
  venue: '社内体育館',
  format: 'league_then_tournament',
  set12Points: 15,
  set3Points: 10,
  deuceMargin: 2,
  bestOf: 3,
  leagueCount: 5,
  matchesPerTeam: 2,
  finalistsCount: 8,
  courtCount: 5,
  avoidConsecutiveMatches: true,
};

export const INITIAL_TEAMS: Team[] = OFFICIAL_TEAMS;

export const PRESET_EXPAND_TEAMS_UP_TO_20: Team[] = [
  { id: 'team_extra_18', name: '技術開発本部チーム', pool: 'C' },
  { id: 'team_extra_19', name: 'ITソリューション部', pool: 'D' },
  { id: 'team_extra_20', name: '環境エネルギー推進室', pool: 'E' },
];

export function createInitialMatches(teams: Team[], settings: Settings): Match[] {
  return createOfficialTournamentMatches(teams, settings);
}

export const INITIAL_MATCHES: Match[] = createInitialMatches(INITIAL_TEAMS, DEFAULT_SETTINGS);

export const DEFAULT_APP_STATE: AppState = {
  schemaVersion: 1,
  settings: DEFAULT_SETTINGS,
  teams: INITIAL_TEAMS,
  matches: INITIAL_MATCHES,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System',
};
