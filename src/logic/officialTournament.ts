import { AppState, Match, Settings, Standing, Team } from '../types';
import { computeLeagueStandings } from './standings';
import { advanceWinner } from './bracket';

export const OFFICIAL_TOURNAMENT_NAME = '社内バレーボール大会';

export const OFFICIAL_TEAMS: Team[] = [
  // A組（4チーム）
  { id: 'team_a1', name: '遠目翼爆誕19周年〜翼をさずけるぅぅ〜（新入社員）', pool: 'A' },
  { id: 'team_a2', name: 'イナズマイレブン（入社2年目）', pool: 'A' },
  { id: 'team_a3', name: 'ゴールデンスパイクチーム（料金C）', pool: 'A' },
  { id: 'team_a4', name: 'OGS', pool: 'A' },

  // B組（4チーム）
  { id: 'team_b1', name: 'PEC VOLTAGE', pool: 'B' },
  { id: 'team_b2', name: '配電昇柱ジャパン', pool: 'B' },
  { id: 'team_b3', name: '新入社員がちめん', pool: 'B' },
  { id: 'team_b4', name: '沖電企業分会', pool: 'B' },

  // C組（3チーム）
  { id: 'team_c1', name: 'うるま支店チーム', pool: 'C' },
  { id: 'team_c2', name: 'CBK45（26卒新入社員）', pool: 'C' },
  { id: 'team_c3', name: '本店123分会合同', pool: 'C' },

  // D組（3チーム）
  { id: 'team_d1', name: 'OGS新入社員', pool: 'D' },
  { id: 'team_d2', name: '発電部合同', pool: 'D' },
  { id: 'team_d3', name: 'PEC本気の遊び部', pool: 'D' },

  // E組（3チーム）
  { id: 'team_e1', name: '関節大集合（沖プラ新入社員）', pool: 'E' },
  { id: 'team_e2', name: '電力流通分会', pool: 'E' },
  { id: 'team_e3', name: 'REO', pool: 'E' },
];

/**
 * 空のセットスコア配列を生成
 */
function createEmptySets(bestOf: number = 3) {
  return Array.from({ length: bestOf || 3 }, () => ({ team1: null, team2: null }));
}

/**
 * 社内バレーボール大会の全対戦カード（予選17試合＋午後19試合＝計36試合）を生成
 * 【案A（全17チーム 4〜5試合保証）】
 * - 上位8チーム：決勝トーナメント＋3位決定戦＋QF敗者交流戦（10試合）
 * - 下位9チーム：3チーム×3グループの交流リーグ（9試合）
 */
