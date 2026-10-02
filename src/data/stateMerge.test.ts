import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_STATE } from './defaults';
import { mergeConcurrentStates, StateConflictError, hasSameTournamentData } from './stateMerge';
import { validateAppState } from './validation';
import { tournamentReducer } from '../state/reducer';
import { computeLeagueStandings } from '../logic/standings';

describe('shared tournament state integrity', () => {
  it('keeps score updates to different matches from overwriting each other', () => {
    const matchA = DEFAULT_APP_STATE.matches.find((match) => match.matchCode === 'A1')!;
    const matchB = DEFAULT_APP_STATE.matches.find((match) => match.matchCode === 'B1')!;
    const base = { ...DEFAULT_APP_STATE, matches: [matchA, matchB] };

    const local = tournamentReducer(base, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: matchA.id,
        sets: [{ team1: 15, team2: 10 }, { team1: 15, team2: 11 }, { team1: null, team2: null }],
      },
    });
    const remote = tournamentReducer(base, {
      type: 'SAVE_SCORE',
      payload: {
        matchId: matchB.id,
        sets: [{ team1: 10, team2: 15 }, { team1: 11, team2: 15 }, { team1: null, team2: null }],
      },
    });

    const merged = mergeConcurrentStates(base, local, remote);
    expect(merged.matches.find((match) => match.id === matchA.id)?.winnerId).toBe(matchA.team1Id);
    expect(merged.matches.find((match) => match.id === matchB.id)?.winnerId).toBe(matchB.team2Id);
    expect(validateAppState(merged, { strictResults: true })).toEqual(merged);
  });

  it('rejects different simultaneous scores for the same match instead of silently overwriting', () => {
    const match = DEFAULT_APP_STATE.matches.find((item) => item.round === 'league')!;
    const base = { ...DEFAULT_APP_STATE, matches: [match] };
    const local = tournamentReducer(base, {
      type: 'SAVE_SCORE',
      payload: { matchId: match.id, sets: [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }] },
    });
    const remote = tournamentReducer(base, {
      type: 'SAVE_SCORE',
      payload: { matchId: match.id, sets: [{ team1: 14, team2: 10 }, { team1: null, team2: null }, { team1: null, team2: null }] },
    });

    expect(() => mergeConcurrentStates(base, local, remote)).toThrow(StateConflictError);
  });

  it('does not consider a timestamp-only change to be an unsaved data edit', () => {
    const newerMeta = { ...DEFAULT_APP_STATE, updatedAt: '2099-01-01T00:00:00.000Z', updatedBy: 'other' };
    expect(hasSameTournamentData(DEFAULT_APP_STATE, newerMeta)).toBe(true);
  });

  it('validates imported match shape, score values, and derived outcomes', () => {
    expect(validateAppState(DEFAULT_APP_STATE, { strictResults: true, strictTeamReferences: true })).toEqual(DEFAULT_APP_STATE);

    const invalidSet = structuredClone(DEFAULT_APP_STATE);
    invalidSet.matches[0].sets[0] = { team1: 10.5, team2: 9 };
    expect(() => validateAppState(invalidSet, { strictResults: true })).toThrow('整数');

    const mismatch = structuredClone(DEFAULT_APP_STATE);
    const match = mismatch.matches.find((item) => item.round === 'league')!;
    match.sets = [{ team1: 15, team2: 10 }, { team1: 15, team2: 10 }, { team1: null, team2: null }];
    match.status = 'completed';
    match.winnerId = match.team2Id;
    match.team1Sets = 2;
    expect(() => validateAppState(mismatch, { strictResults: true })).toThrow('一致しません');
  });

  it('excludes impossible later-set scores from standings after a match is decided', () => {
    const match = DEFAULT_APP_STATE.matches.find((item) => item.round === 'league')!;
    const completedMatch = {
      ...match,
      sets: [
        { team1: 15, team2: 10 },
        { team1: 15, team2: 11 },
        { team1: 10, team2: 15 },
      ],
      team1Sets: 2,
      team2Sets: 0,
      winnerId: match.team1Id,
      status: 'completed' as const,
    };
    const standings = computeLeagueStandings(
      DEFAULT_APP_STATE.teams,
      [completedMatch],
      DEFAULT_APP_STATE.settings
    );
    const winner = standings.find((standing) => standing.teamId === match.team1Id)!;
    expect(winner.pointsFor).toBe(30);
    expect(winner.pointsAgainst).toBe(21);
    expect(winner.setsWon).toBe(2);
  });
});
