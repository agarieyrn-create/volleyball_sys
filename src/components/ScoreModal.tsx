import React, { useEffect, useState } from 'react';
import { isSetFinished } from '../logic/score';
import { Match, SetScore, Settings, Team } from '../types';

interface ScoreModalProps {
  isOpen: boolean;
  match: Match | null;
  teams: Team[];
  settings: Settings;
  onClose: () => void;
  onSave: (matchId: string, sets: SetScore[]) => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  isOpen,
  match,
  teams,
  settings,
  onClose,
  onSave,
}) => {
  const [sets, setSets] = useState<SetScore[]>([]);
  const [showConfirmReEdit, setShowConfirmReEdit] = useState<boolean>(false);

  useEffect(() => {
    if (match) {
      const bestOf = settings.bestOf || 3;
      const initialSets = Array.from({ length: bestOf }, (_, i) => {
        const existing = match.sets[i];
        return {
          team1: existing && existing.team1 !== null ? existing.team1 : null,
          team2: existing && existing.team2 !== null ? existing.team2 : null,
        };
      });
      setSets(initialSets);
      setShowConfirmReEdit(false);
    }
  }, [match, settings.bestOf]);

  if (!isOpen || !match) return null;

  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));
  const t1Name = match.team1Id ? teamMap.get(match.team1Id)?.name || 'チーム1' : '未定';
  const t2Name = match.team2Id ? teamMap.get(match.team2Id)?.name || 'チーム2' : '未定';

  const handleScoreChange = (
    index: number,
    teamKey: 'team1' | 'team2',
    valueStr: string
  ) => {
    const val = valueStr === '' ? null : parseInt(valueStr, 10);
    const num = val === null || isNaN(val) ? null : Math.max(0, val);

    setSets((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [teamKey]: num,
      };
      return copy;
    });
  };

  const handleQuickWin = (index: number, winner: 1 | 2) => {
    const target = index >= 2 ? settings.set3Points : settings.set12Points;
    setSets((prev) => {
      const copy = [...prev];
      copy[index] = {
        team1: winner === 1 ? target : Math.max(0, target - 5),
        team2: winner === 2 ? target : Math.max(0, target - 5),
      };
      return copy;
    });
  };

  const handleClearSet = (index: number) => {
    setSets((prev) => {
      const copy = [...prev];
      copy[index] = { team1: null, team2: null };
      return copy;
    });
  };

  const executeSave = () => {
    onSave(match.id, sets);
    onClose();
  };

  const handleSaveClick = () => {
    // 完了済み試合の再編集時は確認ダイアログ
    if (match.status === 'completed') {
      setShowConfirmReEdit(true);
    } else {
      executeSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="score-input-modal"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
          <div>
            <h3 className="font-black text-lg text-zinc-950 dark:text-zinc-50">スコア入力</h3>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mt-0.5">
              {match.roundName} (第{match.matchNumber}試合)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white p-2 rounded-lg text-base font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 対戦チームヘッダー */}
        <div className="px-5 py-3.5 bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-between text-xs sm:text-sm font-black border-b border-zinc-200 dark:border-zinc-700 gap-2">
          <div className="flex-1 text-center break-words leading-tight px-1 text-zinc-950 dark:text-zinc-50 font-black" title={t1Name}>
            {t1Name}
          </div>
          <div className="text-zinc-500 dark:text-zinc-400 text-xs px-1 font-black font-mono shrink-0">VS</div>
          <div className="flex-1 text-center break-words leading-tight px-1 text-zinc-950 dark:text-zinc-50 font-black" title={t2Name}>
            {t2Name}
          </div>
        </div>

        {/* 再編集警告ダイアログ */}
        {showConfirmReEdit && (
          <div className="p-4 m-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-950 dark:text-amber-100 text-sm">
            <p className="font-black">⚠️ 完了済み試合のスコア再編集</p>
            <p className="text-xs mt-1 text-amber-900 dark:text-amber-200 font-medium">
              この試合のスコアを変更すると、予選順位やトーナメント進出チーム、および以降の対戦カードが連鎖して再計算されます。上書き保存してよろしいですか？
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmReEdit(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-3 py-1.5 text-xs font-black rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
              >
                再計算して保存
              </button>
            </div>
          </div>
        )}

        {/* セットスコア入力欄 */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {sets.map((set, idx) => {
            const target = idx >= 2 ? settings.set3Points : settings.set12Points;
            const margin = settings.deuceMargin;
            const isFinished = isSetFinished(set.team1, set.team2, target, margin);

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-zinc-950 dark:text-zinc-50">
                    第{idx + 1}セット
                    <span className="ml-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                      ({target}点先取 / {margin}点差)
                    </span>
                  </span>
                  {isFinished && (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                      セット成立
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-2 items-center">
                  <div className="col-span-3">
                    <input
                      id={`set-${idx}-team1`}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={set.team1 === null ? '' : set.team1}
                      onChange={(e) => handleScoreChange(idx, 'team1', e.target.value)}
                      className="w-full text-center text-xl font-mono font-black py-2.5 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-1 text-center text-zinc-600 dark:text-zinc-400 font-black text-lg">-</div>

                  <div className="col-span-3">
                    <input
                      id={`set-${idx}-team2`}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={set.team2 === null ? '' : set.team2}
                      onChange={(e) => handleScoreChange(idx, 'team2', e.target.value)}
                      className="w-full text-center text-xl font-mono font-black py-2.5 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* クイック入力補助 */}
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickWin(idx, 1)}
                      className="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold cursor-pointer"
                    >
                      {t1Name.slice(0, 5)}勝利
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickWin(idx, 2)}
                      className="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold cursor-pointer"
                    >
                      {t2Name.slice(0, 5)}勝利
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClearSet(idx)}
                    className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    クリア
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer"
          >
            キャンセル
          </button>
          <button
            id="save-match-score-btn"
            type="button"
            onClick={handleSaveClick}
            className="px-6 py-2 text-xs font-black rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
};