export function createOfficialTournamentMatches(
  teams: Team[] = OFFICIAL_TEAMS,
  settings?: Settings
): Match[] {
  const bestOf = settings?.bestOf || 3;

  const teamById = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const teamByName = new Map<string, Team>(teams.map((t) => [t.name, t]));

  // IDまたは名前でチームを探す
  const findTeamId = (fallbackId: string, name: string): string => {
    if (teamById.has(fallbackId)) return fallbackId;
    const found = teamByName.get(name);
    return found ? found.id : fallbackId;
  };

  const tA1 = findTeamId('team_a1', '遠目翼爆誕19周年〜翼をさずけるぅぅ〜（新入社員）');
  const tA2 = findTeamId('team_a2', 'イナズマイレブン（入社2年目）');
  const tA3 = findTeamId('team_a3', 'ゴールデンスパイクチーム（料金C）');
  const tA4 = findTeamId('team_a4', 'OGS');

  const tB1 = findTeamId('team_b1', 'PEC VOLTAGE');
  const tB2 = findTeamId('team_b2', '配電昇柱ジャパン');
  const tB3 = findTeamId('team_b3', '新入社員がちめん');
  const tB4 = findTeamId('team_b4', '沖電企業分会');

  const tC1 = findTeamId('team_c1', 'うるま支店チーム');
  const tC2 = findTeamId('team_c2', 'CBK45（26卒新入社員）');
  const tC3 = findTeamId('team_c3', '本店123分会合同');

  const tD1 = findTeamId('team_d1', 'OGS新入社員');
  const tD2 = findTeamId('team_d2', '発電部合同');
  const tD3 = findTeamId('team_d3', 'PEC本気の遊び部');

  const tE1 = findTeamId('team_e1', '関節大集合（沖プラ新入社員）');
  const tE2 = findTeamId('team_e2', '電力流通分会');
  const tE3 = findTeamId('team_e3', 'REO');

  const matches: Match[] = [];

  // ==========================================
  // 1. 予選リーグ (各コートA〜E、計17試合)
  // ==========================================

  // --- Court A (Aコート): A1〜A4 ---
  matches.push({
    id: 'league_A1',
    round: 'league',
    roundName: '予選 A組 (A1)',
    roundOrder: 1,
    matchNumber: 1,
    matchCode: 'A1',
    court: 1,
    slot: 1,
    pool: 'A',
    team1Id: tA1,
    team2Id: tA2,
    referee: teamById.get(tA4)?.name || 'OGS',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_A2',
    round: 'league',
    roundName: '予選 A組 (A2)',
    roundOrder: 1,
    matchNumber: 6,
    matchCode: 'A2',
    court: 1,
    slot: 2,
    pool: 'A',
    team1Id: tA3,
    team2Id: tA4,
    referee: teamById.get(tA1)?.name || '遠目翼爆誕19周年〜翼をさずけるぅぅ〜（新入社員）',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_A3',
    round: 'league',
    roundName: '予選 A組 (A3)',
    roundOrder: 1,
    matchNumber: 11,
    matchCode: 'A3',
    court: 1,
    slot: 3,
    pool: 'A',
    team1Id: tA1,
    team2Id: tA3,
    referee: teamById.get(tA2)?.name || 'イナズマイレブン（入社2年目）',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_A4',
    round: 'league',
    roundName: '予選 A組 (A4)',
    roundOrder: 1,
    matchNumber: 16,
    matchCode: 'A4',
    court: 1,
    slot: 4,
    pool: 'A',
    team1Id: tA2,
    team2Id: tA4,
    referee: teamById.get(tA3)?.name || 'ゴールデンスパイクチーム（料金C）',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- Court B (Bコート): B1〜B4 ---
  matches.push({
    id: 'league_B1',
    round: 'league',
    roundName: '予選 B組 (B1)',
    roundOrder: 1,
    matchNumber: 2,
    matchCode: 'B1',
    court: 2,
    slot: 1,
    pool: 'B',
    team1Id: tB1,
    team2Id: tB2,
    referee: teamById.get(tB4)?.name || '沖電企業分会',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_B2',
    round: 'league',
    roundName: '予選 B組 (B2)',
    roundOrder: 1,
    matchNumber: 7,
    matchCode: 'B2',
    court: 2,
    slot: 2,
    pool: 'B',
    team1Id: tB3,
    team2Id: tB4,
    referee: teamById.get(tB1)?.name || 'PEC VOLTAGE',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_B3',
    round: 'league',
    roundName: '予選 B組 (B3)',
    roundOrder: 1,
    matchNumber: 12,
    matchCode: 'B3',
    court: 2,
    slot: 3,
    pool: 'B',
    team1Id: tB1,
    team2Id: tB3,
    referee: teamById.get(tB2)?.name || '配電昇柱ジャパン',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_B4',
    round: 'league',
    roundName: '予選 B組 (B4)',
    roundOrder: 1,
    matchNumber: 17,
    matchCode: 'B4',
    court: 2,
    slot: 4,
    pool: 'B',
    team1Id: tB2,
    team2Id: tB4,
    referee: teamById.get(tB3)?.name || '新入社員がちめん',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- Court C (Cコート): C1〜C3 ---
  matches.push({
    id: 'league_C1',
    round: 'league',
    roundName: '予選 C組 (C1)',
    roundOrder: 1,
    matchNumber: 3,
    matchCode: 'C1',
    court: 3,
    slot: 1,
    pool: 'C',
    team1Id: tC1,
    team2Id: tC2,
    referee: teamById.get(tC3)?.name || '本店123分会合同',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_C2',
    round: 'league',
    roundName: '予選 C組 (C2)',
    roundOrder: 1,
    matchNumber: 8,
    matchCode: 'C2',
    court: 3,
    slot: 2,
    pool: 'C',
    team1Id: tC2,
    team2Id: tC3,
    referee: teamById.get(tC1)?.name || 'うるま支店チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_C3',
    round: 'league',
    roundName: '予選 C組 (C3)',
    roundOrder: 1,
    matchNumber: 13,
    matchCode: 'C3',
    court: 3,
    slot: 3,
    pool: 'C',
    team1Id: tC3,
    team2Id: tC1,
    referee: teamById.get(tC2)?.name || 'CBK45（26卒新入社員）',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- Court D (Dコート): D1〜D3 ---
  matches.push({
    id: 'league_D1',
    round: 'league',
    roundName: '予選 D組 (D1)',
    roundOrder: 1,
    matchNumber: 4,
    matchCode: 'D1',
    court: 4,
    slot: 1,
    pool: 'D',
    team1Id: tD1,
    team2Id: tD2,
    referee: teamById.get(tD3)?.name || 'PEC本気の遊び部',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_D2',
    round: 'league',
    roundName: '予選 D組 (D2)',
    roundOrder: 1,
    matchNumber: 9,
    matchCode: 'D2',
    court: 4,
    slot: 2,
    pool: 'D',
    team1Id: tD2,
    team2Id: tD3,
    referee: teamById.get(tD1)?.name || 'OGS新入社員',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_D3',
    round: 'league',
    roundName: '予選 D組 (D3)',
    roundOrder: 1,
    matchNumber: 14,
    matchCode: 'D3',
    court: 4,
    slot: 3,
    pool: 'D',
    team1Id: tD3,
    team2Id: tD1,
    referee: teamById.get(tD2)?.name || '発電部合同',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- Court E (Eコート): E1〜E3 ---
  matches.push({
    id: 'league_E1',
    round: 'league',
    roundName: '予選 E組 (E1)',
    roundOrder: 1,
    matchNumber: 5,
    matchCode: 'E1',
    court: 5,
    slot: 1,
    pool: 'E',
    team1Id: tE1,
    team2Id: tE2,
    referee: teamById.get(tE3)?.name || 'REO',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_E2',
    round: 'league',
    roundName: '予選 E組 (E2)',
    roundOrder: 1,
    matchNumber: 10,
    matchCode: 'E2',
    court: 5,
    slot: 2,
    pool: 'E',
    team1Id: tE2,
    team2Id: tE3,
    referee: teamById.get(tE1)?.name || '関節大集合（沖プラ新入社員）',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  matches.push({
    id: 'league_E3',
    round: 'league',
    roundName: '予選 E組 (E3)',
    roundOrder: 1,
    matchNumber: 15,
    matchCode: 'E3',
    court: 5,
    slot: 3,
    pool: 'E',
    team1Id: tE3,
    team2Id: tE1,
    referee: teamById.get(tE2)?.name || '電力流通分会',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // =========================================================================
  // 2. 午後：上位トーナメント（10試合）＆ 下位交流リーグ（9試合）計19試合
  // 【案A（全17チーム 4〜5試合保証）】
  // =========================================================================

  // -------------------------------------------------------------------------
  // [A] 上ブロック (決勝トーナメント・3位決定戦・順位交流戦: 計10試合)
  // -------------------------------------------------------------------------

  // A5 (QF1): A組2位 vs D組1位 -> 勝者は A7 slot 1, 敗者は C8 slot 1 (順位交流戦)
  matches.push({
    id: 'match_A5',
    round: 'quarterfinal',
    roundName: '上ブロック 1回戦 (A5)',
    roundOrder: 2,
    matchNumber: 18,
    matchCode: 'A5',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'A組2位',
    bracketSlotLabel2: 'D組1位',
    court: 1,
    slot: 5,
    team1Id: null,
    team2Id: null,
    referee: '本部審判 / A組待機',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_A7',
    nextSlot: 1,
    loserToMatchId: 'match_C8',
    loserToSlot: 1,
  });

  // B5 (QF2): C組1位 vs B組2位 -> 勝者は B7 slot 1, 敗者は D8 slot 1 (順位交流戦)
  matches.push({
    id: 'match_B5',
    round: 'quarterfinal',
    roundName: '上ブロック 1回戦 (B5)',
    roundOrder: 2,
    matchNumber: 19,
    matchCode: 'B5',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'C組1位',
    bracketSlotLabel2: 'B組2位',
    court: 2,
    slot: 5,
    team1Id: null,
    team2Id: null,
    referee: '本部審判 / B組待機チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_B7',
    nextSlot: 1,
    loserToMatchId: 'match_D8',
    loserToSlot: 1,
  });

  // A6 (QF3): B組1位 vs E組1位 -> 勝者は A7 slot 2, 敗者は C8 slot 2 (順位交流戦)
  matches.push({
    id: 'match_A6',
    round: 'quarterfinal',
    roundName: '上ブロック 1回戦 (A6)',
    roundOrder: 2,
    matchNumber: 23,
    matchCode: 'A6',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'B組1位',
    bracketSlotLabel2: 'E組1位',
    court: 1,
    slot: 6,
    team1Id: null,
    team2Id: null,
    referee: 'A5 敗者チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_A7',
    nextSlot: 2,
    loserToMatchId: 'match_C8',
    loserToSlot: 2,
  });

  // B6 (QF4): A組1位 vs C/D/E組2位最上位 -> 勝者は B7 slot 2, 敗者は D8 slot 2 (順位交流戦)
  matches.push({
    id: 'match_B6',
    round: 'quarterfinal',
    roundName: '上ブロック 1回戦 (B6)',
    roundOrder: 2,
    matchNumber: 24,
    matchCode: 'B6',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'A組1位',
    bracketSlotLabel2: 'C/D/E組 2位最上位',
    court: 2,
    slot: 6,
    team1Id: null,
    team2Id: null,
    referee: 'B5 敗者チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_B7',
    nextSlot: 2,
    loserToMatchId: 'match_D8',
    loserToSlot: 2,
  });

  // A7 (準決勝①): A5の勝者 vs A6の勝者 -> 勝者は A8 slot 1 (決勝), 敗者は B8 slot 1 (3位決定戦)
  matches.push({
    id: 'match_A7',
    round: 'semifinal',
    roundName: '上ブロック 準決勝 (A7)',
    roundOrder: 3,
    matchNumber: 28,
    matchCode: 'A7',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'A5の勝者',
    bracketSlotLabel2: 'A6の勝者',
    court: 1,
    slot: 7,
    team1Id: null,
    team2Id: null,
    referee: 'A6 敗者チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_A8',
    nextSlot: 1,
    loserToMatchId: 'match_B8',
    loserToSlot: 1,
  });

  // B7 (準決勝②): B5の勝者 vs B6の勝者 -> 勝者は A8 slot 2 (決勝), 敗者は B8 slot 2 (3位決定戦)
  matches.push({
    id: 'match_B7',
    round: 'semifinal',
    roundName: '上ブロック 準決勝 (B7)',
    roundOrder: 3,
    matchNumber: 29,
    matchCode: 'B7',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'B5の勝者',
    bracketSlotLabel2: 'B6の勝者',
    court: 2,
    slot: 7,
    team1Id: null,
    team2Id: null,
    referee: 'B6 敗者チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: 'match_A8',
    nextSlot: 2,
    loserToMatchId: 'match_B8',
    loserToSlot: 2,
  });

  // A8 (決勝戦): A7の勝者 vs B7の勝者 -> 🏆 優勝・準優勝
  matches.push({
    id: 'match_A8',
    round: 'final',
    roundName: '決勝戦 (A8)',
    roundOrder: 4,
    matchNumber: 33,
    matchCode: 'A8',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'A7の勝者',
    bracketSlotLabel2: 'B7の勝者',
    court: 1,
    slot: 8,
    team1Id: null,
    team2Id: null,
    referee: '大会本部審判',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // B8 (3位決定戦): A7の敗者 vs B7の敗者 -> 🥉 第3位・4位
  matches.push({
    id: 'match_B8',
    round: 'third_place',
    roundName: '3位決定戦 (B8)',
    roundOrder: 4,
    matchNumber: 34,
    matchCode: 'B8',
    bracketGroup: 'upper',
    bracketSlotLabel1: 'A7の敗者',
    bracketSlotLabel2: 'B7の敗者',
    court: 2,
    slot: 8,
    team1Id: null,
    team2Id: null,
    referee: '大会本部審判 / 待機チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // C8 (QF敗者順位交流戦①): A5の敗者 vs A6の敗者 -> 🎖️ 上位順位交流
  matches.push({
    id: 'match_C8',
    round: 'consolation',
    roundName: '上ブロック 順位交流戦 (C8)',
    roundOrder: 4,
    matchNumber: 35,
    matchCode: 'C8',
    bracketGroup: 'consolation',
    bracketSlotLabel1: 'A5の敗者',
    bracketSlotLabel2: 'A6の敗者',
    court: 3,
    slot: 8,
    team1Id: null,
    team2Id: null,
    referee: '大会本部審判 / 交流X組終了チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // D8 (QF敗者順位交流戦②): B5の敗者 vs B6の敗者 -> 🎖️ 上位順位交流
  matches.push({
    id: 'match_D8',
    round: 'consolation',
    roundName: '上ブロック 順位交流戦 (D8)',
    roundOrder: 4,
    matchNumber: 36,
    matchCode: 'D8',
    bracketGroup: 'consolation',
    bracketSlotLabel1: 'B5の敗者',
    bracketSlotLabel2: 'B6の敗者',
    court: 4,
    slot: 8,
    team1Id: null,
    team2Id: null,
    referee: '大会本部審判 / 交流Y組終了チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // -------------------------------------------------------------------------
  // [B] 下ブロック (下位交流リーグ: 3チーム×3グループ、計9試合)
  // -------------------------------------------------------------------------

  // --- 交流X組 (Cコート・Court 3 / 3チーム総当たり・各2試合) ---
  // C5: A組3位 vs C/D/E組 2位(次点1)
  matches.push({
    id: 'match_C5',
    round: 'exchange_league',
    roundName: '交流X組 (C5)',
    roundOrder: 2,
    matchNumber: 20,
    matchCode: 'C5',
    pool: 'X',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'A組3位',
    bracketSlotLabel2: 'C/D/E組 2位(次点1)',
    court: 3,
    slot: 5,
    team1Id: null,
    team2Id: null,
    referee: 'B組4位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // C6: C/D/E組 2位(次点1) vs B組4位
  matches.push({
    id: 'match_C6',
    round: 'exchange_league',
    roundName: '交流X組 (C6)',
    roundOrder: 3,
    matchNumber: 25,
    matchCode: 'C6',
    pool: 'X',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'C/D/E組 2位(次点1)',
    bracketSlotLabel2: 'B組4位',
    court: 3,
    slot: 6,
    team1Id: null,
    team2Id: null,
    referee: 'A組3位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // C7: A組3位 vs B組4位
  matches.push({
    id: 'match_C7',
    round: 'exchange_league',
    roundName: '交流X組 (C7)',
    roundOrder: 3,
    matchNumber: 30,
    matchCode: 'C7',
    pool: 'X',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'A組3位',
    bracketSlotLabel2: 'B組4位',
    court: 3,
    slot: 7,
    team1Id: null,
    team2Id: null,
    referee: 'C/D/E組 2位(次点1)チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- 交流Y組 (Dコート・Court 4 / 3チーム総当たり・各2試合) ---
  // D5: B組3位 vs C/D/E組 2位(次点2)
  matches.push({
    id: 'match_D5',
    round: 'exchange_league',
    roundName: '交流Y組 (D5)',
    roundOrder: 2,
    matchNumber: 21,
    matchCode: 'D5',
    pool: 'Y',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'B組3位',
    bracketSlotLabel2: 'C/D/E組 2位(次点2)',
    court: 4,
    slot: 5,
    team1Id: null,
    team2Id: null,
    referee: 'A組4位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // D6: C/D/E組 2位(次点2) vs A組4位
  matches.push({
    id: 'match_D6',
    round: 'exchange_league',
    roundName: '交流Y組 (D6)',
    roundOrder: 3,
    matchNumber: 26,
    matchCode: 'D6',
    pool: 'Y',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'C/D/E組 2位(次点2)',
    bracketSlotLabel2: 'A組4位',
    court: 4,
    slot: 6,
    team1Id: null,
    team2Id: null,
    referee: 'B組3位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // D7: B組3位 vs A組4位
  matches.push({
    id: 'match_D7',
    round: 'exchange_league',
    roundName: '交流Y組 (D7)',
    roundOrder: 3,
    matchNumber: 31,
    matchCode: 'D7',
    pool: 'Y',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'B組3位',
    bracketSlotLabel2: 'A組4位',
    court: 4,
    slot: 7,
    team1Id: null,
    team2Id: null,
    referee: 'C/D/E組 2位(次点2)チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // --- 交流Z組 (Eコート・Court 5 / 3チーム総当たり・各2試合) ---
  // E5: C組3位 vs D組3位
  matches.push({
    id: 'match_E5',
    round: 'exchange_league',
    roundName: '交流Z組 (E5)',
    roundOrder: 2,
    matchNumber: 22,
    matchCode: 'E5',
    pool: 'Z',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'C組3位',
    bracketSlotLabel2: 'D組3位',
    court: 5,
    slot: 5,
    team1Id: null,
    team2Id: null,
    referee: 'E組3位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // E6: D組3位 vs E組3位
  matches.push({
    id: 'match_E6',
    round: 'exchange_league',
    roundName: '交流Z組 (E6)',
    roundOrder: 3,
    matchNumber: 27,
    matchCode: 'E6',
    pool: 'Z',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'D組3位',
    bracketSlotLabel2: 'E組3位',
    court: 5,
    slot: 6,
    team1Id: null,
    team2Id: null,
    referee: 'C組3位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // E7: C組3位 vs E組3位
  matches.push({
    id: 'match_E7',
    round: 'exchange_league',
    roundName: '交流Z組 (E7)',
    roundOrder: 3,
    matchNumber: 32,
    matchCode: 'E7',
    pool: 'Z',
    bracketGroup: 'exchange_league',
    bracketSlotLabel1: 'C組3位',
    bracketSlotLabel2: 'E組3位',
    court: 5,
    slot: 7,
    team1Id: null,
    team2Id: null,
    referee: 'D組3位チーム',
    sets: createEmptySets(bestOf),
    team1Sets: 0,
    team2Sets: 0,
    winnerId: null,
    status: 'pending',
    nextMatchId: null,
    nextSlot: null,
    loserToMatchId: null,
    loserToSlot: null,
  });

  // slot昇順・court昇順でmatchNumberを1〜31に整列
  matches.sort((a, b) => {
    const slotA = a.slot || 999;
    const slotB = b.slot || 999;
    if (slotA !== slotB) return slotA - slotB;
    return (a.court || 1) - (b.court || 1);
  });

  return matches.map((m, idx) => ({
    ...m,
    matchNumber: idx + 1,
  }));
}

/**
 * C・D・E組の2位チームの中で、得失点差（得点差・ポイント差）が最も良い最上位チームを抽出する。
 * 残りの2チームは次点1・次点2として下ブロック（左下）に配分する。
 */
export function findBestCDE2ndPlace(standings: Standing[]): {
  best: Standing | null;
  second: Standing | null;
  third: Standing | null;
} {
  const c2 = standings.find((s) => s.pool === 'C' && s.rank === 2);
  const d2 = standings.find((s) => s.pool === 'D' && s.rank === 2);
  const e2 = standings.find((s) => s.pool === 'E' && s.rank === 2);

  const candidates = [c2, d2, e2].filter((s): s is Standing => Boolean(s));

  candidates.sort((a, b) => {
    // 1) 得失点差（ポイント差）が大きい順 (ユーザー指定: 得失点の一番いいチーム)
    const diffA = a.pointDiff ?? (a.pointsFor - a.pointsAgainst);
    const diffB = b.pointDiff ?? (b.pointsFor - b.pointsAgainst);
    if (diffB !== diffA) return diffB - diffA;

    // 2) 勝利数が多い順
    if (b.win !== a.win) return b.win - a.win;

    // 3) セット率が高い順
    if (b.setRatio !== a.setRatio) return b.setRatio - a.setRatio;

    // 4) 総得点が多い順
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;

    // 5) プール名順 (C, D, E)
    return (a.pool || '').localeCompare(b.pool || '');
  });

  return {
    best: candidates[0] || null,
    second: candidates[1] || null,
    third: candidates[2] || null,
  };
}

/**
 * 予選リーグの順位（Standings）から公式トーナメント枠（A5, A6, B5, B6, A7, B7, C4, E4, D4, D5, E5）へ
 * 各チームを自動シード配分する
 */
export function seedOfficialTournament(
  matches: Match[],
  standings: Standing[]
): Match[] {
  // 各プールの順位マップを作成: pool -> rank (1..4) -> teamId
  const poolRanks = new Map<string, Map<number, string>>();
  for (const s of standings) {
    const p = s.pool || 'A';
    if (!poolRanks.has(p)) poolRanks.set(p, new Map());
    poolRanks.get(p)!.set(s.rank, s.teamId);
  }

  const getTeam = (pool: string, rank: number): string | null => {
    return poolRanks.get(pool)?.get(rank) || null;
  };

  const a1 = getTeam('A', 1);
  const a2 = getTeam('A', 2);
  const a3 = getTeam('A', 3);
  const a4 = getTeam('A', 4);

  const b1 = getTeam('B', 1);
  const b2 = getTeam('B', 2);
  const b3 = getTeam('B', 3);
  const b4 = getTeam('B', 4);

  const c1 = getTeam('C', 1);
  const c3 = getTeam('C', 3);

  const d1 = getTeam('D', 1);
  const d3 = getTeam('D', 3);

  const e1 = getTeam('E', 1);
  const e3 = getTeam('E', 3);

  const teamNameById = new Map<string, string>();
  for (const s of standings) {
    if (s.teamId && s.teamName) {
      teamNameById.set(s.teamId, s.teamName);
    }
  }

  // C/D/E組の2位のうち得失点最上位チーム（決勝トーナメント進出）と、次点2チーム（下ブロック左下進出）を判定
  const { best: bestCDE2nd, second: secondCDE2nd, third: thirdCDE2nd } = findBestCDE2ndPlace(standings);

  return matches.map((m) => {
    if (m.round === 'league') return m;

    const code = m.matchCode || m.id.replace('match_', '');

    switch (code) {
      // --- 上ブロック (決勝トーナメント: 8チーム) ---
      // A5: A組2位 vs D組1位
      case 'A5':
        return {
          ...m,
          team1Id: a2,
          team2Id: d1,
        };

      // B5: C組1位 vs B組2位
      case 'B5':
        return {
          ...m,
          team1Id: c1,
          team2Id: b2,
        };

      // A6: B組1位 vs E組1位
      case 'A6':
        return {
          ...m,
          team1Id: b1,
          team2Id: e1,
        };

      // B6: A組1位 vs C/D/E組2位最上位（得失点の一番いいチーム）
      case 'B6':
        return {
          ...m,
          team1Id: a1,
          team2Id: bestCDE2nd?.teamId || null,
        };

      // --- 下ブロック 交流X組 (Cコート: A3, 次点1, B4) ---
      case 'C5':
        return {
          ...m,
          team1Id: a3,
          team2Id: secondCDE2nd?.teamId || null,
          referee: b4 ? teamNameById.get(b4) || m.referee : m.referee,
        };

      case 'C6':
        return {
          ...m,
          team1Id: secondCDE2nd?.teamId || null,
          team2Id: b4,
          referee: a3 ? teamNameById.get(a3) || m.referee : m.referee,
        };

      case 'C7':
        return {
          ...m,
          team1Id: a3,
          team2Id: b4,
          referee: secondCDE2nd?.teamName || (secondCDE2nd?.teamId ? teamNameById.get(secondCDE2nd.teamId) : null) || m.referee,
        };

      // --- 下ブロック 交流Y組 (Dコート: B3, 次点2, A4) ---
      case 'D5':
        return {
          ...m,
          team1Id: b3,
          team2Id: thirdCDE2nd?.teamId || null,
          referee: a4 ? teamNameById.get(a4) || m.referee : m.referee,
        };

      case 'D6':
        return {
          ...m,
          team1Id: thirdCDE2nd?.teamId || null,
          team2Id: a4,
          referee: b3 ? teamNameById.get(b3) || m.referee : m.referee,
        };

      case 'D7':
        return {
          ...m,
          team1Id: b3,
          team2Id: a4,
          referee: thirdCDE2nd?.teamName || (thirdCDE2nd?.teamId ? teamNameById.get(thirdCDE2nd.teamId) : null) || m.referee,
        };

      // --- 下ブロック 交流Z組 (Eコート: C3, D3, E3) ---
      case 'E5':
        return {
          ...m,
          team1Id: c3,
          team2Id: d3,
          referee: e3 ? teamNameById.get(e3) || m.referee : m.referee,
        };

      case 'E6':
        return {
          ...m,
          team1Id: d3,
          team2Id: e3,
          referee: c3 ? teamNameById.get(c3) || m.referee : m.referee,
        };

      case 'E7':
        return {
          ...m,
          team1Id: c3,
          team2Id: e3,
          referee: d3 ? teamNameById.get(d3) || m.referee : m.referee,
        };

      default:
        return m;
    }
  });
}

/**
 * 決勝トーナメントの「◯◯ 敗者チーム」などの審判表記を、
 * 実際に該当試合が完了して敗者が確定した際に、自動でその敗者チーム名へと更新する。
 */
export function resolveTournamentReferees(matches: Match[], teams: Team[]): Match[] {
  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const matchMap = new Map<string, Match>();
  for (const m of matches) {
    const code = m.matchCode || m.id.replace('match_', '');
    matchMap.set(code, m);
    matchMap.set(m.id, m);
  }

  const getLoserName = (code: string): string | null => {
    const match = matchMap.get(code);
    if (!match || match.status !== 'completed' || !match.winnerId || !match.team1Id || !match.team2Id) {
      return null;
    }
    const loserId = match.winnerId === match.team1Id ? match.team2Id : match.team1Id;
    const team = teamMap.get(loserId);
    return team ? `${team.name} (${code}敗者)` : null;
  };

  const refereeDependencies: Record<string, string> = {
    A6: 'A5',
    B6: 'B5',
    A7: 'A6',
    B7: 'B6',
    C8: 'A5',
    D8: 'B5',
  };

  return matches.map((m) => {
    const code = m.matchCode || m.id.replace('match_', '');
    const depCode = refereeDependencies[code];
    if (depCode) {
      const loserName = getLoserName(depCode);
      if (loserName) {
        return {
          ...m,
          referee: loserName,
        };
      }
    }
    return m;
  });
}

/**
 * 公式大会の【案A】構造（計36試合：予選17＋決勝トーナメント10＋交流リーグ9、全17チーム4〜5試合保証）を検証・修復・最新化する。
 * Firestoreやローカルストレージに古い構成（30, 31, 32試合等）が残っている場合、
 * 既存の途中スコアや結果をすべて保持したまま最新の公式案A構成へ自動アップグレードする。
 */
export function ensureOfficialTournamentIntegrity(state: AppState): {
  state: AppState;
  upgraded: boolean;
} {
  if (!state || !Array.isArray(state.matches) || !Array.isArray(state.teams)) {
    return { state, upgraded: false };
  }

  // 公式大会判定
  const isOfficial =
    state.matches.some((m) => m.matchCode === 'A5' || m.id === 'match_A5') ||
    state.teams.some(
      (t) =>
        t.name &&
        (t.name.includes('遠目翼爆誕') ||
          t.name.includes('PEC VOLTAGE') ||
          t.name.includes('イナズマイレブン'))
    );

  if (!isOfficial) {
    return { state, upgraded: false };
  }

  const hasB7 = state.matches.some((m) => m.matchCode === 'B7' || m.id === 'match_B7');
  const hasB8 = state.matches.some((m) => m.matchCode === 'B8' || m.id === 'match_B8');
  const hasC8 = state.matches.some((m) => m.matchCode === 'C8' || m.id === 'match_C8');
  const hasD8 = state.matches.some((m) => m.matchCode === 'D8' || m.id === 'match_D8');
  const hasExchangeZ = state.matches.some((m) => m.matchCode === 'E7' || m.id === 'match_E7');
  const is36Matches = state.matches.length === 36;

  if (hasB7 && hasB8 && hasC8 && hasD8 && hasExchangeZ && is36Matches) {
    return { state, upgraded: false };
  }

  // カノニカルな36試合を生成
  const canonicalMatches = createOfficialTournamentMatches(state.teams, state.settings);

  // 既存試合からスコア・勝者・ステータスを引き継ぐ
  const oldMatchMap = new Map<string, Match>();
  for (const m of state.matches) {
    oldMatchMap.set(m.id, m);
    if (m.matchCode) oldMatchMap.set(m.matchCode, m);
  }

  const mergedMatches = canonicalMatches.map((cm) => {
    const old =
      oldMatchMap.get(cm.id) || (cm.matchCode ? oldMatchMap.get(cm.matchCode) : undefined);
    if (!old) return cm;

    const hasSets =
      Array.isArray(old.sets) && old.sets.some((s) => s.team1 !== null || s.team2 !== null);
    if (hasSets || old.status === 'completed') {
      return {
        ...cm,
        sets: old.sets || cm.sets,
        team1Sets: old.team1Sets ?? cm.team1Sets,
        team2Sets: old.team2Sets ?? cm.team2Sets,
        winnerId: old.winnerId ?? cm.winnerId,
        status: old.status ?? cm.status,
      };
    }
    return cm;
  });

  // 予選順位の計算とシード反映
  const standings = computeLeagueStandings(state.teams, mergedMatches, state.settings);
  const seededMatches = seedOfficialTournament(mergedMatches, standings);

  // 決勝トーナメントで既に完了している試合の勝者伝播
  let finalMatches = seededMatches;
  for (const m of seededMatches) {
    if (m.round !== 'league' && m.status === 'completed' && m.winnerId) {
      finalMatches = advanceWinner(finalMatches, m, state.settings);
    }
  }

  finalMatches = resolveTournamentReferees(finalMatches, state.teams);

  return {
    state: {
      ...state,
      settings: {
        ...state.settings,
        finalistsCount: 8,
      },
      matches: finalMatches,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Auto-Upgrade (Plan A: 36 Matches)',
    },
    upgraded: true,
  };
}
