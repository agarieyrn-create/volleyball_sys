import React, { useState } from 'react';
import { getCourtName } from '../logic/court';
import { Match, SetScore, Team } from '../types';

interface ManualMatchEditModalProps {
  isOpen: boolean;
  match: Match | null;
  teams: Team[];
  onClose: () => void;
  onSave: (matchId: string, updates: Partial<Match>) => void;
  onDelete?: (matchId: string) => void;
}

export const ManualMatchEditModal: React.FC<ManualMatchEditModalProps> = ({
  isOpen,
  match,
  teams,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !match) return null;

  const [team1Id, setTeam1Id] = useState<string>(match.team1Id || '');
  const [team2Id, setTeam2Id] = useState<string>(match.team2Id || '');
  const [court, setCourt] = useState<number>(match.court || 1);
  const [slot, setSlot] = useState<number>(match.slot || 1);
  const [matchNumber, setMatchNumber] = useState<number>(match.matchNumber || 1);
  const [roundName, setRoundName] = useState<string>(match.roundName || '');
  const [referee, setReferee] = useState<string>(match.referee || '');
  const [status, setStatus] = useState<'pending' | 'completed'>(match.status === 'completed' ? 'completed' : 'pending');
  const [winnerChoice, setWinnerChoice] = useState<'auto' | 'team1' | 'team2' | 'none'>(
    match.winnerId === match.team1Id && match.team1Id ? 'team1' :
    match.winnerId === match.team2Id && match.team2Id ? 'team2' :
    match.winnerId ? 'auto' : 'none'
  );

  // セットスコア
  const setsCount = Math.max(3, match.sets.length);
  const [sets, setSets] = useState<{ team1: string; team2: string }[]>(() => {
    const arr = [];
    for (let i = 0; i < setsCount; i++) {
      const s = match.sets[i];
      arr.push({
        team1: s && s.team1 !== null ? String(s.team1) : '',
        team2: s && s.team2 !== null ? String(s.team2) : '',
      });
    }
    return arr;
  });

  const handleSetChange = (setIdx: number, field: 'team1' | 'team2', value: string) => {
    setSets((prev) => {
      const next = [...prev];
      next[setIdx] = { ...next[setIdx], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    const parsedSets: SetScore[] = sets.map((s) => ({
      team1: s.team1.trim() === '' ? null : Number(s.team1),
      team2: s.team2.trim() === '' ? null : Number(s.team2),
    }));

    // 勝者の判定
    let resolvedWinnerId: string | null = null;
    if (winnerChoice === 'team1') {
      resolvedWinnerId = team1Id || null;
    } else if (winnerChoice === 'team2') {
      resolvedWinnerId = team2Id || null;
    } else if (winnerChoice === 'none') {
      resolvedWinnerId = null;
    }

    onSave(match.id, {
      team1Id: team1Id || null,
      team2Id: team2Id || null,
      court,
      slot,
      matchNumber,
      roundName,
      referee,
      status,
      sets: parsedSets,
      ...(winnerChoice !== 'auto' ? { winnerId: resolvedWinnerId } : {}),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-black text-xs">
                🛠️ 緊急手動修正
              </span>
              <h3 className="font-black text-base text-zinc-950 dark:text-white">
                試合データの直接手入力編集
              </h3>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 font-medium">
              エラーや変則進行時も、全項目を上書き変更して大会を止めずに進行できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 試合基本情報 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              コート
            </label>
            <select
              value={court}
              onChange={(e) => setCourt(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>
                  {getCourtName(c)} (第{c}コート)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              進行枠（第何試合）
            </label>
            <input
              type="number"
              min={1}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              試合番号 (通し#)
            </label>
            <input
              type="number"
              min={1}
              value={matchNumber}
              onChange={(e) => setMatchNumber(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* ラウンド名 */}
        <div>
          <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
            ラウンド表示名
          </label>
          <input
            type="text"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            placeholder="例: 予選リーグ A、準決勝 第1試合、順位決定戦 など"
            className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* 対戦カード指定 */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 space-y-3">
          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            対戦チームの直接変更
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">チーム1 (左 / 上)</label>
              <select
                value={team1Id}
                onChange={(e) => setTeam1Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-indigo-700 dark:text-indigo-300"
              >
                <option value="">-- 未定 (TBD) --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.pool ? `(グループ${t.pool})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">チーム2 (右 / 下)</label>
              <select
                value={team2Id}
                onChange={(e) => setTeam2Id(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-amber-750 dark:text-amber-300"
              >
                <option value="">-- 未定 (TBD) --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.pool ? `(グループ${t.pool})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* セットスコアの手入力 */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-300 dark:border-zinc-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              各セットスコアの直接数値編集
            </span>
            <span className="text-[11px] text-zinc-650 dark:text-zinc-350 font-bold">空欄＝未消化</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            {sets.map((s, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700">
                <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  第{idx + 1}セット
                </div>
                <div className="flex items-center justify-center gap-1.5 font-mono">
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={s.team1}
                    onChange={(e) => handleSetChange(idx, 'team1', e.target.value)}
                    className="w-11 sm:w-12 text-center py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-zinc-500 font-bold">:</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={s.team2}
                    onChange={(e) => handleSetChange(idx, 'team2', e.target.value)}
                    className="w-11 sm:w-12 text-center py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 状態・勝者・審判 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              試合ステータス
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100"
            >
              <option value="pending">未試合 / 進行中</option>
              <option value="completed">試合終了 (確定)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              勝者の指定
            </label>
            <select
              value={winnerChoice}
              onChange={(e) => setWinnerChoice(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100"
            >
              <option value="auto">スコアから自動算出</option>
              <option value="team1">チーム1の勝利 (強制)</option>
              <option value="team2">チーム2の勝利 (強制)</option>
              <option value="none">勝者なし (引き分け/未定)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              審判担当チーム名
            </label>
            <input
              type="text"
              value={referee}
              onChange={(e) => setReferee(e.target.value)}
              placeholder="例: 人事総務部"
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('この試合を対戦表から削除しますか？')) {
                  onDelete(match.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
            >
              🗑️ 試合を削除
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              変更を適用・保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
